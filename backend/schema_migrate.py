"""
Uzupełnia brakujące kolumny (create_all nie alteruje istniejących tabel).
"""
from sqlalchemy import inspect, text


def _sqlite_columns(engine, table: str) -> set:
    with engine.connect() as conn:
        rows = conn.execute(text(f'PRAGMA table_info({table})')).fetchall()
    return {row[1] for row in rows}


def _sqlite_add_column(engine, table: str, ddl: str) -> None:
    with engine.connect() as conn:
        conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {ddl}'))
        conn.commit()


def ensure_sqlite_schema(engine) -> None:
    url = str(engine.url)
    if 'sqlite' not in url:
        return

    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if 'users' not in tables:
        return

    cols = _sqlite_columns(engine, 'users')
    if 'role' not in cols:
        _sqlite_add_column(engine, 'users', "role VARCHAR(20) NOT NULL DEFAULT 'employee'")
    if 'first_name' not in cols:
        _sqlite_add_column(engine, 'users', 'first_name VARCHAR(80)')
    if 'last_name' not in cols:
        _sqlite_add_column(engine, 'users', 'last_name VARCHAR(80)')
    if 'phone' not in cols:
        _sqlite_add_column(engine, 'users', 'phone VARCHAR(40)')
    if 'organization_id' not in cols:
        _sqlite_add_column(engine, 'users', 'organization_id INTEGER')

    if 'tasks' in tables:
        tcols = _sqlite_columns(engine, 'tasks')
        if 'status_id' not in tcols:
            _sqlite_add_column(engine, 'tasks', 'status_id INTEGER')
        if 'priority' not in tcols:
            _sqlite_add_column(engine, 'tasks', "priority VARCHAR(20) DEFAULT 'medium'")
        if 'version' not in tcols:
            _sqlite_add_column(engine, 'tasks', 'version INTEGER NOT NULL DEFAULT 1')
        if 'assignee_user_id' not in tcols:
            _sqlite_add_column(engine, 'tasks', 'assignee_user_id INTEGER')
        if 'group_id' not in tcols:
            _sqlite_add_column(engine, 'tasks', 'group_id INTEGER')
        if 'updated_at' not in tcols:
            _sqlite_add_column(engine, 'tasks', 'updated_at DATETIME')


def _pg_has_column(conn, table: str, column: str) -> bool:
    r = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
            """
        ),
        {'t': table, 'c': column},
    ).fetchone()
    return r is not None


def ensure_postgres_schema(engine) -> None:
    d = engine.url.drivername
    if d not in ('postgresql', 'postgresql+psycopg2'):
        return

    alters = [
        ('users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'employee'"),
        ('users', 'first_name', 'VARCHAR(80)'),
        ('users', 'last_name', 'VARCHAR(80)'),
        ('users', 'phone', 'VARCHAR(40)'),
        ('users', 'organization_id', 'INTEGER'),
        ('tasks', 'status_id', 'INTEGER'),
        ('tasks', 'priority', "VARCHAR(20) DEFAULT 'medium'"),
        ('tasks', 'version', 'INTEGER NOT NULL DEFAULT 1'),
        ('tasks', 'assignee_user_id', 'INTEGER'),
        ('tasks', 'group_id', 'INTEGER'),
        ('tasks', 'updated_at', 'TIMESTAMP WITH TIME ZONE'),
    ]

    with engine.connect() as conn:
        for table, col, typ in alters:
            if not _pg_has_column(conn, table, col):
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {typ}'))
        conn.commit()


def ensure_schema(engine) -> None:
    ensure_sqlite_schema(engine)
    ensure_postgres_schema(engine)
