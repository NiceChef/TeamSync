import hashlib
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from sqlalchemy import or_ as db_or
from config import settings
from models import (
    db,
    User,
    Organization,
    PasswordResetToken,
    RevokedToken,
    Task,
    TaskComment,
    TaskActivity,
    TaskAttachment,
    Notification,
    Category,
    CalendarEvent,
)
from access import (
    APPROVAL_PENDING,
    ROLE_CLIENT,
    ROLE_INTERNAL,
    is_internal,
    organization_name_from_email,
    require_approved_user,
    role_from_email,
    username_from_email,
)

auth = Blueprint('auth', __name__, url_prefix='/api/auth')
users = Blueprint('users', __name__, url_prefix='/api')

def revoke_jti(jti: str) -> None:
    if not RevokedToken.query.filter_by(jti=jti).first():
        db.session.add(RevokedToken(jti=jti))
        db.session.commit()

def is_jti_revoked(jti: str) -> bool:
    return RevokedToken.query.filter_by(jti=jti).first() is not None

def _token_claims(user: User) -> dict:
    return {
        'role': user.role or ROLE_CLIENT,
        'approval_status': user.approval_status or APPROVAL_PENDING,
        'organization_id': user.organization_id,
    }

def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def _unique_username_from_email(email: str) -> str:
    base = username_from_email(email)
    if not base:
        base = 'user'

    candidate = base
    counter = 2

    while User.query.filter_by(username=candidate).first():
        candidate = f'{base}{counter}'
        counter += 1

    return candidate

def _user_payload(user):
    data = user.to_dict()
    data['suggested_organization_name'] = organization_name_from_email(user.email)
    return data

@auth.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if '@' not in email:
        return jsonify({'error': 'Valid email is required'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    user = User(
        username=_unique_username_from_email(email),
        email=email,
        role=role_from_email(email),
        approval_status=APPROVAL_PENDING,
        organization_id=None,
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'User registered successfully. Account is pending approval.',
        'user': user.to_dict(),
    }), 201

@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    claims = _token_claims(user)
    access_token = create_access_token(identity=str(user.id), additional_claims=claims)
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims=claims)

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
        'approval_status': user.approval_status or APPROVAL_PENDING,
    }), 200

@auth.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id_str = get_jwt_identity()

    jti = get_jwt()['jti']
    if is_jti_revoked(jti):
        return jsonify({'error': 'Token has been revoked'}), 401

    user = User.query.get(int(current_user_id_str))
    claims = _token_claims(user) if user else {
        'role': ROLE_CLIENT,
        'approval_status': APPROVAL_PENDING,
        'organization_id': None,
    }
    access_token = create_access_token(identity=current_user_id_str, additional_claims=claims)

    return jsonify({'access_token': access_token}), 200

@auth.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    revoke_jti(get_jwt()['jti'])

    return jsonify({'message': 'Successfully logged out'}), 200

@auth.route('/logout/refresh', methods=['POST'])
@jwt_required(refresh=True)
def logout_refresh():
    revoke_jti(get_jwt()['jti'])

    return jsonify({'message': 'Successfully logged out'}), 200

@auth.route('/change-password', methods=['POST'])
@require_approved_user
def change_password():
    uid = int(get_jwt_identity())
    user = User.query.get_or_404(uid)
    data = request.get_json() or {}
    old_pw = data.get('old_password')
    new_pw = data.get('new_password')
    if not old_pw or not new_pw:
        return jsonify({'error': 'old_password and new_password are required'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    if not user.check_password(old_pw):
        return jsonify({'error': 'Invalid current password'}), 400
    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password updated'}), 200

@auth.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    user = User.query.filter_by(email=email).first() if email else None

    if user:
        raw = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)
        PasswordResetToken.query.filter_by(user_id=user.id).delete()
        db.session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_reset_token(raw),
                expires_at=expires,
            )
        )
        db.session.commit()

    msg = {'message': 'Jeśli konto istnieje, wysłano instrukcję resetu (w dev token może być w odpowiedzi).'}
    if user and settings.FLASK_ENV == 'development':
        msg['dev_reset_token'] = raw
    return jsonify(msg), 200

@auth.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token')
    new_pw = data.get('new_password')
    if not token or not new_pw:
        return jsonify({'error': 'token and new_password are required'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'new_password must be at least 6 characters'}), 400

    row = PasswordResetToken.query.filter_by(token_hash=_hash_reset_token(token)).first()
    if not row or row.expires_at < datetime.utcnow():
        return jsonify({'error': 'Invalid or expired token'}), 400

    u = User.query.get(row.user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 400
    u.set_password(new_pw)
    db.session.delete(row)
    db.session.commit()
    return jsonify({'message': 'Password has been reset'}), 200


@auth.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_id = int(get_jwt_identity())
    user = User.query.get_or_404(current_user_id)
    return jsonify(user.to_dict()), 200

@users.route('/users', methods=['GET'])
@require_approved_user
def get_users():
    current_user_id = int(get_jwt_identity())
    me = User.query.get_or_404(current_user_id)

    q = (request.args.get('q') or '').strip()

    query = User.query
    if not is_internal(me):
        query = query.filter(User.organization_id == me.organization_id)

    if q:
        like = f'%{q}%'
        query = query.filter(
            db_or(
                User.username.ilike(like),
                User.email.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
            )
        )

    found = query.order_by(User.username).limit(200).all()
    return jsonify([_user_payload(u) for u in found]), 200

@users.route('/users/<int:user_id>', methods=['GET'])
@require_approved_user
def get_user(user_id):
    current_user_id = int(get_jwt_identity())
    me = User.query.get_or_404(current_user_id)
    user = User.query.get_or_404(user_id)

    if is_internal(me):
        return jsonify(_user_payload(user)), 200

    if current_user_id == user_id:
        return jsonify(_user_payload(user)), 200

    if me.organization_id and user.organization_id == me.organization_id:
        return jsonify(_user_payload(user)), 200

    return jsonify({'error': 'You can only view users from your organization'}), 403

@users.route('/users/<int:user_id>', methods=['PUT'])
@require_approved_user
def update_user(user_id):
    current_user_id = int(get_jwt_identity())

    if current_user_id != user_id:
        return jsonify({'error': 'You can only update your own profile'}), 403

    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'email' in data and data['email'] != user.email:
        return jsonify({'error': 'Email cannot be changed'}), 400

    if 'username' in data:
        username = (data.get('username') or '').strip()
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        if User.query.filter_by(username=username).filter(User.id != user_id).first():
            return jsonify({'error': 'Username already exists'}), 400
        user.username = username

    if 'first_name' in data:
        user.first_name = data['first_name'] or None
    if 'last_name' in data:
        user.last_name = data['last_name'] or None
    if 'phone' in data:
        user.phone = data['phone'] or None

    db.session.commit()
    return jsonify(user.to_dict()), 200

@users.route('/users/<int:user_id>', methods=['DELETE'])
@require_approved_user
def delete_user(user_id):
    current_user_id = int(get_jwt_identity())

    if current_user_id != user_id:
        return jsonify({'error': 'You can only delete your own account'}), 403

    user = User.query.get_or_404(user_id)
    _purge_user_references(user)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'}), 200

def _purge_user_references(user: User) -> None:
    """Usuwa/odłącza wszystko, co odwołuje się do usera, zanim go skasujemy.

    Zadania, których jest właścicielem, kasują się kaskadą (User.tasks), a wraz
    z nimi ich komentarze/aktywności/załączniki/powiadomienia (kaskady na Task).
    Tu sprzątamy referencje spoza tej kaskady, które inaczej rzuciłyby błąd FK.
    """
    uid = user.id

    # Wydarzenia kalendarza wskazujące zadania usera — odłącz (FK bez kaskady).
    owned_task_ids = [t.id for t in Task.query.filter_by(user_id=uid).all()]
    if owned_task_ids:
        CalendarEvent.query.filter(CalendarEvent.task_id.in_(owned_task_ids)).update(
            {'task_id': None}, synchronize_session=False
        )

    # Referencje na cudzych zadaniach.
    Task.query.filter_by(assignee_user_id=uid).update(
        {'assignee_user_id': None}, synchronize_session=False
    )
    TaskComment.query.filter_by(user_id=uid).delete(synchronize_session=False)
    TaskActivity.query.filter_by(user_id=uid).update(
        {'user_id': None}, synchronize_session=False
    )
    TaskAttachment.query.filter_by(user_id=uid).delete(synchronize_session=False)
    Notification.query.filter_by(user_id=uid).delete(synchronize_session=False)
    PasswordResetToken.query.filter_by(user_id=uid).delete(synchronize_session=False)

    # Kategorie usera (kasujemy pojedynczo, by SQLAlchemy posprzątał task_categories).
    for cat in Category.query.filter_by(user_id=uid).all():
        db.session.delete(cat)

    # Członkostwa M2M (group_members / project_members / calendar_event_attendees).
    user.groups.clear()
    user.projects.clear()
    user.calendar_events.clear()

    db.session.flush()
