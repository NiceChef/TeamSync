import json
import os
import uuid
from datetime import datetime, date, timezone

from flask import Blueprint, request, jsonify, current_app, send_file, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or
from werkzeug.utils import secure_filename

from config import settings
from models import (
    db,
    Task,
    TaskRelation,
    Category,
    task_categories,
    UserSettings,
    User,
    TaskStatus,
    TaskComment,
    TaskActivity,
    TaskAttachment,
    Notification,
    Group,
    Project,
    CalendarEvent,
)
from task_access import visible_tasks_condition, task_visible, can_edit_task, can_delete_task

api = Blueprint('api', __name__, url_prefix='/api')


def _org_match(a, b):
    return (a or None) == (b or None)


def _valid_assignee(actor, assignee_id):
    other = User.query.get(assignee_id)
    if not other:
        return False
    return _org_match(actor.organization_id, other.organization_id)


def _user_can_use_group(user, group):
    if not group:
        return False
    if not _org_match(user.organization_id, group.organization_id):
        return False
    try:
        if user in group.members:
            return True
    except Exception:
        pass
    return user.id == group.created_by_id


def _can_manage_group(user, group):
    if not group or user.role == 'client':
        return False
    if not _org_match(user.organization_id, group.organization_id):
        return False
    try:
        if user in group.members or user.id == group.created_by_id:
            return True
    except Exception:
        pass
    return user.id == group.created_by_id


def _project_visible(user, project):
    if not project or not _org_match(user.organization_id, project.organization_id):
        return False
    if user.role == 'client':
        try:
            return user in project.members or user.id == project.created_by_id
        except Exception:
            return user.id == project.created_by_id
    return True


def _can_manage_project(user, project):
    if not project or user.role == 'client':
        return False
    if not _org_match(user.organization_id, project.organization_id):
        return False
    try:
        return user in project.members or user.id == project.created_by_id
    except Exception:
        return user.id == project.created_by_id


def _user_can_use_project(user, project):
    if not project or not _org_match(user.organization_id, project.organization_id):
        return False
    if user.role == 'client':
        try:
            return user in project.members or user.id == project.created_by_id
        except Exception:
            return False
    return True


def _parse_dt(value):
    """ISO 8601 (z 'Z' lub bez) -> naive UTC datetime. Zwraca None gdy puste/błędne."""
    if not value:
        return None
    try:
        s = str(value).replace('Z', '+00:00')
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return None


def _default_todo_status():
    return TaskStatus.query.filter_by(code='todo').first()


def _apply_completed_bool(task, completed):
    task.completed = bool(completed)
    done = TaskStatus.query.filter_by(code='done').first()
    todo = TaskStatus.query.filter_by(code='todo').first()
    if completed and done:
        task.status_id = done.id
    elif not completed and todo:
        task.status_id = todo.id


def _notify(user_id, message, kind='task', task_id=None):
    if not user_id:
        return
    db.session.add(
        Notification(user_id=user_id, message=message, kind=kind, task_id=task_id)
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
        visible_id_list = [t.id for t in query.all()]
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
                                task_ids_without_cats = []
                                if all_task_ids_with_cats_list:
                                    # Pobierz wszystkie taski użytkownika i odfiltruj te z kategoriami
                                    all_user_task_ids = list(visible_id_list)
                                    task_ids_without_cats = [tid for tid in all_user_task_ids if tid not in all_task_ids_with_cats_list]
                                else:
                                    # Jeśli nie ma żadnych tasków z kategoriami, wszystkie są bez kategorii
                                    all_user_task_ids = list(visible_id_list)
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
        
        tasks_dict = []
        for task in tasks:
            try:
                tasks_dict.append(task.to_dict(include_relations=include_relations))
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

    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted successfully'}), 200

# ========== TASK RELATIONS ENDPOINTS ==========

@api.route('/tasks/<int:task_id>/relations', methods=['GET'])
@jwt_required()
def get_task_relations(task_id):
    """Pobierz wszystkie relacje dla zadania (wymaga autoryzacji)"""
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    
    direction = request.args.get('direction', 'both')  # 'outgoing', 'incoming', 'both'
    
    query = TaskRelation.query.filter(
        ((TaskRelation.source_task_id == task_id) | (TaskRelation.target_task_id == task_id))
    )
    
    if direction == 'outgoing':
        query = query.filter_by(source_task_id=task_id)
    elif direction == 'incoming':
        query = query.filter_by(target_task_id=task_id)
    
    relations = query.order_by(TaskRelation.created_at.desc()).all()
    include_tasks = request.args.get('include_tasks', 'false').lower() == 'true'
    return jsonify([rel.to_dict(include_tasks=include_tasks) for rel in relations]), 200

@api.route('/tasks/<int:task_id>/relations', methods=['POST'])
@jwt_required()
def create_task_relation(task_id):
    """Utwórz relację między zadaniami (właściciel obu zadań)"""
    current_user_id = int(get_jwt_identity())

    source_task = Task.query.filter_by(id=task_id, user_id=current_user_id).first()
    if not source_task:
        return jsonify({'error': 'Source task not found or you are not the owner'}), 404

    data = request.get_json()

    if not data or not data.get('target_task_id'):
        return jsonify({'error': 'target_task_id is required'}), 400

    target_task_id = data['target_task_id']

    target_task = Task.query.filter_by(id=target_task_id, user_id=current_user_id).first()
    if not target_task:
        return jsonify({'error': 'Target task not found or does not belong to you'}), 404
    
    # Zapobiegaj relacji zadania z samym sobą
    if task_id == target_task_id:
        return jsonify({'error': 'Task cannot be related to itself'}), 400
    
    # Sprawdź czy relacja już istnieje (w obu kierunkach)
    existing = TaskRelation.query.filter(
        ((TaskRelation.source_task_id == task_id) & (TaskRelation.target_task_id == target_task_id)) |
        ((TaskRelation.source_task_id == target_task_id) & (TaskRelation.target_task_id == task_id))
    ).first()
    
    if existing:
        return jsonify({'error': 'This relation already exists'}), 400
    
    relation = TaskRelation(
        source_task_id=task_id,
        target_task_id=target_task_id
    )
    
    db.session.add(relation)
    db.session.commit()
    
    return jsonify(relation.to_dict(include_tasks=True)), 201

@api.route('/relations/<int:relation_id>', methods=['GET'])
@jwt_required()
def get_task_relation(relation_id):
    """Pobierz relację (wymaga autoryzacji)"""
    me = User.query.get_or_404(int(get_jwt_identity()))

    relation = TaskRelation.query.get_or_404(relation_id)

    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)

    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404

    if not task_visible(source_task, me) or not task_visible(target_task, me):
        return jsonify({'error': 'Access denied'}), 403
    
    include_tasks = request.args.get('include_tasks', 'true').lower() == 'true'
    return jsonify(relation.to_dict(include_tasks=include_tasks)), 200

@api.route('/relations/<int:relation_id>', methods=['PUT'])
@jwt_required()
def update_task_relation(relation_id):
    """Aktualizuj relację (wymaga autoryzacji) - obecnie nie ma pól do aktualizacji"""
    current_user_id = int(get_jwt_identity())

    relation = TaskRelation.query.get_or_404(relation_id)

    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)

    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404

    if source_task.user_id != current_user_id or target_task.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Obecnie relacja nie ma pól do aktualizacji (tylko source_task_id i target_task_id)
    # Jeśli potrzebujesz zmienić relację, usuń starą i utwórz nową
    return jsonify(relation.to_dict(include_tasks=True)), 200

@api.route('/relations/<int:relation_id>', methods=['DELETE'])
@jwt_required()
def delete_task_relation(relation_id):
    """Usuń relację (wymaga autoryzacji)"""
    current_user_id_str = get_jwt_identity()
    current_user_id = int(current_user_id_str)
    
    relation = TaskRelation.query.get_or_404(relation_id)
    
    # Sprawdź czy użytkownik jest właścicielem któregoś z zadań
    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)
    
    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404
    
    if source_task.user_id != current_user_id or target_task.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(relation)
    db.session.commit()
    return jsonify({'message': 'Relation deleted successfully'}), 200

# Health check endpoint
# ========== CATEGORIES ENDPOINTS ==========

@api.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Pobierz wszystkie kategorie użytkownika"""
    current_user_id_str = get_jwt_identity()
    current_user_id = int(current_user_id_str)
    
    categories = Category.query.filter_by(user_id=current_user_id).all()
    return jsonify([cat.to_dict() for cat in categories]), 200

@api.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    """Utwórz nową kategorię"""
    current_user_id_str = get_jwt_identity()
    current_user_id = int(current_user_id_str)
    
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400
    
    # Sprawdź czy kategoria o tej nazwie już istnieje dla użytkownika
    existing = Category.query.filter_by(name=data['name'], user_id=current_user_id).first()
    if existing:
        return jsonify({'error': 'Category with this name already exists'}), 400
    
    category = Category(
        name=data['name'],
        color=data.get('color'),
        user_id=current_user_id
    )
    
    db.session.add(category)
    db.session.commit()
    
    return jsonify(category.to_dict()), 201

# ========== TASK CATEGORIES ENDPOINTS ==========

@api.route('/tasks/<int:task_id>/categories', methods=['GET'])
@jwt_required()
def get_task_categories(task_id):
    """Pobierz kategorie przypisane do taska"""
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    return jsonify([cat.to_dict() for cat in task.categories]), 200

@api.route('/tasks/<int:task_id>/categories', methods=['POST'])
@jwt_required()
def add_task_category(task_id):
    """Przypisz kategorię do taska (tylko właściciel zadania)"""
    current_user_id = int(get_jwt_identity())

    task = Task.query.filter_by(id=task_id, user_id=current_user_id).first_or_404()
    data = request.get_json()
    
    if not data or not data.get('category_id'):
        return jsonify({'error': 'category_id is required'}), 400
    
    category_id = data['category_id']
    category = Category.query.filter_by(id=category_id, user_id=current_user_id).first_or_404()
    
    # Sprawdź czy kategoria już jest przypisana
    if category in task.categories:
        return jsonify({'error': 'Category is already assigned to this task'}), 400
    
    task.categories.append(category)
    db.session.commit()
    
    return jsonify({'message': 'Category added to task', 'category': category.to_dict()}), 200

@api.route('/tasks/<int:task_id>/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def remove_task_category(task_id, category_id):
    """Usuń kategorię z taska"""
    current_user_id_str = get_jwt_identity()
    current_user_id = int(current_user_id_str)
    
    task = Task.query.filter_by(id=task_id, user_id=current_user_id).first_or_404()
    category = Category.query.filter_by(id=category_id, user_id=current_user_id).first_or_404()
    
    if category not in task.categories:
        return jsonify({'error': 'Category is not assigned to this task'}), 404
    
    task.categories.remove(category)
    db.session.commit()
    
    return jsonify({'message': 'Category removed from task'}), 200

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
                
                # Ustaw daty jeśli są podane
                if task_data.get('deadline'):
                    try:
                        deadline_str = task_data.get('deadline')
                        # Obsługa różnych formatów daty
                        if isinstance(deadline_str, str):
                            # Spróbuj parsować różne formaty
                            if 'T' in deadline_str:
                                new_task.deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                            else:
                                new_task.deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date()
                        else:
                            new_task.deadline = deadline_str
                    except (ValueError, TypeError) as e:
                        errors.append(f'Invalid deadline format for task "{task_data.get("topic")}": {e}')
                
                if task_data.get('planned_date'):
                    try:
                        planned_str = task_data.get('planned_date')
                        if isinstance(planned_str, str):
                            if 'T' in planned_str:
                                new_task.planned_date = datetime.fromisoformat(planned_str.replace('Z', '+00:00')).date()
                            else:
                                new_task.planned_date = datetime.strptime(planned_str, '%Y-%m-%d').date()
                        else:
                            new_task.planned_date = planned_str
                    except (ValueError, TypeError) as e:
                        errors.append(f'Invalid planned_date format for task "{task_data.get("topic")}": {e}')
                
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


@api.route('/groups', methods=['GET'])
@jwt_required()
def list_groups():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify([]), 200
    q = Group.query
    if me.organization_id is not None:
        q = q.filter(Group.organization_id == me.organization_id)
    else:
        q = q.filter(Group.organization_id.is_(None))
    sq = (request.args.get('q') or '').strip()
    if sq:
        pat = f'%{sq}%'
        q = q.filter(db_or(Group.name.ilike(pat), Group.department.ilike(pat)))
    return jsonify([g.to_dict(include_member_count=True) for g in q.order_by(Group.name).limit(100).all()]), 200


@api.route('/groups', methods=['POST'])
@jwt_required()
def create_group():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    g = Group(
        name=name,
        department=(data.get('department') or '').strip() or None,
        organization_id=me.organization_id,
        created_by_id=me.id,
    )
    db.session.add(g)
    db.session.flush()
    if me not in g.members:
        g.members.append(me)
    db.session.commit()
    return jsonify(g.to_dict(include_member_count=True)), 201


@api.route('/groups/<int:gid>', methods=['GET'])
@jwt_required()
def get_group(gid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    g = Group.query.get_or_404(gid)
    if not _org_match(me.organization_id, g.organization_id):
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        **g.to_dict(include_member_count=True),
        'members': [u.to_dict() for u in g.members],
    }), 200


@api.route('/groups/<int:gid>/members', methods=['POST'])
@jwt_required()
def add_group_member(gid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    g = Group.query.get_or_404(gid)
    if not _can_manage_group(me, g):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    uid = data.get('user_id')
    if uid is None:
        return jsonify({'error': 'user_id required'}), 400
    u = User.query.get(int(uid))
    if not u or not _org_match(u.organization_id, g.organization_id):
        return jsonify({'error': 'User not in same organization'}), 400
    if u not in g.members:
        g.members.append(u)
    db.session.commit()
    return jsonify({'message': 'Member added', 'members': [x.to_dict() for x in g.members]}), 200


@api.route('/groups/<int:gid>/members/<int:uid>', methods=['DELETE'])
@jwt_required()
def remove_group_member(gid, uid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    g = Group.query.get_or_404(gid)
    if not _can_manage_group(me, g):
        return jsonify({'error': 'Forbidden'}), 403
    u = User.query.get_or_404(uid)
    if u in g.members:
        g.members.remove(u)
    db.session.commit()
    return jsonify({'message': 'Member removed'}), 200


@api.route('/tasks/<int:task_id>/comments', methods=['GET'])
@jwt_required()
def list_task_comments(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    rows = TaskComment.query.filter_by(task_id=task_id).order_by(TaskComment.created_at.asc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/comments', methods=['POST'])
@jwt_required()
def create_task_comment(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404
    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'body is required'}), 400
    c = TaskComment(task_id=task_id, user_id=me.id, body=body)
    db.session.add(c)
    db.session.add(
        TaskActivity(
            task_id=task_id,
            user_id=me.id,
            action='comment',
            detail_json=json.dumps({'comment_id': None}),
        )
    )
    for uid in {task.user_id, task.assignee_user_id}:
        if uid and uid != me.id:
            _notify(uid, f'Nowy komentarz: {task.topic[:80]}', task_id=task.id)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@api.route('/tasks/<int:task_id>/activities', methods=['GET'])
@jwt_required()
def list_task_activities(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    rows = (
        TaskActivity.query.filter_by(task_id=task_id)
        .order_by(TaskActivity.created_at.desc())
        .limit(200)
        .all()
    )
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/attachments', methods=['GET'])
@jwt_required()
def list_task_attachments(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404
    rows = TaskAttachment.query.filter_by(task_id=task_id).order_by(TaskAttachment.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/attachments', methods=['POST'])
@jwt_required()
def upload_task_attachment(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)
    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404
    if 'file' not in request.files:
        return jsonify({'error': 'file field required'}), 400
    f = request.files['file']
    if not f or not f.filename:
        return jsonify({'error': 'Empty file'}), 400
    orig = secure_filename(f.filename)
    ext = os.path.splitext(orig)[1].lower()
    allowed = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.doc', '.docx', '.xlsx', '.csv'}
    if ext not in allowed:
        return jsonify({'error': 'File type not allowed'}), 400
    stored = f'{uuid.uuid4().hex}{ext}'
    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, stored)
    f.save(path)
    size = os.path.getsize(path)
    if size > settings.MAX_UPLOAD_BYTES:
        try:
            os.remove(path)
        except OSError:
            pass
        return jsonify({'error': 'File too large'}), 400
    att = TaskAttachment(
        task_id=task_id,
        user_id=me.id,
        original_name=orig,
        stored_name=stored,
        mime_type=f.mimetype,
        size_bytes=size,
    )
    db.session.add(att)
    db.session.add(
        TaskActivity(
            task_id=task_id,
            user_id=me.id,
            action='attachment_upload',
            detail_json=json.dumps({'filename': orig}),
        )
    )
    db.session.commit()
    return jsonify(att.to_dict()), 201


@api.route('/attachments/<int:aid>/download', methods=['GET'])
@jwt_required()
def download_attachment(aid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    att = TaskAttachment.query.get_or_404(aid)
    task = Task.query.get(att.task_id)
    if not task or not task_visible(task, me):
        return jsonify({'error': 'Not found'}), 404
    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, att.stored_name)
    if not os.path.isfile(path):
        return jsonify({'error': 'File missing'}), 404
    return send_file(path, as_attachment=True, download_name=att.original_name)


@api.route('/attachments/<int:aid>', methods=['DELETE'])
@jwt_required()
def delete_attachment(aid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    att = TaskAttachment.query.get_or_404(aid)
    task = Task.query.get(att.task_id)
    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Not found'}), 404
    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, att.stored_name)
    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass
    db.session.delete(att)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@api.route('/notifications', methods=['GET'])
@jwt_required()
def list_notifications():
    me = User.query.get_or_404(int(get_jwt_identity()))
    rows = (
        Notification.query.filter_by(user_id=me.id)
        .order_by(Notification.created_at.desc())
        .limit(80)
        .all()
    )
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/notifications/<int:nid>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(nid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    n = Notification.query.filter_by(id=nid, user_id=me.id).first_or_404()
    n.read = True
    db.session.commit()
    return jsonify(n.to_dict()), 200


@api.route('/reports/tasks-summary', methods=['GET'])
@jwt_required()
def report_tasks_summary():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = Task.query.filter(visible_tasks_condition(me))
    total = q.count()
    done = q.filter_by(completed=True).count()
    inprog = TaskStatus.query.filter_by(code='in_progress').first()
    inprog_n = 0
    if inprog:
        inprog_n = q.filter_by(status_id=inprog.id).count()
    lines = [
        '=== Raport zadań (TeamSync) ===',
        f'Widoczne zadania: {total}',
        f'Zakończone (completed): {done}',
        f'W trakcie (status): {inprog_n}',
    ]
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/user-activity', methods=['GET'])
@jwt_required()
def report_user_activity():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify({'error': 'Forbidden'}), 403
    q_users = User.query
    if me.organization_id:
        q_users = q_users.filter(User.organization_id == me.organization_id)
    else:
        q_users = q_users.filter(User.id == me.id)
    lines = ['=== Aktywność użytkowników (liczba zdarzeń) ===']
    for u in q_users.limit(50).all():
        n = TaskActivity.query.filter_by(user_id=u.id).count()
        c = TaskComment.query.filter_by(user_id=u.id).count()
        lines.append(f'{u.username}: aktywności={n}, komentarze={c}')
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/project-progress', methods=['GET'])
@jwt_required()
def report_project_progress():
    me = User.query.get_or_404(int(get_jwt_identity()))
    base = Task.query.filter(visible_tasks_condition(me))
    lines = ['=== Postęp wg grup (widoczne zadania) ===']
    if me.organization_id:
        groups = Group.query.filter_by(organization_id=me.organization_id).order_by(Group.name).all()
    else:
        groups = Group.query.filter(Group.organization_id.is_(None)).order_by(Group.name).all()
    for g in groups:
        tq = base.filter(Task.group_id == g.id)
        tot = tq.count()
        dn = tq.filter_by(completed=True).count()
        lines.append(f'{g.name}: zakończone {dn} / {tot} łącznie')
    uq = base.filter(Task.group_id.is_(None))
    ut = uq.count()
    ud = uq.filter_by(completed=True).count()
    lines.append(f'Bez grupy: zakończone {ud} / {ut} łącznie')
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


# ========== PROJECTS ENDPOINTS ==========

@api.route('/projects', methods=['GET'])
@jwt_required()
def list_projects():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = Project.query
    if me.organization_id is not None:
        q = q.filter(Project.organization_id == me.organization_id)
    else:
        q = q.filter(Project.organization_id.is_(None))
    status = (request.args.get('status') or '').strip()
    if status in ('active', 'archived', 'draft'):
        q = q.filter(Project.status == status)
    sq = (request.args.get('q') or '').strip()
    if sq:
        pat = f'%{sq}%'
        q = q.filter(db_or(Project.name.ilike(pat), Project.description.ilike(pat)))
    projects = q.order_by(Project.created_at.desc()).limit(200).all()
    if me.role == 'client':
        projects = [p for p in projects if _project_visible(me, p)]
    return jsonify([p.to_dict() for p in projects]), 200


@api.route('/projects', methods=['POST'])
@jwt_required()
def create_project():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    status = data.get('status') or 'draft'
    if status not in ('active', 'archived', 'draft'):
        status = 'draft'

    group_id = data.get('group_id')
    if group_id is not None:
        g = Group.query.get(int(group_id))
        if not _user_can_use_group(me, g):
            return jsonify({'error': 'Invalid group'}), 400
        group_id = int(group_id)

    p = Project(
        name=name,
        description=(data.get('description') or '').strip() or None,
        status=status,
        organization_id=me.organization_id,
        group_id=group_id,
        created_by_id=me.id,
    )
    db.session.add(p)
    db.session.flush()
    if me not in p.members:
        p.members.append(me)
    db.session.commit()
    return jsonify(p.to_dict(include_members=True)), 201


@api.route('/projects/<int:pid>', methods=['GET'])
@jwt_required()
def get_project(pid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    p = Project.query.get_or_404(pid)
    if not _project_visible(me, p):
        return jsonify({'error': 'Not found'}), 404
    return jsonify(p.to_dict(include_members=True, include_tasks=True)), 200


@api.route('/projects/<int:pid>', methods=['PUT'])
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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


# ========== CALENDAR EVENTS ENDPOINTS ==========

def _event_visible(user, event):
    return event is not None and _org_match(user.organization_id, event.organization_id)


@api.route('/events', methods=['GET'])
@jwt_required()
def list_events():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = CalendarEvent.query
    if me.organization_id is not None:
        q = q.filter(CalendarEvent.organization_id == me.organization_id)
    else:
        q = q.filter(CalendarEvent.organization_id.is_(None))
    start = _parse_dt(request.args.get('start'))
    end = _parse_dt(request.args.get('end'))
    if start is not None:
        q = q.filter(CalendarEvent.end >= start)
    if end is not None:
        q = q.filter(CalendarEvent.start <= end)
    pid = request.args.get('project_id')
    if pid:
        try:
            q = q.filter(CalendarEvent.project_id == int(pid))
        except (ValueError, TypeError):
            pass
    rows = q.order_by(CalendarEvent.start.asc()).limit(500).all()
    return jsonify([e.to_dict(include_attendees=True) for e in rows]), 200


@api.route('/events', methods=['POST'])
@jwt_required()
def create_event():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400
    start = _parse_dt(data.get('start'))
    end = _parse_dt(data.get('end'))
    if start is None or end is None:
        return jsonify({'error': 'Invalid start/end. Use ISO 8601 datetime.'}), 400
    if end < start:
        return jsonify({'error': 'end must be after start'}), 400
    event_type = data.get('event_type') or 'meeting'
    if event_type not in ('meeting', 'deadline', 'reminder'):
        event_type = 'meeting'

    project_id = data.get('project_id')
    if project_id is not None:
        p = Project.query.get(int(project_id))
        if not _user_can_use_project(me, p):
            return jsonify({'error': 'Invalid project'}), 400
        project_id = int(project_id)

    task_id = data.get('task_id')
    if task_id is not None:
        t = Task.query.get(int(task_id))
        if not t or not task_visible(t, me):
            return jsonify({'error': 'Invalid task'}), 400
        task_id = int(task_id)

    ev = CalendarEvent(
        title=title,
        description=(data.get('description') or '').strip() or None,
        start=start,
        end=end,
        event_type=event_type,
        project_id=project_id,
        task_id=task_id,
        organization_id=me.organization_id,
        created_by_id=me.id,
        version=1,
    )
    db.session.add(ev)
    db.session.flush()
    if me not in ev.attendees:
        ev.attendees.append(me)
    for uid in (data.get('attendee_ids') or []):
        u = User.query.get(int(uid))
        if u and _org_match(u.organization_id, me.organization_id) and u not in ev.attendees:
            ev.attendees.append(u)
    db.session.commit()
    return jsonify(ev.to_dict(include_attendees=True)), 201


@api.route('/events/<int:eid>', methods=['GET'])
@jwt_required()
def get_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)
    if not _event_visible(me, ev):
        return jsonify({'error': 'Not found'}), 404
    return jsonify(ev.to_dict(include_attendees=True)), 200


@api.route('/events/<int:eid>', methods=['PUT'])
@jwt_required()
def update_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)
    if not _event_visible(me, ev) or me.role == 'client':
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json() or {}

    if data.get('expected_version') is not None:
        if int(data['expected_version']) != int(ev.version or 1):
            return jsonify({
                'error': 'Conflict',
                'message': 'Wydarzenie zostało już zaktualizowane przez innego użytkownika.',
                'current_version': ev.version,
            }), 409

    if 'title' in data:
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'title is required'}), 400
        ev.title = title
    if 'description' in data:
        ev.description = (data.get('description') or '').strip() or None
    if 'start' in data:
        start = _parse_dt(data.get('start'))
        if start is None:
            return jsonify({'error': 'Invalid start'}), 400
        ev.start = start
    if 'end' in data:
        end = _parse_dt(data.get('end'))
        if end is None:
            return jsonify({'error': 'Invalid end'}), 400
        ev.end = end
    if ev.end < ev.start:
        return jsonify({'error': 'end must be after start'}), 400
    if 'event_type' in data and data['event_type'] in ('meeting', 'deadline', 'reminder'):
        ev.event_type = data['event_type']
    if 'project_id' in data:
        pid = data['project_id']
        if pid is None:
            ev.project_id = None
        else:
            p = Project.query.get(int(pid))
            if not _user_can_use_project(me, p):
                return jsonify({'error': 'Invalid project'}), 400
            ev.project_id = p.id

    ev.version = int(ev.version or 1) + 1
    db.session.commit()
    return jsonify(ev.to_dict(include_attendees=True)), 200


@api.route('/events/<int:eid>', methods=['DELETE'])
@jwt_required()
def delete_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)
    if not _event_visible(me, ev) or me.role == 'client':
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(ev)
    db.session.commit()
    return jsonify({'message': 'Event deleted'}), 200


# ========== DASHBOARD (JSON) ENDPOINTS ==========

@api.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    me = User.query.get_or_404(int(get_jwt_identity()))
    tasks_q = Task.query.filter(visible_tasks_condition(me))
    active_tasks = tasks_q.filter_by(completed=False).count()

    proj_q = Project.query
    if me.organization_id is not None:
        proj_q = proj_q.filter(Project.organization_id == me.organization_id)
    else:
        proj_q = proj_q.filter(Project.organization_id.is_(None))
    projects = proj_q.all()
    if me.role == 'client':
        projects = [p for p in projects if _project_visible(me, p)]
    project_count = len(projects)

    now = datetime.utcnow()
    ev_q = CalendarEvent.query.filter(CalendarEvent.start >= now)
    if me.organization_id is not None:
        ev_q = ev_q.filter(CalendarEvent.organization_id == me.organization_id)
    else:
        ev_q = ev_q.filter(CalendarEvent.organization_id.is_(None))
    upcoming_events = ev_q.count()

    if me.organization_id is not None:
        member_count = User.query.filter_by(organization_id=me.organization_id).count()
    else:
        member_count = 1

    return jsonify({
        'projects': project_count,
        'active_tasks': active_tasks,
        'upcoming_events': upcoming_events,
        'members': member_count,
    }), 200


@api.route('/dashboard/recent-tasks', methods=['GET'])
@jwt_required()
def dashboard_recent_tasks():
    me = User.query.get_or_404(int(get_jwt_identity()))
    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5
    rows = (
        Task.query.filter(visible_tasks_condition(me))
        .order_by(Task.updated_at.desc().nullslast(), Task.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([t.to_dict() for t in rows]), 200


@api.route('/dashboard/upcoming-events', methods=['GET'])
@jwt_required()
def dashboard_upcoming_events():
    me = User.query.get_or_404(int(get_jwt_identity()))
    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5
    now = datetime.utcnow()
    q = CalendarEvent.query.filter(CalendarEvent.start >= now)
    if me.organization_id is not None:
        q = q.filter(CalendarEvent.organization_id == me.organization_id)
    else:
        q = q.filter(CalendarEvent.organization_id.is_(None))
    rows = q.order_by(CalendarEvent.start.asc()).limit(limit).all()
    return jsonify([e.to_dict() for e in rows]), 200


@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'API is running'}), 200

# ========== USER SETTINGS ENDPOINTS ==========

@api.route('/user/settings', methods=['GET'])
@jwt_required()
def get_user_settings():
    """Pobierz ustawienia użytkownika"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
        
        user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()
        
        if user_settings:
            return jsonify(user_settings.to_dict()), 200
        return jsonify({
            'id': None,
            'user_id': current_user_id,
            'settings': {},
            'updated_at': None,
            'created_at': None
        }), 200
            
    except Exception as e:
        print(f'ERROR getting user settings: {str(e)}')
        return jsonify({'error': f'Failed to get user settings: {str(e)}'}), 500

@api.route('/user/settings', methods=['POST'])
@jwt_required()
def save_user_settings():
    """Zapisz ustawienia użytkownika"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        settings = data.get('settings', {})
        
        expected_keys = ['selectedCategoryFilters', 'statusFilter', 'sortBy', 'sortOrder', 'visibleColumns', 'dateFrom', 'dateTo']
        validated_settings = {}
        for key in expected_keys:
            if key in settings:
                validated_settings[key] = settings[key]
        
        settings_json = json.dumps(validated_settings)
        
        user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()
        
        if user_settings:
            user_settings.settings_json = settings_json
            user_settings.updated_at = datetime.utcnow()
        else:
            user_settings = UserSettings(
                user_id=current_user_id,
                settings_json=settings_json
            )
            db.session.add(user_settings)
        
        try:
            db.session.commit()
        except Exception as commit_error:
            db.session.rollback()
            
            if 'unique_user_settings' in str(commit_error) or 'UniqueViolation' in str(commit_error):
                user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()
                
                if user_settings:
                    user_settings.settings_json = settings_json
                    user_settings.updated_at = datetime.utcnow()
                    db.session.commit()
                else:
                    raise commit_error
            else:
                raise
        
        return jsonify(user_settings.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        print(f'ERROR saving user settings: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to save user settings: {str(e)}'}), 500
