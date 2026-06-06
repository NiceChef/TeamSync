from datetime import datetime

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity

from access import is_internal, require_approved_user
from models import CalendarEvent, Project, Task, User
from project_access import project_visible_condition
from routes import api
from routes.helpers import _event_visible
from task_access import visible_tasks_condition


def _visible_upcoming_events(me):
    """
    Zwraca nadchodzące wydarzenia widoczne dla użytkownika.

    Internal widzi wszystko. Pozostali widzą wydarzenia:
    - swojej organizacji,
    - powiązane z widocznym projektem,
    - powiązane z widocznym zadaniem,
    - których są uczestnikami lub twórcami.

    Końcowa kontrola wykonywana jest przez _event_visible.
    """
    now = datetime.utcnow()

    rows = (
        CalendarEvent.query
        .filter(CalendarEvent.start >= now)
        .order_by(CalendarEvent.start.asc())
        .limit(700)
        .all()
    )

    return [
        event
        for event in rows
        if _event_visible(me, event)
    ]


@api.route('/dashboard/stats', methods=['GET'])
@require_approved_user
def dashboard_stats():
    me = User.query.get_or_404(int(get_jwt_identity()))

    active_tasks = (
        Task.query
        .filter(visible_tasks_condition(me))
        .filter_by(completed=False)
        .count()
    )

    projects = (
        Project.query
        .filter(project_visible_condition(me))
        .all()
    )

    upcoming_events = _visible_upcoming_events(me)

    if is_internal(me):
        member_count = User.query.count()
    else:
        member_count = (
            User.query
            .filter_by(organization_id=me.organization_id)
            .count()
        )

    return jsonify({
        'projects': len(projects),
        'active_tasks': active_tasks,
        'upcoming_events': len(upcoming_events),
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
        Task.query
        .filter(visible_tasks_condition(me))
        .order_by(
            Task.updated_at.desc().nullslast(),
            Task.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return jsonify([
        task.to_dict()
        for task in rows
    ]), 200


@api.route('/dashboard/upcoming-events', methods=['GET'])
@require_approved_user
def dashboard_upcoming_events():
    me = User.query.get_or_404(int(get_jwt_identity()))

    try:
        limit = min(int(request.args.get('limit', 5)), 50)
    except (ValueError, TypeError):
        limit = 5

    rows = _visible_upcoming_events(me)[:limit]

    return jsonify([
        event.to_dict(include_attendees=True)
        for event in rows
    ]), 200


@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'API is running',
    }), 200