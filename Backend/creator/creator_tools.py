from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, require_designer, check_plan_ownership

creator_tools_bp = Blueprint('creator_tools', __name__, url_prefix='/creator')


def get_db():
    return psycopg2.connect(current_app.config['DATABASE_URL'])


@creator_tools_bp.route('/analytics/overview', methods=['GET'])
@jwt_required()
@require_designer
def get_analytics_overview():
    """
    Creator Analytics Overview
    Get analytics overview for designer's plans including sales, views, and top performers.
    ---
    tags:
      - Creator Tools
    security:
      - Bearer: []
    responses:
      200:
        description: Analytics overview data
      403:
        description: Designer access required
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Total plans
        cur.execute("""
            SELECT COUNT(*) as total_plans,
                   COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_plans,
                   COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_plans,
                   SUM(sales_count) as total_sales,
                   SUM(price * sales_count) as total_revenue
            FROM plans
            WHERE designer_id = %s
        """, (user_id,))
        
        overview = dict(cur.fetchone())
        
        # Recent views (last 30 days)
        cur.execute("""
            SELECT SUM(views_count) as total_views,
                   SUM(downloads_count) as total_downloads,
                   SUM(favorites_count) as total_favorites
            FROM plan_analytics pa
            JOIN plans p ON pa.plan_id = p.id
            WHERE p.designer_id = %s 
            AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
        """, (user_id,))
        
        engagement = cur.fetchone()
        overview.update(dict(engagement))
        
        # Top performing plans
        cur.execute("""
            SELECT p.id, p.name, p.price, p.sales_count,
                   COALESCE(SUM(pa.views_count), 0) as views,
                   COALESCE(SUM(pa.downloads_count), 0) as downloads
            FROM plans p
            LEFT JOIN plan_analytics pa ON p.id = pa.plan_id 
                AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
            WHERE p.designer_id = %s
            GROUP BY p.id, p.name, p.price, p.sales_count
            ORDER BY p.sales_count DESC
            LIMIT 5
        """, (user_id,))
        
        overview['top_plans'] = [dict(row) for row in cur.fetchall()]
        
        return jsonify(overview), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@creator_tools_bp.route('/analytics/plans/<plan_id>', methods=['GET'])
@jwt_required()
def get_plan_analytics(plan_id):
    """
    Get detailed analytics for a specific plan
    """
    user_id, role = get_current_user()
    
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Designers only"), 403
    
    # Get date range from query params
    days = request.args.get('days', default=30, type=int)
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Verify ownership
        cur.execute("""
            SELECT id, name FROM plans 
            WHERE id = %s AND designer_id = %s
        """, (plan_id, user_id))
        
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found or access denied"), 404
        
        # Get analytics by date
        cur.execute("""
            SELECT date, views_count, downloads_count, favorites_count
            FROM plan_analytics
            WHERE plan_id = %s 
            AND date >= CURRENT_DATE - INTERVAL '%s days'
            ORDER BY date DESC
        """, (plan_id, days))
        
        analytics_by_date = [dict(row) for row in cur.fetchall()]
        
        # Get total stats
        cur.execute("""
            SELECT 
                SUM(views_count) as total_views,
                SUM(downloads_count) as total_downloads,
                SUM(favorites_count) as total_favorites
            FROM plan_analytics
            WHERE plan_id = %s 
            AND date >= CURRENT_DATE - INTERVAL '%s days'
        """, (plan_id, days))
        
        totals = dict(cur.fetchone())
        
        # Get geographic data (top viewers by country if tracked)
        cur.execute("""
            SELECT COUNT(*) as view_count,
                   DATE(viewed_at) as date
            FROM plan_views
            WHERE plan_id = %s
            AND viewed_at >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY DATE(viewed_at)
            ORDER BY date DESC
        """, (plan_id, days))
        
        views_timeline = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "plan": dict(plan),
            "totals": totals,
            "analytics_by_date": analytics_by_date,
            "views_timeline": views_timeline
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@creator_tools_bp.route('/analytics/revenue', methods=['GET'])
@jwt_required()
def get_revenue_analytics():
    """
    Get revenue analytics for creator
    """
    user_id, role = get_current_user()
    
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Designers only"), 403
    
    # Get date range
    period = request.args.get('period', default='month', type=str)  # 'week', 'month', 'year'
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        if period == 'week':
            interval = '7 days'
        elif period == 'year':
            interval = '365 days'
        else:
            interval = '30 days'
        
        # Revenue by plan
        cur.execute("""
            SELECT p.id, p.name, p.price, p.sales_count,
                   (p.price * p.sales_count) as total_revenue
            FROM plans p
            WHERE p.designer_id = %s
            ORDER BY total_revenue DESC
        """, (user_id,))
        
        revenue_by_plan = [dict(row) for row in cur.fetchall()]
        
        # Total revenue
        total_revenue = sum(plan['total_revenue'] or 0 for plan in revenue_by_plan)
        
        # Revenue by category
        cur.execute("""
            SELECT category, 
                   SUM(price * sales_count) as category_revenue,
                   COUNT(*) as plan_count
            FROM plans
            WHERE designer_id = %s
            GROUP BY category
            ORDER BY category_revenue DESC
        """, (user_id,))
        
        revenue_by_category = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "total_revenue": total_revenue,
            "period": period,
            "revenue_by_plan": revenue_by_plan,
            "revenue_by_category": revenue_by_category
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@creator_tools_bp.route('/plans', methods=['GET'])
@jwt_required()
def get_my_plans():
    """
    Get all plans created by the designer with filters
    """
    user_id, role = get_current_user()
    
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Designers only"), 403
    
    # Filters
    status = request.args.get('status', type=str)
    category = request.args.get('category', type=str)
    sort_by = request.args.get('sort_by', default='created_at', type=str)
    order = request.args.get('order', default='desc', type=str).upper()
    limit = request.args.get('limit', default=20, type=int)
    offset = request.args.get('offset', default=0, type=int)
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        where_clauses = ["designer_id = %s"]
        values = [user_id]
        
        if status:
            where_clauses.append("status = %s")
            values.append(status)
        
        if category:
            where_clauses.append("category = %s")
            values.append(category)
        
        where_sql = " AND ".join(where_clauses)
        
        # Allowed sort fields
        allowed_sorts = ['created_at', 'price', 'sales_count', 'name']
        sort_by = sort_by if sort_by in allowed_sorts else 'created_at'
        order = 'ASC' if order == 'ASC' else 'DESC'
        
        # Count total
        cur.execute(f"SELECT COUNT(*) FROM plans WHERE {where_sql}", tuple(values))
        total_count = cur.fetchone()[0]
        
        # Get plans
        query = f"""
            SELECT p.*, 
                   COALESCE(SUM(pa.views_count), 0) as total_views,
                   COALESCE(SUM(pa.downloads_count), 0) as total_downloads
            FROM plans p
            LEFT JOIN plan_analytics pa ON p.id = pa.plan_id
            WHERE {where_sql}
            GROUP BY p.id
            ORDER BY {sort_by} {order}
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


@creator_tools_bp.route('/plans/<plan_id>/track-view', methods=['POST'])
def track_plan_view(plan_id):
    """
    Track a plan view (can be called without auth for public tracking)
    """
    data = request.get_json() or {}
    user_id = data.get('user_id')
    ip_address = request.remote_addr
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Record view
        cur.execute("""
            INSERT INTO plan_views (plan_id, user_id, ip_address)
            VALUES (%s, %s, %s)
        """, (plan_id, user_id, ip_address))
        
        # Update daily analytics
        today = datetime.utcnow().date()
        cur.execute("""
            INSERT INTO plan_analytics (plan_id, date, views_count)
            VALUES (%s, %s, 1)
            ON CONFLICT (plan_id, date) 
            DO UPDATE SET views_count = plan_analytics.views_count + 1
        """, (plan_id, today))
        
        conn.commit()
        
        return jsonify(message="View tracked"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@creator_tools_bp.route('/plans/<plan_id>/track-download', methods=['POST'])
@jwt_required()
def track_plan_download(plan_id):
    """
    Track a plan download
    """
    user_id, _ = get_current_user()
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        today = datetime.utcnow().date()
        
        # Update daily analytics
        cur.execute("""
            INSERT INTO plan_analytics (plan_id, date, downloads_count)
            VALUES (%s, %s, 1)
            ON CONFLICT (plan_id, date) 
            DO UPDATE SET downloads_count = plan_analytics.downloads_count + 1
        """, (plan_id, today))
        
        conn.commit()
        
        return jsonify(message="Download tracked"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@creator_tools_bp.route('/plans/<plan_id>/versions', methods=['GET'])
@jwt_required()
def get_plan_versions(plan_id):
    """
    Get all versions of a plan
    """
    user_id, role = get_current_user()
    
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Designers only"), 403
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Verify ownership
        cur.execute("""
            SELECT id FROM plans 
            WHERE id = %s AND designer_id = %s
        """, (plan_id, user_id))
        
        if not cur.fetchone():
            return jsonify(message="Plan not found or access denied"), 404
        
        # Get all versions
        cur.execute("""
            SELECT * FROM plans 
            WHERE (id = %s OR parent_plan_id = %s) AND designer_id = %s
            ORDER BY version DESC
        """, (plan_id, plan_id, user_id))
        
        versions = [dict(row) for row in cur.fetchall()]
        
        return jsonify(versions), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()
