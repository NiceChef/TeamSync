from flask import request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from access import is_internal, require_approved_user
from models import (
    Task,
    TaskStatus,
    TaskActivity,
    TaskComment,
    User,
    Group,
    Project,
    CalendarEvent,
    Organization,
)
from task_access import visible_tasks_condition
from routes import api


def _organization_scope(me, query, model):
    if is_internal(me):
        org_id = request.args.get('organization_id', type=int)
        if org_id is not None and hasattr(model, 'organization_id'):
            return query.filter(model.organization_id == org_id)
        return query

    if hasattr(model, 'organization_id'):
        return query.filter(model.organization_id == me.organization_id)

    return query


def _visible_users_query(me):
    q = User.query
    if is_internal(me):
        org_id = request.args.get('organization_id', type=int)
        if org_id is not None:
            q = q.filter(User.organization_id == org_id)
        return q

    return q.filter(User.organization_id == me.organization_id)


@api.route('/reports/tasks-summary', methods=['GET'])
@require_approved_user
def report_tasks_summary():
    me = User.query.get_or_404(int(get_jwt_identity()))

    q = Task.query.filter(visible_tasks_condition(me))

    total = q.count()
    done = q.filter_by(completed=True).count()

    inprog = TaskStatus.query.filter_by(code='in_progress').first()
    inprog_n = 0
    if inprog:
        inprog_n = q.filter_by(status_id=inprog.id).count()

    data = {
        'total': total,
        'done': done,
        'in_progress': inprog_n,
        'open': max(total - done, 0),
    }

    if request.args.get('format') == 'json':
        return jsonify(data), 200

    lines = [
        '=== Raport zadań (TeamSync) ===',
        f'Widoczne zadania: {total}',
        f'Zakończone: {done}',
        f'W trakcie: {inprog_n}',
        f'Otwarte: {data["open"]}',
    ]
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/user-activity', methods=['GET'])
@require_approved_user
def report_user_activity():
    me = User.query.get_or_404(int(get_jwt_identity()))

    q_users = _visible_users_query(me)

    users_data = []
    lines = ['=== Aktywność użytkowników ===']

    for u in q_users.order_by(User.username).limit(300).all():
        task_ids = [
            row[0]
            for row in Task.query
            .filter(Task.organization_id == u.organization_id)
            .with_entities(Task.id)
            .all()
        ]

        activities_q = TaskActivity.query.filter_by(user_id=u.id)
        comments_q = TaskComment.query.filter_by(user_id=u.id)

        if not is_internal(me):
            activities_q = activities_q.filter(TaskActivity.task_id.in_(task_ids or [-1]))
            comments_q = comments_q.filter(TaskComment.task_id.in_(task_ids or [-1]))

        n = activities_q.count()
        c = comments_q.count()

        users_data.append({
            'user_id': u.id,
            'username': u.username,
            'email': u.email,
            'organization_id': u.organization_id,
            'activities': n,
            'comments': c,
        })
        lines.append(f'{u.username}: aktywności={n}, komentarze={c}')

    if request.args.get('format') == 'json':
        return jsonify({'users': users_data}), 200

    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/project-progress', methods=['GET'])
@require_approved_user
def report_project_progress():
    me = User.query.get_or_404(int(get_jwt_identity()))

    base = Task.query.filter(visible_tasks_condition(me))

    groups_q = Group.query
    if is_internal(me):
        org_id = request.args.get('organization_id', type=int)
        if org_id is not None:
            groups_q = groups_q.filter(Group.organization_id == org_id)
    else:
        groups_q = groups_q.filter(Group.organization_id == me.organization_id)

    lines = ['=== Postęp wg grup ===']
    groups_data = []

    for g in groups_q.order_by(Group.name).all():
        tq = base.filter(Task.group_id == g.id)
        tot = tq.count()
        dn = tq.filter_by(completed=True).count()
        groups_data.append({
            'group_id': g.id,
            'organization_id': g.organization_id,
            'name': g.name,
            'done': dn,
            'total': tot,
        })
        lines.append(f'{g.name}: zakończone {dn} / {tot} łącznie')

    uq = base.filter(Task.group_id.is_(None))
    ut = uq.count()
    ud = uq.filter_by(completed=True).count()

    groups_data.append({
        'group_id': None,
        'organization_id': me.organization_id if not is_internal(me) else None,
        'name': 'Bez grupy',
        'done': ud,
        'total': ut,
    })
    lines.append(f'Bez grupy: zakończone {ud} / {ut} łącznie')

    if request.args.get('format') == 'json':
        return jsonify({'groups': groups_data}), 200

    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/full-activity', methods=['GET'])
@require_approved_user
def report_full_activity():
    me = User.query.get_or_404(int(get_jwt_identity()))

    tasks_q = Task.query.filter(visible_tasks_condition(me))
    projects_q = _organization_scope(me, Project.query, Project)
    events_q = _organization_scope(me, CalendarEvent.query, CalendarEvent)
    users_q = _visible_users_query(me)

    organizations = []
    if is_internal(me):
        orgs_q = Organization.query.order_by(Organization.name)
        org_id = request.args.get('organization_id', type=int)
        if org_id is not None:
            orgs_q = orgs_q.filter(Organization.id == org_id)
        organizations = [o.to_dict() for o in orgs_q.all()]

    tasks = tasks_q.order_by(Task.created_at.desc()).limit(1000).all()
    projects = projects_q.order_by(Project.created_at.desc()).limit(500).all()
    events = events_q.order_by(CalendarEvent.start.desc()).limit(500).all()
    users = users_q.order_by(User.created_at.desc()).limit(500).all()

    activities = (
        TaskActivity.query
        .filter(TaskActivity.task_id.in_([t.id for t in tasks] or [-1]))
        .order_by(TaskActivity.created_at.desc())
        .limit(1000)
        .all()
    )

    comments = (
        TaskComment.query
        .filter(TaskComment.task_id.in_([t.id for t in tasks] or [-1]))
        .order_by(TaskComment.created_at.desc())
        .limit(1000)
        .all()
    )

    data = {
        'scope': 'global' if is_internal(me) else 'organization',
        'organization_id': None if is_internal(me) else me.organization_id,
        'organizations': organizations,
        'users': [u.to_dict() for u in users],
        'tasks': [t.to_dict(include_relations=True) for t in tasks],
        'projects': [p.to_dict(include_members=True) for p in projects],
        'events': [e.to_dict(include_attendees=True) for e in events],
        'activities': [a.to_dict() for a in activities],
        'comments': [c.to_dict() for c in comments],
        'counts': {
            'users': len(users),
            'tasks': len(tasks),
            'projects': len(projects),
            'events': len(events),
            'activities': len(activities),
            'comments': len(comments),
        },
    }

    if request.args.get('format') == 'json':
        return jsonify(data), 200

    lines = [
        '=== Pełny raport aktywności TeamSync ===',
        f'Zakres: {data["scope"]}',
        f'Użytkownicy: {data["counts"]["users"]}',
        f'Zadania: {data["counts"]["tasks"]}',
        f'Projekty: {data["counts"]["projects"]}',
        f'Wydarzenia: {data["counts"]["events"]}',
        f'Aktywności: {data["counts"]["activities"]}',
        f'Komentarze: {data["counts"]["comments"]}',
    ]

    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')