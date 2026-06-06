from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import json

db = SQLAlchemy()

# Sentinel: pozwala odróżnić "nie podano" od jawnego None w to_dict.
_UNSET = object()

group_members = db.Table(
    'group_members',
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow),
)


class Organization(db.Model):
    __tablename__ = 'organizations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TaskStatus(db.Model):
    __tablename__ = 'task_statuses'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    label = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_terminal = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'label': self.label,
            'sort_order': self.sort_order,
            'is_terminal': self.is_terminal,
        }


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    role = db.Column(db.String(20), nullable=False, default='client')
    approval_status = db.Column(db.String(20), nullable=False, default='pending')
    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)

    organization = db.relationship('Organization', backref='users', lazy=True)
    approved_by = db.relationship('User', remote_side=[id], lazy=True)
    groups = db.relationship('Group', secondary=group_members, back_populates='members')
    tasks = db.relationship(
        'Task',
        foreign_keys='Task.user_id',
        backref=db.backref('user', lazy=True),
        lazy=True,
        cascade='all, delete-orphan',
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'role': self.role,
            'approval_status': self.approval_status,
            'approved_by_id': self.approved_by_id,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'organization_id': self.organization_id,
            'organization_name': self.organization.name if self.organization else None,
        }

class Group(db.Model):
    __tablename__ = 'groups'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    department = db.Column(db.String(120), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    organization = db.relationship('Organization', backref='groups', lazy=True)
    members = db.relationship('User', secondary=group_members, back_populates='groups')

    def to_dict(self, include_member_count=False):
        d = {
            'id': self.id,
            'name': self.name,
            'department': self.department,
            'organization_id': self.organization_id,
            'created_by_id': self.created_by_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_member_count:
            try:
                d['member_count'] = len(self.members)
            except Exception:
                d['member_count'] = 0
        return d

task_categories = db.Table(
    'task_categories',
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('categories.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow),
)


task_assignees = db.Table(
    'task_assignees',
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow),
)


task_groups = db.Table(
    'task_groups',
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow),
)


task_organizations = db.Table(
    'task_organizations',
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('organization_id', db.Integer, db.ForeignKey('organizations.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow),
)


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    deadline = db.Column(db.DateTime, nullable=True)
    planned_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status_id = db.Column(db.Integer, db.ForeignKey('task_statuses.id'), nullable=True)
    priority = db.Column(db.String(20), nullable=False, default='medium')
    version = db.Column(db.Integer, nullable=False, default=1)

    # Stare pojedyncze przypisania pozostają tymczasowo dla zgodności.
    assignee_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)

    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)

    status = db.relationship('TaskStatus', backref='tasks', lazy=True)

    assignee = db.relationship(
        'User',
        foreign_keys=[assignee_user_id],
        backref='assigned_tasks',
        lazy=True,
    )

    task_group = db.relationship(
        'Group',
        foreign_keys=[group_id],
        backref='tasks',
        lazy=True,
    )

    organization = db.relationship(
        'Organization',
        foreign_keys=[organization_id],
        backref='tasks',
        lazy=True,
    )

    assigned_users = db.relationship(
        'User',
        secondary=task_assignees,
        backref='assigned_tasks_many',
        lazy=True,
    )

    assigned_groups = db.relationship(
        'Group',
        secondary=task_groups,
        backref='assigned_tasks_many',
        lazy=True,
    )

    assigned_organizations = db.relationship(
        'Organization',
        secondary=task_organizations,
        backref='assigned_tasks_many',
        lazy=True,
    )

    related_tasks_outgoing = db.relationship(
        'TaskRelation',
        foreign_keys='TaskRelation.source_task_id',
        backref='source_task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    related_tasks_incoming = db.relationship(
        'TaskRelation',
        foreign_keys='TaskRelation.target_task_id',
        backref='target_task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    categories = db.relationship(
        'Category',
        secondary=task_categories,
        backref='tasks',
        lazy=True,
    )

    comments = db.relationship(
        'TaskComment',
        backref='task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    activities = db.relationship(
        'TaskActivity',
        backref='task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    attachments = db.relationship(
        'TaskAttachment',
        backref='task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    notifications = db.relationship(
        'Notification',
        backref='task',
        lazy=True,
        cascade='all, delete-orphan',
    )

    @staticmethod
    def _format_task_datetime(value):
        if not value:
            return None

        try:
            if isinstance(value, datetime):
                return value.isoformat()

            if isinstance(value, date):
                return datetime.combine(value, datetime.min.time()).isoformat()

            if hasattr(value, 'isoformat'):
                return value.isoformat()
        except (AttributeError, ValueError, TypeError):
            return None

        return None

    @staticmethod
    def _user_payload(user):
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'organization_id': user.organization_id,
        }

    @staticmethod
    def _group_payload(group):
        return {
            'id': group.id,
            'name': group.name,
            'department': group.department,
            'organization_id': group.organization_id,
            'member_count': len(group.members or []),
        }

    @staticmethod
    def _organization_payload(organization):
        return {
            'id': organization.id,
            'name': organization.name,
        }

    def effective_assigned_users(self):
        """
        Zwraca faktyczną listę przypisanych użytkowników bez duplikatów.

        Kolejność źródeł:
        - bezpośrednio przypisani użytkownicy,
        - członkowie przypisanych grup,
        - członkowie przypisanych organizacji,
        - stare pojedyncze przypisanie assignee_user_id.
        """
        users_by_id = {}

        for user in self.assigned_users or []:
            users_by_id[user.id] = user

        for group in self.assigned_groups or []:
            for user in group.members or []:
                users_by_id[user.id] = user

        for organization in self.assigned_organizations or []:
            for user in organization.users or []:
                users_by_id[user.id] = user

        if self.assignee:
            users_by_id[self.assignee.id] = self.assignee

        return sorted(
            users_by_id.values(),
            key=lambda user: (user.username or '').lower(),
        )

    def _get_all_subtask_planned_dates(self, visited=None):
        if visited is None:
            visited = set()

        if self.id in visited:
            return []

        visited.add(self.id)
        dates = []

        if self.planned_date:
            try:
                if isinstance(self.planned_date, datetime):
                    dates.append(self.planned_date.date())
                elif hasattr(self.planned_date, 'date'):
                    dates.append(self.planned_date.date())
            except (AttributeError, ValueError):
                pass

        try:
            outgoing_relations = TaskRelation.query.filter_by(
                source_task_id=self.id
            ).all()

            for relation in outgoing_relations:
                subtask_id = relation.target_task_id

                if subtask_id in visited:
                    continue

                subtask = db.session.get(Task, subtask_id)
                if not subtask:
                    continue

                if subtask.planned_date:
                    try:
                        if isinstance(subtask.planned_date, datetime):
                            dates.append(subtask.planned_date.date())
                        elif hasattr(subtask.planned_date, 'date'):
                            dates.append(subtask.planned_date.date())
                    except (AttributeError, ValueError):
                        pass

                dates.extend(
                    subtask._get_all_subtask_planned_dates(visited.copy())
                )
        except Exception:
            pass

        return dates

    def to_dict(self, include_relations=False, soonest_action=_UNSET):
        deadline_str = self._format_task_datetime(self.deadline)
        planned_date_str = self._format_task_datetime(self.planned_date)

        if soonest_action is not _UNSET:
            soonest_action_str = soonest_action
        else:
            try:
                all_dates = self._get_all_subtask_planned_dates()

                if all_dates:
                    soonest_action_str = min(all_dates).isoformat()
                else:
                    soonest_action_str = planned_date_str
            except Exception:
                soonest_action_str = planned_date_str

        status_payload = None
        try:
            if self.status:
                status_payload = self.status.to_dict()
        except Exception:
            status_payload = None

        legacy_assignee = None
        try:
            if self.assignee:
                legacy_assignee = self._user_payload(self.assignee)
        except Exception:
            legacy_assignee = None

        legacy_group = None
        try:
            if self.task_group:
                legacy_group = self._group_payload(self.task_group)
        except Exception:
            legacy_group = None
            
        assigned_users_payload = []
        assigned_groups_payload = []
        assigned_organizations_payload = []
        effective_assignees_payload = []

        try:
            assigned_users_payload = [
                self._user_payload(user)
                for user in self.assigned_users or []
            ]
        except Exception:
            assigned_users_payload = []

        try:
            assigned_groups_payload = [
                self._group_payload(group)
                for group in self.assigned_groups or []
            ]
        except Exception:
            assigned_groups_payload = []

        try:
            assigned_organizations_payload = [
                self._organization_payload(organization)
                for organization in self.assigned_organizations or []
            ]
        except Exception:
            assigned_organizations_payload = []

        try:
            effective_assignees_payload = [
                self._user_payload(user)
                for user in self.effective_assigned_users()
            ]
        except Exception:
            effective_assignees_payload = []
        result = {
            'id': self.id,
            'topic': str(self.topic) if self.topic else '',
            'notes': str(self.notes) if self.notes else '',
            'deadline': deadline_str,
            'planned_date': planned_date_str,
            'soonest_action': soonest_action_str,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed': bool(self.completed),
            'user_id': int(self.user_id),
            'status': status_payload,
            'status_id': self.status_id,
            'priority': self.priority or 'medium',
            'version': int(self.version or 1),

            # Pola zgodności ze starą wersją.
            'assignee_user_id': self.assignee_user_id,
            'assignee': legacy_assignee,
            'group_id': self.group_id,
            'group': legacy_group,

            # Nowe wielokrotne przypisania.
            'assigned_user_ids': [
                user['id'] for user in assigned_users_payload
            ],
            'assigned_users': assigned_users_payload,
            'assigned_group_ids': [
                group['id'] for group in assigned_groups_payload
            ],
            'assigned_groups': assigned_groups_payload,
            'assigned_organization_ids': [
                organization['id']
                for organization in assigned_organizations_payload
            ],
            'assigned_organizations': assigned_organizations_payload,

            # Faktyczna lista osób po usunięciu duplikatów.
            'effective_assignees': effective_assignees_payload,
            'effective_assignee_count': len(effective_assignees_payload),

            'project_id': self.project_id,
            'organization_id': self.organization_id,
            'comment_count': len(self.comments) if self.comments is not None else 0,
            'attachment_count': len(self.attachments) if self.attachments is not None else 0,
            'has_attachments': bool(self.attachments),
        }

        if include_relations:
            try:
                result['related_tasks'] = {
                    'outgoing': [
                        relation.to_dict()
                        for relation in self.related_tasks_outgoing
                    ],
                    'incoming': [
                        relation.to_dict()
                        for relation in self.related_tasks_incoming
                    ],
                }
            except Exception:
                result['related_tasks'] = {
                    'outgoing': [],
                    'incoming': [],
                }

        try:
            result['categories'] = [
                category.to_dict()
                for category in self.categories
            ]
        except Exception:
            result['categories'] = []

        return result
    
class TaskRelation(db.Model):
    __tablename__ = 'task_relations'

    id = db.Column(db.Integer, primary_key=True)
    source_task_id = db.Column(
        db.Integer,
        db.ForeignKey('tasks.id'),
        nullable=False,
    )
    target_task_id = db.Column(
        db.Integer,
        db.ForeignKey('tasks.id'),
        nullable=False,
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            'source_task_id',
            'target_task_id',
            name='unique_task_relation',
        ),
    )

    def to_dict(self, include_tasks=False):
        result = {
            'id': self.id,
            'source_task_id': self.source_task_id,
            'target_task_id': self.target_task_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

        if include_tasks:
            result['source_task'] = (
                self.source_task.to_dict()
                if self.source_task
                else None
            )
            result['target_task'] = (
                self.target_task.to_dict()
                if self.target_task
                else None
            )

        return result

class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('name', 'user_id', name='unique_category_per_user'),)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class UserSettings(db.Model):
    __tablename__ = 'user_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    settings_json = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', name='unique_user_settings'),)

    def to_dict(self):
        try:
            settings = json.loads(self.settings_json) if self.settings_json else {}
        except (json.JSONDecodeError, TypeError):
            settings = {}
        return {
            'id': self.id,
            'user_id': self.user_id,
            'settings': settings,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TaskComment(db.Model):
    __tablename__ = 'task_comments'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship('User', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'body': self.body,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'author_username': self.author.username if self.author else None,
        }


class TaskActivity(db.Model):
    __tablename__ = 'task_activities'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(80), nullable=False)
    detail_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', lazy=True)

    def to_dict(self):
        detail = None
        if self.detail_json:
            try:
                detail = json.loads(self.detail_json)
            except (json.JSONDecodeError, TypeError):
                detail = self.detail_json
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'action': self.action,
            'detail': detail,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'username': self.user.username if self.user else None,
        }


class TaskAttachment(db.Model):
    __tablename__ = 'task_attachments'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(120), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'original_name': self.original_name,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    kind = db.Column(db.String(80), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'kind': self.kind,
            'message': self.message,
            'read': self.read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

project_members = db.Table(
    'project_members',
    db.Column(
        'project_id',
        db.Integer,
        db.ForeignKey('projects.id'),
        primary_key=True,
    ),
    db.Column(
        'user_id',
        db.Integer,
        db.ForeignKey('users.id'),
        primary_key=True,
    ),
    db.Column(
        'joined_at',
        db.DateTime,
        default=datetime.utcnow,
    ),
)

project_groups = db.Table(
    'project_groups',
    db.Column(
        'project_id',
        db.Integer,
        db.ForeignKey('projects.id'),
        primary_key=True,
    ),
    db.Column(
        'group_id',
        db.Integer,
        db.ForeignKey('groups.id'),
        primary_key=True,
    ),
    db.Column(
        'created_at',
        db.DateTime,
        default=datetime.utcnow,
    ),
)

project_organizations = db.Table(
    'project_organizations',
    db.Column(
        'project_id',
        db.Integer,
        db.ForeignKey('projects.id'),
        primary_key=True,
    ),
    db.Column(
        'organization_id',
        db.Integer,
        db.ForeignKey('organizations.id'),
        primary_key=True,
    ),
    db.Column(
        'created_at',
        db.DateTime,
        default=datetime.utcnow,
    ),
)


calendar_event_attendees = db.Table(
    'calendar_event_attendees',
    db.Column(
        'event_id',
        db.Integer,
        db.ForeignKey('calendar_events.id'),
        primary_key=True,
    ),
    db.Column(
        'user_id',
        db.Integer,
        db.ForeignKey('users.id'),
        primary_key=True,
    ),
)


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='draft')

    # Organizacja właścicielska projektu.
    organization_id = db.Column(
        db.Integer,
        db.ForeignKey('organizations.id'),
        nullable=True,
    )

    group_id = db.Column(
        db.Integer,
        db.ForeignKey('groups.id'),
        nullable=True,
    )

    created_by_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id'),
        nullable=True,
    )

    planned_start = db.Column(db.DateTime, nullable=True)
    deadline = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    organization = db.relationship(
        'Organization',
        foreign_keys=[organization_id],
        backref='owned_projects',
        lazy=True,
    )

    group = db.relationship(
        'Group',
        backref='projects',
        lazy=True,
    )

    members = db.relationship(
        'User',
        secondary=project_members,
        backref='projects',
        lazy=True,
    )

    assigned_groups = db.relationship(
        'Group',
        secondary=project_groups,
        backref='assigned_projects',
        lazy=True,
    )

    assigned_organizations = db.relationship(
        'Organization',
        secondary=project_organizations,
        backref='assigned_projects',
        lazy=True,
    )

    tasks = db.relationship(
        'Task',
        backref='project',
        lazy=True,
    )

    def effective_members(self):
        """
        Zwraca wszystkich użytkowników posiadających pełny dostęp do projektu.

        Pełny dostęp otrzymują:
        - osoby przypisane bezpośrednio,
        - członkowie przypisanych działów,
        - użytkownicy przypisanych organizacji,
        - twórca projektu.
        """
        users_by_id = {}

        for user in self.members or []:
            users_by_id[user.id] = user

        for group in self.assigned_groups or []:
            for user in group.members or []:
                users_by_id[user.id] = user

        for organization in self.assigned_organizations or []:
            for user in organization.users or []:
                users_by_id[user.id] = user

        if self.created_by_id:
            creator = db.session.get(User, self.created_by_id)

            if creator:
                users_by_id[creator.id] = creator

        return sorted(
            users_by_id.values(),
            key=lambda user: (user.username or '').lower(),
        )

    def user_has_full_access(self, user):
        if not user:
            return False

        if user.id == self.created_by_id:
            return True

        if any(member.id == user.id for member in self.members or []):
            return True

        if any(
            member.id == user.id
            for group in self.assigned_groups or []
            for member in group.members or []
        ):
            return True

        return any(
            organization.id == user.organization_id
            for organization in self.assigned_organizations or []
        )

    def _progress(self, tasks=None):
        try:
            selected_tasks = self.tasks if tasks is None else tasks
            selected_tasks = selected_tasks or []

            total = len(selected_tasks)

            if not total:
                return 0

            completed = sum(
                1
                for task in selected_tasks
                if task.completed
            )

            return round(completed / total * 100)
        except Exception:
            return 0

    @staticmethod
    def _member_payload(user):
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'organization_id': user.organization_id,
            'organization_name': (
                user.organization.name
                if user.organization
                else None
            ),
        }

    @staticmethod
    def _organization_payload(organization):
        return {
            'id': organization.id,
            'name': organization.name,
            'user_count': len(organization.users or []),
        }
    
    @staticmethod
    def _group_payload(group):
        return {
            'id': group.id,
            'name': group.name,
            'department': group.department,
            'organization_id': group.organization_id,
            'organization_name': (
                group.organization.name
                if group.organization
                else None
            ),
            'member_count': len(group.members or []),
        }
    
    def to_dict(
        self,
        include_members=False,
        include_tasks=False,
        tasks_override=None,
    ):
        """
        tasks_override pozwala endpointowi projektu przekazać tylko zadania
        widoczne dla aktualnego użytkownika.
        """
        tasks = (
            list(tasks_override)
            if tasks_override is not None
            else list(self.tasks or [])
        )

        comment_count = 0
        attachment_count = 0

        for task in tasks:
            try:
                comment_count += len(task.comments or [])
            except Exception:
                pass

            try:
                attachment_count += len(task.attachments or [])
            except Exception:
                pass

        assigned_groups_payload = [
            self._group_payload(group)
            for group in self.assigned_groups or []
        ]

        assigned_organizations_payload = [
            self._organization_payload(organization)
            for organization in self.assigned_organizations or []
        ]

        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'organization_id': self.organization_id,
            'organization_name': (
                self.organization.name
                if self.organization
                else None
            ),
            'group_id': self.group_id,
            'created_by_id': self.created_by_id,
            'planned_start': (
                self.planned_start.isoformat()
                if self.planned_start
                else None
            ),
            'deadline': (
                self.deadline.isoformat()
                if self.deadline
                else None
            ),
            'created_at': (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
            'updated_at': (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            ),
            'progress_percent': self._progress(tasks),
            'task_count': len(tasks),
            'comment_count': comment_count,
            'attachment_count': attachment_count,
            'has_attachments': attachment_count > 0,
            'assigned_group_ids': [
                group['id']
                for group in assigned_groups_payload
            ],
            'assigned_groups': assigned_groups_payload,
            'assigned_organization_ids': [
                organization['id']
                for organization in assigned_organizations_payload
            ],
            'assigned_organizations': assigned_organizations_payload,

            'member_ids': [
                member.id
                for member in self.members or []
            ],
            'member_count': len(self.members or []),

            'effective_member_count': len(self.effective_members()),
        }

        if include_members:
            result['members'] = [
                self._member_payload(member)
                for member in self.members or []
            ]

            result['effective_members'] = [
                self._member_payload(member)
                for member in self.effective_members()
            ]

        if include_tasks:
            result['tasks'] = [
                task.to_dict()
                for task in tasks
            ]

        return result

class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start = db.Column(db.DateTime, nullable=False)
    end = db.Column(db.DateTime, nullable=False)
    event_type = db.Column(db.String(20), nullable=False, default='meeting')
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship(
        'Project',
        foreign_keys=[project_id],
        backref='events',
        lazy=True,
    )

    task = db.relationship(
        'Task',
        foreign_keys=[task_id],
        backref='events',
        lazy=True,
    )

    attendees = db.relationship(
        'User',
        secondary=calendar_event_attendees,
        backref='calendar_events',
        lazy=True,
    )
    def to_dict(self, include_attendees=False):
        d = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'start': self.start.isoformat() if self.start else None,
            'end': self.end.isoformat() if self.end else None,
            'event_type': self.event_type or 'meeting',
            'project_id': self.project_id,
            'task_id': self.task_id,
            'organization_id': self.organization_id,
            'created_by_id': self.created_by_id,
            'version': int(self.version or 1),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_attendees:
            d['attendees'] = [
                {'id': u.id, 'username': u.username, 'email': u.email}
                for u in self.attendees
            ]
        return d


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class RevokedToken(db.Model):
    __tablename__ = 'revoked_tokens'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
