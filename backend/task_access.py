from access import is_internal, is_approved
from models import Task, User

def visible_tasks_condition(user: User):
    if not is_approved(user):
        return Task.id == -1

    if is_internal(user):
        return True

    return Task.organization_id == user.organization_id

def task_visible(task: Task, user: User) -> bool:
    if not task or not is_approved(user):
        return False

    if is_internal(user):
        return True

    return task.organization_id == user.organization_id

def can_edit_task(task: Task, user: User) -> bool:
    if not task_visible(task, user):
        return False

    if is_internal(user):
        return True

    return task.user_id == user.id or task.assignee_user_id == user.id

def can_delete_task(task: Task, user: User) -> bool:
    if not task_visible(task, user):
        return False

    if is_internal(user):
        return True

    return task.user_id == user.id