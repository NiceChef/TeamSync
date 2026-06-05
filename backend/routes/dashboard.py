from datetime import datetime

from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from access import is_internal, require_approved_user
from models import Task, Project, CalendarEvent, User
from task_access import visible_tasks_condition
from routes import api
from routes.helpers import _project_visible


@api.route('/dashboard/stats', methods=['GET'])
@require_approved_user
def dashboard_stats():
    me = User.query.get_or_404(int(get_jwt_identity()))

    tasks_q = Task.query.filter(visible_tasks_condition(me))
    active_tasks = tasks_q.filter_by(completed=False).count()

    proj_q = Project.query
    if not is_internal(me):
        proj_q = proj_q.filter(Project.organization_id == me.organization_id)
    projects = [p for p in proj_q.all() if _project_visible(me, p)]

    now = datetime.utcnow()
    ev_q = CalendarEvent.query.filter(CalendarEvent.start >= now)
    if not is_internal(me):
        ev_q = ev_q.filter(CalendarEvent.organization_id == me.organization_id)

    if is_internal(me):
        member_count = User.query.count()
    else:
        member_count = User.query.filter_by(organization_id=me.organization_id).count()

    return jsonify({
        'projects': len(projects),
        'active_tasks': active_tasks,
        'upcoming_events': ev_q.count(),
        'members': member_count,
    }), 200


@api.route('/dashboard/recent-tasks', methods=['GET'])
@require_approved_user
def dashboard_recent_tasks():
    me = User.query.get_or_404(int(get_jwt_identity()))

    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5

    rows = (
        Task.query.filter(visible_tasks_condition(me))
        .order_by(Task.updated_at.desc().nullslast(), Task.created_at.desc())
        .limit(limit)
        .all()
    )

    return jsonify([t.to_dict() for t in rows]), 200


@api.route('/dashboard/upcoming-events', methods=['GET'])
@require_approved_user
def dashboard_upcoming_events():
    me = User.query.get_or_404(int(get_jwt_identity()))

    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5

    now = datetime.utcnow()
    q = CalendarEvent.query.filter(CalendarEvent.start >= now)

    if not is_internal(me):
        q = q.filter(CalendarEvent.organization_id == me.organization_id)

    rows = q.order_by(CalendarEvent.start.asc()).limit(limit).all()
    return jsonify([e.to_dict() for e in rows]), 200


@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'API is running'}), 200