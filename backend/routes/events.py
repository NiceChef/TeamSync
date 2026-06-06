from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity

from access import is_internal, require_approved_user
from models import CalendarEvent, Project, Task, User, db
from project_access import project_has_full_access
from routes import api
from routes.helpers import (
    _can_manage_event,
    _event_visible,
    _org_match,
    _parse_dt,
)
from task_access import task_visible


def _resolve_event_relations(actor, data, current_event=None):
    project = current_event.project if current_event else None
    task = current_event.task if current_event else None

    if 'project_id' in data:
        project_id = data.get('project_id')

        if project_id in (None, ''):
            project = None
        else:
            project = Project.query.get(int(project_id))

            if not project:
                return None, (
                    jsonify({'error': 'Project not found'}),
                    404,
                )

    if 'task_id' in data:
        task_id = data.get('task_id')

        if task_id in (None, ''):
            task = None
        else:
            task = Task.query.get(int(task_id))

            if not task or not task_visible(task, actor):
                return None, (
                    jsonify({'error': 'Task not found'}),
                    404,
                )

    if project and task and task.project_id != project.id:
        return None, (
            jsonify({
                'error': 'Selected task does not belong to selected project',
            }),
            400,
        )

    # Wydarzenie całego projektu wymaga pełnego dostępu.
    # Osoba z częściowym dostępem może utworzyć wydarzenie swojego zadania.
    if project and task is None and not project_has_full_access(project, actor):
        return None, (
            jsonify({
                'error': 'Full project access is required',
            }),
            403,
        )

    if project:
        organization_id = project.organization_id
    elif task:
        organization_id = task.organization_id
    else:
        organization_id = actor.organization_id

    if is_internal(actor) and data.get('organization_id') not in (None, ''):
        organization_id = int(data['organization_id'])

    return {
        'project': project,
        'task': task,
        'organization_id': organization_id,
    }, None


def _sync_event_attendees(event, actor, attendee_ids):
    attendees = []

    if actor not in attendees:
        attendees.append(actor)

    for raw_user_id in attendee_ids or []:
        try:
            user_id = int(raw_user_id)
        except (ValueError, TypeError):
            continue

        user = User.query.get(user_id)

        if not user:
            continue

        if not is_internal(actor):
            same_organization = _org_match(
                user.organization_id,
                event.organization_id,
            )

            project_member = (
                event.project
                and event.project.user_has_full_access(user)
            )

            task_member = (
                event.task
                and task_visible(event.task, user)
            )

            if not (
                same_organization
                or project_member
                or task_member
            ):
                continue

        if user not in attendees:
            attendees.append(user)

    event.attendees = attendees


@api.route('/events', methods=['GET'])
@require_approved_user
def list_events():
    me = User.query.get_or_404(int(get_jwt_identity()))
    query = CalendarEvent.query

    start = _parse_dt(request.args.get('start'))
    end = _parse_dt(request.args.get('end'))

    if start is not None:
        query = query.filter(CalendarEvent.end >= start)

    if end is not None:
        query = query.filter(CalendarEvent.start <= end)

    project_id = request.args.get('project_id')

    if project_id not in (None, ''):
        try:
            query = query.filter(
                CalendarEvent.project_id == int(project_id)
            )
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid project_id'}), 400

    task_id = request.args.get('task_id')

    if task_id not in (None, ''):
        try:
            query = query.filter(
                CalendarEvent.task_id == int(task_id)
            )
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid task_id'}), 400

    rows = (
        query
        .order_by(CalendarEvent.start.asc())
        .limit(700)
        .all()
    )

    visible_events = [
        event
        for event in rows
        if _event_visible(me, event)
    ]

    return jsonify([
        event.to_dict(include_attendees=True)
        for event in visible_events
    ]), 200


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
        return jsonify({
            'error': 'Invalid start/end. Use ISO 8601 datetime.',
        }), 400

    if end < start:
        return jsonify({'error': 'end must be after start'}), 400

    event_type = data.get('event_type') or 'meeting'

    if event_type not in ('meeting', 'deadline', 'reminder'):
        event_type = 'meeting'

    relations, relations_error = _resolve_event_relations(me, data)

    if relations_error:
        return relations_error

    event = CalendarEvent(
        title=title,
        description=(data.get('description') or '').strip() or None,
        start=start,
        end=end,
        event_type=event_type,
        project_id=(
            relations['project'].id
            if relations['project']
            else None
        ),
        task_id=(
            relations['task'].id
            if relations['task']
            else None
        ),
        organization_id=relations['organization_id'],
        created_by_id=me.id,
        version=1,
    )

    db.session.add(event)
    db.session.flush()

    _sync_event_attendees(
        event,
        me,
        data.get('attendee_ids') or [],
    )

    db.session.commit()

    return jsonify(
        event.to_dict(include_attendees=True)
    ), 201


@api.route('/events/<int:event_id>', methods=['GET'])
@require_approved_user
def get_event(event_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    event = CalendarEvent.query.get_or_404(event_id)

    if not _event_visible(me, event):
        return jsonify({'error': 'Not found'}), 404

    return jsonify(
        event.to_dict(include_attendees=True)
    ), 200


@api.route('/events/<int:event_id>', methods=['PUT'])
@require_approved_user
def update_event(event_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    event = CalendarEvent.query.get_or_404(event_id)

    if not _can_manage_event(me, event):
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json() or {}

    if data.get('expected_version') is not None:
        if int(data['expected_version']) != int(event.version or 1):
            return jsonify({
                'error': 'Conflict',
                'message': (
                    'Wydarzenie zostało już zaktualizowane '
                    'przez innego użytkownika.'
                ),
                'current_version': event.version,
            }), 409

    if 'title' in data:
        title = (data.get('title') or '').strip()

        if not title:
            return jsonify({'error': 'title is required'}), 400

        event.title = title

    if 'description' in data:
        event.description = (
            data.get('description') or ''
        ).strip() or None

    if 'start' in data:
        start = _parse_dt(data.get('start'))

        if start is None:
            return jsonify({'error': 'Invalid start'}), 400

        event.start = start

    if 'end' in data:
        end = _parse_dt(data.get('end'))

        if end is None:
            return jsonify({'error': 'Invalid end'}), 400

        event.end = end

    if event.end < event.start:
        return jsonify({'error': 'end must be after start'}), 400

    if data.get('event_type') in (
        'meeting',
        'deadline',
        'reminder',
    ):
        event.event_type = data['event_type']

    if 'project_id' in data or 'task_id' in data:
        relations, relations_error = _resolve_event_relations(
            me,
            data,
            current_event=event,
        )

        if relations_error:
            return relations_error

        event.project_id = (
            relations['project'].id
            if relations['project']
            else None
        )

        event.task_id = (
            relations['task'].id
            if relations['task']
            else None
        )

        event.organization_id = relations['organization_id']

    if 'attendee_ids' in data:
        _sync_event_attendees(
            event,
            me,
            data.get('attendee_ids') or [],
        )

    event.version = int(event.version or 1) + 1

    db.session.commit()

    return jsonify(
        event.to_dict(include_attendees=True)
    ), 200


@api.route('/events/<int:event_id>', methods=['DELETE'])
@require_approved_user
def delete_event(event_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    event = CalendarEvent.query.get_or_404(event_id)

    if not _can_manage_event(me, event):
        return jsonify({'error': 'Not found'}), 404

    db.session.delete(event)
    db.session.commit()

    return jsonify({'message': 'Event deleted'}), 200