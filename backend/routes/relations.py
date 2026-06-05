from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from access import require_approved_user
from models import db, Task, TaskRelation, User
from task_access import task_visible, can_edit_task
from routes import api


SUBTASK_DEADLINE_ERROR = 'Podzadanie nie może mieć deadline późniejszego niż zadanie nadrzędne.'


def _deadline_value(task):
    if not task or not task.deadline:
        return None
    return task.deadline


def _validate_parent_child_deadline(parent_task, child_task):
    parent_deadline = _deadline_value(parent_task)
    child_deadline = _deadline_value(child_task)

    if parent_deadline and child_deadline and child_deadline > parent_deadline:
        return False

    return True


def _has_open_deadline_violation(parent_task):
    parent_deadline = _deadline_value(parent_task)
    if not parent_deadline:
        return None

    relations = TaskRelation.query.filter_by(source_task_id=parent_task.id).all()
    child_ids = [rel.target_task_id for rel in relations]

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


@api.route('/tasks/<int:task_id>/relations', methods=['GET'])
@require_approved_user
def get_task_relations(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    direction = request.args.get('direction', 'both')

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
@require_approved_user
def create_task_relation(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    if not data.get('target_task_id'):
        return jsonify({'error': 'target_task_id is required'}), 400

    target_task_id = int(data['target_task_id'])

    if task_id == target_task_id:
        return jsonify({'error': 'Task cannot be related to itself'}), 400

    source_task = Task.query.get(task_id)
    target_task = Task.query.get(target_task_id)

    if not source_task or not task_visible(source_task, me):
        return jsonify({'error': 'Source task not found'}), 404

    if not target_task or not task_visible(target_task, me):
        return jsonify({'error': 'Target task not found'}), 404

    if not can_edit_task(source_task, me) or not can_edit_task(target_task, me):
        return jsonify({'error': 'You need edit rights on both tasks'}), 403

    if not _validate_parent_child_deadline(source_task, target_task):
        return jsonify({
            'error': 'subtask_deadline_after_parent',
            'message': SUBTASK_DEADLINE_ERROR,
            'parent_task_id': source_task.id,
            'parent_deadline': source_task.deadline.isoformat() if source_task.deadline else None,
            'child_task_id': target_task.id,
            'child_deadline': target_task.deadline.isoformat() if target_task.deadline else None,
        }), 400

    violating_child = _has_open_deadline_violation(source_task)
    if violating_child:
        return jsonify({
            'error': 'parent_deadline_before_child',
            'message': SUBTASK_DEADLINE_ERROR,
            'parent_task_id': source_task.id,
            'parent_deadline': source_task.deadline.isoformat() if source_task.deadline else None,
            'child_task_id': violating_child.id,
            'child_deadline': violating_child.deadline.isoformat() if violating_child.deadline else None,
        }), 400

    existing = TaskRelation.query.filter(
        ((TaskRelation.source_task_id == task_id) & (TaskRelation.target_task_id == target_task_id)) |
        ((TaskRelation.source_task_id == target_task_id) & (TaskRelation.target_task_id == task_id))
    ).first()

    if existing:
        return jsonify({'error': 'This relation already exists'}), 400

    relation = TaskRelation(
        source_task_id=task_id,
        target_task_id=target_task_id,
    )

    db.session.add(relation)
    db.session.commit()

    return jsonify(relation.to_dict(include_tasks=True)), 201


@api.route('/relations/<int:relation_id>', methods=['GET'])
@require_approved_user
def get_task_relation(relation_id):
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
@require_approved_user
def update_task_relation(relation_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    relation = TaskRelation.query.get_or_404(relation_id)

    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)

    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404

    if not can_edit_task(source_task, me) or not can_edit_task(target_task, me):
        return jsonify({'error': 'Access denied'}), 403

    if not _validate_parent_child_deadline(source_task, target_task):
        return jsonify({
            'error': 'subtask_deadline_after_parent',
            'message': SUBTASK_DEADLINE_ERROR,
            'parent_task_id': source_task.id,
            'parent_deadline': source_task.deadline.isoformat() if source_task.deadline else None,
            'child_task_id': target_task.id,
            'child_deadline': target_task.deadline.isoformat() if target_task.deadline else None,
        }), 400

    return jsonify(relation.to_dict(include_tasks=True)), 200


@api.route('/relations/<int:relation_id>', methods=['DELETE'])
@require_approved_user
def delete_task_relation(relation_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    relation = TaskRelation.query.get_or_404(relation_id)

    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)

    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404

    if not can_edit_task(source_task, me) or not can_edit_task(target_task, me):
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(relation)
    db.session.commit()

    return jsonify({'message': 'Relation deleted successfully'}), 200