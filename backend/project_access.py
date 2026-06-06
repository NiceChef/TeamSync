from sqlalchemy import and_, or_

from access import is_approved, is_internal
from models import Group, Organization, Project, Task, User


def task_assignment_condition(user: User):
    """
    Warunek SQL określający zadania przypisane użytkownikowi:

    - użytkownik jest twórcą zadania,
    - przypisanie bezpośrednie,
    - przypisanie przez dział/grupę,
    - przypisanie przez organizację,
    - zgodność ze starymi polami assignee_user_id i group_id.
    """
    if not user:
        return Task.id == -1

    conditions = [
        Task.user_id == user.id,
        Task.assignee_user_id == user.id,
        Task.assigned_users.any(User.id == user.id),
        Task.assigned_groups.any(
            Group.members.any(User.id == user.id)
        ),
    ]

    if user.organization_id is not None:
        conditions.append(
            Task.assigned_organizations.any(
                Organization.id == user.organization_id
            )
        )

    conditions.append(
        and_(
            Task.group_id.isnot(None),
            Task.task_group.has(
                Group.members.any(User.id == user.id)
            ),
        )
    )

    return or_(*conditions)


def project_full_access_condition(user: User):
    """
    Pełny dostęp do projektu otrzymują:

    - twórca projektu,
    - osoba przypisana bezpośrednio,
    - członek przypisanego działu,
    - użytkownik przypisanej organizacji.
    """
    if not user:
        return Project.id == -1

    conditions = [
        Project.created_by_id == user.id,
        Project.members.any(User.id == user.id),
        Project.assigned_groups.any(
            Group.members.any(User.id == user.id)
        ),
    ]

    if user.organization_id is not None:
        conditions.append(
            Project.assigned_organizations.any(
                Organization.id == user.organization_id
            )
        )

    return or_(*conditions)


def project_has_full_access(project: Project, user: User) -> bool:
    if not project or not is_approved(user):
        return False

    if is_internal(user):
        return True

    if project.created_by_id == user.id:
        return True

    try:
        if any(member.id == user.id for member in project.members or []):
            return True
    except Exception:
        pass

    try:
        if any(
            member.id == user.id
            for group in project.assigned_groups or []
            for member in group.members or []
        ):
            return True
    except Exception:
        pass

    try:
        if any(
            organization.id == user.organization_id
            for organization in project.assigned_organizations or []
        ):
            return True
    except Exception:
        pass

    return False

def project_visible_condition(user: User):
    """
    Projekt jest widoczny, jeżeli użytkownik:

    - ma pełny dostęp do projektu,
    - albo posiada dostęp do przynajmniej jednego zadania projektu.
    """
    if not is_approved(user):
        return Project.id == -1

    if is_internal(user):
        return True

    return or_(
        project_full_access_condition(user),
        Project.tasks.any(task_assignment_condition(user)),
    )

def task_assigned_to_user(task: Task, user: User) -> bool:
    if not task or not user:
        return False

    if task.user_id == user.id:
        return True

    if task.assignee_user_id == user.id:
        return True

    try:
        if any(
            assigned_user.id == user.id
            for assigned_user in task.assigned_users or []
        ):
            return True
    except Exception:
        pass

    try:
        if any(
            member.id == user.id
            for group in task.assigned_groups or []
            for member in group.members or []
        ):
            return True
    except Exception:
        pass

    try:
        if any(
            organization.id == user.organization_id
            for organization in task.assigned_organizations or []
        ):
            return True
    except Exception:
        pass

    try:
        if task.task_group and any(
            member.id == user.id
            for member in task.task_group.members or []
        ):
            return True
    except Exception:
        pass

    return False


def task_visible_for_user(task: Task, user: User) -> bool:
    """
    Zadanie jest widoczne, jeżeli użytkownik:

    - jest internal,
    - ma pełny dostęp do projektu zadania,
    - albo jest przypisany do konkretnego zadania.
    """
    if not task or not is_approved(user):
        return False

    if is_internal(user):
        return True

    if task.project and project_has_full_access(task.project, user):
        return True

    return task_assigned_to_user(task, user)


def visible_project_tasks(project: Project, user: User):
    """
    Zwraca zadania projektu widoczne dla użytkownika.

    Osoba z pełnym dostępem widzi wszystkie zadania.
    Osoba mająca dostęp wyłącznie przez zadanie widzi tylko swoje zadania.
    """
    if not project or not is_approved(user):
        return []

    if project_has_full_access(project, user):
        return list(project.tasks or [])

    return [
        task
        for task in project.tasks or []
        if task_assigned_to_user(task, user)
    ]


def project_visible(project: Project, user: User) -> bool:
    if not project or not is_approved(user):
        return False

    if project_has_full_access(project, user):
        return True

    return any(
        task_assigned_to_user(task, user)
        for task in project.tasks or []
    )


def can_manage_project(project: Project, user: User) -> bool:
    if not project_visible(project, user):
        return False

    if is_internal(user):
        return True

    return project.created_by_id == user.id


def can_use_project(project: Project, user: User) -> bool:
    return project_visible(project, user)