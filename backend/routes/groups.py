from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_ as db_or

from models import db, Group, User
from routes import api
from routes.helpers import _org_match, _can_manage_group


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
