#!/usr/bin/env python3
"""
Skrypt do seedowania bazy danych (dodawanie danych testowych).
Użycie: python seed.py
"""
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


def seed_test_user():
    """Dodaje testowe dane w trybie developerskim (wymaga app_context)."""
    from config import settings

    seed_task_statuses()
    migrate_legacy_task_statuses()

    if settings.FLASK_ENV != 'development':
        print('[INFO] Seed użytkownika pominięty — nie tryb development.')
        return

    org = Organization.query.filter_by(name='Demo Org').first()
    if not org:
        org = Organization(name='Demo Org')
        db.session.add(org)
        db.session.commit()

    existing_user = User.query.filter_by(username='TestUser').first()
    if not existing_user:
        test_user = User(
            username='TestUser',
            email='testuser@example.com',
            role='employee',
            organization_id=org.id,
        )
        test_user.set_password('TestUserPassword!')
        db.session.add(test_user)
        db.session.commit()
        print('[OK] Użytkownik testowy "TestUser" utworzony (hasło jak w README).')
        existing_user = test_user
    else:
        if existing_user.organization_id is None:
            existing_user.organization_id = org.id
            db.session.commit()

    client_user = User.query.filter_by(username='TestClient').first()
    if not client_user:
        client_user = User(
            username='TestClient',
            email='client@client.local',
            role='client',
            organization_id=org.id,
        )
        client_user.set_password('TestClientPassword!')
        db.session.add(client_user)
        db.session.commit()
        print('[OK] Klient testowy "TestClient" / client@client.local (hasło TestClientPassword!).')

    g = Group.query.filter_by(name='Zespół demo').first()
    if not g:
        g = Group(
            name='Zespół demo',
            department='IT',
            organization_id=org.id,
            created_by_id=existing_user.id,
        )
        db.session.add(g)
        db.session.commit()
        if existing_user not in g.members:
            g.members.append(existing_user)
            db.session.commit()
        print('[OK] Grupa "Zespół demo" z przypisanym TestUser.')


def seed_database():
    from app import create_app

    app = create_app()
    with app.app_context():
        seed_test_user()


if __name__ == '__main__':
    seed_database()
