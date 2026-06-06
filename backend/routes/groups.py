from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import or_ as db_or

from access import is_internal, is_approved, require_approved_user
from models import db, Group, Organization, User
from routes import api
from routes.helpers import _org_match, _can_manage_group

def _current_user():
    return User.query.get_or_404(int(get_jwt_identity()))

def _group_payload(group, include_members=False):
    approved_members = [
        user
        for user in group.members or []
        if is_approved(user)
    ]

    payload = group.to_dict()
    payload['organization_name'] = (
        group.organization.name
        if group.organization
        else None
    )
    payload['member_count'] = len(approved_members)

    if include_members:
        payload['members'] = [
            user.to_dict()
            for user in sorted(
                approved_members,
                key=lambda member: (
                    member.username or member.email or ''
                ).lower(),
            )
        ]

    return payload

def _organization_payload(organization):
    approved_users = [
        user
        for user in organization.users or []
        if is_approved(user)
    ]

    return {
        **organization.to_dict(),
        'user_count': len(approved_users),
        'group_count': len(organization.groups or []),
    }

def _organization_for_actor(actor, organization_id=None):
    if is_internal(actor) and organization_id is not None:
        return Organization.query.get(int(organization_id))

    if actor.organization_id is None:
        return None

    return Organization.query.get(actor.organization_id)


def _group_name_exists(name, organization_id, excluded_group_id=None):
    query = Group.query.filter(
        Group.organization_id == organization_id,
        db.func.lower(Group.name) == name.lower(),
    )

    if excluded_group_id is not None:
        query = query.filter(Group.id != excluded_group_id)

    return query.first() is not None


@api.route('/organizations', methods=['GET'])
@require_approved_user
def list_visible_organizations():
    me = _current_user()
    query = Organization.query

    if not is_internal(me):
        query = query.filter(Organization.id == me.organization_id)

    search = (request.args.get('q') or '').strip()
    if search:
        query = query.filter(Organization.name.ilike(f'%{search}%'))

    organizations = query.order_by(Organization.name.asc()).limit(300).all()

    return jsonify([
        _organization_payload(organization)
        for organization in organizations
    ]), 200


@api.route('/groups', methods=['GET'])
@require_approved_user
def list_groups():
    me = _current_user()
    query = Group.query

    if not is_internal(me):
        query = query.filter(Group.organization_id == me.organization_id)

    organization_id = request.args.get('organization_id')
    if organization_id is not None:
        try:
            organization_id = int(organization_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid organization_id'}), 400

        if not is_internal(me) and organization_id != me.organization_id:
            return jsonify({'error': 'Forbidden'}), 403

        query = query.filter(Group.organization_id == organization_id)

    search = (request.args.get('q') or '').strip()
    if search:
        pattern = f'%{search}%'
        query = query.filter(
            db_or(
                Group.name.ilike(pattern),
                Group.department.ilike(pattern),
            )
        )

    groups = query.order_by(Group.name.asc()).limit(300).all()

    return jsonify([
        _group_payload(group)
        for group in groups
    ]), 200


@api.route('/groups', methods=['POST'])
@require_approved_user
def create_group():
    me = _current_user()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    organization = _organization_for_actor(
        me,
        data.get('organization_id'),
    )

    if not organization:
        return jsonify({'error': 'Organization is required'}), 400

    if _group_name_exists(name, organization.id):
        return jsonify({
            'error': 'Group with this name already exists in organization',
        }), 400

    group = Group(
        name=name,
        department=(data.get('department') or '').strip() or None,
        organization_id=organization.id,
        created_by_id=me.id,
    )

    db.session.add(group)
    db.session.flush()

    member_ids = data.get('member_ids') or []

    for member_id in member_ids:
        try:
            member_id = int(member_id)
        except (TypeError, ValueError):
            continue

        member = User.query.get(member_id)

        if not member or not is_approved(member):
            continue

        if not _org_match(member.organization_id, organization.id):
            continue

        if member not in group.members:
            group.members.append(member)

    db.session.commit()

    return jsonify(_group_payload(group, include_members=True)), 201


@api.route('/groups/<int:group_id>', methods=['GET'])
@require_approved_user
def get_group(group_id):
    me = _current_user()
    group = Group.query.get_or_404(group_id)

    if not is_internal(me) and not _org_match(
        me.organization_id,
        group.organization_id,
    ):
        return jsonify({'error': 'Not found'}), 404

    return jsonify(_group_payload(group, include_members=True)), 200


@api.route('/groups/<int:group_id>', methods=['PUT'])
@require_approved_user
def update_group(group_id):
    me = _current_user()
    group = Group.query.get_or_404(group_id)

    if not _can_manage_group(me, group):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()

        if not name:
            return jsonify({'error': 'Group name is required'}), 400

        if _group_name_exists(name, group.organization_id, group.id):
            return jsonify({
                'error': 'Group with this name already exists in organization',
            }), 400

        group.name = name

    if 'department' in data:
        group.department = (data.get('department') or '').strip() or None

    db.session.commit()

    return jsonify(_group_payload(group, include_members=True)), 200


@api.route('/groups/<int:group_id>', methods=['DELETE'])
@require_approved_user
def delete_group(group_id):
    me = _current_user()
    group = Group.query.get_or_404(group_id)

    if not _can_manage_group(me, group):
        return jsonify({'error': 'Forbidden'}), 403

    group.members.clear()
    db.session.delete(group)
    db.session.commit()

    return jsonify({'message': 'Group deleted'}), 200


@api.route('/groups/<int:group_id>/members', methods=['POST'])
@require_approved_user
def add_group_member(group_id):
    me = _current_user()
    group = Group.query.get_or_404(group_id)

    if not _can_manage_group(me, group):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    user_id = data.get('user_id')

    if user_id is None:
        return jsonify({'error': 'user_id is required'}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid user_id'}), 400

    user = User.query.get(user_id)

    if not user or not is_approved(user):
        return jsonify({'error': 'User not found'}), 404

    if not _org_match(user.organization_id, group.organization_id):
        return jsonify({
            'error': 'User must belong to the group organization',
        }), 400

    if user not in group.members:
        group.members.append(user)
        db.session.commit()

    return jsonify(_group_payload(group, include_members=True)), 200


@api.route('/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
@require_approved_user
def remove_group_member(group_id, user_id):
    me = _current_user()
    group = Group.query.get_or_404(group_id)

    if not _can_manage_group(me, group):
        return jsonify({'error': 'Forbidden'}), 403

    user = User.query.get_or_404(user_id)

    if user in group.members:
        group.members.remove(user)
        db.session.commit()

    return jsonify(_group_payload(group, include_members=True)), 200