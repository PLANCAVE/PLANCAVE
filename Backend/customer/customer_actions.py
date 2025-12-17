from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required
import psycopg
from psycopg.rows import dict_row
from datetime import datetime, date, timedelta
from decimal import Decimal
import uuid
import sys
import os
import io
import zipfile
import json
import requests
import hmac
import hashlib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, log_user_activity
from utils.download_helpers import (
    fetch_plan_bundle,
    build_plan_zip,
    fetch_user_contact,
)

customer_bp = Blueprint('customer', __name__, url_prefix='/customer')


def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])


DOWNLOAD_LINK_EXPIRY_MINUTES = int(os.environ.get('DOWNLOAD_LINK_EXPIRY_MINUTES', '30'))
MAX_DOWNLOADS_PER_TOKEN = int(os.environ.get('MAX_DOWNLOADS_PER_TOKEN', '1'))
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY')
PAYSTACK_CALLBACK_URL = os.environ.get('PAYSTACK_CALLBACK_URL')
PAYSTACK_WEBHOOK_SECRET = os.environ.get('PAYSTACK_SECRET_KEY')
PAYSTACK_CURRENCY = os.environ.get('PAYSTACK_CURRENCY', 'USD')


def resolve_plan_file_path(file_path: str) -> str | None:
    """Resolve stored relative file paths to absolute disk locations."""
    if not file_path:
        return None

    if os.path.isabs(file_path) and os.path.exists(file_path):
        return file_path

    normalized = file_path.lstrip('/')
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    candidate_paths = [file_path, normalized, os.path.join('uploads', normalized)]

    for candidate in candidate_paths:
        absolute_candidate = candidate if os.path.isabs(candidate) else os.path.join(project_root, candidate)
        if os.path.exists(absolute_candidate):
            return absolute_candidate

    return None


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _paystack_headers():
    if not PAYSTACK_SECRET_KEY:
        raise RuntimeError("PAYSTACK_SECRET_KEY is not configured")
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def _paystack_signature_for(body: bytes) -> str:
    if not PAYSTACK_WEBHOOK_SECRET:
        return ''
    return hmac.new(
        PAYSTACK_WEBHOOK_SECRET.encode('utf-8'),
        body,
        hashlib.sha512,
    ).hexdigest()


def _complete_paystack_purchase(reference: str, paystack_data: dict, conn, cur):
    """Mark a Paystack purchase as completed after verifying all invariants."""
    cur.execute(
        """
        SELECT p.id, p.user_id, p.plan_id, p.amount, p.payment_status, pl.price, pl.sales_count
        FROM purchases p
        JOIN plans pl ON p.plan_id = pl.id
        WHERE p.transaction_id = %s
        """,
        (reference,)
    )
    purchase = cur.fetchone()
    if not purchase:
        return False, ("Purchase record not found", 404)

    if purchase['payment_status'] == 'completed':
        return True, ("Payment already completed", 200)

    # Validate Paystack metadata matches our pending purchase
    metadata = (paystack_data.get('metadata') or {})
    if str(metadata.get('plan_id')) != str(purchase['plan_id']) or int(metadata.get('user_id')) != int(purchase['user_id']):
        return False, ("Payment metadata mismatch", 400)

    # Validate currency and amount
    currency = paystack_data.get('currency')
    if currency and currency != PAYSTACK_CURRENCY:
        return False, ("Payment currency mismatch", 400)

    expected_amount_major = float(purchase['amount'])
    expected_amount_minor = int(round(expected_amount_major * 100))
    paid_amount_minor = int(paystack_data.get('amount') or 0)
    if paid_amount_minor != expected_amount_minor:
        return False, ("Payment amount mismatch", 400)

    cur.execute(
        """
        UPDATE purchases
        SET payment_status = 'completed'
        WHERE id = %s
        """,
        (purchase['id'],)
    )

    cur.execute(
        """
        UPDATE plans
        SET sales_count = sales_count + 1
        WHERE id = %s
        """,
        (purchase['plan_id'],)
    )

    log_user_activity(
        purchase['user_id'],
        'purchase',
        {
            'plan_id': str(purchase['plan_id']),
            'transaction_id': reference,
            'payment_provider': 'paystack',
            'amount': expected_amount_major,
        },
        conn,
    )

    return True, ("Payment verified and purchase activated", 200)


def _init_paystack_transaction(email: str, amount: float, plan_id: str, user_id: int):
    """
    Initialize a Paystack transaction and return authorization URL + reference.
    Amount should be provided in major units; Paystack expects the smallest currency unit.
    """
    if not PAYSTACK_SECRET_KEY:
        raise RuntimeError("PAYSTACK_SECRET_KEY is not configured")

    # Convert USD to KES if Paystack currency is KES (approx 1 USD = 1 KES for testing)
    if PAYSTACK_CURRENCY == 'KES':
        amount = amount * 1  # Conversion rate
    
    amount_smallest_unit = int(round(float(amount) * 100))
    payload = {
        "email": email,
        "amount": amount_smallest_unit,
        "currency": PAYSTACK_CURRENCY,
        "metadata": {
            "plan_id": plan_id,
            "user_id": user_id,
        }
    }
    if PAYSTACK_CALLBACK_URL:
        payload["callback_url"] = PAYSTACK_CALLBACK_URL

    resp = requests.post(
        "https://api.paystack.co/transaction/initialize",
        headers=_paystack_headers(),
        json=payload,
        timeout=10,
    )
    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or not data.get("status"):
        raise RuntimeError(data.get("message") or "Failed to initialize Paystack transaction")

    auth_data = data.get("data", {})
    return auth_data.get("authorization_url"), auth_data.get("reference")


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
        
        # If Paystack flow, initialize payment and mark purchase pending
        if payment_method == 'paystack':
            contact = fetch_user_contact(user_id, conn)
            payer_email = (contact or {}).get('email') or f"user-{user_id}@example.com"
            try:
                authorization_url, reference = _init_paystack_transaction(
                    payer_email,
                    float(plan['price']),
                    plan_id,
                    user_id,
                )
            except Exception as e:
                conn.rollback()
                return jsonify(message=f"Failed to start Paystack payment: {e}"), 502

            purchase_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO purchases (
                    id, user_id, plan_id, amount, payment_method,
                    payment_status, transaction_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                purchase_id, user_id, plan_id, plan['price'],
                payment_method, 'pending', reference
            ))

            conn.commit()
            return jsonify({
                "message": "Paystack payment initialized",
                "status": "pending",
                "authorization_url": authorization_url,
                "reference": reference,
                "purchase_id": purchase_id
            }), 201

        # Reject non-Paystack payment methods
        return jsonify(message="Only Paystack payments are supported"), 400
    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/payments/paystack/webhook', methods=['POST'])
def paystack_webhook():
    """Paystack webhook handler. Verifies signature and completes purchases."""
    raw_body = request.get_data() or b''
    signature = request.headers.get('x-paystack-signature')
    expected = _paystack_signature_for(raw_body)
    if not expected or not signature or not hmac.compare_digest(signature, expected):
        return jsonify(message="Invalid Paystack signature"), 401

    payload = request.get_json(silent=True) or {}
    event = payload.get('event')
    data = payload.get('data') or {}

    # Only handle successful charges
    if event not in ('charge.success', 'transaction.success'):
        return jsonify(status="ignored"), 200

    reference = data.get('reference')
    if not reference:
        return jsonify(message="Missing reference"), 400

    if data.get('status') != 'success':
        return jsonify(status="ignored"), 200

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        ok, (msg, code) = _complete_paystack_purchase(reference, data, conn, cur)
        if not ok and code != 200:
            conn.rollback()
            return jsonify(message=msg), code
        conn.commit()
        return jsonify(status="ok"), 200
    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/payments/paystack/verify/<string:reference>', methods=['POST', 'GET'])
@jwt_required()
def verify_paystack(reference: str):
    """
    Verify Paystack transaction by reference and mark purchase as completed.
    """
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        # Verify with Paystack
        resp = requests.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers=_paystack_headers(),
            timeout=10,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code != 200 or not data.get("status"):
            return jsonify(message=data.get("message") or "Failed to verify Paystack payment"), 400

        paystack_data = data.get("data") or {}
        if paystack_data.get("status") != "success":
            return jsonify(message="Payment not completed yet"), 202

        # Ensure the authenticated user is allowed to verify this reference
        cur.execute(
            """
            SELECT user_id, plan_id
            FROM purchases
            WHERE transaction_id = %s
            """,
            (reference,)
        )
        owner = cur.fetchone()
        if not owner:
            return jsonify(message="Purchase record not found"), 404
        if int(owner['user_id']) != int(user_id) and role != 'admin':
            return jsonify(message="Not authorized to verify this purchase"), 403

        ok, (msg, code) = _complete_paystack_purchase(reference, paystack_data, conn, cur)
        if not ok and code != 200:
            conn.rollback()
            return jsonify(message=msg), code

        conn.commit()
        return jsonify({
            "message": msg,
            "plan_id": str(owner['plan_id']),
            "transaction_id": reference
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/plans/<string:plan_id>/purchase-status', methods=['GET'])
@jwt_required()
def purchase_status(plan_id: str):
    """Return purchase status for the current user and plan."""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT payment_status, transaction_id
            FROM purchases
            WHERE user_id = %s AND plan_id = %s
            ORDER BY purchased_at DESC
            LIMIT 1
            """,
            (user_id, plan_id)
        )
        row = cur.fetchone()
        if not row:
            return jsonify(status="none")
        return jsonify(status=row['payment_status'], transaction_id=row.get('transaction_id'))
    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/plans/download-link', methods=['POST'])
@jwt_required()
def generate_download_link():
    """Create a one-time download token for purchased plans."""
    user_id, role = get_current_user()
    data = request.get_json() or {}

    plan_id = data.get('plan_id')
    if not plan_id:
        return jsonify(message="plan_id is required"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute("SELECT id, name FROM plans WHERE id = %s", (plan_id,))
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found"), 404

        if role != 'admin':
            cur.execute(
                """
                SELECT id FROM purchases
                WHERE user_id = %s AND plan_id = %s AND payment_status = 'completed'
                """,
                (user_id, plan_id)
            )
            if not cur.fetchone():
                return jsonify(message="Purchase required before downloading"), 403

        # Quota check removed - paying customers get unlimited downloads

        # Invalidate previous unused tokens for the same plan/user
        cur.execute(
            "UPDATE download_tokens SET used = TRUE WHERE user_id = %s AND plan_id = %s AND used = FALSE",
            (user_id, plan_id)
        )

        token = str(uuid.uuid4())
        # Tokens should never expire unless used. Column is NOT NULL, so store a far-future expiry.
        expires_at = datetime(9999, 12, 31)

        cur.execute(
            """
            INSERT INTO download_tokens (user_id, plan_id, token, expires_at, max_downloads)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING token, expires_at
            """,
            # Single-use download only
            (user_id, plan_id, token, expires_at, 1)
        )

        log_user_activity(user_id, 'download_link_requested', {
            'plan_id': plan_id,
            'plan_name': plan['name'],
            'expires_at': expires_at.isoformat() + 'Z'
        }, conn)

        conn.commit()

        return jsonify({
            "download_token": token,
            "expires_at": expires_at.isoformat() + 'Z'
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/plans/download/<string:download_token>', methods=['GET'])
@jwt_required()
def download_plan_files(download_token: str):
    """Download the plan's technical files as a zip using a one-time token."""
    user_id, role = get_current_user()
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute(
            """
            SELECT dt.*, p.name AS plan_name
            FROM download_tokens dt
            JOIN plans p ON dt.plan_id = p.id
            WHERE dt.token = %s
            """,
            (download_token,)
        )
        token_row = cur.fetchone()

        if not token_row:
            return jsonify(message="Invalid or expired download token"), 404

        # Only the purchaser (or admin) can use this token.
        if role != 'admin' and int(token_row['user_id']) != int(user_id):
            return jsonify(message="Download token does not belong to you"), 403

        if token_row['used']:
            return jsonify(message="Download token already used"), 410

        if token_row['download_count'] >= token_row.get('max_downloads', 1):
            cur.execute("UPDATE download_tokens SET used = TRUE WHERE token = %s", (download_token,))
            conn.commit()
            return jsonify(message="Download limit reached for this token"), 410

        plan_id = token_row['plan_id']

        bundle = fetch_plan_bundle(plan_id, conn)
        if not bundle:
            return jsonify(message="Plan not found"), 404

        if not bundle['files']:
            return jsonify(message="No technical files available for this plan"), 404

        customer_info = fetch_user_contact(token_row['user_id'], conn)
        bundle['customer'] = customer_info or {}

        zip_buffer, download_name, files_added = build_plan_zip(bundle, customer=customer_info)

        if files_added == 0:
            return jsonify(message="Plan files could not be located on the server"), 404

        zip_buffer.seek(0)
        download_name = download_name or f"{token_row['plan_name'] or 'plan'}-technical-files.zip"

        new_count = token_row['download_count'] + 1
        token_used = new_count >= token_row.get('max_downloads', 1)

        cur.execute(
            """
            UPDATE download_tokens
            SET download_count = %s, used = %s
            WHERE token = %s
            """,
            (new_count, token_used, download_token)
        )

        cur.execute(
            """
            INSERT INTO plan_analytics (plan_id, date, downloads_count)
            VALUES (%s, CURRENT_DATE, 1)
            ON CONFLICT (plan_id, date)
            DO UPDATE SET downloads_count = plan_analytics.downloads_count + 1
            """,
            (plan_id,)
        )

        increment_user_quota(user_id, 'downloads', 1, conn)
        log_user_activity(user_id, 'plan_download', {
            'plan_id': plan_id,
            'token': download_token,
            'files_downloaded': files_added
        }, conn)

        conn.commit()

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
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/cart', methods=['POST'])
@jwt_required()
def add_to_cart():
    """Add a plan to the authenticated user's cart"""
    user_id, role = get_current_user()
    data = request.get_json() or {}

    plan_id = data.get('plan_id')

    if not plan_id:
        return jsonify(message="plan_id is required"), 400

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        # Ensure plan exists and is available
        cur.execute("SELECT id, name FROM plans WHERE id = %s AND status = 'Available'", (plan_id,))
        plan = cur.fetchone()

        if not plan:
            return jsonify(message="Plan not found or unavailable"), 404

        cur.execute(
            """
            INSERT INTO cart_items (user_id, plan_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, plan_id) DO NOTHING
            RETURNING id
            """,
            (user_id, plan_id)
        )

        # Only log when a new row was created
        inserted = cur.fetchone()
        if inserted:
            log_user_activity(user_id, 'cart_add', {
                'plan_id': plan_id,
                'plan_name': plan['name']
            }, conn)

        conn.commit()

        return jsonify(message="Added to cart"), 201

    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/cart', methods=['GET'])
@jwt_required()
def get_cart_items():
    """Retrieve the authenticated user's cart items"""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute(
            """
            SELECT 
                c.added_at,
                p.*, 
                u.username AS designer_name
            FROM cart_items c
            JOIN plans p ON c.plan_id = p.id
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE c.user_id = %s AND p.status = 'Available'
            ORDER BY c.added_at DESC
            """,
            (user_id,)
        )

        cart = [dict(row) for row in cur.fetchall()]

        return jsonify(cart), 200

    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/cart/<plan_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(plan_id):
    """Remove a plan from the authenticated user's cart"""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            DELETE FROM cart_items
            WHERE user_id = %s AND plan_id = %s
            """,
            (user_id, plan_id)
        )

        if cur.rowcount == 0:
            return jsonify(message="Cart item not found"), 404

        conn.commit()

        return jsonify(message="Removed from cart"), 200

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

    def _serialize_purchase_row(row: dict) -> dict:
        purchase = dict(row)
        purchased_at = purchase.get('purchased_at')
        if purchased_at is not None and hasattr(purchased_at, 'isoformat'):
            purchase['purchased_at'] = purchased_at.isoformat() + 'Z'

        amount = purchase.get('amount')
        try:
            if amount is not None:
                purchase['amount'] = float(amount)
        except Exception:
            pass

        return purchase
    
    try:
        # Count total
        cur.execute("SELECT COUNT(*) AS total FROM purchases WHERE user_id = %s", (user_id,))
        total_row = cur.fetchone() or {}
        total_count = int(total_row.get('total') or 0)
        
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
        
        purchases = [_serialize_purchase_row(row) for row in cur.fetchall()]
        
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
        return jsonify(message="Failed to fetch purchases", error=str(e)), 500
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
