from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, log_user_activity, check_user_quota, increment_user_quota

customer_bp = Blueprint('customer', __name__, url_prefix='/customer')


def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])


@customer_bp.route('/plans/purchase', methods=['POST'])
@jwt_required()
def purchase_plan():
    """
    Purchase Plan
    Purchase a plan by ID.
    ---
    tags:
      - Customer
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - plan_id
          properties:
            plan_id:
              type: string
              example: "550e8400-e29b-41d4-a716-446655440000"
            payment_method:
              type: string
              example: mpesa
              default: mpesa
    responses:
      201:
        description: Purchase successful
      404:
        description: Plan not found
      409:
        description: Already purchased
    """
    user_id, role = get_current_user()
    data = request.get_json()
    
    plan_id = data.get('plan_id')
    payment_method = data.get('payment_method', 'mpesa')
    
    if not plan_id:
        return jsonify(message="plan_id is required"), 400
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Get plan details
        cur.execute("SELECT id, name, price FROM plans WHERE id = %s AND status = 'Available'", (plan_id,))
        plan = cur.fetchone()
        
        if not plan:
            return jsonify(message="Plan not found or not available"), 404
        
        # Check if already purchased
        cur.execute("SELECT id FROM purchases WHERE user_id = %s AND plan_id = %s", (user_id, plan_id))
        if cur.fetchone():
            return jsonify(message="You have already purchased this plan"), 409
        
        # Create purchase record
        purchase_id = str(uuid.uuid4())
        transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
        
        cur.execute("""
            INSERT INTO purchases (
                id, user_id, plan_id, amount, payment_method, 
                payment_status, transaction_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            purchase_id, user_id, plan_id, plan['price'],
            payment_method, 'completed', transaction_id
        ))
        
        # Update plan sales count
        cur.execute("""
            UPDATE plans
            SET sales_count = sales_count + 1
            WHERE id = %s
        """, (plan_id,))
        
        # Log activity
        log_user_activity(user_id, 'purchase', {
            'plan_id': plan_id,
            'plan_name': plan['name'],
            'amount': float(plan['price']),
            'transaction_id': transaction_id
        }, conn)
        
        conn.commit()
        
        return jsonify({
            "message": "Purchase successful",
            "purchase_id": purchase_id,
            "transaction_id": transaction_id,
            "amount": float(plan['price'])
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/purchases', methods=['GET'])
@jwt_required()
def get_my_purchases():
    """
    Get user's purchase history
    """
    user_id, role = get_current_user()
    
    limit = request.args.get('limit', default=20, type=int)
    offset = request.args.get('offset', default=0, type=int)
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Count total
        cur.execute("SELECT COUNT(*) FROM purchases WHERE user_id = %s", (user_id,))
        total_count = cur.fetchone()[0]
        
        # Get purchases
        cur.execute("""
            SELECT 
                p.*, 
                pl.name as plan_name,
                pl.category,
                pl.image_url,
                u.username as designer_name
            FROM purchases p
            JOIN plans pl ON p.plan_id = pl.id
            LEFT JOIN users u ON pl.designer_id = u.id
            WHERE p.user_id = %s
            ORDER BY p.purchased_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, limit, offset))
        
        purchases = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "metadata": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(purchases)
            },
            "purchases": purchases
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    """
    Add a plan to favorites
    """
    user_id, role = get_current_user()
    data = request.get_json()
    
    plan_id = data.get('plan_id')
    
    if not plan_id:
        return jsonify(message="plan_id is required"), 400
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO favorites (user_id, plan_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, plan_id) DO NOTHING
        """, (user_id, plan_id))
        
        # Update analytics
        today = datetime.utcnow().date()
        cur.execute("""
            INSERT INTO plan_analytics (plan_id, date, favorites_count)
            VALUES (%s, %s, 1)
            ON CONFLICT (plan_id, date)
            DO UPDATE SET favorites_count = plan_analytics.favorites_count + 1
        """, (plan_id, today))
        
        conn.commit()
        
        return jsonify(message="Added to favorites"), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/favorites', methods=['GET'])
@jwt_required()
def get_favorites():
    """
    Get user's favorite plans
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT 
                f.added_at,
                p.*,
                u.username as designer_name
            FROM favorites f
            JOIN plans p ON f.plan_id = p.id
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE f.user_id = %s AND p.status = 'Available'
            ORDER BY f.added_at DESC
        """, (user_id,))
        
        favorites = [dict(row) for row in cur.fetchall()]
        
        return jsonify(favorites), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/favorites/<plan_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(plan_id):
    """
    Remove a plan from favorites
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            DELETE FROM favorites
            WHERE user_id = %s AND plan_id = %s
        """, (user_id, plan_id))
        
        if cur.rowcount == 0:
            return jsonify(message="Favorite not found"), 404
        
        conn.commit()
        
        return jsonify(message="Removed from favorites"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/reviews', methods=['POST'])
@jwt_required()
def add_review():
    """
    Add a review for a purchased plan
    """
    user_id, role = get_current_user()
    data = request.get_json()
    
    plan_id = data.get('plan_id')
    rating = data.get('rating')
    review = data.get('review', '')
    
    if not plan_id or not rating:
        return jsonify(message="plan_id and rating are required"), 400
    
    if not (1 <= rating <= 5):
        return jsonify(message="Rating must be between 1 and 5"), 400
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Check if user purchased the plan
        cur.execute("""
            SELECT id FROM purchases 
            WHERE user_id = %s AND plan_id = %s AND payment_status = 'completed'
        """, (user_id, plan_id))
        
        if not cur.fetchone():
            return jsonify(message="You can only review plans you have purchased"), 403
        
        # Add/Update review
        cur.execute("""
            INSERT INTO plan_reviews (plan_id, user_id, rating, review)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (plan_id, user_id)
            DO UPDATE SET rating = EXCLUDED.rating, 
                         review = EXCLUDED.review,
                         updated_at = CURRENT_TIMESTAMP
        """, (plan_id, user_id, rating, review))
        
        conn.commit()
        
        return jsonify(message="Review added successfully"), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def customer_dashboard():
    """
    Customer Dashboard
    Get customer's activity summary including purchases, favorites, and recommendations.
    ---
    tags:
      - Customer
    security:
      - Bearer: []
    responses:
      200:
        description: Customer dashboard data
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Purchase summary
        cur.execute("""
            SELECT 
                COUNT(*) as total_purchases,
                SUM(amount) as total_spent
            FROM purchases
            WHERE user_id = %s AND payment_status = 'completed'
        """, (user_id,))
        purchase_summary = dict(cur.fetchone())
        
        # Favorites count
        cur.execute("""
            SELECT COUNT(*) as favorite_count
            FROM favorites
            WHERE user_id = %s
        """, (user_id,))
        favorites_count = cur.fetchone()['favorite_count']
        
        # Recent purchases
        cur.execute("""
            SELECT 
                p.id, p.purchased_at, p.amount,
                pl.name as plan_name,
                pl.category,
                pl.image_url
            FROM purchases p
            JOIN plans pl ON p.plan_id = pl.id
            WHERE p.user_id = %s AND p.payment_status = 'completed'
            ORDER BY p.purchased_at DESC
            LIMIT 5
        """, (user_id,))
        recent_purchases = [dict(row) for row in cur.fetchall()]
        
        # Recommended plans (based on category)
        cur.execute("""
            SELECT DISTINCT p.*
            FROM plans p
            WHERE p.status = 'Available'
            AND p.category IN (
                SELECT DISTINCT pl.category
                FROM purchases pu
                JOIN plans pl ON pu.plan_id = pl.id
                WHERE pu.user_id = %s
            )
            AND p.id NOT IN (
                SELECT plan_id FROM purchases WHERE user_id = %s
            )
            ORDER BY p.sales_count DESC
            LIMIT 6
        """, (user_id, user_id))
        recommended_plans = [dict(row) for row in cur.fetchall()]
        
        return jsonify({
            "purchase_summary": purchase_summary,
            "favorites_count": favorites_count,
            "recent_purchases": recent_purchases,
            "recommended_plans": recommended_plans
        }), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get user profile
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        cur.execute("""
            SELECT id, username, email, role, created_at, phone, profile_image
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        profile = dict(cur.fetchone())
        
        return jsonify(profile), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update user profile
    """
    user_id, role = get_current_user()
    data = request.get_json()
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        updates = []
        values = []
        
        allowed_fields = ['email', 'phone', 'profile_image']
        
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
        conn.commit()
        
        return jsonify(message="Profile updated successfully"), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()
