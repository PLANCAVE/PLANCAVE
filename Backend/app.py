import requests

from flask_jwt_extended import create_access_token
from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
import psycopg2
import psycopg2.extras
from flask_cors import CORS
import os
from dotenv import load_dotenv
from config import Config

# Load environment variables
load_dotenv()

# Create Flask app and configure
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes and for the frontend origin
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Initialize extensions
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

def get_db():
    """
    Establishes and returns a new connection to the PostgreSQL database using the configured DATABASE_URL.
    """
    return psycopg2.connect(app.config['DATABASE_URL'])

def extract_role(identity):
    """
    Extracts the user's role from the JWT identity, handling both flat and nested ('sub') payloads.
    Args:
        identity (dict): The JWT identity payload.
    Returns:
        str or None: The user's role, or None if not found.
    """
    if not identity:
        return None
    if isinstance(identity, dict):
        if 'role' in identity:
            return identity['role']
        elif 'sub' in identity and isinstance(identity['sub'], dict):
            return identity['sub'].get('role')
    return None

def get_current_user():
    """
    Retrieves the current user's identity from the JWT token.
    Returns:
        tuple: User ID and role of the currently authenticated user.
    """
    identity = get_jwt_identity()
    # Try both flat and nested
    user_id = identity.get('id') if identity.get('id') else (identity.get('sub', {}).get('id') if identity.get('sub') else None)
    role = extract_role(identity)
    return user_id, role



@app.route('/admin/users', methods=['GET'])
@jwt_required()
def get_users():
    identity = get_jwt_identity()
    role = extract_role(identity)
    if role != 'admin':
        return jsonify(message="Admins only"), 403
    # Fetch users from DB and return as JSON
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username, role FROM users;")
    users = [{"id": row[0], "username": row[1], "role": row[2]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(users)



@app.route('/verify-token', methods=['GET', 'OPTIONS'])
def verify_token_handler():
    if request.method == 'OPTIONS':
        # Handle OPTIONS request for CORS preflight
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    # For GET requests, verify the token
    @jwt_required()
    def get_handler():
        current_user = get_jwt_identity()
        return jsonify(valid=True, user=current_user), 200
    
    return get_handler()

def register_user(data, role):
    """
    Registers a new user with the specified role (customer, designer, or admin).
    Args:
        data (dict): The request data containing 'username' and 'password'.
        role (str): Role to assign to the new user.
    Returns:
        Response: JSON response indicating success or failure of the registration.
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
    Endpoint for registering a new customer.
    Returns:
        Response: JSON response from the registration process.
    """
    data = request.get_json()
    return register_user(data, role='customer')

@app.route('/register/designer', methods=['POST'])
def register_designer():
    """
    Endpoint for registering a new designer.
    Returns:
        Response: JSON response from the registration process.
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
        # Unnest id and role using additional_claims
        additional_claims = {"id": user_id, "role": role}
        token = create_access_token(identity=user_id, additional_claims=additional_claims)
        return jsonify(access_token=token)
    else:
        return jsonify(message="Invalid credentials"), 401
   
   
    
@app.route('/oauth-login', methods=['POST'])
def oauth_login():
    data = request.json
    provider = data.get('provider')
    access_token = data.get('access_token')

    if not provider or not access_token:
        return jsonify({'error': 'Missing provider or access_token'}), 400

    user_info = None

    if provider == 'google':
        # Verify Google token and get user info
        resp = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        if resp.status_code == 200:
            user_info = resp.json()
        else:
            return jsonify({'error': 'Invalid Google access token'}), 401

    elif provider == 'github':
        # Verify GitHub token and get user info
        resp = requests.get(
            'https://api.github.com/user',
            headers={'Authorization': f'token {access_token}'}
        )
        if resp.status_code == 200:
            user_info = resp.json()
        else:
            return jsonify({'error': 'Invalid GitHub access token'}), 401

    else:
        return jsonify({'error': 'Unsupported provider'}), 400

    # Now you have user_info, create your own JWT
    flask_jwt = create_access_token(identity={
    'user_id': user_info.get('sub') or user_info.get('id'),
    'role': 'user'
})
    return jsonify({'access_token': flask_jwt}) 

 
@app.route('/plans', methods=['GET'])
def get_plans():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 12))
    offset = (page - 1) * limit

    # Add filter logic as needed
    filters = []
    params = []

    if 'bedrooms' in request.args:
        filters.append("bedrooms = %s")
        params.append(request.args['bedrooms'])
    if 'area' in request.args:
        filters.append("area >= %s")
        params.append(request.args['area'])
    # Add more filters as needed...

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = f"SELECT * FROM plans {where_clause} ORDER BY id LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    # Map columns as needed
    plans = [
        {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "price": row[3],
            "bedrooms": row[4],
            "area": row[5],
            "image": row[6],
            "floors": row[7],
            "bathrooms": row[8],
        }
        for row in rows
    ]
    cur.close()
    conn.close()

    # For pagination: get total count
    count_query = f"SELECT COUNT(*) FROM plans {where_clause}"
    conn = get_db()
    cur = conn.cursor()
    cur.execute(count_query, params[:-2])  # exclude limit/offset
    total_count = cur.fetchone()[0]
    cur.close()
    conn.close()

    return jsonify({
        "data": plans,
        "totalPages": (total_count + limit - 1) // limit
    })
    
    
    
    
@app.route('/admin/products', methods=['GET'])
@jwt_required()
def get_products():
    identity = get_jwt_identity()
    role = extract_role(identity)
    if role != 'admin':
        return jsonify(message="Admins only"), 403
    # For now, return dummy data
    products = [
        {"id": 1, "name": "Basic Plan", "price": 9.99, "active": True, "subscribers": 120},
        {"id": 2, "name": "Premium Plan", "price": 19.99, "active": True, "subscribers": 85},
        {"id": 3, "name": "Enterprise Plan", "price": 49.99, "active": False, "subscribers": 30}
    ]
    return jsonify(products)

@app.route('/admin/revenue', methods=['GET'])
@jwt_required()
def get_revenue():
    identity = get_jwt_identity()
    role = extract_role(identity)
    if role != 'admin':
        return jsonify(message="Admins only"), 403
    # Return dummy revenue data
    revenue_data = {
        "total": 12500,
        "growth": 15,
        "monthly": [
            {"month": "Jan", "revenue": 800},
            {"month": "Feb", "revenue": 950},
            {"month": "Mar", "revenue": 1100},
            {"month": "Apr", "revenue": 1250},
            {"month": "May", "revenue": 1400},
            {"month": "Jun", "revenue": 1600}
        ]
    }
    return jsonify(revenue_data)

@app.route('/admin/analytics/usage', methods=['GET'])
@jwt_required()
def get_analytics():
    identity = get_jwt_identity()
    role = extract_role(identity)
    if role != 'admin':
        return jsonify(message="Admins only"), 403
    # Return dummy analytics data
    analytics_data = {
        "dailyActive": 250,
        "usage": [
            {"day": "Mon", "visits": 120},
            {"day": "Tue", "visits": 140},
            {"day": "Wed", "visits": 135},
            {"day": "Thu", "visits": 155},
            {"day": "Fri", "visits": 180},
            {"day": "Sat", "visits": 90},
            {"day": "Sun", "visits": 75}
        ],
        "userTypes": [
            {"name": "Customers", "value": 65},
            {"name": "Designers", "value": 25},
            {"name": "Admins", "value": 10}
        ]
    }
    return jsonify(analytics_data)
@app.route('/analytics/track', methods=['POST'])
def track_analytics():
    try:
        event = request.get_json()
        # Log the analytics event (you can store/process as needed)
        print('Analytics event:', event)
        return jsonify(success=True), 200
    except Exception as e:
        print('Analytics tracking error:', e)
        return jsonify(success=False, error='Server error'), 500

@app.route('/admin', methods=['GET'])
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
    app.run(port=5001, debug=True)
