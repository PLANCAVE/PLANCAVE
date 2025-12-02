from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flasgger import Swagger
import psycopg
from psycopg.rows import dict_row
import os
import sys
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

load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend
# CORS configuration - allows frontend from any origin in production
# In production, set FRONTEND_URL env variable for security
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
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
        "title": "PlanCave Backend API",
        "description": "Interactive documentation for PlanCave backend endpoints (auth, plans, uploads, teams, creator tools, admin, customer).",
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


@app.route('/')
def health_check():
    """Health check endpoint for Render and monitoring"""
    return jsonify({
        "status": "healthy",
        "service": "PlanCave API",
        "version": "1.0.0"
    }), 200


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
    username = data.get('username')
    password = data.get('password')
    first_name = data.get('first_name', '')
    middle_name = data.get('middle_name', '')
    last_name = data.get('last_name', '')

    if not username or not password:
        return jsonify(message="Username and password are required"), 400

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        # First try to add columns if they don't exist
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);")
            conn.commit()
        except:
            conn.rollback()
        
        cur.execute(
            "INSERT INTO users (username, password, role, first_name, middle_name, last_name) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;",
            (username, hashed_pw, role, first_name, middle_name, last_name)
        )
        user_id = cur.fetchone()['id']
        conn.commit()
    except psycopg.OperationalError as e:
        conn.rollback()
        return jsonify(message="Username already exists"), 409
    finally:
        cur.close()
        conn.close()

    return jsonify(message=f"{role.capitalize()} registered", user_id=user_id), 201


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
    cur.execute("SELECT id, password, role, is_active FROM users WHERE username=%s;", (username,))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if not result:
        return jsonify(message="Invalid credentials"), 401

    user_id, hashed_pw, role, is_active = result
    
    # Check if account is active
    if not is_active:
        return jsonify(message="Your account has been deactivated. Please contact admin@plancave.com."), 403

    if bcrypt.check_password_hash(hashed_pw, password):
        token = create_access_token(
            identity=str(user_id),
            additional_claims={"role": role, "email": username}
        )
        return jsonify(access_token=token)
    else:
        return jsonify(message="Invalid credentials"), 401


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
