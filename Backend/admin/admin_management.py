from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg
from psycopg.rows import dict_row
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, require_admin
from utils.download_helpers import fetch_plan_bundle, build_plan_zip

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def get_db():
    return psycopg.connect(
        current_app.config['DATABASE_URL'],
        connect_timeout=5,
        options='-c statement_timeout=15000'
    )


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
    cur = conn.cursor(row_factory=dict_row)
    
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
        user_stats = dict(cur.fetchone())
        
        # Plan statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_plans,
                COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_plans,
                COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_plans,
                COALESCE(SUM(sales_count), 0) as total_sales,
                COALESCE(AVG(price), 0) as avg_price
            FROM plans
        """)
        plan_stats = dict(cur.fetchone())
        
        # Revenue statistics
        cur.execute("""
            SELECT 
                COALESCE(COUNT(*), 0) as total_purchases,
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(AVG(amount), 0) as avg_transaction,
                COALESCE(SUM(CASE WHEN purchased_at >= CURRENT_DATE - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as revenue_30d,
                COALESCE(COUNT(CASE WHEN purchased_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END), 0) as purchases_30d
            FROM purchases
            WHERE payment_status = 'completed'
        """)
        revenue_stats = dict(cur.fetchone())
        
        # Activity statistics
        cur.execute("""
            SELECT 
                COALESCE(COUNT(*), 0) as total_activities,
                COALESCE(COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END), 0) as activities_24h,
                COALESCE(COUNT(CASE WHEN activity_type = 'login' THEN 1 END), 0) as logins,
                COALESCE(COUNT(CASE WHEN activity_type = 'purchase' THEN 1 END), 0) as purchases,
                COALESCE(COUNT(CASE WHEN activity_type = 'view' THEN 1 END), 0) as views
            FROM user_activity
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        """)
        activity_stats = dict(cur.fetchone())
        
        # Top designers
        cur.execute("""
            SELECT 
                u.id, u.username, u.email,
                COUNT(p.id) as total_plans,
                COALESCE(SUM(p.sales_count), 0) as total_sales,
                COALESCE(SUM(p.price * p.sales_count), 0) as total_revenue
            FROM users u
            LEFT JOIN plans p ON u.id = p.designer_id
            WHERE u.role = 'designer'
            GROUP BY u.id, u.username, u.email
            ORDER BY total_revenue DESC
            LIMIT 10
        """)
        top_designers = [dict(row) for row in cur.fetchall()]
        
        # Recent activity
        cur.execute("""
            SELECT 
                ua.*, u.username
            FROM user_activity ua
            JOIN users u ON ua.user_id = u.id
            ORDER BY ua.created_at DESC
            LIMIT 20
        """)
        recent_activity = [dict(row) for row in cur.fetchall()]
        
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


@admin_bp.route('/plans/<plan_id>/download', methods=['GET'])
@jwt_required()
@require_admin
def admin_download_plan(plan_id):
    """Allow admins to download full plan technical bundle without tokens."""
    conn = get_db()

    try:
        bundle = fetch_plan_bundle(plan_id, conn)
        if not bundle:
            return jsonify(message="Plan not found"), 404

        if not bundle['files']:
            return jsonify(message="No technical files available for this plan"), 404

        zip_buffer, download_name, files_added = build_plan_zip(bundle)

        if files_added == 0:
            return jsonify(message="Plan files could not be located on the server"), 404

        zip_buffer.seek(0)
        response = send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=download_name
        )
        response.headers['Cache-Control'] = 'no-store'
        return response

    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@admin_bp.route('/purchases', methods=['GET'])
@jwt_required()
@require_admin
def list_purchases():
    payment_status = request.args.get('payment_status')
    payment_method = request.args.get('payment_method')
    plan_id = request.args.get('plan_id')
    user_id = request.args.get('user_id', type=int)
    limit = request.args.get('limit', default=50, type=int)
    offset = request.args.get('offset', default=0, type=int)

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        where_clauses = []
        values = []

        if payment_status:
            where_clauses.append('p.payment_status = %s')
            values.append(payment_status)
        if payment_method:
            where_clauses.append('p.payment_method = %s')
            values.append(payment_method)
        if plan_id:
            where_clauses.append('p.plan_id = %s')
            values.append(plan_id)
        if user_id is not None:
            where_clauses.append('p.user_id = %s')
            values.append(user_id)

        where_sql = ' AND '.join(where_clauses) if where_clauses else 'TRUE'

        cur.execute(f"SELECT COUNT(*) AS count FROM purchases p WHERE {where_sql}", tuple(values))
        total = int((cur.fetchone() or {}).get('count') or 0)

        cur.execute(
            f"""
            SELECT
                p.id,
                p.user_id,
                u.username AS user_email,
                p.plan_id,
                pl.name AS plan_name,
                p.amount,
                p.payment_method,
                p.payment_status,
                p.transaction_id,
                p.purchased_at AS purchased_at,
                p.selected_deliverables,
                p.payment_metadata,
                p.admin_confirmed_at,
                p.admin_confirmed_by,
                dt.total_tokens AS download_tokens_generated,
                dt.used_tokens AS download_tokens_used,
                dt.last_downloaded_at
            FROM purchases p
            JOIN users u ON p.user_id = u.id
            JOIN plans pl ON p.plan_id = pl.id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) AS total_tokens,
                    COUNT(*) FILTER (WHERE used) AS used_tokens,
                    MAX(created_at) FILTER (WHERE used) AS last_downloaded_at
                FROM download_tokens dt
                WHERE dt.user_id = p.user_id AND dt.plan_id = p.plan_id
            ) dt ON TRUE
            WHERE {where_sql}
            ORDER BY p.purchased_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple(values + [limit, offset])
        )
        purchases = []
        for row in cur.fetchall():
            record = dict(row)

            amount = record.get('amount')
            if amount is not None:
                try:
                    record['amount'] = float(amount)
                except Exception:
                    pass

            download_tokens_generated = int(record.get('download_tokens_generated') or 0)
            download_tokens_used = int(record.get('download_tokens_used') or 0)

            last_downloaded_at = record.get('last_downloaded_at')
            if last_downloaded_at is not None and hasattr(last_downloaded_at, 'isoformat'):
                record['last_downloaded_at'] = last_downloaded_at.isoformat()

            if download_tokens_used > 0:
                download_status = 'downloaded'
            elif download_tokens_generated > 0:
                download_status = 'pending_download'
            else:
                download_status = 'not_generated'

            record['download_status'] = download_status
            record['download_tokens_generated'] = download_tokens_generated
            record['download_tokens_used'] = download_tokens_used

            purchases.append(record)

        return jsonify({
            'metadata': {
                'total': total,
                'limit': limit,
                'offset': offset,
                'returned': len(purchases),
            },
            'purchases': purchases,
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
    cur = conn.cursor(row_factory=dict_row)
    
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
        total_count = cur.fetchone()['count']
        
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
        users = [dict(row) for row in cur.fetchall()]
        
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
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # User info
        cur.execute("""
            SELECT id, username, email, role, created_at, is_active, last_login, phone, profile_image
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user_row = cur.fetchone()
        if not user_row:
            return jsonify(message="User not found"), 404
        
        user = dict(user_row)
        
        # Purchase history
        cur.execute("""
            SELECT p.*, pl.name as plan_name
            FROM purchases p
            JOIN plans pl ON p.plan_id = pl.id
            WHERE p.user_id = %s
            ORDER BY p.purchased_at DESC
            LIMIT 20
        """, (user_id,))
        user['purchases'] = [dict(row) for row in cur.fetchall()]
        
        # Plans (if designer)
        if user['role'] in ['designer', 'admin']:
            cur.execute("""
                SELECT id, name, category, price, status, sales_count, created_at
                FROM plans
                WHERE designer_id = %s
                ORDER BY created_at DESC
            """, (user_id,))
            user['plans'] = [dict(row) for row in cur.fetchall()]
        
        # Recent activity
        cur.execute("""
            SELECT activity_type, details, created_at
            FROM user_activity
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,))
        user['recent_activity'] = [dict(row) for row in cur.fetchall()]
        
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
        
        allowed_fields = ['username', 'email', 'role', 'is_active', 'phone', 'first_name', 'middle_name', 'last_name']
        
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
        current_user_id = int(get_jwt_identity())
        
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
    cur = conn.cursor(row_factory=dict_row)
    
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
        total_count = cur.fetchone()['count']
        
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
        plans = [dict(row) for row in cur.fetchall()]
        
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
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute("""
            WITH plan_stats AS (
                SELECT 
                    designer_id,
                    COUNT(*)::INT AS total_plans,
                    COALESCE(AVG(NULLIF(price, 0)), 0) AS avg_plan_price
                FROM plans
                GROUP BY designer_id
            ),
            purchase_stats AS (
                SELECT 
                    pl.designer_id,
                    COUNT(*) FILTER (WHERE pu.payment_status = 'completed')::INT AS total_sales,
                    COALESCE(SUM(pu.amount) FILTER (WHERE pu.payment_status = 'completed'), 0) AS total_revenue
                FROM purchases pu
                JOIN plans pl ON pu.plan_id = pl.id
                GROUP BY pl.designer_id
            )
            SELECT 
                u.id AS designer_id,
                COALESCE(u.email, u.username) AS designer_email,
                u.first_name,
                u.middle_name,
                u.last_name,
                COALESCE(ps.total_plans, 0) AS total_plans,
                COALESCE(pu_stats.total_sales, 0) AS total_sales,
                COALESCE(pu_stats.total_revenue, 0) AS total_revenue,
                COALESCE(ps.avg_plan_price, 0) AS avg_plan_price,
                u.created_at AS joined_date
            FROM users u
            LEFT JOIN plan_stats ps ON ps.designer_id = u.id
            LEFT JOIN purchase_stats pu_stats ON pu_stats.designer_id = u.id
            WHERE u.role = 'designer'
            ORDER BY COALESCE(pu_stats.total_revenue, 0) DESC, COALESCE(ps.total_plans, 0) DESC, u.created_at DESC
        """)

        designers = []
        total_revenue = 0.0
        for row in cur.fetchall():
            record = dict(row)
            record['total_plans'] = int(record.get('total_plans') or 0)
            record['total_sales'] = int(record.get('total_sales') or 0)
            record['total_revenue'] = float(record.get('total_revenue') or 0)
            record['avg_plan_price'] = float(record.get('avg_plan_price') or 0)
            joined = record.get('joined_date')
            if joined and hasattr(joined, 'isoformat'):
                record['joined_date'] = joined.isoformat()
            total_revenue += record['total_revenue']
            designers.append(record)

        return jsonify({
            "designers": designers,
            "total_designers": len(designers),
            "total_revenue": total_revenue
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
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute("""
            WITH purchase_stats AS (
                SELECT 
                    user_id,
                    COUNT(*) FILTER (WHERE payment_status = 'completed')::INT AS total_purchases,
                    COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0) AS total_spent,
                    MAX(purchased_at) FILTER (WHERE payment_status = 'completed') AS last_purchase_date
                FROM purchases
                GROUP BY user_id
            ),
            favorites_stats AS (
                SELECT 
                    user_id,
                    COUNT(*)::INT AS plans_liked
                FROM favorites
                GROUP BY user_id
            )
            SELECT 
                u.id AS customer_id,
                COALESCE(u.email, u.username) AS customer_email,
                u.first_name,
                u.middle_name,
                u.last_name,
                COALESCE(p.total_purchases, 0) AS total_purchases,
                COALESCE(p.total_spent, 0) AS total_spent,
                COALESCE(f.plans_liked, 0) AS plans_liked,
                u.created_at AS joined_date,
                p.last_purchase_date
            FROM users u
            LEFT JOIN purchase_stats p ON p.user_id = u.id
            LEFT JOIN favorites_stats f ON f.user_id = u.id
            WHERE u.role = 'customer'
            ORDER BY COALESCE(p.total_spent, 0) DESC, u.created_at DESC
        """)

        customers = []
        total_spent = 0.0
        for row in cur.fetchall():
            record = dict(row)
            record['total_purchases'] = int(record.get('total_purchases') or 0)
            record['total_spent'] = float(record.get('total_spent') or 0)
            record['plans_liked'] = int(record.get('plans_liked') or 0)
            joined = record.get('joined_date')
            if joined and hasattr(joined, 'isoformat'):
                record['joined_date'] = joined.isoformat()
            last_purchase = record.get('last_purchase_date')
            if last_purchase and hasattr(last_purchase, 'isoformat'):
                record['last_purchase_date'] = last_purchase.isoformat()
            total_spent += record['total_spent']
            customers.append(record)

        return jsonify({
            "customers": customers,
            "total_customers": len(customers),
            "total_revenue": total_spent
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
                pu.purchased_at as purchased_at,
                pu.payment_status,
                pl.price
            FROM purchases pu
            JOIN users u ON pu.user_id = u.id
            JOIN plans pl ON pu.plan_id = pl.id
            WHERE pu.plan_id = %s
            ORDER BY pu.purchased_at DESC
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
