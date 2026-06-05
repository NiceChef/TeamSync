from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from access import (
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
    APPROVAL_REJECTED,
    ROLE_CLIENT,
    ROLE_INTERNAL,
    organization_name_from_email,
    require_internal_user,
)
from models import db, User, Organization
from routes import api

def _current_internal_user():
    return User.query.get_or_404(int(get_jwt_identity()))

def _normalize_role(value):
    role = (value or ROLE_CLIENT).strip().lower()
    if role not in (ROLE_CLIENT, ROLE_INTERNAL):
        return ROLE_CLIENT
    return role

def _organization_payload(org):
    return {
        'id': org.id,
        'name': org.name,
        'created_at': org.created_at.isoformat() if org.created_at else None,
        'user_count': len(org.users) if org.users is not None else 0,
    }

def _get_or_create_internal_organization():
    org = Organization.query.filter(db.func.lower(Organization.name) == 'teamsync').first()
    if not org:
        org = Organization(name='TEAMSYNC')
        db.session.add(org)
        db.session.flush()
    else:
        org.name = 'TEAMSYNC'
    return org

def _user_payload(user):
    data = user.to_dict()
    data['suggested_organization_name'] = organization_name_from_email(user.email)
    return data

@api.route('/authorization/users', methods=['GET'])
@require_internal_user
def authorization_users():
    status = (request.args.get('status') or '').strip().lower()
    q = User.query

    if status:
        q = q.filter(User.approval_status == status)

    users = q.order_by(User.created_at.desc()).limit(300).all()

    return jsonify([_user_payload(u) for u in users]), 200

@api.route('/authorization/pending-users', methods=['GET'])
@require_internal_user
def authorization_pending_users():
    users = (
        User.query
        .filter(User.approval_status == APPROVAL_PENDING)
        .order_by(User.created_at.asc())
        .limit(300)
        .all()
    )
    return jsonify([_user_payload(u) for u in users]), 200

@api.route('/authorization/organizations', methods=['GET'])
@require_internal_user
def authorization_organizations():
    q = (request.args.get('q') or '').strip()
    query = Organization.query

    if q:
        query = query.filter(Organization.name.ilike(f'%{q}%'))

    organizations = query.order_by(Organization.name.asc()).limit(300).all()
    return jsonify([_organization_payload(org) for org in organizations]), 200

@api.route('/authorization/organizations', methods=['POST'])
@require_internal_user
def authorization_create_organization():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip().upper()

    if not name:
        return jsonify({'error': 'Organization name is required'}), 400

    existing = Organization.query.filter(db.func.lower(Organization.name) == name.lower()).first()
    if existing:
        return jsonify({'error': 'Organization already exists'}), 400

    org = Organization(name=name)
    db.session.add(org)
    db.session.commit()

    return jsonify(_organization_payload(org)), 201

@api.route('/authorization/users/<int:user_id>/approve', methods=['POST'])
@require_internal_user
def authorization_approve_user(user_id):
    me = _current_internal_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if user.id == me.id and user.role != ROLE_INTERNAL:
        return jsonify({'error': 'You cannot downgrade yourself while approving'}), 400

    role = _normalize_role(data.get('role') or user.role)
    organization_id = data.get('organization_id')

    if role == ROLE_INTERNAL:
        org = _get_or_create_internal_organization()
        user.organization_id = org.id
    else:
        if organization_id is None:
            return jsonify({'error': 'organization_id is required for client users'}), 400

        org = Organization.query.get(int(organization_id))
        if not org:
            return jsonify({'error': 'Organization not found'}), 404

        user.organization_id = org.id

    user.role = role
    user.approval_status = APPROVAL_APPROVED
    user.approved_by_id = me.id
    user.approved_at = datetime.utcnow()

    db.session.commit()

    return jsonify(_user_payload(user)), 200

@api.route('/authorization/users/<int:user_id>/reject', methods=['POST'])
@require_internal_user
def authorization_reject_user(user_id):
    me = _current_internal_user()
    user = User.query.get_or_404(user_id)

    if user.id == me.id:
        return jsonify({'error': 'You cannot reject yourself'}), 400

    user.approval_status = APPROVAL_REJECTED
    user.approved_by_id = me.id
    user.approved_at = datetime.utcnow()

    db.session.commit()

    return jsonify(_user_payload(user)), 200

@api.route('/authorization/users/<int:user_id>/pending', methods=['POST'])
@require_internal_user
def authorization_mark_user_pending(user_id):
    me = _current_internal_user()
    user = User.query.get_or_404(user_id)

    if user.id == me.id:
        return jsonify({'error': 'You cannot mark yourself as pending'}), 400

    user.approval_status = APPROVAL_PENDING
    user.approved_by_id = None
    user.approved_at = None

    db.session.commit()

    return jsonify(_user_payload(user)), 200

@api.route('/authorization/users/<int:user_id>/organization', methods=['PUT'])
@require_internal_user
def authorization_update_user_organization(user_id):
    me = _current_internal_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if user.id == me.id and data.get('role') == ROLE_CLIENT:
        return jsonify({'error': 'You cannot downgrade yourself'}), 400

    role = _normalize_role(data.get('role') or user.role)

    if role == ROLE_INTERNAL:
        org = _get_or_create_internal_organization()
        user.organization_id = org.id
    else:
        organization_id = data.get('organization_id')

        if organization_id is None:
            return jsonify({'error': 'organization_id is required for client users'}), 400

        org = Organization.query.get(int(organization_id))
        if not org:
            return jsonify({'error': 'Organization not found'}), 404

        user.organization_id = org.id

    user.role = role

    db.session.commit()

    return jsonify(_user_payload(user)), 200