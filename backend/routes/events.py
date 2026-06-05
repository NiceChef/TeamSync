from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from access import is_internal, require_approved_user
from models import db, CalendarEvent, Project, Task, User
from task_access import task_visible
from routes import api
from routes.helpers import (
    _org_match,
    _parse_dt,
    _user_can_use_project,
    _event_visible,
    _can_manage_event,
)


@api.route('/events', methods=['GET'])
@require_approved_user
def list_events():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = CalendarEvent.query

    if not is_internal(me):
        q = q.filter(CalendarEvent.organization_id == me.organization_id)

    start = _parse_dt(request.args.get('start'))
    end = _parse_dt(request.args.get('end'))

    if start is not None:
        q = q.filter(CalendarEvent.end >= start)
    if end is not None:
        q = q.filter(CalendarEvent.start <= end)

    pid = request.args.get('project_id')
    if pid:
        try:
            q = q.filter(CalendarEvent.project_id == int(pid))
        except (ValueError, TypeError):
            pass

    task_id = request.args.get('task_id')
    if task_id:
        try:
            q = q.filter(CalendarEvent.task_id == int(task_id))
        except (ValueError, TypeError):
            pass

    rows = q.order_by(CalendarEvent.start.asc()).limit(700).all()
    return jsonify([e.to_dict(include_attendees=True) for e in rows if _event_visible(me, e)]), 200


@api.route('/events', methods=['POST'])
@require_approved_user
def create_event():
    me = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    start = _parse_dt(data.get('start'))
    end = _parse_dt(data.get('end'))

    if start is None or end is None:
        return jsonify({'error': 'Invalid start/end. Use ISO 8601 datetime.'}), 400
    if end < start:
        return jsonify({'error': 'end must be after start'}), 400

    event_type = data.get('event_type') or 'meeting'
    if event_type not in ('meeting', 'deadline', 'reminder'):
        event_type = 'meeting'

    organization_id = me.organization_id

    project_id = data.get('project_id')
    if project_id is not None:
        p = Project.query.get(int(project_id))
        if not _user_can_use_project(me, p):
            return jsonify({'error': 'Invalid project'}), 400
        project_id = p.id
        organization_id = p.organization_id

    task_id = data.get('task_id')
    if task_id is not None:
        t = Task.query.get(int(task_id))
        if not t or not task_visible(t, me):
            return jsonify({'error': 'Invalid task'}), 400
        task_id = t.id
        if t.organization_id is not None:
            organization_id = t.organization_id

    if is_internal(me) and data.get('organization_id') is not None:
        organization_id = int(data.get('organization_id'))

    ev = CalendarEvent(
        title=title,
        description=(data.get('description') or '').strip() or None,
        start=start,
        end=end,
        event_type=event_type,
        project_id=project_id,
        task_id=task_id,
        organization_id=organization_id,
        created_by_id=me.id,
        version=1,
    )

    db.session.add(ev)
    db.session.flush()

    if me not in ev.attendees:
        ev.attendees.append(me)

    for uid in (data.get('attendee_ids') or []):
        u = User.query.get(int(uid))
        if not u:
            continue
        if is_internal(me) or _org_match(u.organization_id, organization_id):
            if u not in ev.attendees:
                ev.attendees.append(u)

    db.session.commit()
    return jsonify(ev.to_dict(include_attendees=True)), 201


@api.route('/events/<int:eid>', methods=['GET'])
@require_approved_user
def get_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)

    if not _event_visible(me, ev):
        return jsonify({'error': 'Not found'}), 404

    return jsonify(ev.to_dict(include_attendees=True)), 200


@api.route('/events/<int:eid>', methods=['PUT'])
@require_approved_user
def update_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)

    if not _can_manage_event(me, ev):
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json() or {}

    if data.get('expected_version') is not None:
        if int(data['expected_version']) != int(ev.version or 1):
            return jsonify({
                'error': 'Conflict',
                'message': 'Wydarzenie zostało już zaktualizowane przez innego użytkownika.',
                'current_version': ev.version,
            }), 409

    if 'title' in data:
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'title is required'}), 400
        ev.title = title

    if 'description' in data:
        ev.description = (data.get('description') or '').strip() or None

    if 'start' in data:
        start = _parse_dt(data.get('start'))
        if start is None:
            return jsonify({'error': 'Invalid start'}), 400
        ev.start = start

    if 'end' in data:
        end = _parse_dt(data.get('end'))
        if end is None:
            return jsonify({'error': 'Invalid end'}), 400
        ev.end = end

    if ev.end < ev.start:
        return jsonify({'error': 'end must be after start'}), 400

    if 'event_type' in data and data['event_type'] in ('meeting', 'deadline', 'reminder'):
        ev.event_type = data['event_type']

    if 'project_id' in data:
        pid = data['project_id']
        if pid is None:
            ev.project_id = None
        else:
            p = Project.query.get(int(pid))
            if not _user_can_use_project(me, p):
                return jsonify({'error': 'Invalid project'}), 400
            ev.project_id = p.id
            ev.organization_id = p.organization_id

    if 'task_id' in data:
        tid = data['task_id']
        if tid is None:
            ev.task_id = None
        else:
            t = Task.query.get(int(tid))
            if not t or not task_visible(t, me):
                return jsonify({'error': 'Invalid task'}), 400
            ev.task_id = t.id
            if t.organization_id is not None:
                ev.organization_id = t.organization_id

    if is_internal(me) and data.get('organization_id') is not None:
        ev.organization_id = int(data.get('organization_id'))

    if 'attendee_ids' in data:
        ev.attendees.clear()
        if me not in ev.attendees:
            ev.attendees.append(me)
        for uid in (data.get('attendee_ids') or []):
            u = User.query.get(int(uid))
            if not u:
                continue
            if is_internal(me) or _org_match(u.organization_id, ev.organization_id):
                if u not in ev.attendees:
                    ev.attendees.append(u)

    ev.version = int(ev.version or 1) + 1
    db.session.commit()

    return jsonify(ev.to_dict(include_attendees=True)), 200


@api.route('/events/<int:eid>', methods=['DELETE'])
@require_approved_user
def delete_event(eid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    ev = CalendarEvent.query.get_or_404(eid)

    if not _can_manage_event(me, ev):
        return jsonify({'error': 'Not found'}), 404

    db.session.delete(ev)
    db.session.commit()

    return jsonify({'message': 'Event deleted'}), 200