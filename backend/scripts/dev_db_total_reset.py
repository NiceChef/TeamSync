#!/usr/bin/env python3
"""
Całkowity reset bazy: DROP wszystkich tabel (wraz ze schematem danych), ponowne create_all + seed.

Użycie (z katalogu backend/):
  python scripts/dev_db_total_reset.py

Wymaga FLASK_ENV=development (ustawione w .env_development).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Zapobiega podwójnemu create_all + seed przy imporcie app (create_app uruchamia je na starcie).
os.environ['TASKS_SKIP_AUTO_DB_INIT'] = '1'

from sqlalchemy import text

from config import settings
from _security import math_challenge


def total_reset():
    if settings.FLASK_ENV != 'development':
        print('BŁĄD: Skrypt działa tylko w trybie development.')
        return False

    print('=' * 60)
    print('CAŁKOWITY RESET BAZY DANYCH')
    print('=' * 60)
    print('Zostaną usunięte WSZYSTKIE tabele i dane.')
    print('=' * 60)

    if not math_challenge():
        return False

    from app import app
    from models import db

    with app.app_context():
        if db.engine.dialect.name == 'postgresql':
            with db.engine.begin() as conn:
                conn.execute(text('DROP SCHEMA public CASCADE'))
                conn.execute(text('CREATE SCHEMA public'))
                conn.execute(text('GRANT ALL ON SCHEMA public TO public'))
        else:
            db.drop_all()

        db.create_all()
        print('[OK] Tabele utworzone ponownie (create_all).')

        from seed import seed_test_user
        seed_test_user()
        print('[OK] Seed użytkownika testowego zakończony.')

    print('=' * 60)
    print('Reset zakończony.')
    print('=' * 60)
    return True


if __name__ == '__main__':
    sys.exit(0 if total_reset() else 1)
