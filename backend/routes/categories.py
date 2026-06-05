from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from access import is_internal, require_approved_user
from models import db, Category, Task, User
from task_access import task_visible, can_edit_task
from routes import api


@api.route('/categories', methods=['GET'])
@require_approved_user
def get_categories():
    current_user_id = int(get_jwt_identity())
    categories = Category.query.filter_by(user_id=current_user_id).all()
    return jsonify([cat.to_dict() for cat in categories]), 200


@api.route('/categories', methods=['POST'])
@require_approved_user
def create_category():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Category name is required'}), 400

    existing = Category.query.filter_by(name=name, user_id=current_user_id).first()
    if existing:
        return jsonify({'error': 'Category with this name already exists'}), 400

    category = Category(
        name=name,
        color=data.get('color'),
        user_id=current_user_id,
    )

    db.session.add(category)
    db.session.commit()

    return jsonify(category.to_dict()), 201


@api.route('/tasks/<int:task_id>/categories', methods=['GET'])
@require_approved_user
def get_task_categories(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    return jsonify([cat.to_dict() for cat in task.categories]), 200


@api.route('/tasks/<int:task_id>/categories', methods=['POST'])
@require_approved_user
def add_task_category(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404

    data = request.get_json() or {}
    if not data.get('category_id'):
        return jsonify({'error': 'category_id is required'}), 400

    category = Category.query.filter_by(
        id=int(data['category_id']),
        user_id=me.id,
    ).first_or_404()

    if category in task.categories:
        return jsonify({'error': 'Category is already assigned to this task'}), 400

    task.categories.append(category)
    db.session.commit()

    return jsonify({'message': 'Category added to task', 'category': category.to_dict()}), 200


@api.route('/tasks/<int:task_id>/categories/<int:category_id>', methods=['DELETE'])
@require_approved_user
def remove_task_category(task_id, category_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404

    category = Category.query.filter_by(id=category_id, user_id=me.id).first_or_404()

    if category not in task.categories:
        return jsonify({'error': 'Category is not assigned to this task'}), 404

    task.categories.remove(category)
    db.session.commit()

    return jsonify({'message': 'Category removed to task'}), 200