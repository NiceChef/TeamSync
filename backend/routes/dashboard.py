from datetime import datetime

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import Task, Project, CalendarEvent, User
from task_access import visible_tasks_condition
from routes import api
from routes.helpers import _project_visible

# ========== DASHBOARD (JSON) ENDPOINTS ==========

@api.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    me = User.query.get_or_404(int(get_jwt_identity()))
    tasks_q = Task.query.filter(visible_tasks_condition(me))
    active_tasks = tasks_q.filter_by(completed=False).count()

    proj_q = Project.query
    if me.organization_id is not None:
        proj_q = proj_q.filter(Project.organization_id == me.organization_id)
    else:
        proj_q = proj_q.filter(Project.organization_id.is_(None))
    projects = proj_q.all()
    if me.role == 'client':
        projects = [p for p in projects if _project_visible(me, p)]
    project_count = len(projects)

    now = datetime.utcnow()
    ev_q = CalendarEvent.query.filter(CalendarEvent.start >= now)
    if me.organization_id is not None:
        ev_q = ev_q.filter(CalendarEvent.organization_id == me.organization_id)
    else:
        ev_q = ev_q.filter(CalendarEvent.organization_id.is_(None))
    upcoming_events = ev_q.count()

    if me.organization_id is not None:
        member_count = User.query.filter_by(organization_id=me.organization_id).count()
    else:
        member_count = 1

    return jsonify({
        'projects': project_count,
        'active_tasks': active_tasks,
        'upcoming_events': upcoming_events,
        'members': member_count,
    }), 200


@api.route('/dashboard/recent-tasks', methods=['GET'])
@jwt_required()
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
@jwt_required()
def dashboard_upcoming_events():
    me = User.query.get_or_404(int(get_jwt_identity()))
    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5
    now = datetime.utcnow()
    q = CalendarEvent.query.filter(CalendarEvent.start >= now)
    if me.organization_id is not None:
        q = q.filter(CalendarEvent.organization_id == me.organization_id)
    else:
        q = q.filter(CalendarEvent.organization_id.is_(None))
    rows = q.order_by(CalendarEvent.start.asc()).limit(limit).all()
    return jsonify([e.to_dict() for e in rows]), 200


@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'API is running'}), 200
