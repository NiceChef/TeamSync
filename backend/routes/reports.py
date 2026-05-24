from flask import request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import Task, TaskStatus, TaskActivity, TaskComment, User, Group
from task_access import visible_tasks_condition
from routes import api


@api.route('/reports/tasks-summary', methods=['GET'])
@jwt_required()
def report_tasks_summary():
    me = User.query.get_or_404(int(get_jwt_identity()))
    q = Task.query.filter(visible_tasks_condition(me))
    total = q.count()
    done = q.filter_by(completed=True).count()
    inprog = TaskStatus.query.filter_by(code='in_progress').first()
    inprog_n = 0
    if inprog:
        inprog_n = q.filter_by(status_id=inprog.id).count()
    if request.args.get('format') == 'json':
        return jsonify({
            'total': total,
            'done': done,
            'in_progress': inprog_n,
            'open': max(total - done, 0),
        }), 200
    lines = [
        '=== Raport zadań (TeamSync) ===',
        f'Widoczne zadania: {total}',
        f'Zakończone (completed): {done}',
        f'W trakcie (status): {inprog_n}',
    ]
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/user-activity', methods=['GET'])
@jwt_required()
def report_user_activity():
    me = User.query.get_or_404(int(get_jwt_identity()))
    if me.role == 'client':
        return jsonify({'error': 'Forbidden'}), 403
    q_users = User.query
    if me.organization_id:
        q_users = q_users.filter(User.organization_id == me.organization_id)
    else:
        q_users = q_users.filter(User.id == me.id)
    lines = ['=== Aktywność użytkowników (liczba zdarzeń) ===']
    users_data = []
    for u in q_users.limit(50).all():
        n = TaskActivity.query.filter_by(user_id=u.id).count()
        c = TaskComment.query.filter_by(user_id=u.id).count()
        users_data.append({'username': u.username, 'activities': n, 'comments': c})
        lines.append(f'{u.username}: aktywności={n}, komentarze={c}')
    if request.args.get('format') == 'json':
        return jsonify({'users': users_data}), 200
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')


@api.route('/reports/project-progress', methods=['GET'])
@jwt_required()
def report_project_progress():
    me = User.query.get_or_404(int(get_jwt_identity()))
    base = Task.query.filter(visible_tasks_condition(me))
    lines = ['=== Postęp wg grup (widoczne zadania) ===']
    if me.organization_id:
        groups = Group.query.filter_by(organization_id=me.organization_id).order_by(Group.name).all()
    else:
        groups = Group.query.filter(Group.organization_id.is_(None)).order_by(Group.name).all()
    groups_data = []
    for g in groups:
        tq = base.filter(Task.group_id == g.id)
        tot = tq.count()
        dn = tq.filter_by(completed=True).count()
        groups_data.append({'name': g.name, 'done': dn, 'total': tot})
        lines.append(f'{g.name}: zakończone {dn} / {tot} łącznie')
    uq = base.filter(Task.group_id.is_(None))
    ut = uq.count()
    ud = uq.filter_by(completed=True).count()
    groups_data.append({'name': 'Bez grupy', 'done': ud, 'total': ut})
    lines.append(f'Bez grupy: zakończone {ud} / {ut} łącznie')
    if request.args.get('format') == 'json':
        return jsonify({'groups': groups_data}), 200
    return Response('\n'.join(lines), mimetype='text/plain; charset=utf-8')
