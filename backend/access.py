from functools import wraps
from datetime import datetime

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_ as db_or

from models import User, Task, Project, CalendarEvent, Group


ROLE_INTERNAL = 'internal'
ROLE_CLIENT = 'client'

APPROVAL_PENDING = 'pending'
APPROVAL_APPROVED = 'approved'
APPROVAL_REJECTED = 'rejected'

INTERNAL_EMAIL_DOMAIN = 'team-sync.com'

def username_from_email(email):
    if not email or '@' not in email:
        return ''
    return email.split('@', 1)[0].strip()

def organization_name_from_email(email):
    domain = email_domain(email)
    if not domain:
        return ''

    if domain == INTERNAL_EMAIL_DOMAIN:
        return 'TEAMSYNC'

    company = domain.split('.', 1)[0].strip()
    if not company:
        return ''

    return company.upper()

def email_domain(email):
    if not email or '@' not in email:
        return ''
    return email.rsplit('@', 1)[-1].strip().lower()


def role_from_email(email):
    if email_domain(email) == INTERNAL_EMAIL_DOMAIN:
        return ROLE_INTERNAL
    return ROLE_CLIENT


def is_internal(user):
    return bool(user and user.role == ROLE_INTERNAL)


def is_client(user):
    return bool(user and user.role == ROLE_CLIENT)


def is_pending(user):
    return bool(user and user.approval_status == APPROVAL_PENDING)


def is_approved(user):
    return bool(user and user.approval_status == APPROVAL_APPROVED)


def is_rejected(user):
    return bool(user and user.approval_status == APPROVAL_REJECTED)


def current_user_or_404():
    uid = int(get_jwt_identity())
    return User.query.get_or_404(uid)


def can_access_app(user):
    return is_approved(user)


def can_access_authorization(user):
    return is_internal(user) and is_approved(user)


def can_access_organization(user, organization_id):
    if not user or not is_approved(user):
        return False
    if is_internal(user):
        return True
    return user.organization_id == organization_id


def org_scope_filter(user, model):
    if is_internal(user):
        return True

    if not hasattr(model, 'organization_id'):
        return False

    return model.organization_id == user.organization_id


def task_visible_condition(user):
    if is_internal(user):
        return True

    return Task.organization_id == user.organization_id


def can_view_task(user, task):
    if not task or not is_approved(user):
        return False
    if is_internal(user):
        return True
    return task.organization_id == user.organization_id


def can_edit_task(user, task):
    if not can_view_task(user, task):
        return False
    if is_internal(user):
        return True
    return task.user_id == user.id or task.assignee_user_id == user.id


def can_delete_task(user, task):
    if not can_view_task(user, task):
        return False
    if is_internal(user):
        return True
    return task.user_id == user.id


def can_view_project(user, project):
    if not project or not is_approved(user):
        return False
    if is_internal(user):
        return True
    return project.organization_id == user.organization_id


def can_manage_project(user, project):
    if not can_view_project(user, project):
        return False
    if is_internal(user):
        return True
    return project.created_by_id == user.id


def can_create_project(user):
    return is_approved(user)


def can_view_event(user, event):
    if not event or not is_approved(user):
        return False
    if is_internal(user):
        return True
    return event.organization_id == user.organization_id


def can_manage_event(user, event):
    if not can_view_event(user, event):
        return False
    if is_internal(user):
        return True
    return event.created_by_id == user.id


def can_manage_group(user, group):
    if not group or not is_approved(user):
        return False
    if is_internal(user):
        return True
    return group.created_by_id == user.id and group.organization_id == user.organization_id


def require_approved_user(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        me = current_user_or_404()
        if is_pending(me):
            return jsonify({'error': 'Account pending approval', 'approval_status': APPROVAL_PENDING}), 403
        if is_rejected(me):
            return jsonify({'error': 'Account rejected', 'approval_status': APPROVAL_REJECTED}), 403
        if not is_approved(me):
            return jsonify({'error': 'Account is not approved'}), 403
        return fn(*args, **kwargs)
    return wrapper


def require_internal_user(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        me = current_user_or_404()
        if not can_access_authorization(me):
            return jsonify({'error': 'Forbidden'}), 403
        return fn(*args, **kwargs)
    return wrapper