from dotenv import load_dotenv
from datetime import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import Optional, List

# Załaduj zmienne z pliku .env_backend_dev (development) lub .env_backend_prod (production)
# Sprawdź zmienną środowiskową ENV_FILE, jeśli nie ustawiona, użyj dev
import os
env_file = os.getenv('ENV_FILE', 'dev')
if env_file in ('prod', 'production'):
    env_file_path = '.env_backend_prod'
elif env_file in ('dev', 'development'):
    env_file_path = '.env_development'
else:
    env_file_path = '.env_development'

if os.path.exists(env_file_path):
    load_dotenv(env_file_path)
elif os.path.exists(f'../{env_file_path}'):
    load_dotenv(f'../{env_file_path}')

class Settings(BaseSettings):
    """Konfiguracja aplikacji z walidacją Pydantic"""
    
    model_config = SettingsConfigDict(
        env_file=['.env_backend_prod', '.env_development'],
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore'
    )
    
    # Secret Key
    SECRET_KEY: str = Field(
        default='dev-secret-key-change-in-production',
        description='Secret key for Flask sessions'
    )
    
    # Database - jedna zmienna URI
    SQLALCHEMY_DATABASE_URI: str = Field(
        default='sqlite:///tasks.db',
        description='Database connection URI (supports PostgreSQL and SQLite)'
    )
    
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = Field(
        default=False,
        description='Track modifications for SQLAlchemy'
    )
    
    # JWT Configuration
    JWT_SECRET_KEY: Optional[str] = Field(
        default=None,
        description='JWT secret key (defaults to SECRET_KEY if not set)'
    )
    
    JWT_ACCESS_TOKEN_EXPIRES: int = Field(
        default=3600,
        description='JWT access token expiration time in seconds'
    )
    
    JWT_REFRESH_TOKEN_EXPIRES: int = Field(
        default=2592000,
        description='JWT refresh token expiration time in seconds'
    )
    
    JWT_TOKEN_LOCATION: str = Field(
        default='headers',
        description='JWT token location (comma-separated: headers,cookies,json,query_string)'
    )
    
    @property
    def jwt_token_location_list(self) -> List[str]:
        """Zwraca JWT_TOKEN_LOCATION jako listę"""
        if isinstance(self.JWT_TOKEN_LOCATION, list):
            return self.JWT_TOKEN_LOCATION
        # Parsuj string jako listę (obsługuje format JSON lub comma-separated)
        if self.JWT_TOKEN_LOCATION.startswith('[') and self.JWT_TOKEN_LOCATION.endswith(']'):
            import json
            try:
                return json.loads(self.JWT_TOKEN_LOCATION)
            except:
                pass
        # Comma-separated values
        return [loc.strip() for loc in self.JWT_TOKEN_LOCATION.split(',') if loc.strip()]
    
    JWT_HEADER_NAME: str = Field(
        default='Authorization',
        description='JWT header name'
    )
    
    JWT_HEADER_TYPE: str = Field(
        default='Bearer',
        description='JWT header type'
    )
    
    # Flask Configuration
    FLASK_APP: Optional[str] = Field(
        default='app.py',
        description='Flask application file'
    )
    
    FLASK_ENV: str = Field(
        default='development',
        description='Flask environment'
    )
    
    # Server Configuration
    FLASK_HOST: str = Field(
        default='0.0.0.0',
        description='Flask server host'
    )
    
    FLASK_PORT: int = Field(
        default=5000,
        description='Flask server port'
    )

    # Rejestracja: domeny e-mail (po przecinku) → rola "client", pozostali → "employee"
    CLIENT_EMAIL_DOMAINS: str = Field(
        default='',
        description='Comma-separated email domains that register as client role',
    )

    UPLOAD_FOLDER: str = Field(
        default='uploads',
        description='Relative folder for task attachments (under backend cwd)',
    )

    MAX_UPLOAD_BYTES: int = Field(
        default=5_000_000,
        description='Max attachment size in bytes',
    )
    
    @field_validator('SQLALCHEMY_DATABASE_URI')
    @classmethod
    def validate_database_uri(cls, v: str) -> str:
        """Walidacja formatu URI bazy danych"""
        if not v:
            raise ValueError('SQLALCHEMY_DATABASE_URI cannot be empty')
        # Walidacja formatu - obsługujemy PostgreSQL i SQLite
        valid_prefixes = [
            'postgresql://',
            'postgresql+psycopg2://',
            'sqlite:///',
            'sqlite://'
        ]
        if not any(v.startswith(prefix) for prefix in valid_prefixes):
            raise ValueError(
                'SQLALCHEMY_DATABASE_URI must start with one of: '
                'postgresql://, postgresql+psycopg2://, sqlite:///, sqlite://'
            )
        return v
    
    @field_validator('FLASK_PORT')
    @classmethod
    def validate_port(cls, v: int) -> int:
        """Walidacja portu"""
        if not (1 <= v <= 65535):
            raise ValueError('FLASK_PORT must be between 1 and 65535')
        return v
    
    @property
    def jwt_secret_key(self) -> str:
        """Zwraca JWT_SECRET_KEY lub SECRET_KEY jako fallback"""
        return self.JWT_SECRET_KEY or self.SECRET_KEY
    
    @property
    def jwt_access_token_expires(self) -> timedelta:
        """Zwraca JWT_ACCESS_TOKEN_EXPIRES jako timedelta"""
        return timedelta(seconds=self.JWT_ACCESS_TOKEN_EXPIRES)
    
    @property
    def jwt_refresh_token_expires(self) -> timedelta:
        """Zwraca JWT_REFRESH_TOKEN_EXPIRES jako timedelta"""
        return timedelta(seconds=self.JWT_REFRESH_TOKEN_EXPIRES)

# Utwórz instancję ustawień
settings = Settings()

# Klasa Config dla kompatybilności z Flask
class Config:
    """Klasa konfiguracji Flask - wrapper dla Settings"""
    
    SECRET_KEY = settings.SECRET_KEY
    SQLALCHEMY_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = settings.SQLALCHEMY_TRACK_MODIFICATIONS
    
    # JWT Configuration
    JWT_SECRET_KEY = settings.jwt_secret_key
    JWT_ACCESS_TOKEN_EXPIRES = settings.jwt_access_token_expires
    JWT_REFRESH_TOKEN_EXPIRES = settings.jwt_refresh_token_expires
    JWT_TOKEN_LOCATION = settings.jwt_token_location_list
    JWT_HEADER_NAME = settings.JWT_HEADER_NAME
    JWT_HEADER_TYPE = settings.JWT_HEADER_TYPE

    MAX_CONTENT_LENGTH = settings.MAX_UPLOAD_BYTES

