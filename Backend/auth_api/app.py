from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flasgger import Swagger
import psycopg
from psycopg.rows import dict_row
import os
import sys
import smtplib
from email.message import EmailMessage
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from dotenv import load_dotenv
from config import Config


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dashboards.dashboard import dashboard_bp
from plans.plans import plans_bp
from plans.enhanced_uploads import enhanced_uploads_bp
from teams.teams import teams_bp
from creator.creator_tools import creator_tools_bp
from admin.admin_management import admin_bp
from customer.customer_actions import customer_bp
from ai.ai_assistant import ai_bp

load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)


def _get_env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_email_serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("EMAIL_TOKEN_SECRET") or app.config.get("SECRET_KEY")
    if not secret:
        raise RuntimeError("EMAIL_TOKEN_SECRET (or SECRET_KEY fallback) is not configured")
    return URLSafeTimedSerializer(secret_key=secret, salt="ramanicave-email")


def _build_app_url(path: str) -> str:
    base = (os.getenv("APP_BASE_URL") or os.getenv("FRONTEND_URL") or "").rstrip("/")
    if not base:
        # Fallback: relative URL (still useful in local dev)
        return path
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    mail_server = os.getenv("MAIL_SERVER")
    mail_port = int(os.getenv("MAIL_PORT", "587"))
    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    default_sender = os.getenv("MAIL_DEFAULT_SENDER") or mail_username
    use_tls = _get_env_bool("MAIL_USE_TLS", True)
    use_ssl = _get_env_bool("MAIL_USE_SSL", False)

    if not mail_server or not mail_username or not mail_password or not default_sender:
        raise RuntimeError("SMTP env vars not configured (MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER)")

    msg = EmailMessage()
    msg["From"] = default_sender
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content("This email requires an HTML-capable client.")
    msg.add_alternative(html_body, subtype="html")

    if use_ssl:
        server = smtplib.SMTP_SSL(mail_server, mail_port, timeout=20)
    else:
        server = smtplib.SMTP(mail_server, mail_port, timeout=20)

    try:
        if use_tls and not use_ssl:
            server.starttls()
        server.login(mail_username, mail_password)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass

# Enable CORS for frontend
# CORS configuration - allows frontend from any origin in production
# In production, set FRONTEND_URL env variable for security
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://plancave-prototype-frontend.onrender.com",
]

# Add production frontend URL if set
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

# For prototype/development: allow all Render domains
# In production, replace this with specific domain
if os.environ.get("ENV") != "production":
    allowed_origins.append("*")  # Allow all origins for prototype

CORS(app, 
     resources={r"/*": {"origins": allowed_origins}},
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

bcrypt = Bcrypt(app)
jwt = JWTManager(app)

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Ramanicave Backend API",
        "description": "Interactive documentation for Ramanicave backend endpoints (auth, plans, uploads, teams, creator tools, admin, customer).",
        "version": "1.0.0"
    },
    "basePath": "/",
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header. Example: 'Bearer {token}'"
        }
    },
}

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/apispec_1.json",
            "rule_filter": lambda rule: True,  # include all routes
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs/",
}

swagger = Swagger(app, template=swagger_template, config=swagger_config)

app.register_blueprint(dashboard_bp)
app.register_blueprint(plans_bp)
app.register_blueprint(enhanced_uploads_bp)
app.register_blueprint(teams_bp)
app.register_blueprint(creator_tools_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(customer_bp)
app.register_blueprint(ai_bp)


@app.route('/')
@app.route('/api/health', strict_slashes=False)
def health_check():
    """Health check endpoint for Render and monitoring"""
    return jsonify({
        "status": "healthy",
        "service": "Ramanicave API",
        "version": "1.0.0"
    }), 200


@app.route('/uploads/<path:filename>')
@app.route('/api/uploads/<path:filename>')
def serve_uploads(filename):
    """Serve uploaded plan files (thumbnails, galleries, documents).

    This makes URLs like /uploads/plans/<plan_id>/images/<file> accessible
    from the frontend using the backend base URL.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    upload_root = os.path.join(project_root, 'uploads')
    return send_from_directory(upload_root, filename)


def get_db():
    """
    Establishes and returns a new connection to the PostgreSQL database.
    """
    return psycopg.connect(app.config['DATABASE_URL'])


def get_current_user():
    """
    Retrieves the current user's identity from the JWT token.

    Returns:
        tuple: User ID and role of the currently authenticated user.
    """
    from flask_jwt_extended import get_jwt
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    role = claims.get('role')
    return user_id, role


def register_user(data, role):
    """
    Registers a new user with the specified role (customer, designer, or admin).

    Args:
        data (dict): The request data containing 'username', 'password', and optional name fields.
        role (str): Role to assign to the new user.

    Returns:
        Response: JSON response indicating success or failure of the registration process.
    """
    username = (data.get('username') or '').strip()
    password = data.get('password')
    first_name = data.get('first_name', '')
    middle_name = data.get('middle_name', '')
    last_name = data.get('last_name', '')

    if not username or not password:
        return jsonify(message="Username and password are required"), 400

    # Normalize username (email) to lowercase for consistency
    username_lc = username.lower()

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        # Ensure columns exist (idempotent)
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;")
            conn.commit()
        except Exception:
            conn.rollback()

        # Check duplicate by case-insensitive match
        cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s);", (username_lc,))
        if cur.fetchone():
            return jsonify(message="This email/username is already registered"), 409

        # Insert user (unverified by default)
        cur.execute(
            "INSERT INTO users (username, password, role, first_name, middle_name, last_name, is_active, email_verified) VALUES (%s, %s, %s, %s, %s, %s, TRUE, FALSE) RETURNING id;",
            (username_lc, hashed_pw, role, first_name, middle_name, last_name)
        )
        row = cur.fetchone()
        conn.commit()
        user_id = row['id'] if row else None

        # Send verification email (best-effort; do not block registration if SMTP is down)
        try:
            serializer = _get_email_serializer()
            token = serializer.dumps({"user_id": int(user_id), "email": username_lc, "purpose": "verify_email"})
            verify_url = _build_app_url(f"/verify-email?token={token}")
            html = (
                "<div style='font-family:Arial,sans-serif'>"
                "<h2>Verify your email</h2>"
                "<p>Please confirm your email address to activate your Ramanicave account.</p>"
                f"<p><a href='{verify_url}' style='display:inline-block;padding:10px 14px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px'>Verify Email</a></p>"
                "<p>If you did not create this account, you can ignore this email.</p>"
                "</div>"
            )
            _send_email(username_lc, "Verify your Ramanicave email", html)
        except Exception as e:
            app.logger.error(f"Failed to send verification email to {username_lc}: {e}")

        return jsonify({
            "id": user_id,
            "email": username_lc,
            "role": role,
            "message": f"{role.capitalize()} registered successfully. Please verify your email before login."
        }), 201
    except Exception as e:
        conn.rollback()
        # If a unique constraint exists, this could still fire; map to 409 where possible
        try:
            from psycopg.errors import UniqueViolation  # type: ignore
            if isinstance(e, UniqueViolation):
                return jsonify(message="This email/username is already registered"), 409
        except Exception:
            pass
        return jsonify(message="Registration failed", error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@app.route('/me/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """Upload and set the current user's profile picture.

    Expects multipart/form-data with a single file field named 'avatar'.
    """
    from werkzeug.utils import secure_filename
    user_id, role = get_current_user()

    if 'avatar' not in request.files:
        return jsonify(message="No avatar file provided"), 400

    file = request.files['avatar']
    if file.filename == '':
        return jsonify(message="Empty filename"), 400

    filename = secure_filename(file.filename)
    # Simple extension check
    allowed_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in allowed_exts:
        return jsonify(message="Unsupported file type"), 400

    try:
        from utils.cloudinary_config import upload_to_cloudinary
        secure_url = upload_to_cloudinary(file, folder="avatars")
        if not secure_url:
            return jsonify(message="Failed to upload avatar: no URL returned"), 500
    except Exception as e:
        app.logger.error(f"Avatar upload error: {e}")
        return jsonify(message="Failed to upload avatar", error=str(e)), 500

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            "UPDATE users SET profile_picture_url = %s WHERE id = %s RETURNING id, username, role, first_name, middle_name, last_name, profile_picture_url;",
            (secure_url, user_id),
        )
        row = cur.fetchone()
        conn.commit()

        if not row:
            return jsonify(message="User not found"), 404

        return jsonify({
            "id": row["id"],
            "email": row["username"],
            "role": row["role"],
            "first_name": row.get("first_name"),
            "middle_name": row.get("middle_name"),
            "last_name": row.get("last_name"),
            "profile_picture_url": row.get("profile_picture_url"),
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message="Failed to upload avatar", error=str(e)), 500
    finally:
        cur.close()
        conn.close()

    

@app.route('/register/customer', methods=['POST'])
def register_customer():
    """
    Register Customer
    Register a new customer account.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: jane_customer
            password:
              type: string
              example: securepass123
    responses:
      201:
        description: Customer registered successfully
      400:
        description: Missing username or password
      409:
        description: Username already exists
    """
    data = request.get_json()
    return register_user(data, role='customer')


@app.route('/register/designer', methods=['POST'])
def register_designer():
    """
    Register Designer
    Register a new designer/architect account.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: john_architect
            password:
              type: string
              example: securepass123
    responses:
      201:
        description: Designer registered successfully
      400:
        description: Missing username or password
      409:
        description: Username already exists
    """
    data = request.get_json()
    return register_user(data, role='designer')


@app.route('/admin/create_user', methods=['POST'])
@jwt_required()
def create_user():
    """
    Endpoint for admins to create new users with any role.

    Returns:
        Response: JSON response indicating the result of the operation.
    """
    current_user_id, current_role = get_current_user()
    if current_role != 'admin':
        return jsonify(message="Admins only"), 403

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    if role not in ['admin', 'designer', 'customer']:
        return jsonify(message="Invalid role"), 400

    return register_user({'username': username, 'password': password}, role=role)


@app.route('/login', methods=['POST'])
def login():
    """
    User Login
    Authenticates a user and returns a JWT access token.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: john_architect
            password:
              type: string
              example: securepass123
    responses:
      200:
        description: Login successful
        schema:
          type: object
          properties:
            access_token:
              type: string
      401:
        description: Invalid credentials
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    conn = get_db()
    cur = conn.cursor()
    # Make username lookup case-insensitive so existing mixed-case usernames still work
    cur.execute("SELECT id, password, role, is_active, COALESCE(email_verified, FALSE) FROM users WHERE LOWER(username) = LOWER(%s);", (username,))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if not result:
        return jsonify(message="Invalid credentials"), 401

    user_id, hashed_pw, role, is_active, email_verified = result
    
    # Check if account is active
    if not is_active:
        return jsonify(message="Your account has been deactivated. Please contact admin@ramanicave.com."), 403

    if not email_verified and (role or "").lower() != "admin":
        return jsonify(message="Please verify your email before login."), 403

    if bcrypt.check_password_hash(hashed_pw, password):
        access_token = create_access_token(
            identity=str(user_id),
            additional_claims={"role": role, "email": username}
        )

        refresh_token = create_refresh_token(
            identity=str(user_id),
            additional_claims={"role": role, "email": username}
        )

        resp = jsonify(access_token=access_token)
        set_refresh_cookies(resp, refresh_token)
        return resp
    else:
        return jsonify(message="Invalid credentials"), 401


@app.route('/auth/resend-verification', methods=['POST'])
def resend_verification_email():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify(message="username is required"), 400

    username_lc = username.lower()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            "SELECT id, COALESCE(email_verified, FALSE) AS email_verified FROM users WHERE LOWER(username) = LOWER(%s)",
            (username_lc,),
        )
        row = cur.fetchone()
        # Always return 200 to avoid account enumeration
        if not row:
            return jsonify(message="If the account exists, a verification email has been sent."), 200
        if bool(row.get('email_verified')):
            return jsonify(message="Email already verified."), 200

        try:
            serializer = _get_email_serializer()
            token = serializer.dumps({"user_id": int(row['id']), "email": username_lc, "purpose": "verify_email"})
            verify_url = _build_app_url(f"/verify-email?token={token}")
            html = (
                "<div style='font-family:Arial,sans-serif'>"
                "<h2>Verify your email</h2>"
                "<p>Click the button below to verify your email.</p>"
                f"<p><a href='{verify_url}' style='display:inline-block;padding:10px 14px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px'>Verify Email</a></p>"
                "</div>"
            )
            _send_email(username_lc, "Verify your Ramanicave email", html)
        except Exception as e:
            app.logger.error(f"Failed to resend verification email to {username_lc}: {e}")

        return jsonify(message="If the account exists, a verification email has been sent."), 200
    finally:
        cur.close()
        conn.close()


@app.route('/auth/verify-email', methods=['GET'])
def verify_email():
    token = request.args.get('token')
    if not token:
        return jsonify(message="token is required"), 400

    serializer = _get_email_serializer()
    try:
        payload = serializer.loads(token, max_age=int(os.getenv("EMAIL_VERIFY_TOKEN_TTL_SECONDS", "86400")))
    except SignatureExpired:
        return jsonify(message="Verification link expired"), 400
    except BadSignature:
        return jsonify(message="Invalid verification token"), 400

    if not isinstance(payload, dict) or payload.get("purpose") != "verify_email":
        return jsonify(message="Invalid verification token"), 400

    user_id = payload.get("user_id")
    email = (payload.get("email") or "").lower()
    if not user_id or not email:
        return jsonify(message="Invalid verification token"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            "UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = %s AND LOWER(username) = LOWER(%s) RETURNING id",
            (int(user_id), email),
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify(message="User not found"), 404
        return jsonify(message="Email verified successfully"), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message="Failed to verify email", error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@app.route('/auth/password-reset/request', methods=['POST'])
def request_password_reset():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify(message="username is required"), 400

    username_lc = username.lower()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s)", (username_lc,))
        row = cur.fetchone()

        # Always return 200 (avoid enumeration)
        if not row:
            return jsonify(message="If the account exists, a password reset email has been sent."), 200

        try:
            serializer = _get_email_serializer()
            token = serializer.dumps({"user_id": int(row['id']), "email": username_lc, "purpose": "reset_password"})
            reset_url = _build_app_url(f"/reset-password?token={token}")
            html = (
                "<div style='font-family:Arial,sans-serif'>"
                "<h2>Reset your password</h2>"
                "<p>Click the button below to set a new password.</p>"
                f"<p><a href='{reset_url}' style='display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:8px'>Reset Password</a></p>"
                "<p>If you didn't request this, you can ignore this email.</p>"
                "</div>"
            )
            _send_email(username_lc, "Reset your Ramanicave password", html)
        except Exception as e:
            app.logger.error(f"Failed to send password reset email to {username_lc}: {e}")

        return jsonify(message="If the account exists, a password reset email has been sent."), 200
    finally:
        cur.close()
        conn.close()


@app.route('/auth/password-reset/confirm', methods=['POST'])
def confirm_password_reset():
    data = request.get_json() or {}
    token = data.get('token')
    new_password = data.get('new_password')
    if not token or not new_password:
        return jsonify(message="token and new_password are required"), 400

    serializer = _get_email_serializer()
    try:
        payload = serializer.loads(token, max_age=int(os.getenv("PASSWORD_RESET_TOKEN_TTL_SECONDS", "1800")))
    except SignatureExpired:
        return jsonify(message="Reset link expired"), 400
    except BadSignature:
        return jsonify(message="Invalid reset token"), 400

    if not isinstance(payload, dict) or payload.get("purpose") != "reset_password":
        return jsonify(message="Invalid reset token"), 400

    user_id = payload.get("user_id")
    email = (payload.get("email") or "").lower()
    if not user_id or not email:
        return jsonify(message="Invalid reset token"), 400

    hashed_pw = bcrypt.generate_password_hash(new_password).decode('utf-8')

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            "UPDATE users SET password = %s WHERE id = %s AND LOWER(username) = LOWER(%s) RETURNING id",
            (hashed_pw, int(user_id), email),
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify(message="User not found"), 404
        return jsonify(message="Password updated successfully"), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message="Failed to reset password", error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@app.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_access_token():
    identity = get_jwt_identity()
    claims = get_jwt() or {}
    role = claims.get('role')
    email = claims.get('email')

    access_token = create_access_token(
        identity=str(identity),
        additional_claims={"role": role, "email": email}
    )
    return jsonify(access_token=access_token)


@app.route('/auth/logout', methods=['POST'])
def logout():
    resp = jsonify(message="Logged out")
    unset_jwt_cookies(resp)
    return resp


@app.route('/dashboard', methods=['GET'])
@jwt_required()
def protected():
    """
    Protected dashboard endpoint accessible only to authenticated users.

    Returns:
        Response: JSON message with a greeting to the user.
    """
    user_id, role = get_current_user()
    return jsonify(message=f"Welcome {role} #{user_id}!")


def init_db():
    """Initialize database with required columns"""
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Add missing columns if they don't exist
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);")
        
        # Update existing users to be active
        cur.execute("UPDATE users SET is_active = TRUE WHERE is_active IS NULL;")
        
        conn.commit()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"⚠️  Database initialization error (may be normal): {e}")
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route('/me', methods=['GET'])
@jwt_required()
def get_profile():
    """Return the current user's profile (name, email/username, role, avatar)."""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            "SELECT id, username, role, first_name, middle_name, last_name, profile_picture_url "
            "FROM users WHERE id = %s;",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return jsonify(message="User not found"), 404

        return jsonify({
            "id": row["id"],
            "email": row["username"],
            "role": row["role"],
            "first_name": row.get("first_name"),
            "middle_name": row.get("middle_name"),
            "last_name": row.get("last_name"),
            "profile_picture_url": row.get("profile_picture_url"),
        }), 200
    finally:
        cur.close()
        conn.close()


@app.route('/me', methods=['PUT', 'PATCH'])
@jwt_required()
def update_profile():
    """Update the current user's profile (names and profile picture). Email/username cannot be changed."""
    user_id, role = get_current_user()
    data = request.get_json() or {}

    allowed_fields = ["first_name", "middle_name", "last_name", "profile_picture_url"]
    updates = []
    values = []
    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = %s")
            values.append(data[field])

    if not updates:
        return jsonify(message="No updatable fields provided"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, username, role, first_name, middle_name, last_name, profile_picture_url;"
        values.append(user_id)
        cur.execute(sql, tuple(values))
        row = cur.fetchone()
        conn.commit()

        if not row:
            return jsonify(message="User not found"), 404

        return jsonify({
            "id": row["id"],
            "email": row["username"],
            "role": row["role"],
            "first_name": row.get("first_name"),
            "middle_name": row.get("middle_name"),
            "last_name": row.get("last_name"),
            "profile_picture_url": row.get("profile_picture_url"),
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message="Failed to update profile", error=str(e)), 500
    finally:
        cur.close()
        conn.close()

@app.route('/admin/run-migrations', methods=['POST'])
@jwt_required()
def run_migrations():
    """
    ONE-TIME MIGRATION ENDPOINT
    Run database migrations to set up all tables and columns.
    Admin access required. Safe to run multiple times (idempotent).
    """
    from auth.auth_utils import get_current_user
    
    try:
        user_id, role = get_current_user()
        if role != 'admin':
            return jsonify(message="Admin access required"), 403
    except Exception as e:
        return jsonify(message="Authentication failed", error=str(e)), 401
    
    conn = None
    cur = None
    
    try:
        conn = psycopg.connect(app.config['DATABASE_URL'])
        conn.autocommit = True
        cur = conn.cursor()
        
        # Read SQL files
        base_schema_path = os.path.join(os.path.dirname(__file__), 'db.sql')
        migrations_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'migrations.sql')
        
        results = []
        
        # Run base schema
        if os.path.exists(base_schema_path):
            with open(base_schema_path, 'r') as f:
                base_schema = f.read()
            cur.execute(base_schema)
            results.append("✅ Base schema (db.sql) applied successfully")
        else:
            results.append("⚠️ Base schema file not found")
        
        # Run migrations
        if os.path.exists(migrations_path):
            with open(migrations_path, 'r') as f:
                migrations = f.read()
            cur.execute(migrations)
            results.append("✅ Migrations (migrations.sql) applied successfully")
        else:
            results.append("⚠️ Migrations file not found")
        
        results.append("✅ All migrations completed successfully!")
        
        return jsonify({
            "message": "Migrations completed",
            "details": results
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        return jsonify({
            "message": "Migration failed",
            "error": str(e),
            "traceback": error_trace
        }), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


if __name__ == '__main__':
    # Initialize database on startup
    init_db()
    
    # Get port from environment (Render sets this) or default to 5000
    port = int(os.environ.get('PORT', 5000))
    
    # Bind to 0.0.0.0 so Render can access it
    app.run(host='0.0.0.0', port=port, debug=False)
