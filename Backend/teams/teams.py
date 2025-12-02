from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import uuid

teams_bp = Blueprint('teams', __name__, url_prefix='/teams')


def get_current_user():
    identity = get_jwt_identity()
    return identity.get('id'), identity.get('role')


def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])


def check_team_permission(team_id, user_id, required_role=None):
    """
    Check if user has permission to access team
    Returns: (has_permission, user_role)
    """
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT role FROM team_members 
            WHERE team_id = %s AND user_id = %s
        """, (team_id, user_id))
        
        result = cur.fetchone()
        if not result:
            return False, None
        
        user_role = result['role']
        
        if required_role:
            role_hierarchy = {'viewer': 1, 'editor': 2, 'owner': 3}
            has_permission = role_hierarchy.get(user_role, 0) >= role_hierarchy.get(required_role, 0)
            return has_permission, user_role
        
        return True, user_role
        
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/', methods=['POST'])
@jwt_required()
def create_team():
    """
    Create Team
    Create a new team for collaboration.
    ---
    tags:
      - Teams
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
              example: Architecture Firm Ltd
            description:
              type: string
              example: Our main design team
    responses:
      201:
        description: Team created successfully
      400:
        description: Team name required
    """
    user_id, role = get_current_user()
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify(message="Team name is required"), 400
    
    team_id = str(uuid.uuid4())
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Create team
        cur.execute("""
            INSERT INTO teams (id, name, description, owner_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            team_id,
            data['name'],
            data.get('description', ''),
            user_id,
            datetime.utcnow()
        ))
        
        # Add creator as owner
        cur.execute("""
            INSERT INTO team_members (team_id, user_id, role)
            VALUES (%s, %s, %s)
        """, (team_id, user_id, 'owner'))
        
        conn.commit()
        
        return jsonify({
            "message": "Team created successfully",
            "team_id": team_id
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error creating team: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/', methods=['GET'])
@jwt_required()
def get_my_teams():
    """
    Get My Teams
    Get all teams the current user is a member of.
    ---
    tags:
      - Teams
    security:
      - Bearer: []
    responses:
      200:
        description: List of teams
    """
    user_id, _ = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT t.*, tm.role, 
                   (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
                   u.username as owner_name
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN users u ON t.owner_id = u.id
            WHERE tm.user_id = %s
            ORDER BY t.created_at DESC
        """, (user_id,))
        
        teams = [dict(row) for row in cur.fetchall()]
        
        return jsonify(teams), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>', methods=['GET'])
@jwt_required()
def get_team_details(team_id):
    """
    Get team details with members
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id)
    if not has_permission:
        return jsonify(message="Access denied"), 403
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Get team info
        cur.execute("""
            SELECT t.*, u.username as owner_name
            FROM teams t
            LEFT JOIN users u ON t.owner_id = u.id
            WHERE t.id = %s
        """, (team_id,))
        
        team = cur.fetchone()
        if not team:
            return jsonify(message="Team not found"), 404
        
        team_dict = dict(team)
        
        # Get members
        cur.execute("""
            SELECT tm.role, tm.joined_at, u.id, u.username, u.email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = %s
            ORDER BY tm.joined_at
        """, (team_id,))
        
        team_dict['members'] = [dict(row) for row in cur.fetchall()]
        
        return jsonify(team_dict), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/members', methods=['POST'])
@jwt_required()
def add_team_member(team_id):
    """
    Add a member to team (owner/editor only)
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id, required_role='editor')
    if not has_permission:
        return jsonify(message="Access denied. Editor or Owner role required"), 403
    
    data = request.get_json()
    new_member_id = data.get('user_id')
    member_role = data.get('role', 'viewer')
    
    if not new_member_id:
        return jsonify(message="user_id is required"), 400
    
    if member_role not in ['viewer', 'editor', 'owner']:
        return jsonify(message="Invalid role. Must be viewer, editor, or owner"), 400
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO team_members (team_id, user_id, role)
            VALUES (%s, %s, %s)
            ON CONFLICT (team_id, user_id) DO UPDATE 
            SET role = EXCLUDED.role
        """, (team_id, new_member_id, member_role))
        
        conn.commit()
        
        return jsonify(message="Member added successfully"), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error adding member: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_team_member(team_id, member_id):
    """
    Remove a member from team (owner only)
    """
    user_id, _ = get_current_user()
    
    has_permission, user_role = check_team_permission(team_id, user_id, required_role='owner')
    if not has_permission:
        return jsonify(message="Access denied. Owner role required"), 403
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            DELETE FROM team_members 
            WHERE team_id = %s AND user_id = %s
        """, (team_id, member_id))
        
        if cur.rowcount == 0:
            return jsonify(message="Member not found in team"), 404
        
        conn.commit()
        
        return jsonify(message="Member removed successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error removing member: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/collections', methods=['POST'])
@jwt_required()
def create_collection(team_id):
    """
    Create a collection for team
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id, required_role='editor')
    if not has_permission:
        return jsonify(message="Access denied. Editor or Owner role required"), 403
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify(message="Collection name is required"), 400
    
    collection_id = str(uuid.uuid4())
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO team_collections (id, team_id, name, description, created_by)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            collection_id,
            team_id,
            data['name'],
            data.get('description', ''),
            user_id
        ))
        
        conn.commit()
        
        return jsonify({
            "message": "Collection created successfully",
            "collection_id": collection_id
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error creating collection: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/collections', methods=['GET'])
@jwt_required()
def get_team_collections(team_id):
    """
    Get all collections for a team
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id)
    if not has_permission:
        return jsonify(message="Access denied"), 403
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT tc.*, u.username as created_by_name,
                   (SELECT COUNT(*) FROM collection_plans WHERE collection_id = tc.id) as plan_count
            FROM team_collections tc
            LEFT JOIN users u ON tc.created_by = u.id
            WHERE tc.team_id = %s
            ORDER BY tc.created_at DESC
        """, (team_id,))
        
        collections = [dict(row) for row in cur.fetchall()]
        
        return jsonify(collections), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/collections/<collection_id>/plans', methods=['POST'])
@jwt_required()
def add_plan_to_collection(team_id, collection_id):
    """
    Add a plan to a collection
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id, required_role='editor')
    if not has_permission:
        return jsonify(message="Access denied. Editor or Owner role required"), 403
    
    data = request.get_json()
    plan_id = data.get('plan_id')
    
    if not plan_id:
        return jsonify(message="plan_id is required"), 400
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO collection_plans (collection_id, plan_id, added_by)
            VALUES (%s, %s, %s)
            ON CONFLICT (collection_id, plan_id) DO NOTHING
        """, (collection_id, plan_id, user_id))
        
        conn.commit()
        
        return jsonify(message="Plan added to collection"), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error adding plan: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/collections/<collection_id>/plans', methods=['GET'])
@jwt_required()
def get_collection_plans(team_id, collection_id):
    """
    Get all plans in a collection
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id)
    if not has_permission:
        return jsonify(message="Access denied"), 403
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT p.*, cp.added_at, u.username as added_by_name
            FROM collection_plans cp
            JOIN plans p ON cp.plan_id = p.id
            LEFT JOIN users u ON cp.added_by = u.id
            WHERE cp.collection_id = %s
            ORDER BY cp.added_at DESC
        """, (collection_id,))
        
        plans = [dict(row) for row in cur.fetchall()]
        
        return jsonify(plans), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@teams_bp.route('/<team_id>/collections/<collection_id>/plans/<plan_id>', methods=['DELETE'])
@jwt_required()
def remove_plan_from_collection(team_id, collection_id, plan_id):
    """
    Remove a plan from a collection
    """
    user_id, _ = get_current_user()
    
    has_permission, _ = check_team_permission(team_id, user_id, required_role='editor')
    if not has_permission:
        return jsonify(message="Access denied. Editor or Owner role required"), 403
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            DELETE FROM collection_plans 
            WHERE collection_id = %s AND plan_id = %s
        """, (collection_id, plan_id))
        
        if cur.rowcount == 0:
            return jsonify(message="Plan not found in collection"), 404
        
        conn.commit()
        
        return jsonify(message="Plan removed from collection"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error removing plan: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()
