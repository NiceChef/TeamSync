import json
from datetime import datetime, date
from access import is_internal, require_approved_user
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or
from project_access import project_has_full_access

from models import (
    db,
    Task,
    TaskRelation,
    Category,
    task_categories,
    User,
    TaskStatus,
    TaskActivity,
    Group,
    Project,
    CalendarEvent,
    Organization,
)
from task_access import visible_tasks_condition, task_visible, can_edit_task, can_delete_task
from routes import api
from routes.helpers import (
    _valid_assignee,
    _user_can_use_group,
    _user_can_use_project,
    _default_todo_status,
    _apply_completed_bool,
    _notify,
    _bulk_soonest_action,
    _parse_import_dt,
)

# ========== TASKS ENDPOINTS ==========

def _direct_open_subtasks(task):
    relations = TaskRelation.query.filter_by(source_task_id=task.id).all()
    if not relations:
        return []

    child_ids = [rel.target_task_id for rel in relations]
    if not child_ids:
        return []

    return Task.query.filter(
        Task.id.in_(child_ids),
        Task.completed.is_(False),
    ).all()


def _close_subtasks_recursively(task, actor):
    done = TaskStatus.query.filter_by(code='done').first()
    closed = []
    visited = set()

    def walk(parent):
        if parent.id in visited:
            return
        visited.add(parent.id)

        relations = TaskRelation.query.filter_by(source_task_id=parent.id).all()
        child_ids = [rel.target_task_id for rel in relations]

        if not child_ids:
            return

        children = Task.query.filter(Task.id.in_(child_ids)).all()

        for child in children:
            if not child.completed:
                if done:
                    child.status_id = done.id
                child.completed = True
                child.version = int(child.version or 1) + 1
                closed.append(child)

                db.session.add(
                    TaskActivity(
                        task_id=child.id,
                        user_id=actor.id,
                        action='task_closed_by_parent',
                        detail_json=json.dumps({'parent_task_id': task.id}),
                    )
                )

            walk(child)

    walk(task)
    return closed

SUBTASK_DEADLINE_ERROR = 'Podzadanie nie może mieć deadline późniejszego niż zadanie nadrzędne.'


def _deadline_value(task):
    if not task or not task.deadline:
        return None
    return task.deadline


def _task_deadline_payload(task, prefix):
    return {
        f'{prefix}_task_id': task.id if task else None,
        f'{prefix}_deadline': task.deadline.isoformat() if task and task.deadline else None,
    }


def _find_parent_deadline_violation(task):
    child_deadline = _deadline_value(task)
    if not child_deadline:
        return None

    parent_relations = TaskRelation.query.filter_by(target_task_id=task.id).all()
    parent_ids = [rel.source_task_id for rel in parent_relations]

    if not parent_ids:
        return None

    violating_parent = (
        Task.query
        .filter(Task.id.in_(parent_ids))
        .filter(Task.deadline.isnot(None))
        .filter(Task.deadline < child_deadline)
        .order_by(Task.deadline.asc())
        .first()
    )

    return violating_parent


def _find_child_deadline_violation(task):
    parent_deadline = _deadline_value(task)
    if not parent_deadline:
        return None

    child_relations = TaskRelation.query.filter_by(source_task_id=task.id).all()
    child_ids = [rel.target_task_id for rel in child_relations]

    if not child_ids:
        return None

    violating_child = (
        Task.query
        .filter(Task.id.in_(child_ids))
        .filter(Task.deadline.isnot(None))
        .filter(Task.deadline > parent_deadline)
        .order_by(Task.deadline.desc())
        .first()
    )

    return violating_child


def _validate_task_deadline_hierarchy(task):
    violating_parent = _find_parent_deadline_violation(task)
    if violating_parent:
        return jsonify({
            'error': 'subtask_deadline_after_parent',
            'message': SUBTASK_DEADLINE_ERROR,
            **_task_deadline_payload(violating_parent, 'parent'),
            **_task_deadline_payload(task, 'child'),
        }), 400

    violating_child = _find_child_deadline_violation(task)
    if violating_child:
        return jsonify({
            'error': 'parent_deadline_before_child',
            'message': SUBTASK_DEADLINE_ERROR,
            **_task_deadline_payload(task, 'parent'),
            **_task_deadline_payload(violating_child, 'child'),
        }), 400

    return None

def _parse_task_datetime(value, field_name):
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
        return datetime.combine(parsed_date, datetime.min.time()), None
    except (ValueError, TypeError):
        return None, jsonify({
            'error': f'Invalid {field_name} format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM format.'
        }), 400

def _parse_assignment_ids(value, field_name):
    if value is None:
        return [], None

    if not isinstance(value, list):
        return None, (
            jsonify({
                'error': f'{field_name} must be a list of IDs',
            }),
            400,
        )

    parsed_ids = []

    try:
        for item in value:
            item_id = int(item)

            if item_id not in parsed_ids:
                parsed_ids.append(item_id)
    except (TypeError, ValueError):
        return None, (
            jsonify({
                'error': f'{field_name} must contain only valid IDs',
            }),
            400,
        )

    return parsed_ids, None


def _assignment_payload_present(data):
    return any(
        field in data
        for field in (
            'assigned_user_ids',
            'assigned_group_ids',
            'assigned_organization_ids',
            'assignee_user_id',
            'group_id',
        )
    )


def _assignment_organization_ids(users, groups, organizations):
    organization_ids = {
        organization.id
        for organization in organizations
        if organization is not None
    }

    organization_ids.update(
        group.organization_id
        for group in groups
        if group.organization_id is not None
    )

    organization_ids.update(
        user.organization_id
        for user in users
        if user.organization_id is not None
    )

    return organization_ids


def _remove_redundant_assignments(users, groups, organizations):
    """
    Usuwa przypisania dublujące się przez organizację lub grupę.

    Jeśli wybrano organizację:
    - usuwamy bezpośrednio wybrane osoby z tej organizacji,
    - usuwamy grupy należące do tej organizacji.

    Jeśli wybrano grupę:
    - usuwamy bezpośrednio wybrane osoby należące do tej grupy.
    """
    organization_ids = {
        organization.id
        for organization in organizations
    }

    filtered_groups = [
        group
        for group in groups
        if group.organization_id not in organization_ids
    ]

    covered_user_ids = set()

    for organization in organizations:
        covered_user_ids.update(
            user.id
            for user in organization.users or []
        )

    for group in filtered_groups:
        covered_user_ids.update(
            user.id
            for user in group.members or []
        )

    filtered_users = [
        user
        for user in users
        if user.id not in covered_user_ids
    ]

    return filtered_users, filtered_groups, organizations

def _resolve_task_assignments(actor, data, project=None):
    assigned_user_ids, users_error = _parse_assignment_ids(
        data.get('assigned_user_ids', []),
        'assigned_user_ids',
    )

    if users_error:
        return None, users_error

    assigned_group_ids, groups_error = _parse_assignment_ids(
        data.get('assigned_group_ids', []),
        'assigned_group_ids',
    )

    if groups_error:
        return None, groups_error

    assigned_organization_ids, organizations_error = _parse_assignment_ids(
        data.get('assigned_organization_ids', []),
        'assigned_organization_ids',
    )

    if organizations_error:
        return None, organizations_error

    # Zgodność ze starszym frontendem.
    legacy_assignee_id = data.get('assignee_user_id')

    if legacy_assignee_id not in (None, ''):
        legacy_assignee_id = int(legacy_assignee_id)

        if legacy_assignee_id not in assigned_user_ids:
            assigned_user_ids.append(legacy_assignee_id)

    legacy_group_id = data.get('group_id')

    if legacy_group_id not in (None, ''):
        legacy_group_id = int(legacy_group_id)

        if legacy_group_id not in assigned_group_ids:
            assigned_group_ids.append(legacy_group_id)

    users = (
        User.query.filter(User.id.in_(assigned_user_ids)).all()
        if assigned_user_ids
        else []
    )

    groups = (
        Group.query.filter(Group.id.in_(assigned_group_ids)).all()
        if assigned_group_ids
        else []
    )

    organizations = (
        Organization.query
        .filter(Organization.id.in_(assigned_organization_ids))
        .all()
        if assigned_organization_ids
        else []
    )

    if len(users) != len(assigned_user_ids):
        return None, (
            jsonify({
                'error': 'One or more assigned users do not exist',
            }),
            400,
        )

    if len(groups) != len(assigned_group_ids):
        return None, (
            jsonify({
                'error': 'One or more assigned groups do not exist',
            }),
            400,
        )

    if len(organizations) != len(assigned_organization_ids):
        return None, (
            jsonify({
                'error': 'One or more assigned organizations do not exist',
            }),
            400,
        )

    # Nadal pozwalamy przypisać zadanie bezpośrednio tylko jednej organizacji.
    if len(organizations) > 1:
        return None, (
            jsonify({
                'error': 'A task can be assigned to only one organization',
            }),
            400,
        )

    for user in users:
        if is_internal(actor):
            continue

        if user.organization_id != actor.organization_id:
            return None, (
                jsonify({
                    'error': (
                        f'User {user.id} cannot be assigned '
                        'because they belong to another organization'
                    ),
                }),
                403,
            )

    for group in groups:
        if not _user_can_use_group(actor, group):
            return None, (
                jsonify({
                    'error': f'Group {group.id} cannot be assigned to this task',
                }),
                400,
            )

    for organization in organizations:
        if (
            not is_internal(actor)
            and actor.organization_id != organization.id
        ):
            return None, (
                jsonify({
                    'error': 'You cannot assign another organization',
                }),
                403,
            )

    users, groups, organizations = _remove_redundant_assignments(
        users,
        groups,
        organizations,
    )

    organization_ids = _assignment_organization_ids(
        users,
        groups,
        organizations,
    )

    if project is not None:
        # organization_id zadania pozostaje organizacją właścicielską projektu.
        # Widoczność osób z innych organizacji wynika z przypisań many-to-many.
        task_organization_id = project.organization_id
    elif len(organization_ids) > 1:
        return None, (
            jsonify({
                'error': (
                    'Assignments outside a project must belong '
                    'to the same organization'
                ),
            }),
            400,
        )
    elif organization_ids:
        task_organization_id = next(iter(organization_ids))
    else:
        task_organization_id = actor.organization_id

    return {
        'users': users,
        'groups': groups,
        'organizations': organizations,
        'organization_id': task_organization_id,
    }, None

def _sync_task_assignments(task, assignment_data):
    users = assignment_data['users']
    groups = assignment_data['groups']
    organizations = assignment_data['organizations']

    task.assigned_users = users
    task.assigned_groups = groups
    task.assigned_organizations = organizations
    task.organization_id = assignment_data['organization_id']

    # Pola zgodności dla starszych fragmentów aplikacji.
    task.assignee_user_id = users[0].id if users else None
    task.group_id = groups[0].id if groups else None


def _notify_new_task_assignees(task, actor):
    notified_user_ids = set()

    for user in task.effective_assigned_users():
        if user.id == actor.id or user.id in notified_user_ids:
            continue

        _notify(
            user.id,
            f'Nowe zadanie przypisane: {task.topic[:120]}',
            task_id=task.id,
        )

        notified_user_ids.add(user.id)


def _notify_task_status_assignees(task, actor):
    notified_user_ids = set()

    for user in task.effective_assigned_users():
        if user.id == actor.id or user.id in notified_user_ids:
            continue

        _notify(
            user.id,
            f'Zmiana statusu zadania: {task.topic[:80]}',
            kind='status',
            task_id=task.id,
        )

        notified_user_ids.add(user.id)

@api.route('/tasks', methods=['GET'])
@require_approved_user
def get_tasks():
    """Pobierz zadania użytkownika (wymaga autoryzacji)"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
        me = User.query.get(current_user_id)
        if not me:
            return jsonify({'error': 'User not found'}), 404

        completed = request.args.get('completed', type=str)
        related_to = request.args.get('related_to', type=int)
        categories_param = request.args.get('categories', type=str)
        no_categories = request.args.get('no_categories', type=str)  # 'true' or 'false'
        date_from = request.args.get('date_from', type=str)  # YYYY-MM-DD
        date_to = request.args.get('date_to', type=str)  # YYYY-MM-DD

        query = Task.query.filter(visible_tasks_condition(me))

        # Filtruj po kategoriach jeśli podano
        category_filter_applied = False
        if categories_param or (no_categories and no_categories.lower() == 'true'):
            try:
                # Jeśli wybrano "no categories", znajdź taski bez kategorii
                if no_categories and no_categories.lower() == 'true':
                    # Znajdź wszystkie taski które mają kategorie
                    task_ids_with_categories = db.session.query(task_categories.c.task_id).distinct().all()
                    task_ids_with_cats = [row[0] for row in task_ids_with_categories]

                    # Filtruj taski które NIE mają kategorii
                    if task_ids_with_cats:
                        query = query.filter(~Task.id.in_(task_ids_with_cats))
                    # Jeśli nie ma żadnych tasków z kategoriami, wszystkie taski są bez kategorii
                    category_filter_applied = True

                # Jeśli wybrano konkretne kategorie
                if categories_param:
                    # Parametr categories to lista ID oddzielonych przecinkami, np. "1,2,3"
                    category_ids = [int(cid.strip()) for cid in categories_param.split(',') if cid.strip()]
                    if category_ids:
                        # Sprawdź czy kategorie należą do użytkownika
                        user_categories = Category.query.filter_by(user_id=current_user_id).filter(Category.id.in_(category_ids)).all()
                        valid_category_ids = [cat.id for cat in user_categories]

                        if valid_category_ids:
                            # Znajdź taski, które mają przynajmniej jedną z wybranych kategorii
                            # Używamy join z tabelą task_categories
                            task_ids_with_categories = db.session.query(task_categories.c.task_id).filter(
                                task_categories.c.category_id.in_(valid_category_ids)
                            ).distinct().all()
                            task_ids = [row[0] for row in task_ids_with_categories]

                            # Jeśli również wybrano "no categories", połącz wyniki (OR)
                            if no_categories and no_categories.lower() == 'true':
                                # Znajdź taski bez kategorii
                                all_task_ids_with_cats = db.session.query(task_categories.c.task_id).distinct().all()
                                all_task_ids_with_cats_list = [row[0] for row in all_task_ids_with_cats]
                                # Lista widocznych id liczona tylko tu, gdzie jest potrzebna.
                                all_user_task_ids = [
                                    t.id for t in Task.query
                                    .filter(visible_tasks_condition(me)).all()
                                ]
                                if all_task_ids_with_cats_list:
                                    task_ids_without_cats = [tid for tid in all_user_task_ids if tid not in all_task_ids_with_cats_list]
                                else:
                                    # Jeśli nie ma żadnych tasków z kategoriami, wszystkie są bez kategorii
                                    task_ids_without_cats = all_user_task_ids

                                # Połącz listy (OR logic)
                                combined_task_ids = list(set(task_ids + task_ids_without_cats))
                                if combined_task_ids:
                                    query = query.filter(Task.id.in_(combined_task_ids))
                                else:
                                    query = query.filter(Task.id == -1)  # Nigdy nie pasuje
                            else:
                                # Tylko kategorie (bez "no categories")
                                if task_ids:
                                    query = query.filter(Task.id.in_(task_ids))
                                else:
                                    # Jeśli nie ma tasków z tymi kategoriami, zwróć pusty wynik
                                    query = query.filter(Task.id == -1)  # Nigdy nie pasuje
                            category_filter_applied = True
                        else:
                            # Jeśli żadna kategoria nie jest ważna, zwróć pusty wynik (chyba że wybrano "no categories")
                            if not (no_categories and no_categories.lower() == 'true'):
                                query = query.filter(Task.id == -1)  # Nigdy nie pasuje
                            category_filter_applied = True
            except (ValueError, AttributeError) as e:
                # Jeśli parsowanie się nie powiodło, ignoruj filtr kategorii
                print(f'Error parsing categories parameter: {e}')

        # Filtruj po relacjach jeśli podano
        if related_to:
            # Znajdź zadania powiązane przez relacje (jako źródło lub cel)
            related_source_ids = [rel.target_task_id for rel in
                TaskRelation.query.filter_by(source_task_id=related_to).all()]
            related_target_ids = [rel.source_task_id for rel in
                TaskRelation.query.filter_by(target_task_id=related_to).all()]
            related_ids = list(set(related_source_ids + related_target_ids))
            if related_ids:
                query = query.filter(Task.id.in_(related_ids))
            else:
                # Jeśli nie ma relacji, zwróć pusty wynik
                query = query.filter(Task.id == -1)  # Nigdy nie pasuje

        # Filtruj po statusie (completed) jeśli podano
        if completed is not None and completed.strip():
            completed_bool = completed.lower().strip() == 'true'
            query = query.filter_by(completed=completed_bool)

        # Filtruj po datach jeśli podano
        if date_from:
            try:
                date_from_obj = date.fromisoformat(date_from)
                date_from_datetime = datetime.combine(date_from_obj, datetime.min.time())
                # Filtruj taski które mają przynajmniej jedną datę >= date_from
                query = query.filter(
                    db_or(
                        Task.planned_date >= date_from_datetime,
                        Task.deadline >= date_from_datetime,
                        Task.created_at >= date_from_datetime
                    )
                )
            except (ValueError, TypeError):
                pass  # Ignoruj nieprawidłowy format daty

        if date_to:
            try:
                date_to_obj = date.fromisoformat(date_to)
                date_to_datetime = datetime.combine(date_to_obj, datetime.max.time())
                # Filtruj taski które mają przynajmniej jedną datę <= date_to
                query = query.filter(
                    db_or(
                        Task.planned_date <= date_to_datetime,
                        Task.deadline <= date_to_datetime,
                        Task.created_at <= date_to_datetime
                    )
                )
            except (ValueError, TypeError):
                pass  # Ignoruj nieprawidłowy format daty

        qtext = request.args.get('q', type=str)
        if qtext and qtext.strip():
            pat = f'%{qtext.strip()}%'
            query = query.filter(db_or(Task.topic.ilike(pat), Task.notes.ilike(pat)))

        pr = request.args.get('priority', type=str)
        if pr and pr.strip():
            query = query.filter(Task.priority == pr.strip())

        sc = request.args.get('status_code', type=str)
        if sc and sc.strip():
            ts = TaskStatus.query.filter_by(code=sc.strip()).first()
            if ts:
                query = query.filter(Task.status_id == ts.id)

        project_id = request.args.get('project_id', type=int)
        if project_id is not None:
            query = query.filter(Task.project_id == project_id)

        tasks = query.all()
        include_relations = request.args.get('include_relations', 'false').lower() == 'true'
        soonest_map = _bulk_soonest_action(tasks)

        tasks_dict = []
        for task in tasks:
            try:
                tasks_dict.append(task.to_dict(
                    include_relations=include_relations,
                    soonest_action=soonest_map.get(task.id),
                ))
            except Exception as task_error:
                # Loguj błąd dla konkretnego zadania, ale kontynuuj z innymi
                import traceback
                error_trace = traceback.format_exc()
                print(f'ERROR serializing task {task.id}: {str(task_error)}')
                print(error_trace)
                # Dodaj podstawowe dane zadania bez dat
                tasks_dict.append({
                    'id': task.id,
                    'topic': str(task.topic) if task.topic else '',
                    'notes': str(task.notes) if task.notes else '',
                    'deadline': None,
                    'planned_date': None,
                    'created_at': task.created_at.isoformat() if task.created_at else None,
                    'completed': bool(task.completed),
                    'user_id': int(task.user_id),
                    'error': 'Error formatting dates'
                })

        response = jsonify(tasks_dict)
        return response, 200
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f'ERROR in get_tasks: {str(e)}')
        print(error_details)
        return jsonify({'error': f'Failed to get tasks: {str(e)}', 'details': error_details}), 500

@api.route('/tasks', methods=['POST'])
@require_approved_user
def create_task():
    current_user_id = int(get_jwt_identity())
    me = User.query.get_or_404(current_user_id)
    data = request.get_json() or {}

    topic = (data.get('topic') or '').strip()
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400

    deadline, deadline_error = _parse_task_datetime(
        data.get('deadline'),
        'deadline',
    )
    if deadline_error:
        return deadline_error

    planned_date, planned_date_error = _parse_task_datetime(
        data.get('planned_date'),
        'planned_date',
    )
    if planned_date_error:
        return planned_date_error

    if planned_date and deadline and planned_date > deadline:
        return jsonify({
            'error': 'planned_date_after_deadline',
            'message': 'Data planu nie może być późniejsza niż deadline zadania.',
        }), 400

    todo = _default_todo_status()
    done = TaskStatus.query.filter_by(code='done').first()

    completed = bool(data.get('completed', False))
    status_id = None

    if data.get('status_id') not in (None, ''):
        status = TaskStatus.query.get(int(data['status_id']))

        if not status:
            return jsonify({'error': 'Invalid status'}), 400

        status_id = status.id
        completed = bool(status.is_terminal)
    elif completed and done:
        status_id = done.id
    elif todo:
        status_id = todo.id

    priority = data.get('priority') or 'medium'
    if priority not in ('low', 'medium', 'high'):
        priority = 'medium'

    project = None
    project_id = data.get('project_id')

    if project_id not in (None, ''):
        project = Project.query.get(int(project_id))

        if not project or not project_has_full_access(project, me):
            return jsonify({
                'error': 'You need full project access to create a task in it',
            }), 403

        project_id = project.id
    else:
        project_id = None

    assignments, assignments_error = _resolve_task_assignments(
        me,
        data,
        project=project,
    )
    if assignments_error:
        return assignments_error

    task = Task(
        topic=topic,
        notes=data.get('notes') or '',
        deadline=deadline,
        planned_date=planned_date,
        user_id=current_user_id,
        completed=completed,
        status_id=status_id,
        priority=priority,
        version=1,
        project_id=project_id,
        organization_id=assignments['organization_id'],
    )

    db.session.add(task)
    db.session.flush()

    _sync_task_assignments(task, assignments)

    db.session.add(
        TaskActivity(
            task_id=task.id,
            user_id=me.id,
            action='task_created',
            detail_json=json.dumps({
                'topic': task.topic,
                'assigned_user_ids': [
                    user.id for user in assignments['users']
                ],
                'assigned_group_ids': [
                    group.id for group in assignments['groups']
                ],
                'assigned_organization_ids': [
                    organization.id
                    for organization in assignments['organizations']
                ],
            }),
        )
    )

    _notify_new_task_assignees(task, me)

    db.session.commit()

    return jsonify(task.to_dict(include_relations=True)), 201

@api.route('/tasks/<int:task_id>', methods=['GET'])
@require_approved_user
def get_task(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    include_relations = request.args.get('include_relations', 'false').lower() == 'true'
    return jsonify(task.to_dict(include_relations=include_relations)), 200

@api.route('/tasks/<int:task_id>', methods=['PUT'])
@require_approved_user
def update_task(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404

    data = request.get_json() or {}

    if data.get('expected_version') is not None:
        expected_version = int(data['expected_version'])
        current_version = int(task.version or 1)

        if expected_version != current_version:
            return jsonify({
                'error': 'Conflict',
                'message': 'Zadanie zostało już zaktualizowane przez innego użytkownika.',
                'current_version': current_version,
            }), 409

    old_effective_assignee_ids = {
        user.id
        for user in task.effective_assigned_users()
    }

    old = {
        'completed': task.completed,
        'status_id': task.status_id,
        'topic': task.topic,
        'priority': task.priority,
        'project_id': task.project_id,
        'organization_id': task.organization_id,
        'assigned_user_ids': [
            user.id for user in task.assigned_users
        ],
        'assigned_group_ids': [
            group.id for group in task.assigned_groups
        ],
        'assigned_organization_ids': [
            organization.id
            for organization in task.assigned_organizations
        ],
    }

    cascade_subtasks = bool(data.get('cascade_subtasks', False))

    if 'topic' in data:
        topic = (data.get('topic') or '').strip()

        if not topic:
            return jsonify({'error': 'Topic is required'}), 400

        task.topic = topic

    if 'notes' in data:
        task.notes = data.get('notes') or ''

    if 'deadline' in data:
        deadline, deadline_error = _parse_task_datetime(
            data.get('deadline'),
            'deadline',
        )
        if deadline_error:
            return deadline_error

        task.deadline = deadline

    if 'planned_date' in data:
        planned_date, planned_date_error = _parse_task_datetime(
            data.get('planned_date'),
            'planned_date',
        )
        if planned_date_error:
            return planned_date_error

        task.planned_date = planned_date

    if task.planned_date and task.deadline and task.planned_date > task.deadline:
        return jsonify({
            'error': 'planned_date_after_deadline',
            'message': 'Data planu nie może być późniejsza niż deadline zadania.',
        }), 400

    if 'priority' in data:
        priority = data.get('priority')

        if priority not in ('low', 'medium', 'high'):
            return jsonify({'error': 'Invalid priority'}), 400

        task.priority = priority

    if 'status_id' in data:
        status_id = data.get('status_id')

        if status_id in (None, ''):
            task.status_id = None
        else:
            status = TaskStatus.query.get(int(status_id))

            if not status:
                return jsonify({'error': 'Invalid status'}), 400

            task.status_id = status.id
            task.completed = bool(status.is_terminal)

    if 'completed' in data:
        _apply_completed_bool(task, data.get('completed'))

    project = task.project

    if 'project_id' in data:
        project_id = data.get('project_id')

        if project_id in (None, ''):
            project = None
            task.project_id = None
        else:
            project = Project.query.get(int(project_id))

            if not project or not project_has_full_access(project, me):
                return jsonify({
                    'error': 'You need full project access to move a task into it',
                }), 403

            task.project_id = project.id

    should_sync_assignments = (
        _assignment_payload_present(data)
        or 'project_id' in data
    )

    if should_sync_assignments:
        assignment_payload = dict(data)

        if not _assignment_payload_present(data):
            assignment_payload.update({
                'assigned_user_ids': [
                    user.id for user in task.assigned_users
                ],
                'assigned_group_ids': [
                    group.id for group in task.assigned_groups
                ],
                'assigned_organization_ids': [
                    organization.id
                    for organization in task.assigned_organizations
                ],
            })

        assignments, assignments_error = _resolve_task_assignments(
            me,
            assignment_payload,
            project=project,
        )
        if assignments_error:
            return assignments_error

        _sync_task_assignments(task, assignments)
    elif project is not None:
        task.organization_id = project.organization_id

    hierarchy_error = _validate_task_deadline_hierarchy(task)
    if hierarchy_error:
        return hierarchy_error

    is_closing_task = (
        old.get('completed') is False
        and task.completed is True
    )

    if is_closing_task:
        open_subtasks = _direct_open_subtasks(task)

        if open_subtasks and not cascade_subtasks:
            return jsonify({
                'error': 'open_subtasks',
                'message': (
                    'To zadanie ma otwarte podzadania. '
                    'Czy na pewno chcesz je zamknąć razem z zadaniem?'
                ),
                'open_subtasks': [
                    {
                        'id': subtask.id,
                        'topic': subtask.topic,
                    }
                    for subtask in open_subtasks
                ],
            }), 409

        if open_subtasks and cascade_subtasks:
            _close_subtasks_recursively(task, me)

    task.version = int(task.version or 1) + 1

    new_effective_assignees = task.effective_assigned_users()
    new_effective_assignee_ids = {
        user.id
        for user in new_effective_assignees
    }

    newly_assigned_user_ids = (
        new_effective_assignee_ids
        - old_effective_assignee_ids
    )

    for user in new_effective_assignees:
        if user.id == me.id or user.id not in newly_assigned_user_ids:
            continue

        _notify(
            user.id,
            f'Przypisano Ci zadanie: {task.topic[:120]}',
            task_id=task.id,
        )

    if old.get('completed') != task.completed:
        _notify_task_status_assignees(task, me)

    db.session.add(
        TaskActivity(
            task_id=task.id,
            user_id=me.id,
            action='task_update',
            detail_json=json.dumps({
                'before': old,
                'after': {
                    'completed': task.completed,
                    'status_id': task.status_id,
                    'topic': task.topic,
                    'priority': task.priority,
                    'project_id': task.project_id,
                    'organization_id': task.organization_id,
                    'assigned_user_ids': [
                        user.id for user in task.assigned_users
                    ],
                    'assigned_group_ids': [
                        group.id for group in task.assigned_groups
                    ],
                    'assigned_organization_ids': [
                        organization.id
                        for organization in task.assigned_organizations
                    ],
                },
            }),
        )
    )

    db.session.commit()

    return jsonify(task.to_dict(include_relations=True)), 200

@api.route('/tasks/import', methods=['POST'])
@require_approved_user
def import_tasks():
    """Import tasks from JSON/XLSX (wymaga autoryzacji)"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
        me = User.query.get_or_404(current_user_id)

        data = request.get_json()
        if not data or 'tasks' not in data:
            return jsonify({'error': 'Invalid request. Expected "tasks" array.'}), 400

        tasks_data = data['tasks']
        if not isinstance(tasks_data, list):
            return jsonify({'error': 'Tasks must be an array.'}), 400

        imported_count = 0
        errors = []

        for task_data in tasks_data:
            try:
                # Walidacja wymaganych pól
                if not task_data.get('topic'):
                    errors.append(f'Task missing topic: {task_data}')
                    continue

                completed_imp = bool(task_data.get('completed', False))
                todo_st = _default_todo_status()
                done_st = TaskStatus.query.filter_by(code='done').first()
                st_id = None
                if completed_imp and done_st:
                    st_id = done_st.id
                elif todo_st:
                    st_id = todo_st.id
                pr = task_data.get('priority') or 'medium'
                if pr not in ('low', 'medium', 'high'):
                    pr = 'medium'
                    
                new_task = Task(
                    user_id=current_user_id,
                    organization_id=me.organization_id,
                    topic=task_data.get('topic', '').strip(),
                    notes=task_data.get('notes', ''),
                    completed=completed_imp,
                    deadline=None,
                    planned_date=None,
                    status_id=st_id,
                    priority=pr,
                    version=1,
                )

                # Daty: kolumny to DateTime, więc zawsze zapisujemy datetime (nie date).
                if task_data.get('deadline'):
                    dt = _parse_import_dt(task_data.get('deadline'))
                    if dt is None:
                        errors.append(f'Invalid deadline format for task "{task_data.get("topic")}"')
                    else:
                        new_task.deadline = dt

                if task_data.get('planned_date'):
                    dt = _parse_import_dt(task_data.get('planned_date'))
                    if dt is None:
                        errors.append(f'Invalid planned_date format for task "{task_data.get("topic")}"')
                    else:
                        new_task.planned_date = dt

                db.session.add(new_task)
                imported_count += 1
            except Exception as e:
                errors.append(f'Error importing task "{task_data.get("topic", "unknown")}": {str(e)}')

        db.session.commit()

        response_data = {
            'message': f'Successfully imported {imported_count} task(s)',
            'imported_count': imported_count,
            'total_count': len(tasks_data)
        }

        if errors:
            response_data['errors'] = errors
            response_data['error_count'] = len(errors)

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f'ERROR importing tasks: {str(e)}')
        print(error_trace)
        return jsonify({'error': f'Failed to import tasks: {str(e)}'}), 500


@api.route('/task-statuses', methods=['GET'])
@require_approved_user
def list_task_statuses():
    rows = TaskStatus.query.order_by(TaskStatus.sort_order, TaskStatus.id).all()
    return jsonify([r.to_dict() for r in rows]), 200
