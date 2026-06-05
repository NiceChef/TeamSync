import json
from datetime import datetime

from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from access import require_approved_user
from models import db, UserSettings
from routes import api


@api.route('/user/settings', methods=['GET'])
@require_approved_user
def get_user_settings():
    try:
        current_user_id = int(get_jwt_identity())
        user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()

        if user_settings:
            return jsonify(user_settings.to_dict()), 200

        return jsonify({
            'id': None,
            'user_id': current_user_id,
            'settings': {},
            'updated_at': None,
            'created_at': None,
        }), 200
    except Exception as e:
        print(f'ERROR getting user settings: {str(e)}')
        return jsonify({'error': f'Failed to get user settings: {str(e)}'}), 500


@api.route('/user/settings', methods=['POST'])
@require_approved_user
def save_user_settings():
    try:
        current_user_id = int(get_jwt_identity())

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        settings = data.get('settings', {})
        expected_keys = [
            'selectedCategoryFilters',
            'statusFilter',
            'sortBy',
            'sortOrder',
            'visibleColumns',
            'dateFrom',
            'dateTo',
        ]

        validated_settings = {}
        for key in expected_keys:
            if key in settings:
                validated_settings[key] = settings[key]

        settings_json = json.dumps(validated_settings)
        user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()

        if user_settings:
            user_settings.settings_json = settings_json
            user_settings.updated_at = datetime.utcnow()
        else:
            user_settings = UserSettings(
                user_id=current_user_id,
                settings_json=settings_json,
            )
            db.session.add(user_settings)

        try:
            db.session.commit()
        except Exception as commit_error:
            db.session.rollback()

            if 'unique_user_settings' in str(commit_error) or 'UniqueViolation' in str(commit_error):
                user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()
                if user_settings:
                    user_settings.settings_json = settings_json
                    user_settings.updated_at = datetime.utcnow()
                    db.session.commit()
                else:
                    raise commit_error
            else:
                raise

        return jsonify(user_settings.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f'ERROR saving user settings: {str(e)}')
        return jsonify({'error': f'Failed to save user settings: {str(e)}'}), 500