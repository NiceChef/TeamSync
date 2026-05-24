from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Task, TaskRelation, User
from task_access import task_visible, can_edit_task
from routes import api

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
    """Utwórz relację między zadaniami (wymaga prawa edycji obu zadań)."""
    me = User.query.get_or_404(int(get_jwt_identity()))

    data = request.get_json() or {}
    if not data.get('target_task_id'):
        return jsonify({'error': 'target_task_id is required'}), 400
    target_task_id = data['target_task_id']

    # Zapobiegaj relacji zadania z samym sobą
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
    me = User.query.get_or_404(int(get_jwt_identity()))

    relation = TaskRelation.query.get_or_404(relation_id)

    source_task = Task.query.get(relation.source_task_id)
    target_task = Task.query.get(relation.target_task_id)

    if not source_task or not target_task:
        return jsonify({'error': 'Related tasks not found'}), 404

    if not can_edit_task(source_task, me) or not can_edit_task(target_task, me):
        return jsonify({'error': 'Access denied'}), 403

    # Obecnie relacja nie ma pól do aktualizacji (tylko source_task_id i target_task_id)
    # Jeśli potrzebujesz zmienić relację, usuń starą i utwórz nową
    return jsonify(relation.to_dict(include_tasks=True)), 200

@api.route('/relations/<int:relation_id>', methods=['DELETE'])
@jwt_required()
def delete_task_relation(relation_id):
    """Usuń relację (wymaga prawa edycji obu zadań)."""
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
