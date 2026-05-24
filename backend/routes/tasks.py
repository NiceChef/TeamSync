import json
from datetime import datetime, date

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or

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

@api.route('/tasks', methods=['GET'])
@jwt_required()
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
@jwt_required()
def create_task():
    """Utwórz nowe zadanie (wymaga autoryzacji)"""
    current_user_id = int(get_jwt_identity())
    me = User.query.get_or_404(current_user_id)
    data = request.get_json() or {}

    if not data.get('topic'):
        return jsonify({'error': 'Topic is required'}), 400

    deadline = None
    if data.get('deadline'):
        try:
            deadline_date = date.fromisoformat(data['deadline'])
            deadline = datetime.combine(deadline_date, datetime.min.time())
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD format.'}), 400

    planned_date = None
    if data.get('planned_date'):
        try:
            planned_date_obj = date.fromisoformat(data['planned_date'])
            planned_date = datetime.combine(planned_date_obj, datetime.min.time())
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid planned_date format. Use YYYY-MM-DD format.'}), 400

    todo = _default_todo_status()
    done = TaskStatus.query.filter_by(code='done').first()
    completed = bool(data.get('completed', False))
    status_id = None
    if data.get('status_id') is not None:
        st = TaskStatus.query.get(int(data['status_id']))
        if st:
            status_id = st.id
            completed = bool(st.is_terminal)
    elif completed and done:
        status_id = done.id
    elif todo:
        status_id = todo.id

    assignee_user_id = data.get('assignee_user_id')
    if assignee_user_id is not None:
        assignee_user_id = int(assignee_user_id)
        if not _valid_assignee(me, assignee_user_id):
            return jsonify({'error': 'Invalid assignee for your organization'}), 400

    group_id = data.get('group_id')
    if group_id is not None:
        g = Group.query.get(int(group_id))
        if not _user_can_use_group(me, g):
            return jsonify({'error': 'Invalid group'}), 400
        group_id = int(group_id)
    else:
        group_id = None

    pr = data.get('priority') or 'medium'
    if pr not in ('low', 'medium', 'high'):
        pr = 'medium'

    project_id = data.get('project_id')
    if project_id is not None:
        p = Project.query.get(int(project_id))
        if not _user_can_use_project(me, p):
            return jsonify({'error': 'Invalid project'}), 400
        project_id = int(project_id)
    else:
        project_id = None

    task = Task(
        topic=data['topic'],
        notes=data.get('notes', ''),
        deadline=deadline,
        planned_date=planned_date,
        user_id=current_user_id,
        completed=completed,
        status_id=status_id,
        priority=pr,
        version=1,
        assignee_user_id=assignee_user_id,
        group_id=group_id,
        project_id=project_id,
    )

    db.session.add(task)
    db.session.flush()
    db.session.add(
        TaskActivity(
            task_id=task.id,
            user_id=me.id,
            action='task_created',
            detail_json=json.dumps({'topic': task.topic}),
        )
    )
    if assignee_user_id and assignee_user_id != me.id:
        _notify(
            assignee_user_id,
            f'Nowe zadanie przypisane: {task.topic[:120]}',
            task_id=task.id,
        )
    db.session.commit()

    return jsonify(task.to_dict()), 201


@api.route('/tasks/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    include_relations = request.args.get('include_relations', 'false').lower() == 'true'
    return jsonify(task.to_dict(include_relations=include_relations)), 200


@api.route('/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404

    data = request.get_json() or {}

    if data.get('expected_version') is not None:
        if int(data['expected_version']) != int(task.version or 1):
            return jsonify({
                'error': 'Conflict',
                'message': 'Zadanie zostało już zaktualizowane przez innego użytkownika.',
                'current_version': task.version,
            }), 409

    old = {
        'completed': task.completed,
        'status_id': task.status_id,
        'topic': task.topic,
        'priority': task.priority,
    }

    if 'topic' in data:
        task.topic = data['topic']

    if 'notes' in data:
        task.notes = data['notes'] if data['notes'] else ''

    if 'deadline' in data:
        if data['deadline'] is None:
            task.deadline = None
        else:
            try:
                deadline_date = date.fromisoformat(data['deadline'])
                task.deadline = datetime.combine(deadline_date, datetime.min.time())
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD format.'}), 400

    if 'planned_date' in data:
        if data['planned_date'] is None:
            task.planned_date = None
        else:
            try:
                planned_date_obj = date.fromisoformat(data['planned_date'])
                task.planned_date = datetime.combine(planned_date_obj, datetime.min.time())
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid planned_date format. Use YYYY-MM-DD format.'}), 400

    if 'priority' in data and data['priority'] in ('low', 'medium', 'high'):
        task.priority = data['priority']

    if 'status_id' in data:
        if data['status_id'] is None:
            task.status_id = None
        else:
            st = TaskStatus.query.get(int(data['status_id']))
            if st:
                task.status_id = st.id
                task.completed = bool(st.is_terminal)

    if 'completed' in data:
        _apply_completed_bool(task, data['completed'])

    if 'assignee_user_id' in data:
        aid = data['assignee_user_id']
        if aid is None:
            task.assignee_user_id = None
        else:
            aid = int(aid)
            if not _valid_assignee(me, aid):
                return jsonify({'error': 'Invalid assignee'}), 400
            if aid != task.assignee_user_id and aid != me.id:
                _notify(aid, f'Przypisano Ci zadanie: {task.topic[:120]}', task_id=task.id)
            task.assignee_user_id = aid

    if 'group_id' in data:
        gid = data['group_id']
        if gid is None:
            task.group_id = None
        else:
            g = Group.query.get(int(gid))
            if not _user_can_use_group(me, g):
                return jsonify({'error': 'Invalid group'}), 400
            task.group_id = g.id

    if 'project_id' in data:
        pid = data['project_id']
        if pid is None:
            task.project_id = None
        else:
            p = Project.query.get(int(pid))
            if not _user_can_use_project(me, p):
                return jsonify({'error': 'Invalid project'}), 400
            task.project_id = p.id

    task.version = int(task.version or 1) + 1

    db.session.add(
        TaskActivity(
            task_id=task.id,
            user_id=me.id,
            action='task_update',
            detail_json=json.dumps({'before': old}),
        )
    )

    if old.get('completed') != task.completed and task.assignee_user_id and task.assignee_user_id != me.id:
        _notify(
            task.assignee_user_id,
            f'Zmiana statusu zadania: {task.topic[:80]}',
            kind='status',
            task_id=task.id,
        )

    db.session.commit()
    return jsonify(task.to_dict()), 200


@api.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    if not can_delete_task(task, me):
        return jsonify({'error': 'Only the task owner can delete this task'}), 403

    CalendarEvent.query.filter_by(task_id=task.id).update(
        {'task_id': None}, synchronize_session=False
    )
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted successfully'}), 200


@api.route('/tasks/import', methods=['POST'])
@jwt_required()
def import_tasks():
    """Import tasks from JSON/XLSX (wymaga autoryzacji)"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)

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
@jwt_required()
def list_task_statuses():
    rows = TaskStatus.query.order_by(TaskStatus.sort_order, TaskStatus.id).all()
    return jsonify([r.to_dict() for r in rows]), 200
