import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-default')
    DATABASE_URL = os.getenv('DATABASE_URL')
    GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")

    # Email (SMTP) configuration is read directly from environment variables in auth_api/app.py
    # Expected env vars:
    # - MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USE_SSL, MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER
    # - APP_BASE_URL (used to build verify/reset links)
    # - EMAIL_TOKEN_SECRET, EMAIL_VERIFY_TOKEN_TTL_SECONDS, PASSWORD_RESET_TOKEN_TTL_SECONDS

    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", "900")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_SECONDS", "2592000")))
    JWT_COOKIE_SECURE = os.getenv("ENV") == "production"
    JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "None" if os.getenv("ENV") == "production" else "Lax")
    JWT_COOKIE_CSRF_PROTECT = False

    # Large file upload settings
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB max file size
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')


