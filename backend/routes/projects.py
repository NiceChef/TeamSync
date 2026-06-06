from datetime import date, datetime

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import or_ as db_or

from access import is_internal, require_approved_user
from models import db, Group, Organization, Project, User
from project_access import (
    can_manage_project,
    project_has_full_access,
    project_visible_condition,
    visible_project_tasks,
)
from routes import api
from routes.helpers import _user_can_use_group


def _default_project_start():
    today = date.today()

    return datetime.combine(
        today,
        datetime.min.time(),
    ).replace(hour=7, minute=0)


def _default_project_deadline():
    today = date.today()

    return datetime.combine(
        today,
        datetime.min.time(),
    ).replace(hour=16, minute=0)


def _parse_project_datetime(value, field_name):
    if value in (None, ''):
        return None, None

    raw_value = str(value).strip()

    try:
        if 'T' in raw_value:
            parsed = datetime.fromisoformat(
                raw_value.replace('Z', '+00:00')
            )

            if parsed.tzinfo is not None:
                parsed = parsed.replace(tzinfo=None)

            return parsed, None

        parsed_date = date.fromisoformat(raw_value)
        fallback_hour = 16 if field_name == 'deadline' else 7

        return datetime.combine(
            parsed_date,
            datetime.min.time(),
        ).replace(hour=fallback_hour), None
    except (ValueError, TypeError):
        return None, (
            jsonify({
                'error': (
                    f'Invalid {field_name} format. '
                    'Use YYYY-MM-DD or YYYY-MM-DDTHH:MM format.'
                ),
            }),
            400,
        )


def _parse_id_list(value, field_name):
    if value in (None, ''):
        return [], None

    if not isinstance(value, list):
        return None, (
            jsonify({'error': f'{field_name} must be a list'}),
            400,
        )

    result = []

    try:
        for raw_id in value:
            parsed_id = int(raw_id)

            if parsed_id not in result:
                result.append(parsed_id)
    except (ValueError, TypeError):
        return None, (
            jsonify({'error': f'{field_name} must contain integer IDs'}),
            400,
        )

    return result, None


def _resolve_project_assignments(actor, data, owner_organization_id):
    member_ids, members_error = _parse_id_list(
        data.get('member_ids', []),
        'member_ids',
    )

    if members_error:
        return None, members_error

    group_ids, groups_error = _parse_id_list(
        data.get('assigned_group_ids', []),
        'assigned_group_ids',
    )

    if groups_error:
        return None, groups_error

    organization_ids, organizations_error = _parse_id_list(
        data.get('assigned_organization_ids', []),
        'assigned_organization_ids',
    )

    if organizations_error:
        return None, organizations_error

    members = (
        User.query.filter(User.id.in_(member_ids)).all()
        if member_ids
        else []
    )

    groups = (
        Group.query.filter(Group.id.in_(group_ids)).all()
        if group_ids
        else []
    )

    organizations = (
        Organization.query
        .filter(Organization.id.in_(organization_ids))
        .all()
        if organization_ids
        else []
    )

    if len(members) != len(member_ids):
        return None, (
            jsonify({'error': 'One or more project members do not exist'}),
            400,
        )

    if len(groups) != len(group_ids):
        return None, (
            jsonify({'error': 'One or more project groups do not exist'}),
            400,
        )

    if len(organizations) != len(organization_ids):
        return None, (
            jsonify({'error': 'One or more organizations do not exist'}),
            400,
        )

    if not is_internal(actor):
        for member in members:
            if member.organization_id != actor.organization_id:
                return None, (
                    jsonify({
                        'error': 'You cannot assign users from another organization',
                    }),
                    403,
                )

        for group in groups:
            if group.organization_id != actor.organization_id:
                return None, (
                    jsonify({
                        'error': 'You cannot assign groups from another organization',
                    }),
                    403,
                )

        for organization in organizations:
            if organization.id != actor.organization_id:
                return None, (
                    jsonify({
                        'error': 'You cannot assign another organization',
                    }),
                    403,
                )

    selected_organization_ids = {
        organization.id
        for organization in organizations
    }

    # Organizacja zastępuje należące do niej działy.
    groups = [
        group
        for group in groups
        if group.organization_id not in selected_organization_ids
    ]

    selected_group_member_ids = {
        member.id
        for group in groups
        for member in group.members or []
    }

    # Organizacja i dział zastępują ręczne przypisania użytkowników.
    members = [
        member
        for member in members
        if member.organization_id not in selected_organization_ids
        and member.id not in selected_group_member_ids
    ]

    return {
        'members': members,
        'groups': groups,
        'organizations': organizations,
        'owner_organization_id': owner_organization_id,
    }, None


def _sync_project_assignments(project, assignments, actor):
    members = list(assignments['members'])

    if actor not in members:
        members.append(actor)

    project.members = members
    project.assigned_groups = assignments['groups']
    project.assigned_organizations = assignments['organizations']

def _project_payload(project, user, include_tasks=False):
    """
    Buduje odpowiedź projektu zgodnie z poziomem dostępu.

    Pełny dostęp:
    - wszystkie zadania projektu,
    - członkowie,
    - organizacje,
    - możliwość zarządzania zgodnie z uprawnieniami.

    Dostęp częściowy przez przypisane zadanie:
    - podstawowe informacje projektu,
    - wyłącznie widoczne zadania,
    - bez członków i przypisanych organizacji.
    """
    full_access = project_has_full_access(project, user)
    visible_tasks = visible_project_tasks(project, user)

    payload = project.to_dict(
        include_members=full_access,
        include_tasks=include_tasks,
        tasks_override=visible_tasks,
    )

    payload['has_full_access'] = full_access
    payload['can_manage'] = can_manage_project(project, user)
    payload['partial_access'] = (
        not full_access
        and bool(visible_tasks)
    )

    if not full_access:
        payload.pop('member_ids', None)
        payload.pop('members', None)
        payload.pop('effective_members', None)

        payload.pop('assigned_group_ids', None)
        payload.pop('assigned_groups', None)

        payload.pop('assigned_organization_ids', None)
        payload.pop('assigned_organizations', None)

        payload['member_count'] = None
        payload['effective_member_count'] = None

    return payload


@api.route('/projects', methods=['GET'])
@require_approved_user
def list_projects():
    me = User.query.get_or_404(int(get_jwt_identity()))

    query = Project.query.filter(
        project_visible_condition(me)
    )

    status = (request.args.get('status') or '').strip()

    if status in ('active', 'archived', 'draft'):
        query = query.filter(Project.status == status)

    search = (request.args.get('q') or '').strip()

    if search:
        pattern = f'%{search}%'

        query = query.filter(
            db_or(
                Project.name.ilike(pattern),
                Project.description.ilike(pattern),
            )
        )

    projects = (
        query
        .order_by(Project.created_at.desc())
        .limit(300)
        .all()
    )

    return jsonify([
        _project_payload(project, me)
        for project in projects
    ]), 200


@api.route('/projects', methods=['POST'])
@require_approved_user
def create_project():
    me = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()

    if not name:
        return jsonify({'error': 'name is required'}), 400

    status = data.get('status') or 'draft'

    if status not in ('active', 'archived', 'draft'):
        status = 'draft'

    organization_id = me.organization_id

    if is_internal(me) and data.get('organization_id') not in (None, ''):
        organization_id = int(data['organization_id'])

    group_id = data.get('group_id')

    if group_id not in (None, ''):
        group = Group.query.get(int(group_id))

        if not _user_can_use_group(me, group):
            return jsonify({'error': 'Invalid group'}), 400

        group_id = group.id

        if group.organization_id is not None:
            organization_id = group.organization_id
    else:
        group_id = None

    planned_start, planned_start_error = _parse_project_datetime(
        data.get('planned_start'),
        'planned_start',
    )

    if planned_start_error:
        return planned_start_error

    deadline, deadline_error = _parse_project_datetime(
        data.get('deadline'),
        'deadline',
    )

    if deadline_error:
        return deadline_error

    planned_start = planned_start or _default_project_start()
    deadline = deadline or _default_project_deadline()

    if deadline < planned_start:
        return jsonify({
            'error': 'Project deadline cannot be earlier than planned start',
        }), 400

    assignments, assignments_error = _resolve_project_assignments(
        me,
        data,
        organization_id,
    )

    if assignments_error:
        return assignments_error

    project = Project(
        name=name,
        description=(data.get('description') or '').strip() or None,
        status=status,
        organization_id=organization_id,
        group_id=group_id,
        created_by_id=me.id,
        planned_start=planned_start,
        deadline=deadline,
    )

    db.session.add(project)
    db.session.flush()

    _sync_project_assignments(project, assignments, me)

    db.session.commit()

    return jsonify(
        _project_payload(project, me, include_tasks=True)
    ), 201


@api.route('/projects/<int:pid>', methods=['GET'])
@require_approved_user
def get_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))

    project = Project.query.filter(
        Project.id == pid,
        project_visible_condition(me),
    ).first_or_404()

    return jsonify(
        _project_payload(project, me, include_tasks=True)
    ), 200


@api.route('/projects/<int:pid>', methods=['PUT'])
@require_approved_user
def update_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    project = Project.query.get_or_404(pid)

    if not can_manage_project(project, me):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()

        if not name:
            return jsonify({'error': 'name is required'}), 400

        project.name = name

    if 'description' in data:
        project.description = (
            data.get('description') or ''
        ).strip() or None

    if data.get('status') in ('active', 'archived', 'draft'):
        project.status = data['status']

    if 'planned_start' in data:
        planned_start, error = _parse_project_datetime(
            data.get('planned_start'),
            'planned_start',
        )

        if error:
            return error

        project.planned_start = planned_start

    if 'deadline' in data:
        deadline, error = _parse_project_datetime(
            data.get('deadline'),
            'deadline',
        )

        if error:
            return error

        project.deadline = deadline

    if (
        project.planned_start
        and project.deadline
        and project.deadline < project.planned_start
    ):
        return jsonify({
            'error': 'Project deadline cannot be earlier than planned start',
        }), 400

    if 'group_id' in data:
        group_id = data.get('group_id')

        if group_id in (None, ''):
            project.group_id = None
        else:
            group = Group.query.get(int(group_id))

            if not _user_can_use_group(me, group):
                return jsonify({'error': 'Invalid group'}), 400

            project.group_id = group.id

        assignment_fields_present = (
        'member_ids' in data
        or 'assigned_group_ids' in data
        or 'assigned_organization_ids' in data
    )

    if assignment_fields_present:
        assignment_payload = {
            'member_ids': (
                data.get('member_ids')
                if 'member_ids' in data
                else [
                    member.id
                    for member in project.members
                ]
            ),
            'assigned_group_ids': (
                data.get('assigned_group_ids')
                if 'assigned_group_ids' in data
                else [
                    group.id
                    for group in project.assigned_groups
                ]
            ),
            'assigned_organization_ids': (
                data.get('assigned_organization_ids')
                if 'assigned_organization_ids' in data
                else [
                    organization.id
                    for organization in project.assigned_organizations
                ]
            ),
        }

        assignments, error = _resolve_project_assignments(
            me,
            assignment_payload,
            project.organization_id,
        )

        if error:
            return error

        _sync_project_assignments(project, assignments, me)
        
    db.session.commit()

    return jsonify(
        _project_payload(project, me, include_tasks=True)
    ), 200


@api.route('/projects/<int:pid>', methods=['DELETE'])
@require_approved_user
def delete_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    project = Project.query.get_or_404(pid)

    if not can_manage_project(project, me):
        return jsonify({'error': 'Forbidden'}), 403

    for task in list(project.tasks or []):
        task.project_id = None

    db.session.delete(project)
    db.session.commit()

    return jsonify({'message': 'Project deleted'}), 200

@api.route('/projects/<int:pid>/members', methods=['POST'])
@require_approved_user
def add_project_member(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    project = Project.query.get_or_404(pid)

    if not can_manage_project(project, me):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    user_id = data.get('user_id')

    if user_id is None:
        return jsonify({'error': 'user_id required'}), 400

    user = User.query.get(int(user_id))

    if not user:
        return jsonify({'error': 'User not found'}), 404

    if (
        not is_internal(me)
        and user.organization_id != me.organization_id
    ):
        return jsonify({'error': 'Forbidden'}), 403

    covered_by_organization = any(
        organization.id == user.organization_id
        for organization in project.assigned_organizations or []
    )

    covered_by_group = any(
        member.id == user.id
        for group in project.assigned_groups or []
        for member in group.members or []
    )

    if (
        not covered_by_organization
        and not covered_by_group
        and user not in project.members
    ):
        project.members.append(user)

    db.session.commit()

    return jsonify(
        _project_payload(project, me, include_tasks=True)
    ), 200

@api.route('/projects/<int:pid>/members/<int:uid>', methods=['DELETE'])
@require_approved_user
def remove_project_member(pid, uid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    project = Project.query.get_or_404(pid)

    if not can_manage_project(project, me):
        return jsonify({'error': 'Forbidden'}), 403

    user = User.query.get_or_404(uid)

    if user.id == project.created_by_id:
        return jsonify({
            'error': 'Project creator cannot be removed',
        }), 400

    if user in project.members:
        project.members.remove(user)

    db.session.commit()

    return jsonify(
        _project_payload(project, me, include_tasks=True)
    ), 200