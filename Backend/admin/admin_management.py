from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import psycopg
from psycopg.rows import dict_row
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, require_admin

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])


@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@require_admin
def admin_dashboard():
    """
    Admin Dashboard
    Get comprehensive platform-wide analytics including users, plans, revenue, and activity.
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    responses:
      200:
        description: Platform analytics data
      403:
        description: Admin access required
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # User statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'customer' THEN 1 END) as customers,
                COUNT(CASE WHEN role = 'designer' THEN 1 END) as designers,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30d,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
            FROM users
        """)
        user_stats = cur.fetchone()
        
        # Plan statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_plans,
                COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_plans,
                COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_plans,
                SUM(sales_count) as total_sales,
                AVG(price) as avg_price
            FROM plans
        """)
        plan_stats = cur.fetchone()
        
        # Revenue statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_purchases,
                SUM(amount) as total_revenue,
                AVG(amount) as avg_transaction,
                SUM(CASE WHEN purchased_at >= CURRENT_DATE - INTERVAL '30 days' THEN amount ELSE 0 END) as revenue_30d,
                COUNT(CASE WHEN purchased_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as purchases_30d
            FROM purchases
            WHERE payment_status = 'completed'
        """)
        revenue_stats = cur.fetchone()
        
        # Activity statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_activities,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as activities_24h,
                COUNT(CASE WHEN activity_type = 'login' THEN 1 END) as logins,
                COUNT(CASE WHEN activity_type = 'purchase' THEN 1 END) as purchases,
                COUNT(CASE WHEN activity_type = 'view' THEN 1 END) as views
            FROM user_activity
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        """)
        activity_stats = cur.fetchone()
        
        # Top designers
        cur.execute("""
            SELECT 
                u.id, u.username, u.email,
                COUNT(p.id) as total_plans,
                SUM(p.sales_count) as total_sales,
                SUM(p.price * p.sales_count) as total_revenue
            FROM users u
            LEFT JOIN plans p ON u.id = p.designer_id
            WHERE u.role = 'designer'
            GROUP BY u.id, u.username, u.email
            ORDER BY total_revenue DESC
            LIMIT 10
        """)
        top_designers = cur.fetchall()
        
        # Recent activity
        cur.execute("""
            SELECT 
                ua.*, u.username
            FROM user_activity ua
            JOIN users u ON ua.user_id = u.id
            ORDER BY ua.created_at DESC
            LIMIT 20
        """)
        recent_activity = cur.fetchall()
        
        return jsonify({
            "user_stats": user_stats,
            "plan_stats": plan_stats,
            "revenue_stats": revenue_stats,
            "activity_stats": activity_stats,
            "top_designers": top_designers,
            "recent_activity": recent_activity
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@require_admin
def get_all_users():
    """
    Get all users with filtering and pagination
    """
    role = request.args.get('role')
    is_active = request.args.get('is_active')
    search = request.args.get('search')
    limit = request.args.get('limit', default=50, type=int)
    offset = request.args.get('offset', default=0, type=int)
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        where_clauses = []
        values = []
        
        if role:
            where_clauses.append("role = %s")
            values.append(role)
        
        if is_active is not None:
            where_clauses.append("is_active = %s")
            values.append(is_active.lower() == 'true')
        
        if search:
            where_clauses.append("(username ILIKE %s OR email ILIKE %s)")
            values.extend([f"%{search}%", f"%{search}%"])
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"
        
        # Count total
        cur.execute(f"SELECT COUNT(*) FROM users WHERE {where_sql}", tuple(values))
        total_count = cur.fetchone()[0]
        
        # Get users
        query = f"""
            SELECT id, username, email, role, created_at, is_active, last_login,
                   (SELECT COUNT(*) FROM purchases WHERE user_id = users.id) as purchase_count,
                   (SELECT COUNT(*) FROM plans WHERE designer_id = users.id) as plan_count
            FROM users
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        
        cur.execute(query, tuple(values + [limit, offset]))
        users = cur.fetchall()
        
        return jsonify({
            "metadata": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(users)
            },
            "users": users
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
@require_admin
def get_user_details(user_id):
    """
    Get detailed information about a specific user
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # User info
        cur.execute("""
            SELECT id, username, email, role, created_at, is_active, last_login, phone, profile_image
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        if not user:
            return jsonify(message="User not found"), 404
        
        # Purchase history
        cur.execute("""
            SELECT p.*, pl.name as plan_name
            FROM purchases p
            JOIN plans pl ON p.plan_id = pl.id
            WHERE p.user_id = %s
            ORDER BY p.purchased_at DESC
            LIMIT 20
        """, (user_id,))
        user['purchases'] = cur.fetchall()
        
        # Plans (if designer)
        if user['role'] in ['designer', 'admin']:
            cur.execute("""
                SELECT id, name, category, price, status, sales_count, created_at
                FROM plans
                WHERE designer_id = %s
                ORDER BY created_at DESC
            """, (user_id,))
            user['plans'] = cur.fetchall()
        
        # Recent activity
        cur.execute("""
            SELECT activity_type, details, created_at
            FROM user_activity
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,))
        user['recent_activity'] = cur.fetchall()
        
        return jsonify(user), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@require_admin
def update_user(user_id):
    """
    Update user information
    """
    data = request.get_json()
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        updates = []
        values = []
        
        allowed_fields = ['username', 'email', 'role', 'is_active', 'phone']
        
        for field in allowed_fields:
            if field in data:
                updates.append(f"{field} = %s")
                values.append(data[field])
        
        if not updates:
            return jsonify(message="No valid fields to update"), 400
        
        values.append(user_id)
        
        query = f"""
            UPDATE users
            SET {', '.join(updates)}
            WHERE id = %s
        """
        
        cur.execute(query, tuple(values))
        
        if cur.rowcount == 0:
            return jsonify(message="User not found"), 404
        
        conn.commit()
        
        return jsonify(message="User updated successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_user(user_id):
    """
    Deactivate a user (soft delete) - cannot delete admin users or self
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get current admin's ID
        identity = get_jwt_identity()
        current_user_id = identity['id']
        
        # Prevent self-deletion
        if user_id == current_user_id:
            return jsonify(message="You cannot deactivate your own account"), 403
        
        # Check if target user is admin
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        result = cur.fetchone()
        
        if not result:
            return jsonify(message="User not found"), 404
            
        if result[0] == 'admin':
            return jsonify(message="Admin users can only be managed directly from the database for security"), 403
        
        # Deactivate non-admin user
        cur.execute("""
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s
        """, (user_id,))
        
        conn.commit()
        
        return jsonify(message="User deactivated successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/plans', methods=['GET'])
@jwt_required()
@require_admin
def get_all_plans():
    """
    Get all plans with filtering
    """
    status = request.args.get('status')
    designer_id = request.args.get('designer_id', type=int)
    category = request.args.get('category')
    limit = request.args.get('limit', default=50, type=int)
    offset = request.args.get('offset', default=0, type=int)
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        where_clauses = []
        values = []
        
        if status:
            where_clauses.append("status = %s")
            values.append(status)
        
        if designer_id:
            where_clauses.append("designer_id = %s")
            values.append(designer_id)
        
        if category:
            where_clauses.append("category = %s")
            values.append(category)
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"
        
        # Count total
        cur.execute(f"SELECT COUNT(*) FROM plans WHERE {where_sql}", tuple(values))
        total_count = cur.fetchone()[0]
        
        # Get plans
        query = f"""
            SELECT p.*, u.username as designer_name,
                   (SELECT COUNT(*) FROM purchases WHERE plan_id = p.id) as purchase_count
            FROM plans p
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE {where_sql}
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
        """
        
        cur.execute(query, tuple(values + [limit, offset]))
        plans = cur.fetchall()
        
        return jsonify({
            "metadata": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(plans)
            },
            "plans": plans
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/plans/<plan_id>', methods=['PUT'])
@jwt_required()
@require_admin
def update_plan(plan_id):
    """
    Admin can update any plan
    """
    data = request.get_json()
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        updates = []
        values = []
        
        allowed_fields = ['name', 'description', 'category', 'price', 'status', 'area', 
                         'bedrooms', 'bathrooms', 'floors']
        
        for field in allowed_fields:
            if field in data:
                updates.append(f"{field} = %s")
                values.append(data[field])
        
        if not updates:
            return jsonify(message="No valid fields to update"), 400
        
        values.append(plan_id)
        
        query = f"""
            UPDATE plans
            SET {', '.join(updates)}
            WHERE id = %s
        """
        
        cur.execute(query, tuple(values))
        
        if cur.rowcount == 0:
            return jsonify(message="Plan not found"), 404
        
        conn.commit()
        
        return jsonify(message="Plan updated successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/plans/<plan_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_plan(plan_id):
    """
    Admin can delete any plan
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("DELETE FROM plans WHERE id = %s", (plan_id,))
        
        if cur.rowcount == 0:
            return jsonify(message="Plan not found"), 404
        
        conn.commit()
        
        return jsonify(message="Plan deleted successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/analytics/revenue', methods=['GET'])
@jwt_required()
@require_admin
def get_revenue_analytics():
    """
    Comprehensive revenue analytics for admin
    """
    period = request.args.get('period', default='month')  # day, week, month, year
    
    if period == 'day':
        interval = '24 hours'
        group_by = "DATE_TRUNC('hour', purchased_at)"
    elif period == 'week':
        interval = '7 days'
        group_by = "DATE_TRUNC('day', purchased_at)"
    elif period == 'year':
        interval = '365 days'
        group_by = "DATE_TRUNC('month', purchased_at)"
    else:  # month
        interval = '30 days'
        group_by = "DATE_TRUNC('day', purchased_at)"
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Revenue over time
        cur.execute(f"""
            SELECT 
                {group_by} as period,
                COUNT(*) as transaction_count,
                SUM(amount) as revenue
            FROM purchases
            WHERE payment_status = 'completed'
            AND purchased_at >= NOW() - INTERVAL '{interval}'
            GROUP BY period
            ORDER BY period
        """)
        revenue_timeline = cur.fetchall()
        
        # Revenue by category
        cur.execute("""
            SELECT 
                pl.category,
                COUNT(pu.id) as sales_count,
                SUM(pu.amount) as revenue
            FROM purchases pu
            JOIN plans pl ON pu.plan_id = pl.id
            WHERE pu.payment_status = 'completed'
            GROUP BY pl.category
            ORDER BY revenue DESC
        """)
        revenue_by_category = cur.fetchall()
        
        # Revenue by designer
        cur.execute("""
            SELECT 
                u.id, u.username, u.email,
                COUNT(pu.id) as sales_count,
                SUM(pu.amount) as revenue
            FROM purchases pu
            JOIN plans pl ON pu.plan_id = pl.id
            JOIN users u ON pl.designer_id = u.id
            WHERE pu.payment_status = 'completed'
            GROUP BY u.id, u.username, u.email
            ORDER BY revenue DESC
            LIMIT 10
        """)
        top_earners = cur.fetchall()
        
        return jsonify({
            "revenue_timeline": revenue_timeline,
            "revenue_by_category": revenue_by_category,
            "top_earners": top_earners
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/analytics/platform', methods=['GET'])
@jwt_required()
@require_admin
def get_platform_analytics():
    """
    Overall platform analytics and metrics
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Growth metrics
        cur.execute("""
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as new_users
            FROM users
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date
        """)
        user_growth = [dict(row) for row in cur.fetchall()]
        
        # Engagement metrics
        cur.execute("""
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as activity_count,
                COUNT(DISTINCT user_id) as active_users
            FROM user_activity
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date
        """)
        engagement_timeline = [dict(row) for row in cur.fetchall()]
        
        # Most viewed plans
        cur.execute("""
            SELECT 
                p.id, p.name, p.price, p.category,
                SUM(pa.views_count) as total_views,
                SUM(pa.downloads_count) as total_downloads
            FROM plans p
            LEFT JOIN plan_analytics pa ON p.id = pa.plan_id
            WHERE pa.date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY p.id, p.name, p.price, p.category
            ORDER BY total_views DESC
            LIMIT 10
        """)
        most_viewed = [dict(row) for row in cur.fetchall()]
        
        # Most purchased plans
        cur.execute("""
            SELECT 
                pl.id, pl.name, pl.price, pl.category,
                COUNT(pu.id) as purchase_count,
                SUM(pu.amount) as total_revenue
            FROM plans pl
            LEFT JOIN purchases pu ON pl.id = pu.plan_id
            WHERE pu.payment_status = 'completed'
            GROUP BY pl.id, pl.name, pl.price, pl.category
            ORDER BY purchase_count DESC
            LIMIT 10
        """)
        most_purchased = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "user_growth": user_growth,
            "engagement_timeline": engagement_timeline,
            "most_viewed_plans": most_viewed,
            "most_purchased_plans": most_purchased
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/analytics/designers', methods=['GET'])
@jwt_required()
@require_admin
def get_designer_analytics():
    """Get detailed analytics for all designers including revenue and sales"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get designer revenue and sales stats (simplified - no purchases table yet)
        cur.execute("""
            SELECT 
                u.id as designer_id,
                u.username as designer_email,
                COUNT(pl.id) as total_plans,
                0 as total_sales,
                0 as total_revenue,
                COALESCE(AVG(pl.price), 0) as avg_plan_price,
                u.created_at as joined_date
            FROM users u
            LEFT JOIN plans pl ON u.id = pl.designer_id
            WHERE u.role = 'designer'
            GROUP BY u.id, u.username, u.created_at
            ORDER BY total_plans DESC
        """)
        columns = [desc[0] for desc in cur.description]
        designers = [dict(zip(columns, row)) for row in cur.fetchall()]
        
        return jsonify({
            "designers": designers,
            "total_designers": len(designers),
            "total_revenue": 0
        }), 200
        
    except Exception as e:
        print(f"Designer analytics error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/analytics/customers', methods=['GET'])
@jwt_required()
@require_admin
def get_customer_analytics():
    """Get detailed analytics for all customers including purchase history"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get customer purchase history (simplified - no purchases/likes tables yet)
        cur.execute("""
            SELECT 
                u.id as customer_id,
                u.username as customer_email,
                0 as total_purchases,
                0 as total_spent,
                0 as plans_liked,
                u.created_at as joined_date,
                NULL as last_purchase_date
            FROM users u
            WHERE u.role = 'customer'
            ORDER BY u.created_at DESC
        """)
        columns = [desc[0] for desc in cur.description]
        customers = [dict(zip(columns, row)) for row in cur.fetchall()]
        
        return jsonify({
            "customers": customers,
            "total_customers": len(customers),
            "total_revenue": 0
        }), 200
        
    except Exception as e:
        print(f"Customer analytics error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/analytics/plan-details/<plan_id>', methods=['GET'])
@jwt_required()
@require_admin
def get_plan_details(plan_id):
    """Get detailed analytics for a specific plan including buyers and viewers"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get plan buyers
        cur.execute("""
            SELECT 
                u.id as user_id,
                u.username as email,
                pu.purchase_date,
                pu.payment_status,
                pl.price
            FROM purchases pu
            JOIN users u ON pu.user_id = u.id
            JOIN plans pl ON pu.plan_id = pl.id
            WHERE pu.plan_id = %s
            ORDER BY pu.purchase_date DESC
        """, (plan_id,))
        buyers = [dict(row) for row in cur.fetchall()]
        
        # Get plan likes
        cur.execute("""
            SELECT 
                u.id as user_id,
                u.username as email,
                l.created_at as liked_date
            FROM likes l
            JOIN users u ON l.user_id = u.id
            WHERE l.plan_id = %s
            ORDER BY l.created_at DESC
        """, (plan_id,))
        likes = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "buyers": buyers,
            "likes": likes,
            "total_buyers": len(buyers),
            "total_likes": len(likes),
            "total_revenue": sum(b['price'] for b in buyers if b['payment_status'] == 'completed')
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()
