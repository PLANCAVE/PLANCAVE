from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flasgger import Swagger
import psycopg2
import psycopg2.extras
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
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

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


def get_db():
    """
    Establishes and returns a new connection to the PostgreSQL database.
    """
    return psycopg2.connect(app.config['DATABASE_URL'])


def get_current_user():
    """
    Retrieves the current user's identity from the JWT token.

    Returns:
        tuple: User ID and role of the currently authenticated user.
    """
    identity = get_jwt_identity()
    return identity['id'], identity['role']


def register_user(data, role):
    """
    Registers a new user with the specified role (customer, designer, or admin).

    Args:
        data (dict): The request data containing 'username' and 'password'.
        role (str): Role to assign to the new user.

    Returns:
        Response: JSON response indicating success or failure of the registration process.
    """
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify(message="Username and password are required"), 400

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password, role) VALUES (%s, %s, %s) RETURNING id;",
            (username, hashed_pw, role)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
    except psycopg2.errors.UniqueViolation:
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
    cur.execute("SELECT id, password, role FROM users WHERE username=%s;", (username,))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if not result:
        return jsonify(message="Invalid credentials"), 401

    user_id, hashed_pw, role = result

    if bcrypt.check_password_hash(hashed_pw, password):
        token = create_access_token(identity={"id": user_id, "role": role})
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


if __name__ == '__main__':
    app.run(debug=True)
