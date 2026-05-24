"""Wspólne funkcje pomocnicze współdzielone przez moduły routingu."""
from datetime import datetime, date, timezone

from models import db, User, Task, TaskRelation, TaskStatus, Notification


def _org_match(a, b):
    return (a or None) == (b or None)


def _valid_assignee(actor, assignee_id):
    other = User.query.get(assignee_id)
    if not other:
        return False
    return _org_match(actor.organization_id, other.organization_id)


def _user_can_use_group(user, group):
    if not group:
        return False
    if not _org_match(user.organization_id, group.organization_id):
        return False
    try:
        if user in group.members:
            return True
    except Exception:
        pass
    return user.id == group.created_by_id


def _can_manage_group(user, group):
    if not group or user.role == 'client':
        return False
    if not _org_match(user.organization_id, group.organization_id):
        return False
    try:
        if user in group.members or user.id == group.created_by_id:
            return True
    except Exception:
        pass
    return user.id == group.created_by_id


def _project_visible(user, project):
    if not project or not _org_match(user.organization_id, project.organization_id):
        return False
    if user.role == 'client':
        try:
            return user in project.members or user.id == project.created_by_id
        except Exception:
            return user.id == project.created_by_id
    return True


def _can_manage_project(user, project):
    if not project or user.role == 'client':
        return False
    if not _org_match(user.organization_id, project.organization_id):
        return False
    try:
        return user in project.members or user.id == project.created_by_id
    except Exception:
        return user.id == project.created_by_id


def _user_can_use_project(user, project):
    if not project or not _org_match(user.organization_id, project.organization_id):
        return False
    if user.role == 'client':
        try:
            return user in project.members or user.id == project.created_by_id
        except Exception:
            return False
    return True


def _event_visible(user, event):
    return event is not None and _org_match(user.organization_id, event.organization_id)


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
        memo[tid] = None  # znacznik "w trakcie" — przerywa cykle
        pd = planned.get(tid)
        best = pd.date() if hasattr(pd, 'date') else pd
        for nxt in adj.get(tid, ()):  # noqa: E1133
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
