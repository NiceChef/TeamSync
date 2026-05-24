import json
from datetime import datetime

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, UserSettings
from routes import api

# ========== USER SETTINGS ENDPOINTS ==========

@api.route('/user/settings', methods=['GET'])
@jwt_required()
def get_user_settings():
    """Pobierz ustawienia użytkownika"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)

        user_settings = UserSettings.query.filter_by(user_id=current_user_id).first()

        if user_settings:
            return jsonify(user_settings.to_dict()), 200
        return jsonify({
            'id': None,
            'user_id': current_user_id,
            'settings': {},
            'updated_at': None,
            'created_at': None
        }), 200

    except Exception as e:
        print(f'ERROR getting user settings: {str(e)}')
        return jsonify({'error': f'Failed to get user settings: {str(e)}'}), 500

@api.route('/user/settings', methods=['POST'])
@jwt_required()
def save_user_settings():
    """Zapisz ustawienia użytkownika"""
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        settings = data.get('settings', {})

        expected_keys = ['selectedCategoryFilters', 'statusFilter', 'sortBy', 'sortOrder', 'visibleColumns', 'dateFrom', 'dateTo']
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
                settings_json=settings_json
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
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to save user settings: {str(e)}'}), 500
