from flask import request, jsonify
from datetime import datetime, date
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or
from access import is_internal, require_approved_user
from models import db, Project, Group, User
from routes import api
from routes.helpers import (
    _org_match,
    _project_visible,
    _can_manage_project,
    _user_can_use_group,
)

def _default_project_start():
    today = date.today()
    return datetime.combine(today, datetime.min.time()).replace(hour=7, minute=0)


def _default_project_deadline():
    today = date.today()
    return datetime.combine(today, datetime.min.time()).replace(hour=16, minute=0)


def _parse_project_datetime(value, field_name):
    if value in (None, ''):
        return None, None

    raw_value = str(value).strip()

    try:
        if 'T' in raw_value:
            parsed = datetime.fromisoformat(raw_value.replace('Z', '+00:00'))

            if parsed.tzinfo is not None:
                parsed = parsed.replace(tzinfo=None)

            return parsed, None

        parsed_date = date.fromisoformat(raw_value)
        fallback_hour = 16 if field_name == 'deadline' else 7
        return datetime.combine(parsed_date, datetime.min.time()).replace(hour=fallback_hour), None
    except (ValueError, TypeError):
        return None, jsonify({
            'error': f'Invalid {field_name} format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM format.'
        }), 400

@api.route('/projects', methods=['GET'])
@require_approved_user
def list_projects():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = Project.query

    if not is_internal(me):
        q = q.filter(Project.organization_id == me.organization_id)

    status = (request.args.get('status') or '').strip()
    if status in ('active', 'archived', 'draft'):
        q = q.filter(Project.status == status)

    sq = (request.args.get('q') or '').strip()
    if sq:
        pat = f'%{sq}%'
        q = q.filter(db_or(Project.name.ilike(pat), Project.description.ilike(pat)))

    projects = q.order_by(Project.created_at.desc()).limit(300).all()
    return jsonify([p.to_dict() for p in projects if _project_visible(me, p)]), 200


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

    group_id = data.get('group_id')
    organization_id = me.organization_id

    if is_internal(me) and data.get('organization_id') is not None:
        organization_id = int(data.get('organization_id'))

    if group_id is not None:
        g = Group.query.get(int(group_id))
        if not _user_can_use_group(me, g):
            return jsonify({'error': 'Invalid group'}), 400
        group_id = int(group_id)
        organization_id = g.organization_id

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

    if planned_start is None:
        planned_start = _default_project_start()

    if deadline is None:
        deadline = _default_project_deadline()

    if deadline < planned_start:
        return jsonify({'error': 'Project deadline cannot be earlier than planned start'}), 400
    p = Project(
        name=name,
        description=(data.get('description') or '').strip() or None,
        status=status,
        organization_id=organization_id,
        group_id=group_id,
        created_by_id=me.id,
        planned_start=planned_start,
        deadline=deadline,
    )
    db.session.add(p)
    db.session.flush()

    if me not in p.members:
        p.members.append(me)

    db.session.commit()
    return jsonify(p.to_dict(include_members=True)), 201

@api.route('/projects/<int:pid>', methods=['GET'])
@require_approved_user
def get_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if not _project_visible(me, p):
        return jsonify({'error': 'Not found'}), 404
    return jsonify(p.to_dict(include_members=True, include_tasks=True)), 200


@api.route('/projects/<int:pid>', methods=['PUT'])
@require_approved_user
def update_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if not _can_manage_project(me, p):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'name is required'}), 400
        p.name = name
    if 'description' in data:
        p.description = (data.get('description') or '').strip() or None
    if 'status' in data and data['status'] in ('active', 'archived', 'draft'):
        p.status = data['status']
    if 'planned_start' in data:
        planned_start, planned_start_error = _parse_project_datetime(
            data.get('planned_start'),
            'planned_start',
        )
        if planned_start_error:
            return planned_start_error
        p.planned_start = planned_start

    if 'deadline' in data:
        deadline, deadline_error = _parse_project_datetime(
            data.get('deadline'),
            'deadline',
        )
        if deadline_error:
            return deadline_error
        p.deadline = deadline

    if p.planned_start and p.deadline and p.deadline < p.planned_start:
        return jsonify({'error': 'Project deadline cannot be earlier than planned start'}), 400    
    if 'group_id' in data:
        gid = data['group_id']
        if gid is None:
            p.group_id = None
        else:
            g = Group.query.get(int(gid))
            if not _user_can_use_group(me, g):
                return jsonify({'error': 'Invalid group'}), 400
            p.group_id = g.id
    db.session.commit()
    return jsonify(p.to_dict(include_members=True)), 200


@api.route('/projects/<int:pid>', methods=['DELETE'])
@require_approved_user
def delete_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if me.id != p.created_by_id:
        return jsonify({'error': 'Only the project owner can delete this project'}), 403
    for t in list(p.tasks):
        t.project_id = None
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Project deleted'}), 200


@api.route('/projects/<int:pid>/members', methods=['POST'])
@require_approved_user
def add_project_member(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if not _can_manage_project(me, p):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    uid = data.get('user_id')
    if uid is None:
        return jsonify({'error': 'user_id required'}), 400
    u = User.query.get(int(uid))
    if not u or not _org_match(u.organization_id, p.organization_id):
        return jsonify({'error': 'User not in same organization'}), 400
    if u not in p.members:
        p.members.append(u)
    db.session.commit()
    return jsonify(p.to_dict(include_members=True)), 200


@api.route('/projects/<int:pid>/members/<int:uid>', methods=['DELETE'])
@require_approved_user
def remove_project_member(pid, uid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if not _can_manage_project(me, p):
        return jsonify({'error': 'Forbidden'}), 403
    u = User.query.get_or_404(uid)
    if u in p.members:
        p.members.remove(u)
    db.session.commit()
    return jsonify({'message': 'Member removed'}), 200
