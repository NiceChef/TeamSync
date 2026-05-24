from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or

from models import db, Project, Group, User
from routes import api
from routes.helpers import (
    _org_match,
    _project_visible,
    _can_manage_project,
    _user_can_use_group,
)

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
