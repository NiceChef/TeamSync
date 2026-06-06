from datetime import datetime, date, timezone
from access import is_internal, is_approved
from models import db, User, Task, TaskRelation, TaskStatus, Notification

from project_access import (
    project_visible,
    can_manage_project,
    can_use_project,
    task_visible_for_user,
)

def _org_match(a, b):
    return (a or None) == (b or None)

def _valid_assignee(actor, assignee_id):
    if not is_approved(actor):
        return False

    other = User.query.get(assignee_id)
    if not other or not is_approved(other):
        return False

    if is_internal(actor):
        return True

    return _org_match(actor.organization_id, other.organization_id)

def _user_can_use_group(user, group):
    if not group or not is_approved(user):
        return False

    if is_internal(user):
        return True

    return _org_match(user.organization_id, group.organization_id)


def _can_manage_group(user, group):
    if not group or not is_approved(user):
        return False

    if is_internal(user):
        return True

    return _org_match(user.organization_id, group.organization_id)

def _project_visible(user, project):
    return project_visible(project, user)


def _can_manage_project(user, project):
    return can_manage_project(project, user)


def _user_can_use_project(user, project):
    return can_use_project(project, user)

def _event_visible(user, event):
    if not event or not is_approved(user):
        return False

    if is_internal(user):
        return True

    if event.created_by_id == user.id:
        return True

    try:
        if any(
            attendee.id == user.id
            for attendee in event.attendees or []
        ):
            return True
    except Exception:
        pass

    if event.task and task_visible_for_user(event.task, user):
        return True

    if event.project and project_visible(event.project, user):
        return True

    return _org_match(user.organization_id, event.organization_id)

def _can_manage_event(user, event):
    if not event or not is_approved(user):
        return False

    if is_internal(user):
        return True

    return event.created_by_id == user.id

def _parse_dt(value):
    """ISO 8601 (z 'Z' lub bez) -> naive UTC datetime. Zwraca None gdy puste/błędne."""
    if not value:
        return None
    try:
        s = str(value).replace('Z', '+00:00')
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return None

def _parse_import_dt(value):
    """Daty z importu -> datetime (kolumny Task to DateTime). None gdy nieparsowalne.

    Obsługuje 'YYYY-MM-DD' (północ), ISO 8601 z 'T'/'Z' oraz już-datetime/date.
    """
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        try:
            if 'T' in value:
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is not None:
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt
            return datetime.combine(date.fromisoformat(value), datetime.min.time())
        except (ValueError, TypeError):
            return None
    return None

def _default_todo_status():
    return TaskStatus.query.filter_by(code='todo').first()

def _apply_completed_bool(task, completed):
    task.completed = bool(completed)
    done = TaskStatus.query.filter_by(code='done').first()
    todo = TaskStatus.query.filter_by(code='todo').first()
    if completed and done:
        task.status_id = done.id
    elif not completed and todo:
        task.status_id = todo.id

def _notify(user_id, message, kind='task', task_id=None):
    if not user_id:
        return
    db.session.add(
        Notification(user_id=user_id, message=message, kind=kind, task_id=task_id)
    )

def _notify_internal_users(message, kind='system', task_id=None):
    users = User.query.filter_by(role='internal', approval_status='approved').all()
    for user in users:
        _notify(user.id, message, kind=kind, task_id=task_id)

def _bulk_soonest_action(tasks):
    """Liczy 'soonest_action' dla listy zadań w 2 zapytaniach zamiast N rekurencji.

    soonest_action(t) = najwcześniejszy planned_date wśród t i wszystkich zadań
    osiągalnych przez relacje wychodzące (podzadania). Zwraca {task_id: iso|None}.
    """
    planned = {
        tid: pd
        for tid, pd in db.session.query(Task.id, Task.planned_date).all()
    }
    adj = {}
    for src, tgt in db.session.query(
        TaskRelation.source_task_id, TaskRelation.target_task_id
    ).all():
        adj.setdefault(src, []).append(tgt)

    memo = {}

    def _soonest(tid):
        if tid in memo:
            return memo[tid]
        memo[tid] = None
        pd = planned.get(tid)
        best = pd.date() if hasattr(pd, 'date') else pd
        for nxt in adj.get(tid, ()):
            s = _soonest(nxt)
            if s is not None and (best is None or s < best):
                best = s
        memo[tid] = best
        return best

    out = {}
    for t in tasks:
        d = _soonest(t.id)
        out[t.id] = d.isoformat() if d is not None else None
    return out