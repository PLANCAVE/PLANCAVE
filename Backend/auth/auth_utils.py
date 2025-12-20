"""
Unified Authentication and Authorization Utilities
Role-based access control for Ramanicave
"""
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, get_jwt
from functools import wraps
import psycopg
from psycopg.rows import dict_row


def get_current_user():
    """
    Get current authenticated user from JWT token
    Returns: (user_id, role)
    """
    # Identity is now a string (user_id)
    user_id = int(get_jwt_identity())
    
    # Role is in additional claims
    claims = get_jwt()
    role = claims.get('role')
    
    return user_id, role


def require_role(*allowed_roles):
    """
    Decorator to require specific roles for endpoint access
    Usage: @require_role('admin', 'designer')
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_id, role = get_current_user()
            
            if role not in allowed_roles:
                return jsonify(
                    message=f"Access denied. Required roles: {', '.join(allowed_roles)}",
                    your_role=role
                ), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(fn):
    """
    Decorator to require admin role
    Usage: @require_admin
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id, role = get_current_user()
        
        if role != 'admin':
            return jsonify(
                message="Access denied. Admin only.",
                your_role=role
            ), 403
        
        return fn(*args, **kwargs)
    return wrapper


def require_designer(fn):
    """
    Decorator to require designer or admin role
    Usage: @require_designer
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id, role = get_current_user()
        
        if role not in ['admin', 'designer']:
            return jsonify(
                message="Access denied. Designer or Admin only.",
                your_role=role
            ), 403
        
        return fn(*args, **kwargs)
    return wrapper


def check_plan_ownership(plan_id, user_id, conn):
    """
    Check if user owns a specific plan
    Returns: True if owner or admin, False otherwise
    """
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT p.designer_id, u.role
            FROM plans p
            JOIN users u ON u.id = %s
            WHERE p.id = %s
        """, (user_id, plan_id))
        
        result = cur.fetchone()
        if not result:
            return False
        
        # Admin can access everything
        if result['role'] == 'admin':
            return True
        
        # Check ownership
        return result['designer_id'] == user_id
        
    finally:
        cur.close()


def get_user_info(user_id, conn):
    """
    Get complete user information
    Returns: dict with user info or None
    """
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT id, username, email, role, created_at,
                   is_active, last_login
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        return dict(result) if result else None
        
    finally:
        cur.close()


def log_user_activity(user_id, activity_type, details, conn):
    """
    Log user activity for analytics
    """
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO user_activity (user_id, activity_type, details)
            VALUES (%s, %s, %s)
        """, (user_id, activity_type, details))
        
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        print(f"Error logging activity: {e}")
    finally:
        cur.close()


def check_user_quota(user_id, quota_type, conn):
    """
    Check if user has remaining quota for an action
    Returns: (has_quota: bool, remaining: int)
    """
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT quota_type, quota_limit, quota_used
            FROM user_quotas
            WHERE user_id = %s AND quota_type = %s
        """, (user_id, quota_type))
        
        result = cur.fetchone()
        
        if not result:
            return True, -1  # No quota limit set
        
        remaining = result['quota_limit'] - result['quota_used']
        has_quota = remaining > 0
        
        return has_quota, remaining
        
    finally:
        cur.close()


def increment_user_quota(user_id, quota_type, amount, conn):
    """
    Increment user quota usage
    """
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO user_quotas (user_id, quota_type, quota_used)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, quota_type)
            DO UPDATE SET quota_used = user_quotas.quota_used + EXCLUDED.quota_used
        """, (user_id, quota_type, amount))
        
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating quota: {e}")
    finally:
        cur.close()
