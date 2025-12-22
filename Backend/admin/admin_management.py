from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg
from psycopg.rows import dict_row
from datetime import datetime, timedelta
import json
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


@admin_bp.route('/custom-plan-requests', methods=['GET'])
@jwt_required()
@require_admin
def admin_list_custom_plan_requests():
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        limit = request.args.get('limit', default=50, type=int)
        limit = max(1, min(limit or 50, 200))
        offset = request.args.get('offset', default=0, type=int)
        offset = max(0, offset or 0)

        cur.execute(
            """
            SELECT
                cpr.id,
                cpr.user_id,
                u.email AS user_email,
                cpr.full_name,
                cpr.contact_email,
                cpr.contact_phone,
                cpr.country,
                cpr.city,
                cpr.bedrooms,
                cpr.floors,
                cpr.budget_min,
                cpr.budget_max,
                cpr.style,
                cpr.land_size,
                cpr.needs_boq,
                cpr.needs_structural,
                cpr.needs_mep,
                cpr.description,
                cpr.status,
                cpr.created_at
            FROM custom_plan_requests cpr
            LEFT JOIN users u ON u.id = cpr.user_id
            ORDER BY cpr.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        )

        rows = [dict(r) for r in (cur.fetchall() or [])]
        for r in rows:
            if r.get('id') is not None:
                r['id'] = str(r['id'])
            if r.get('created_at') is not None:
                r['created_at'] = r['created_at'].isoformat()
        return jsonify({
            'requests': rows,
            'metadata': {
                'limit': limit,
                'offset': offset,
                'returned': len(rows),
            }
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error listing custom plan requests: {e}")
        return jsonify(message='Failed to load requests'), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/purchases/<string:purchase_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_purchase(purchase_id: str):
    """Delete a purchase record (and related download tokens) so the user can repurchase."""
    if not purchase_id:
        return jsonify(message="purchase_id is required"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute("BEGIN")
        cur.execute(
            """
            SELECT id, user_id, plan_id, payment_status
            FROM purchases
            WHERE id = %s
            """,
            (purchase_id,),
        )
        purchase = cur.fetchone()
        if not purchase:
            conn.rollback()
            return jsonify(message="Purchase not found"), 404

        # Defensive cleanup; DB schema also has ON DELETE CASCADE.
        try:
            cur.execute("DELETE FROM download_tokens WHERE purchase_id = %s", (purchase_id,))
        except Exception:
            pass

        cur.execute("DELETE FROM purchases WHERE id = %s", (purchase_id,))
        conn.commit()
        return jsonify(
            message="Purchase deleted",
            purchase_id=str(purchase.get('id')),
            user_id=purchase.get('user_id'),
            plan_id=str(purchase.get('plan_id')) if purchase.get('plan_id') is not None else None,
        ), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


@admin_bp.route('/custom-plan-requests/<request_id>', methods=['GET'])
@jwt_required()
@require_admin
def admin_get_custom_plan_request(request_id):
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT
                cpr.id,
                cpr.user_id,
                u.email AS user_email,
                cpr.full_name,
                cpr.contact_email,
                cpr.contact_phone,
                cpr.country,
                cpr.city,
                cpr.bedrooms,
                cpr.floors,
                cpr.budget_min,
                cpr.budget_max,
                cpr.style,
                cpr.land_size,
                cpr.needs_boq,
                cpr.needs_structural,
                cpr.needs_mep,
                cpr.description,
                cpr.status,
                cpr.created_at
            FROM custom_plan_requests cpr
            LEFT JOIN users u ON u.id = cpr.user_id
            WHERE cpr.id = %s
            """,
            (request_id,),
        )
        row = cur.fetchone()
        if not row:
            return jsonify(message='Request not found'), 404
        r = dict(row)
        if r.get('id') is not None:
            r['id'] = str(r['id'])
        if r.get('created_at') is not None:
            r['created_at'] = r['created_at'].isoformat()
        return jsonify({'request': r}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching custom plan request: {e}")
        return jsonify(message='Failed to load request'), 500
    finally:
        cur.close()
        conn.close()


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

        # Plan engagement metrics (last 30 days)
        cur.execute(
            """
            SELECT
                COALESCE(SUM(pa.views_count), 0) AS total_plan_views_30d,
                COALESCE(SUM(pa.downloads_count), 0) AS total_plan_downloads_30d,
                COALESCE(SUM(pa.favorites_count), 0) AS total_plan_favorites_30d
            FROM plan_analytics pa
            WHERE pa.date >= CURRENT_DATE - INTERVAL '30 days'
            """
        )
        plan_engagement = dict(cur.fetchone() or {})

        cur.execute(
            """
            SELECT
                p.id, p.name, p.project_type, p.category, p.price, p.sales_count,
                COALESCE(SUM(pa.views_count), 0) AS total_views,
                COALESCE(SUM(pa.downloads_count), 0) AS total_downloads
            FROM plans p
            LEFT JOIN plan_analytics pa ON pa.plan_id = p.id
              AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
            WHERE p.status = 'Available'
            GROUP BY p.id
            ORDER BY total_views DESC
            LIMIT 10
            """
        )
        top_viewed_plans = [dict(row) for row in cur.fetchall()]

        cur.execute(
            """
            SELECT
                p.project_type,
                COALESCE(SUM(pa.views_count), 0) AS total_views,
                COALESCE(SUM(pa.downloads_count), 0) AS total_downloads,
                COUNT(DISTINCT p.id) AS plan_count
            FROM plan_analytics pa
            JOIN plans p ON pa.plan_id = p.id
            WHERE pa.date >= CURRENT_DATE - INTERVAL '30 days'
              AND p.status = 'Available'
              AND p.project_type IS NOT NULL
              AND TRIM(p.project_type) <> ''
            GROUP BY p.project_type
            ORDER BY total_views DESC
            LIMIT 10
            """
        )
        top_viewed_types = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "user_stats": user_stats,
            "plan_stats": plan_stats,
            "revenue_stats": revenue_stats,
            "activity_stats": activity_stats,
            "top_designers": top_designers,
            "recent_activity": recent_activity,
            "plan_engagement": plan_engagement,
            "top_viewed_plans": top_viewed_plans,
            "top_viewed_types": top_viewed_types,
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/plans/<plan_id>/files/remove', methods=['POST'])
@jwt_required()
@require_admin
def admin_remove_plan_file(plan_id):
    data = request.get_json() or {}
    file_path = data.get('file_path')
    if not file_path or not isinstance(file_path, str):
        return jsonify(message="file_path is required"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute("SELECT id, image_url, file_paths FROM plans WHERE id = %s", (plan_id,))
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found"), 404

        image_url = plan.get('image_url')
        raw_file_paths = plan.get('file_paths')
        file_paths = {}
        if isinstance(raw_file_paths, dict):
            file_paths = raw_file_paths
        elif isinstance(raw_file_paths, str):
            try:
                parsed = json.loads(raw_file_paths)
                if isinstance(parsed, dict):
                    file_paths = parsed
            except Exception:
                file_paths = {}

        mutated = False

        if image_url == file_path:
            image_url = None
            mutated = True

        for key, val in list(file_paths.items()):
            if isinstance(val, list):
                new_list = [x for x in val if x != file_path]
                if len(new_list) != len(val):
                    file_paths[key] = new_list
                    mutated = True
            elif isinstance(val, str):
                if val == file_path:
                    file_paths[key] = None
                    mutated = True

        cur.execute(
            "DELETE FROM plan_files WHERE plan_id = %s AND file_path = %s",
            (plan_id, file_path),
        )

        if mutated:
            cur.execute(
                """
                UPDATE plans
                SET image_url = %s,
                    file_paths = %s
                WHERE id = %s
                """,
                (image_url, json.dumps(file_paths), plan_id),
            )

        conn.commit()
        return jsonify(
            message="File removed",
            image_url=image_url,
            file_paths=file_paths,
        ), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/plans/<plan_id>', methods=['GET'])
@jwt_required()
@require_admin
def get_admin_plan(plan_id):
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute(
            """
            SELECT p.*,
                   COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name), ''), u.username) as designer_name,
                   u.role as designer_role
            FROM plans p
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE p.id = %s
            """,
            (plan_id,),
        )
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found"), 404

        plan_dict = dict(plan)

        def _json_load_if_str(value):
            if value is None:
                return None
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except Exception:
                    return value
            return value

        for key in (
            'disciplines_included',
            'certifications',
            'special_features',
            'file_paths',
            'deliverable_prices',
            'tags',
        ):
            if key in plan_dict:
                plan_dict[key] = _json_load_if_str(plan_dict.get(key))

        cur.execute("SELECT * FROM plan_files WHERE plan_id = %s", (plan_id,))
        files = [dict(row) for row in cur.fetchall()]

        try:
            raw_file_paths = plan_dict.get('file_paths')
            if isinstance(raw_file_paths, dict):
                file_paths = raw_file_paths
            else:
                file_paths = None

            if file_paths and isinstance(file_paths, dict):
                gallery_paths = file_paths.get('gallery') or []
                image_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                for path in gallery_paths:
                    if not isinstance(path, str):
                        continue
                    _, ext = os.path.splitext(path)
                    if ext.lower() in image_exts:
                        files.append({
                            'plan_id': plan_id,
                            'file_type': ext.lstrip('.').lower(),
                            'file_path': path,
                        })
        except Exception:
            pass

        plan_dict['files'] = files
        return jsonify(plan_dict), 200
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

        select_sql = f"""
            SELECT
                p.id,
                COALESCE(p.payment_metadata->>'order_id', NULL) AS order_id,
                p.user_id,
                u.username AS user_email,
                p.plan_id,
                pl.name AS plan_name,
                pl.deliverable_prices,
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
                WHERE dt.purchase_id = p.id
            ) dt ON TRUE
            WHERE {where_sql}
            ORDER BY p.purchased_at DESC
            LIMIT %s OFFSET %s
        """

        try:
            cur.execute(select_sql, tuple(values + [limit, offset]))
        except Exception as e:
            # Backward-compat: older DBs may not have download_tokens.purchase_id.
            if 'purchase_id' in str(e) and 'does not exist' in str(e):
                select_sql = f"""
                    SELECT
                        p.id,
                        COALESCE(p.payment_metadata->>'order_id', NULL) AS order_id,
                        p.user_id,
                        u.username AS user_email,
                        p.plan_id,
                        pl.name AS plan_name,
                        pl.deliverable_prices,
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
                """
                cur.execute(select_sql, tuple(values + [limit, offset]))
            else:
                raise
        purchases = []
        for row in cur.fetchall():
            record = dict(row)

            # Normalize deliverable_prices + selected_deliverables and compute full/partial purchase.
            deliverable_prices = record.get('deliverable_prices')
            if isinstance(deliverable_prices, str):
                try:
                    deliverable_prices = json.loads(deliverable_prices)
                except Exception:
                    deliverable_prices = None

            priced_keys = set()
            if isinstance(deliverable_prices, dict):
                for k, v in deliverable_prices.items():
                    try:
                        n = 0 if v is None or v == '' else float(v)
                    except Exception:
                        n = 0
                    if isinstance(k, str) and n > 0:
                        priced_keys.add(k)

            raw_sel = record.get('selected_deliverables')
            if isinstance(raw_sel, str):
                try:
                    raw_sel = json.loads(raw_sel)
                except Exception:
                    raw_sel = raw_sel

            selected_list = []
            if raw_sel is None:
                selected_list = None
            elif isinstance(raw_sel, list):
                selected_list = [str(x) for x in raw_sel if isinstance(x, (str, int, float))]
            else:
                selected_list = raw_sel

            full_purchase = False
            if selected_list is None:
                full_purchase = True
            elif selected_list == []:
                full_purchase = True
            elif priced_keys and isinstance(selected_list, list) and priced_keys.issubset(set(selected_list)):
                full_purchase = True

            record['full_purchase'] = bool(full_purchase)
            record['purchase_type'] = 'full' if full_purchase else 'partial'

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
