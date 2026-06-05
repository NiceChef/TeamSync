import os
from dotenv import load_dotenv

env_file = os.getenv('ENV_FILE', 'dev')
if env_file in ('prod', 'production'):
    env_file_path = '.env_backend_prod'
elif env_file in ('dev', 'development'):
    env_file_path = '.env_development'
else:
    env_file_path = '.env_development'

for path in (env_file_path, f'../{env_file_path}', '.env_backend_dev', '../.env_backend_dev'):
    if os.path.exists(path):
        load_dotenv(path, override=False)
        break

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt
from config import Config, settings
from models import db
from routes import api
from auth import auth, users, is_jti_revoked
from schema_migrate import ensure_schema


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), settings.UPLOAD_FOLDER))
    os.makedirs(upload_dir, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_dir
    
    CORS(app, supports_credentials=True, allow_headers=['Content-Type', 'Authorization'])
    
    db.init_app(app)
    
    jwt = JWTManager(app)
    
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        return is_jti_revoked(jwt_payload['jti'])
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization token is missing'}), 401
    
    app.register_blueprint(api)
    app.register_blueprint(auth)
    app.register_blueprint(users)
    import sys
    is_flask_cli = 'flask' in sys.argv[0] or any('flask' in arg for arg in sys.argv)
    
    skip_auto_db = os.environ.get('TASKS_SKIP_AUTO_DB_INIT') == '1'
    if not is_flask_cli and not skip_auto_db:
        with app.app_context():
            try:
                from sqlalchemy import inspect as sql_inspect
                from seed import seed_test_user
                
                inspector = sql_inspect(db.engine)
                tables_before = inspector.get_table_names()
                db.create_all()
                ensure_schema(db.engine)

                if not tables_before or 'users' not in tables_before:
                    print('[INFO] Baza zainicjalizowana (create_all).')
                seed_test_user()
            except Exception as e:
                print(f'[WARN] Inicjalizacja bazy: {e}')
                print('[WARN] Aplikacja startuje — operacje na bazie mogą się nie powieść.')
    
    return app


app = create_app()

if __name__ == '__main__':
    from config import settings
    
    if settings.FLASK_ENV == 'production':
        from waitress import serve
        print(f'Starting Waitress on {settings.FLASK_HOST}:{settings.FLASK_PORT}')
        serve(app, host=settings.FLASK_HOST, port=settings.FLASK_PORT)
    else:
        debug_mode = settings.FLASK_ENV == 'development'
        app.run(debug=debug_mode, host=settings.FLASK_HOST, port=settings.FLASK_PORT)
