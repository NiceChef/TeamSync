from sqlalchemy import or_

from access import is_approved, is_internal
from models import Task, User
from project_access import (
    project_full_access_condition,
    task_assignment_condition,
    task_assigned_to_user,
    task_visible_for_user,
)


def visible_tasks_condition(user: User):
    """
    Internal widzi wszystkie zadania.

    Pozostali widzą:
    - zadania przypisane bezpośrednio lub przez grupę/organizację,
    - zadania, których są twórcami,
    - wszystkie zadania projektów, do których mają pełny dostęp.
    """
    if not is_approved(user):
        return Task.id == -1

    if is_internal(user):
        return True

    return or_(
        task_assignment_condition(user),
        Task.project.has(
            project_full_access_condition(user)
        ),
    )


def task_visible(task: Task, user: User) -> bool:
    return task_visible_for_user(task, user)


def can_edit_task(task: Task, user: User) -> bool:
    if not task_visible(task, user):
        return False

    if is_internal(user):
        return True

    if task.user_id == user.id:
        return True

    if task.project and task.project.created_by_id == user.id:
        return True

    return task_assigned_to_user(task, user)


def can_delete_task(task: Task, user: User) -> bool:
    if not task_visible(task, user):
        return False

    if is_internal(user):
        return True

    if task.project and task.project.created_by_id == user.id:
        return True

    return task.user_id == user.id