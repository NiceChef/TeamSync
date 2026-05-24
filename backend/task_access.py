from sqlalchemy import or_ as db_or

from models import Task, User


def visible_tasks_condition(user: User):
    uid = user.id
    if getattr(user, 'role', None) == 'client':
        return db_or(Task.assignee_user_id == uid, Task.user_id == uid)
    parts = [Task.user_id == uid, Task.assignee_user_id == uid]
    try:
        gid_list = [g.id for g in (user.groups or [])]
    except Exception:
        gid_list = []
    if gid_list:
        parts.append(Task.group_id.in_(gid_list))
    return db_or(*parts)


def task_visible(task: Task, user: User) -> bool:
    if not task:
        return False
    uid = user.id
    if getattr(user, 'role', None) == 'client':
        return task.assignee_user_id == uid or task.user_id == uid
    if task.user_id == uid or task.assignee_user_id == uid:
        return True
    try:
        return task.group_id and any(g.id == task.group_id for g in (user.groups or []))
    except Exception:
        return False


def can_edit_task(task: Task, user: User) -> bool:
    return task_visible(task, user)


def can_delete_task(task: Task, user: User) -> bool:
    return task.user_id == user.id
