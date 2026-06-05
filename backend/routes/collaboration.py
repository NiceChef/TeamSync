import json
import os
import uuid

from flask import request, jsonify, current_app, send_file
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename

from access import require_approved_user
from config import settings
from models import db, Task, TaskComment, TaskActivity, TaskAttachment, Notification, User
from task_access import task_visible, can_edit_task
from routes import api
from routes.helpers import _notify, _notify_internal_users


@api.route('/tasks/<int:task_id>/comments', methods=['GET'])
@require_approved_user
def list_task_comments(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    rows = TaskComment.query.filter_by(task_id=task_id).order_by(TaskComment.created_at.asc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/comments', methods=['POST'])
@require_approved_user
def create_task_comment(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()

    if not body:
        return jsonify({'error': 'body is required'}), 400

    comment = TaskComment(task_id=task_id, user_id=me.id, body=body)
    db.session.add(comment)
    db.session.flush()

    db.session.add(
        TaskActivity(
            task_id=task_id,
            user_id=me.id,
            action='comment',
            detail_json=json.dumps({'comment_id': comment.id}),
        )
    )

    for uid in {task.user_id, task.assignee_user_id}:
        if uid and uid != me.id:
            _notify(uid, f'Nowy komentarz: {task.topic[:80]}', task_id=task.id)

    _notify_internal_users(
        f'{me.username} dodał komentarz do zadania: {task.topic[:80]}',
        kind='comment',
        task_id=task.id,
    )

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@api.route('/tasks/<int:task_id>/activities', methods=['GET'])
@require_approved_user
def list_task_activities(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    rows = (
        TaskActivity.query.filter_by(task_id=task_id)
        .order_by(TaskActivity.created_at.desc())
        .limit(200)
        .all()
    )

    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/attachments', methods=['GET'])
@require_approved_user
def list_task_attachments(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Task not found'}), 404

    rows = TaskAttachment.query.filter_by(task_id=task_id).order_by(TaskAttachment.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/tasks/<int:task_id>/attachments', methods=['POST'])
@require_approved_user
def upload_task_attachment(task_id):
    me = User.query.get_or_404(int(get_jwt_identity()))
    task = Task.query.get(task_id)

    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Task not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'file field required'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Empty file'}), 400

    original_name = secure_filename(file.filename)
    ext = os.path.splitext(original_name)[1].lower()
    allowed = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.doc', '.docx', '.xlsx', '.csv'}

    if ext not in allowed:
        return jsonify({'error': 'File type not allowed'}), 400

    stored_name = f'{uuid.uuid4().hex}{ext}'
    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, stored_name)

    file.save(path)

    size = os.path.getsize(path)
    if size > settings.MAX_UPLOAD_BYTES:
        try:
            os.remove(path)
        except OSError:
            pass
        return jsonify({'error': 'File too large'}), 400

    attachment = TaskAttachment(
        task_id=task_id,
        user_id=me.id,
        original_name=original_name,
        stored_name=stored_name,
        mime_type=file.mimetype,
        size_bytes=size,
    )

    db.session.add(attachment)
    db.session.add(
        TaskActivity(
            task_id=task_id,
            user_id=me.id,
            action='attachment_upload',
            detail_json=json.dumps({'filename': original_name}),
        )
    )

    _notify_internal_users(
        f'{me.username} dodał plik do zadania: {task.topic[:80]}',
        kind='attachment',
        task_id=task.id,
    )

    db.session.commit()
    return jsonify(attachment.to_dict()), 201


@api.route('/attachments/<int:aid>/download', methods=['GET'])
@require_approved_user
def download_attachment(aid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    attachment = TaskAttachment.query.get_or_404(aid)
    task = Task.query.get(attachment.task_id)

    if not task or not task_visible(task, me):
        return jsonify({'error': 'Not found'}), 404

    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, attachment.stored_name)

    if not os.path.isfile(path):
        return jsonify({'error': 'File missing'}), 404

    return send_file(path, as_attachment=True, download_name=attachment.original_name)


@api.route('/attachments/<int:aid>', methods=['DELETE'])
@require_approved_user
def delete_attachment(aid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    attachment = TaskAttachment.query.get_or_404(aid)
    task = Task.query.get(attachment.task_id)

    if not task or not can_edit_task(task, me):
        return jsonify({'error': 'Not found'}), 404

    folder = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(folder, attachment.stored_name)

    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass

    db.session.delete(attachment)
    db.session.commit()

    return jsonify({'message': 'Deleted'}), 200


@api.route('/notifications', methods=['GET'])
@require_approved_user
def list_notifications():
    me = User.query.get_or_404(int(get_jwt_identity()))

    rows = (
        Notification.query.filter_by(user_id=me.id)
        .order_by(Notification.created_at.desc())
        .limit(80)
        .all()
    )

    return jsonify([r.to_dict() for r in rows]), 200


@api.route('/notifications/<int:nid>/read', methods=['POST'])
@require_approved_user
def mark_notification_read(nid):
    me = User.query.get_or_404(int(get_jwt_identity()))
    notification = Notification.query.filter_by(id=nid, user_id=me.id).first_or_404()

    notification.read = True
    db.session.commit()

    return jsonify(notification.to_dict()), 200