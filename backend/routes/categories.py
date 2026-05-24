from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Category, Task, User
from task_access import task_visible
from routes import api

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
