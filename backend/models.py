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
    role = db.Column(db.String(20), nullable=False, default='employee')
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)

    organization = db.relationship('Organization', backref='users', lazy=True)
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
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'organization_id': self.organization_id,
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
    assignee_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)

    status = db.relationship('TaskStatus', backref='tasks', lazy=True)
    assignee = db.relationship('User', foreign_keys=[assignee_user_id], backref='assigned_tasks', lazy=True)
    task_group = db.relationship('Group', foreign_keys=[group_id], backref='tasks', lazy=True)

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
    categories = db.relationship('Category', secondary=task_categories, backref='tasks', lazy=True)
    comments = db.relationship('TaskComment', backref='task', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('TaskActivity', backref='task', lazy=True, cascade='all, delete-orphan')
    attachments = db.relationship('TaskAttachment', backref='task', lazy=True, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='task', lazy=True, cascade='all, delete-orphan')

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
            outgoing_relations = TaskRelation.query.filter_by(source_task_id=self.id).all()
            for rel in outgoing_relations:
                subtask_id = rel.target_task_id
                if subtask_id not in visited:
                    subtask = db.session.get(Task, subtask_id)
                    if subtask:
                        if subtask.planned_date:
                            try:
                                if isinstance(subtask.planned_date, datetime):
                                    dates.append(subtask.planned_date.date())
                                elif hasattr(subtask.planned_date, 'date'):
                                    dates.append(subtask.planned_date.date())
                            except (AttributeError, ValueError):
                                pass
                        subtask_dates = subtask._get_all_subtask_planned_dates(visited.copy())
                        dates.extend(subtask_dates)
        except Exception:
            pass
        return dates

    def to_dict(self, include_relations=False, soonest_action=_UNSET):
        deadline_str = None
        if self.deadline:
            try:
                if isinstance(self.deadline, datetime):
                    deadline_str = self.deadline.date().isoformat()
                elif hasattr(self.deadline, 'date'):
                    deadline_str = self.deadline.date().isoformat()
            except (AttributeError, ValueError):
                deadline_str = None

        planned_date_str = None
        if self.planned_date:
            try:
                if isinstance(self.planned_date, datetime):
                    planned_date_str = self.planned_date.date().isoformat()
                elif hasattr(self.planned_date, 'date'):
                    planned_date_str = self.planned_date.date().isoformat()
            except (AttributeError, ValueError):
                planned_date_str = None

        # soonest_action: jeśli wywołujący policzył go hurtowo (lista zadań),
        # użyj wartości — inaczej rekurencyjny spacer po podzadaniach (pojedynczy GET).
        if soonest_action is not _UNSET:
            soonest_action_str = soonest_action
        else:
            soonest_action_str = None
            try:
                all_dates = self._get_all_subtask_planned_dates()
                if all_dates:
                    soonest_action_str = min(all_dates).isoformat()
                else:
                    soonest_action_str = planned_date_str
            except Exception:
                soonest_action_str = planned_date_str

        st = None
        try:
            if self.status:
                st = self.status.to_dict()
        except Exception:
            st = None

        assignee_d = None
        try:
            if self.assignee:
                assignee_d = {
                    'id': self.assignee.id,
                    'username': self.assignee.username,
                    'email': self.assignee.email,
                }
        except Exception:
            pass

        group_d = None
        try:
            if self.task_group:
                group_d = {'id': self.task_group.id, 'name': self.task_group.name}
        except Exception:
            pass

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
            'status': st,
            'status_id': self.status_id,
            'priority': self.priority or 'medium',
            'version': int(self.version or 1),
            'assignee_user_id': self.assignee_user_id,
            'assignee': assignee_d,
            'group_id': self.group_id,
            'group': group_d,
            'project_id': self.project_id,
        }

        if include_relations:
            try:
                result['related_tasks'] = {
                    'outgoing': [rel.to_dict() for rel in self.related_tasks_outgoing],
                    'incoming': [rel.to_dict() for rel in self.related_tasks_incoming],
                }
            except Exception:
                result['related_tasks'] = {'outgoing': [], 'incoming': []}

        try:
            result['categories'] = [cat.to_dict() for cat in self.categories]
        except Exception:
            result['categories'] = []

        return result


class TaskRelation(db.Model):
    __tablename__ = 'task_relations'

    id = db.Column(db.Integer, primary_key=True)
    source_task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    target_task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('source_task_id', 'target_task_id', name='unique_task_relation'),)

    def to_dict(self, include_tasks=False):
        result = {
            'id': self.id,
            'source_task_id': self.source_task_id,
            'target_task_id': self.target_task_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_tasks:
            result['source_task'] = self.source_task.to_dict() if self.source_task else None
            result['target_task'] = self.target_task.to_dict() if self.target_task else None
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
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow),
)


calendar_event_attendees = db.Table(
    'calendar_event_attendees',
    db.Column('event_id', db.Integer, db.ForeignKey('calendar_events.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
)


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='draft')
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = db.relationship('Organization', backref='projects', lazy=True)
    group = db.relationship('Group', backref='projects', lazy=True)
    members = db.relationship('User', secondary=project_members, backref='projects')
    tasks = db.relationship('Task', backref='project', lazy=True)

    def _progress(self):
        try:
            total = len(self.tasks)
            if not total:
                return 0
            done = sum(1 for t in self.tasks if t.completed)
            return round(done / total * 100)
        except Exception:
            return 0

    def to_dict(self, include_members=False, include_tasks=False):
        d = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'organization_id': self.organization_id,
            'group_id': self.group_id,
            'created_by_id': self.created_by_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'progress_percent': self._progress(),
            'task_count': len(self.tasks) if self.tasks is not None else 0,
        }
        if include_members:
            d['members'] = [
                {'id': u.id, 'username': u.username, 'email': u.email}
                for u in self.members
            ]
        else:
            d['member_count'] = len(self.members)
        if include_tasks:
            d['tasks'] = [t.to_dict() for t in self.tasks]
        return d


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

    project = db.relationship('Project', backref='events', lazy=True)
    attendees = db.relationship('User', secondary=calendar_event_attendees, backref='calendar_events')

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
