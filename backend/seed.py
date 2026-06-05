from datetime import datetime
from models import db, User, Organization, TaskStatus, Task, Group

def seed_task_statuses():
    defaults = [
        ('todo', 'Do wykonania', 1, False),
        ('in_progress', 'W trakcie', 2, False),
        ('done', 'Zakończone', 3, True),
    ]
    for code, label, order, term in defaults:
        if not TaskStatus.query.filter_by(code=code).first():
            db.session.add(
                TaskStatus(code=code, label=label, sort_order=order, is_terminal=term)
            )
    db.session.commit()


def migrate_legacy_task_statuses():
    done = TaskStatus.query.filter_by(code='done').first()
    todo = TaskStatus.query.filter_by(code='todo').first()
    if not done or not todo:
        return
    for t in Task.query.filter(Task.status_id.is_(None)).all():
        t.status_id = done.id if t.completed else todo.id
    db.session.commit()


def migrate_legacy_task_organizations():
    for t in Task.query.filter(Task.organization_id.is_(None)).all():
        if t.project and t.project.organization_id:
            t.organization_id = t.project.organization_id
        elif t.task_group and t.task_group.organization_id:
            t.organization_id = t.task_group.organization_id
        elif t.user and t.user.organization_id:
            t.organization_id = t.user.organization_id
    db.session.commit()


def seed_test_user():
    """Dodaje minimalne dane developerskie po resecie bazy."""
    from config import settings

    seed_task_statuses()

    if settings.FLASK_ENV != 'development':
        print('[INFO] Seed uzytkownika pominiety - nie tryb development.')
        return

    teamsync_org = Organization.query.filter(db.func.lower(Organization.name) == 'teamsync').first()
    if not teamsync_org:
        teamsync_org = Organization(name='TEAMSYNC')
        db.session.add(teamsync_org)
        db.session.commit()
    else:
        teamsync_org.name = 'TEAMSYNC'
        db.session.commit()

    main_user = User.query.filter_by(email='testuser@team-sync.com').first()

    if not main_user:
        main_user = User(
            username='TestUser',
            email='testuser@team-sync.com',
            role='internal',
            approval_status='approved',
            approved_at=datetime.utcnow(),
            organization_id=teamsync_org.id,
        )
        main_user.set_password('TestUserPassword!')
        db.session.add(main_user)
        db.session.commit()
        print('[OK] Glowny uzytkownik TestUser utworzony.')
    else:
        main_user.username = 'TestUser'
        main_user.role = 'internal'
        main_user.approval_status = 'approved'
        main_user.organization_id = teamsync_org.id
        if main_user.approved_at is None:
            main_user.approved_at = datetime.utcnow()
        main_user.set_password('TestUserPassword!')
        db.session.commit()
        print('[OK] Glowny uzytkownik TestUser zaktualizowany.')


def seed_database():
    from app import create_app

    app = create_app()
    with app.app_context():
        seed_test_user()


if __name__ == '__main__':
    seed_database()
