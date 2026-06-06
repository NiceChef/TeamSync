"""
Uzupełnia brakujące kolumny i tabele.

db.create_all() tworzy nowe tabele, ale nie aktualizuje istniejących tabel.
Ten moduł obsługuje proste migracje dla SQLite oraz PostgreSQL.
"""

from sqlalchemy import inspect, text


def _sqlite_columns(engine, table: str) -> set:
    with engine.connect() as connection:
        rows = connection.execute(
            text(f'PRAGMA table_info({table})')
        ).fetchall()

    return {row[1] for row in rows}


def _sqlite_add_column(engine, table: str, ddl: str) -> None:
    with engine.connect() as connection:
        connection.execute(
            text(f'ALTER TABLE {table} ADD COLUMN {ddl}')
        )
        connection.commit()

def _sqlite_create_assignment_tables(engine) -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (task_id, user_id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS task_groups (
            task_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (task_id, group_id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS task_organizations (
            task_id INTEGER NOT NULL,
            organization_id INTEGER NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (task_id, organization_id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )
        """,
                """
        CREATE TABLE IF NOT EXISTS project_groups (
            project_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (project_id, group_id),
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS project_organizations (
            project_id INTEGER NOT NULL,
            organization_id INTEGER NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (project_id, organization_id),
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )
        """,
    ]

    with engine.connect() as connection:
        for statement in statements:
            connection.execute(text(statement))

        connection.commit()

def _sqlite_migrate_legacy_assignments(engine) -> None:
    """
    Przenosi stare pojedyncze przypisania do nowych tabel many-to-many.

    Nie kopiujemy tasks.organization_id do task_organizations.
    organization_id na zadaniu określa zakres widoczności, a nie przypisanie
    całej organizacji do wykonania zadania.
    """
    statements = [
        """
        INSERT OR IGNORE INTO task_assignees (task_id, user_id, created_at)
        SELECT id, assignee_user_id, CURRENT_TIMESTAMP
        FROM tasks
        WHERE assignee_user_id IS NOT NULL
        """,
        """
        INSERT OR IGNORE INTO task_groups (task_id, group_id, created_at)
        SELECT id, group_id, CURRENT_TIMESTAMP
        FROM tasks
        WHERE group_id IS NOT NULL
        """,
    ]

    with engine.connect() as connection:
        for statement in statements:
            connection.execute(text(statement))

        connection.commit()


def ensure_sqlite_schema(engine) -> None:
    if 'sqlite' not in str(engine.url):
        return

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if 'users' not in tables:
        return

    user_columns = _sqlite_columns(engine, 'users')

    if 'role' not in user_columns:
        _sqlite_add_column(
            engine,
            'users',
            "role VARCHAR(20) NOT NULL DEFAULT 'client'",
        )

    if 'approval_status' not in user_columns:
        _sqlite_add_column(
            engine,
            'users',
            "approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'",
        )

    if 'approved_by_id' not in user_columns:
        _sqlite_add_column(engine, 'users', 'approved_by_id INTEGER')

    if 'approved_at' not in user_columns:
        _sqlite_add_column(engine, 'users', 'approved_at DATETIME')

    if 'first_name' not in user_columns:
        _sqlite_add_column(engine, 'users', 'first_name VARCHAR(80)')

    if 'last_name' not in user_columns:
        _sqlite_add_column(engine, 'users', 'last_name VARCHAR(80)')

    if 'phone' not in user_columns:
        _sqlite_add_column(engine, 'users', 'phone VARCHAR(40)')

    if 'organization_id' not in user_columns:
        _sqlite_add_column(engine, 'users', 'organization_id INTEGER')

    if 'tasks' in tables:
        task_columns = _sqlite_columns(engine, 'tasks')

        if 'status_id' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'status_id INTEGER')

        if 'priority' not in task_columns:
            _sqlite_add_column(
                engine,
                'tasks',
                "priority VARCHAR(20) DEFAULT 'medium'",
            )

        if 'version' not in task_columns:
            _sqlite_add_column(
                engine,
                'tasks',
                'version INTEGER NOT NULL DEFAULT 1',
            )

        if 'assignee_user_id' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'assignee_user_id INTEGER')

        if 'group_id' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'group_id INTEGER')

        if 'project_id' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'project_id INTEGER')

        if 'organization_id' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'organization_id INTEGER')

        if 'updated_at' not in task_columns:
            _sqlite_add_column(engine, 'tasks', 'updated_at DATETIME')

    if 'projects' in tables:
        project_columns = _sqlite_columns(engine, 'projects')

        if 'planned_start' not in project_columns:
            _sqlite_add_column(engine, 'projects', 'planned_start DATETIME')

        if 'deadline' not in project_columns:
            _sqlite_add_column(engine, 'projects', 'deadline DATETIME')

    _sqlite_create_assignment_tables(engine)
    _sqlite_migrate_legacy_assignments(engine)


def _postgres_has_column(connection, table: str, column: str) -> bool:
    result = connection.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table_name
              AND column_name = :column_name
            """
        ),
        {
            'table_name': table,
            'column_name': column,
        },
    ).fetchone()

    return result is not None


def _postgres_create_assignment_tables(connection) -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (task_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS task_groups (
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            group_id INTEGER NOT NULL REFERENCES groups(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (task_id, group_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS task_organizations (
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            organization_id INTEGER NOT NULL REFERENCES organizations(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (task_id, organization_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS project_groups (
            project_id INTEGER NOT NULL REFERENCES projects(id),
            group_id INTEGER NOT NULL REFERENCES groups(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, group_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS project_organizations (
            project_id INTEGER NOT NULL REFERENCES projects(id),
            organization_id INTEGER NOT NULL REFERENCES organizations(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, organization_id)
        )
        """,
    ]

    for statement in statements:
        connection.execute(text(statement))

def _postgres_migrate_legacy_assignments(connection) -> None:
    statements = [
        """
        INSERT INTO task_assignees (task_id, user_id, created_at)
        SELECT id, assignee_user_id, CURRENT_TIMESTAMP
        FROM tasks
        WHERE assignee_user_id IS NOT NULL
        ON CONFLICT (task_id, user_id) DO NOTHING
        """,
        """
        INSERT INTO task_groups (task_id, group_id, created_at)
        SELECT id, group_id, CURRENT_TIMESTAMP
        FROM tasks
        WHERE group_id IS NOT NULL
        ON CONFLICT (task_id, group_id) DO NOTHING
        """,
    ]

    for statement in statements:
        connection.execute(text(statement))


def ensure_postgres_schema(engine) -> None:
    driver = engine.url.drivername

    if driver not in (
        'postgresql',
        'postgresql+psycopg2',
        'postgresql+psycopg',
    ):
        return

    columns = [
        ('users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'client'"),
        ('users', 'approval_status', "VARCHAR(20) NOT NULL DEFAULT 'pending'"),
        ('users', 'approved_by_id', 'INTEGER'),
        ('users', 'approved_at', 'TIMESTAMP WITH TIME ZONE'),
        ('users', 'first_name', 'VARCHAR(80)'),
        ('users', 'last_name', 'VARCHAR(80)'),
        ('users', 'phone', 'VARCHAR(40)'),
        ('users', 'organization_id', 'INTEGER'),
        ('tasks', 'status_id', 'INTEGER'),
        ('tasks', 'priority', "VARCHAR(20) DEFAULT 'medium'"),
        ('tasks', 'version', 'INTEGER NOT NULL DEFAULT 1'),
        ('tasks', 'assignee_user_id', 'INTEGER'),
        ('tasks', 'group_id', 'INTEGER'),
        ('tasks', 'project_id', 'INTEGER'),
        ('tasks', 'organization_id', 'INTEGER'),
        ('tasks', 'updated_at', 'TIMESTAMP WITH TIME ZONE'),
        ('projects', 'planned_start', 'TIMESTAMP WITH TIME ZONE'),
        ('projects', 'deadline', 'TIMESTAMP WITH TIME ZONE'),
    ]

    with engine.connect() as connection:
        for table, column, column_type in columns:
            if not _postgres_has_column(connection, table, column):
                connection.execute(
                    text(
                        f'ALTER TABLE {table} '
                        f'ADD COLUMN {column} {column_type}'
                    )
                )

        _postgres_create_assignment_tables(connection)
        _postgres_migrate_legacy_assignments(connection)

        connection.commit()


def ensure_schema(engine) -> None:
    ensure_sqlite_schema(engine)
    ensure_postgres_schema(engine)