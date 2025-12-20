from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
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
from auth.auth_utils import get_current_user, log_user_activity, increment_user_quota
from utils.download_helpers import (
    fetch_plan_bundle,
    build_plan_zip,
    fetch_user_contact,
    build_manifest_pdf_html,
)

customer_bp = Blueprint('customer', __name__, url_prefix='/customer')


def get_db():
    return psycopg.connect(
        current_app.config['DATABASE_URL'],
        connect_timeout=5,
        options='-c statement_timeout=15000'
    )


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
    # Paystack returns many intermediate states; only treat a charge as paid when
    # it is successful AND has a paid timestamp.
    status = (paystack_data.get('status') or '').lower()
    current_app.logger.info(f"Completing purchase {reference}: Paystack status='{status}', paid_at={paystack_data.get('paid_at')}")
    
    if status != 'success':
        return False, (f"Payment not completed yet (status: {status})", 202)

    paid_at = paystack_data.get('paid_at') or paystack_data.get('paidAt')
    if not paid_at:
        return False, ("Payment not completed yet (no paid timestamp)", 202)

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
        current_app.logger.error(f"Purchase record not found for reference: {reference}")
        return False, ("Purchase record not found", 404)

    if purchase['payment_status'] == 'completed':
        current_app.logger.info(f"Purchase {reference} already completed")
        return True, ("Payment already completed", 200)

    # Validate Paystack metadata matches our pending purchase
    metadata = (paystack_data.get('metadata') or {})
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}

    if isinstance(metadata, dict):
        meta_plan_id = metadata.get('plan_id')
        meta_user_id = metadata.get('user_id')
        if meta_plan_id is not None or meta_user_id is not None:
            try:
                if meta_plan_id is not None and str(meta_plan_id) != str(purchase['plan_id']):
                    return False, ("Payment metadata mismatch", 400)
                if meta_user_id is not None and int(meta_user_id) != int(purchase['user_id']):
                    return False, ("Payment metadata mismatch", 400)
            except Exception:
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
        SET payment_status = 'completed',
            purchased_at = COALESCE(purchased_at, NOW())
        WHERE id = %s
        RETURNING payment_status, purchased_at
        """,
        (purchase['id'],)
    )
    updated_row = cur.fetchone()
    if not updated_row or (updated_row.get('payment_status') if isinstance(updated_row, dict) else updated_row[0]) != 'completed':
        current_app.logger.error(f"Purchase {reference} failed to update to completed; row={updated_row}")
        return False, ("Failed to update purchase status", 500)

    try:
        cur.execute(
            """
            UPDATE purchases
            SET payment_metadata = %s
            WHERE id = %s
            """,
            (json.dumps(paystack_data), purchase['id'])
        )
    except Exception:
        pass

    cur.execute(
        """
        UPDATE plans
        SET sales_count = sales_count + 1
        WHERE id = %s
        """,
        (purchase['plan_id'],)
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
    plan_id_str = str(plan_id) if plan_id is not None else None
    user_id_val = int(user_id) if user_id is not None else None

    payload = {
        "email": email,
        "amount": amount_smallest_unit,
        "currency": PAYSTACK_CURRENCY,
        "metadata": {
            "plan_id": plan_id_str,
            "user_id": user_id_val,
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
    selected_deliverables = data.get('selected_deliverables')
    
    if not plan_id:
        return jsonify(message="plan_id is required"), 400
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Get plan details
        cur.execute(
            "SELECT id, name, price, deliverable_prices FROM plans WHERE id = %s AND status = 'Available'",
            (plan_id,)
        )
        plan = cur.fetchone()
        
        if not plan:
            return jsonify(message="Plan not found or not available"), 404
        
        # Check if already purchased
        cur.execute("SELECT id FROM purchases WHERE user_id = %s AND plan_id = %s", (user_id, plan_id))
        if cur.fetchone():
            return jsonify(message="You have already purchased this plan"), 409
        
        # Determine amount (support per-deliverable pricing)
        amount = float(plan['price'])
        normalized_selection = None

        raw_deliverable_prices = plan.get('deliverable_prices')
        deliverable_prices = None
        if raw_deliverable_prices is not None:
            if isinstance(raw_deliverable_prices, str):
                try:
                    deliverable_prices = json.loads(raw_deliverable_prices)
                except Exception:
                    deliverable_prices = None
            elif isinstance(raw_deliverable_prices, dict):
                deliverable_prices = raw_deliverable_prices

        if selected_deliverables is not None and deliverable_prices and isinstance(deliverable_prices, dict):
            if not isinstance(selected_deliverables, list) or not all(isinstance(x, str) for x in selected_deliverables):
                return jsonify(message="selected_deliverables must be a list of strings"), 400

            normalized_selection = []
            total = 0.0
            for key in selected_deliverables:
                if key not in deliverable_prices:
                    continue
                val = deliverable_prices.get(key)
                if val is None or val == '':
                    continue
                try:
                    total += float(val)
                    normalized_selection.append(key)
                except (ValueError, TypeError):
                    continue

            if total <= 0:
                return jsonify(message="Selected deliverables total must be greater than 0"), 400

            amount = total

        # If Paystack flow, initialize payment and mark purchase pending
        if payment_method == 'paystack':
            contact = fetch_user_contact(user_id, conn)
            payer_email = (contact or {}).get('email') or f"user-{user_id}@example.com"
            try:
                authorization_url, reference = _init_paystack_transaction(
                    payer_email,
                    float(amount),
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
                    payment_status, transaction_id, selected_deliverables
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                purchase_id, user_id, plan_id, amount,
                payment_method, 'pending', reference, json.dumps(normalized_selection) if normalized_selection is not None else None
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


@customer_bp.route('/plans/manifest/<string:download_token>', methods=['GET'])
@jwt_required(optional=True)
def download_plan_manifest(download_token: str):
    """Download the plan's manifest as a PDF using a one-time token."""
    identity = get_jwt_identity()
    claims = get_jwt() or {}
    user_id = int(identity) if identity is not None else None
    role = claims.get('role')

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

        if user_id is not None and role != 'admin' and int(token_row['user_id']) != int(user_id):
            return jsonify(message="Download token does not belong to you"), 403

        if token_row['used']:
            return jsonify(message="Download token already used"), 410

        plan_id = token_row['plan_id']
        bundle = fetch_plan_bundle(plan_id, conn)
        if not bundle:
            return jsonify(message="Plan not found"), 404

        customer_info = fetch_user_contact(token_row['user_id'], conn)
        bundle['customer'] = customer_info or {}

        # Build a light organized file list for the manifest
        cur.execute(
            """
            SELECT file_name, file_type, file_path, file_size, uploaded_at
            FROM plan_files
            WHERE plan_id = %s
            ORDER BY uploaded_at ASC
            """,
            (plan_id,)
        )
        organized_files = [dict(row) for row in cur.fetchall()]

        manifest_pdf = build_manifest_pdf_html(bundle, organized_files, customer=customer_info)
        manifest_pdf.seek(0)

        # Consume the token (same one-time rule as ZIP download)
        cur.execute(
            """
            UPDATE download_tokens
            SET download_count = download_count + 1, used = TRUE
            WHERE token = %s
            """,
            (download_token,)
        )
        conn.commit()

        safe_name = (token_row.get('plan_name') or 'plan')
        download_name = f"{safe_name}-manifest.pdf"

        response = send_file(
            manifest_pdf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=download_name,
        )
        response.headers['Cache-Control'] = 'no-store'
        return response

    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
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
            # If Paystack says it's not completed yet, acknowledge the webhook to
            # avoid noisy retries; we'll complete the purchase on a later webhook
            # or user-triggered verification.
            if int(code) == 202:
                conn.rollback()
                return jsonify(status="ignored"), 200
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


@customer_bp.route('/payments/paystack/verify/<string:reference>', methods=['POST'])
@jwt_required()
def verify_paystack(reference: str):
    """
    Verify a Paystack transaction and mark purchase as completed if payment is settled.
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
        
        # Debug logging
        current_app.logger.info(f"Paystack verification for {reference}: status={resp.status_code}, data_keys={list(data.keys()) if data else 'none'}")
        if data.get('data'):
            paystack_data = data['data']
            current_app.logger.info(f"Paystack data: status={paystack_data.get('status')}, paid_at={paystack_data.get('paid_at')}, reference={paystack_data.get('reference')}")
        
        if resp.status_code != 200 or not data.get("status"):
            return jsonify(message=data.get("message") or "Failed to verify Paystack payment"), 400

        paystack_data = data.get("data") or {}
        paystack_reference = paystack_data.get('reference')
        if paystack_reference and str(paystack_reference) != str(reference):
            return jsonify(message="Payment verification reference mismatch"), 400

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
        if user_id is not None and int(owner['user_id']) != int(user_id) and role != 'admin':
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


@customer_bp.route('/admin/payments/paystack/verify/<string:reference>', methods=['POST'])
@jwt_required()
def admin_verify_paystack(reference: str):
    """
    Admin-only endpoint to verify a Paystack transaction and mark purchase as completed.
    """
    user_id, role = get_current_user()
    if role != 'admin':
        return jsonify(message="Admin access required"), 403

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
        
        # Debug logging
        current_app.logger.info(f"Admin Paystack verification for {reference}: status={resp.status_code}, data_keys={list(data.keys()) if data else 'none'}")
        if data.get('data'):
            paystack_data = data['data']
            current_app.logger.info(f"Paystack data: status={paystack_data.get('status')}, paid_at={paystack_data.get('paid_at')}, reference={paystack_data.get('reference')}")
        
        if resp.status_code != 200 or not data.get("status"):
            return jsonify(message=data.get("message") or "Failed to verify Paystack payment"), 400

        paystack_data = data.get("data") or {}
        paystack_reference = paystack_data.get('reference')
        if paystack_reference and str(paystack_reference) != str(reference):
            return jsonify(message="Payment verification reference mismatch"), 400

        # Get purchase details
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

        ok, (msg, code) = _complete_paystack_purchase(reference, paystack_data, conn, cur)
        if not ok and code != 200:
            conn.rollback()
            return jsonify(message=msg), code

        conn.commit()
        return jsonify({
            "message": msg,
            "plan_id": str(owner['plan_id']),
            "transaction_id": reference,
            "user_id": owner['user_id']
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/payments/paystack/retry/<string:purchase_id>', methods=['POST'])
@jwt_required()
def retry_paystack_payment(purchase_id: str):
    """Reinitialize a pending Paystack payment so the buyer can complete checkout."""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        cur.execute(
            """
            SELECT p.id, p.user_id, p.plan_id, p.payment_status, p.payment_method,
                   p.amount, p.transaction_id, p.selected_deliverables, u.email
            FROM purchases p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = %s
            """,
            (purchase_id,)
        )
        purchase = cur.fetchone()

        if not purchase:
            return jsonify(message="Purchase not found"), 404

        if role != 'admin' and int(purchase['user_id']) != int(user_id):
            return jsonify(message="Not authorized to retry this payment"), 403

        if purchase['payment_method'] != 'paystack':
            return jsonify(message="Retry is only available for Paystack purchases"), 400

        if (purchase.get('payment_status') or '').lower() == 'completed':
            return jsonify(message="Payment already completed"), 409

        # Fetch contact email (fallback to stored user email)
        contact = fetch_user_contact(purchase['user_id'], conn) or {}
        payer_email = contact.get('email') or purchase.get('email') or f"user-{purchase['user_id']}@example.com"

        try:
            authorization_url, new_reference = _init_paystack_transaction(
                payer_email,
                float(purchase['amount'] or 0),
                purchase['plan_id'],
                purchase['user_id'],
            )
        except Exception as e:
            conn.rollback()
            return jsonify(message=f"Failed to initialize Paystack transaction: {e}"), 502

        cur.execute(
            """
            UPDATE purchases
            SET transaction_id = %s,
                payment_status = 'pending',
                payment_metadata = NULL
            WHERE id = %s
            RETURNING plan_id
            """,
            (new_reference, purchase_id)
        )
        update_row = cur.fetchone()
        if not update_row:
            conn.rollback()
            return jsonify(message="Failed to update purchase with new Paystack reference"), 500

        conn.commit()
        return jsonify({
            "message": "Paystack payment reinitialized",
            "authorization_url": authorization_url,
            "reference": new_reference,
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify(message=str(e)), 500
    finally:
        cur.close()
        conn.close()


@customer_bp.route('/admin/payments/paystack/confirm/<string:reference>', methods=['POST'])
@jwt_required()
def admin_confirm_paystack(reference: str):
    """
    Admin-only endpoint to verify a Paystack transaction and mark purchase as admin confirmed.
    """
    user_id, role = get_current_user()
    if role != 'admin':
        return jsonify(message="Admin access required"), 403

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
        
        # Debug logging
        current_app.logger.info(f"Admin Paystack confirmation for {reference}: status={resp.status_code}, data_keys={list(data.keys()) if data else 'none'}")
        if data.get('data'):
            paystack_data = data['data']
            current_app.logger.info(f"Paystack data: status={paystack_data.get('status')}, paid_at={paystack_data.get('paid_at')}, reference={paystack_data.get('reference')}")
        
        if resp.status_code != 200 or not data.get("status"):
            return jsonify(message=data.get("message") or "Failed to verify Paystack payment"), 400

        paystack_data = data.get("data") or {}
        paystack_reference = paystack_data.get('reference')
        if paystack_reference and str(paystack_reference) != str(reference):
            return jsonify(message="Payment verification reference mismatch"), 400

        # Get purchase details
        cur.execute(
            """
            SELECT user_id, plan_id, payment_status
            FROM purchases
            WHERE transaction_id = %s
            """,
            (reference,)
        )
        owner = cur.fetchone()
        if not owner:
            return jsonify(message="Purchase record not found"), 404

        # Allow admin to confirm even if already completed (for audit marking)
        ok, (msg, code) = _complete_paystack_purchase(reference, paystack_data, conn, cur)
        if not ok and code != 200:
            conn.rollback()
            return jsonify(message=msg), code

        # Mark as admin confirmed
        cur.execute(
            """
            UPDATE purchases
            SET admin_confirmed_at = NOW(),
                admin_confirmed_by = %s
            WHERE transaction_id = %s
            """,
            (user_id, reference)
        )

        conn.commit()
        return jsonify({
            "message": f"Payment verified and marked as admin confirmed by user {user_id}",
            "plan_id": str(owner['plan_id']),
            "transaction_id": reference,
            "user_id": owner['user_id']
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
    """Return purchase + download status for the current user and plan."""
    user_id, role = get_current_user()

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT id, payment_status, transaction_id, purchased_at
            FROM purchases
            WHERE user_id = %s AND plan_id = %s
            ORDER BY purchased_at DESC
            LIMIT 1
            """,
            (user_id, plan_id)
        )
        purchase = cur.fetchone()
        if not purchase:
            return jsonify(status="none")

        payment_status = purchase.get('payment_status')
        if payment_status != 'completed':
            # pending / failed etc.
            return jsonify(
                status=payment_status,
                transaction_id=purchase.get('transaction_id'),
            )

        # Paid: determine whether the plan has been downloaded (based on used download tokens)
        cur.execute(
            """
            SELECT MAX(created_at) AS last_downloaded_at
            FROM download_tokens
            WHERE user_id = %s AND plan_id = %s AND used = TRUE
            """,
            (user_id, plan_id)
        )
        dl_row = cur.fetchone() or {}
        last_downloaded_at = dl_row.get('last_downloaded_at')
        if last_downloaded_at is not None and hasattr(last_downloaded_at, 'isoformat'):
            last_downloaded_at = last_downloaded_at.isoformat() + 'Z'

        download_status = 'downloaded' if dl_row.get('last_downloaded_at') else 'pending_download'

        return jsonify(
            status='completed',
            transaction_id=purchase.get('transaction_id'),
            download_status=download_status,
            last_downloaded_at=last_downloaded_at,
        )
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
        cur.execute("SELECT id, name, designer_id FROM plans WHERE id = %s", (plan_id,))
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found"), 404

        is_plan_owner = False
        try:
            is_plan_owner = plan.get('designer_id') is not None and int(plan.get('designer_id')) == int(user_id)
        except Exception:
            is_plan_owner = False

        if role != 'admin' and not is_plan_owner:
            cur.execute(
                """
                SELECT id, purchased_at
                FROM purchases
                WHERE user_id = %s AND plan_id = %s AND payment_status = 'completed'
                ORDER BY purchased_at DESC NULLS LAST
                LIMIT 1
                """,
                (user_id, plan_id)
            )
            purchase = cur.fetchone()
            if not purchase:
                # Helpful diagnostics: distinguish between "no purchase record" and
                # "purchase exists but not completed".
                cur.execute(
                    """
                    SELECT id, payment_status, payment_method, transaction_id, purchased_at
                    FROM purchases
                    WHERE user_id = %s AND plan_id = %s
                    ORDER BY purchased_at DESC NULLS LAST
                    LIMIT 1
                    """,
                    (user_id, plan_id)
                )
                latest_purchase = cur.fetchone()
                if latest_purchase:
                    return jsonify(
                        message="Purchase not completed yet",
                        payment_status=latest_purchase.get('payment_status'),
                        transaction_id=latest_purchase.get('transaction_id'),
                        purchased_at=(
                            latest_purchase.get('purchased_at').isoformat() + 'Z'
                            if latest_purchase.get('purchased_at') is not None and hasattr(latest_purchase.get('purchased_at'), 'isoformat')
                            else latest_purchase.get('purchased_at')
                        ),
                    ), 409
                if not purchase:
                    return jsonify(message="Purchase required before downloading"), 403

            # Enforce a strict one-time download per paid purchase.
            # If the user has already used a token for this plan, do not allow issuing another.
            cur.execute(
                """
                SELECT 1
                FROM download_tokens
                WHERE user_id = %s AND plan_id = %s AND used = TRUE
                LIMIT 1
                """,
                (user_id, plan_id)
            )
            if cur.fetchone():
                return jsonify(message="This plan has already been downloaded"), 409

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
@jwt_required(optional=True)
def download_plan_files(download_token: str):
    """Download the plan's technical files as a zip using a one-time token."""
    identity = get_jwt_identity()
    claims = get_jwt() or {}
    user_id = int(identity) if identity is not None else None
    role = claims.get('role')
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

        # If the caller is authenticated, enforce token ownership (or admin).
        # If the caller is unauthenticated, possession of the token is the secret.
        if user_id is not None and role != 'admin' and int(token_row['user_id']) != int(user_id):
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

        selected_deliverables = None
        if role != 'admin':
            cur.execute(
                """
                SELECT selected_deliverables
                FROM purchases
                WHERE user_id = %s AND plan_id = %s AND payment_status = 'completed'
                ORDER BY purchased_at DESC
                LIMIT 1
                """,
                (int(token_row['user_id']), plan_id)
            )
            purchase_row = cur.fetchone() or {}
            selected_deliverables = purchase_row.get('selected_deliverables')

        customer_info = fetch_user_contact(token_row['user_id'], conn)
        bundle['customer'] = customer_info or {}

        zip_buffer, download_name, files_added = build_plan_zip(
            bundle,
            customer=customer_info,
            selected_deliverables=selected_deliverables,
        )

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

        # Attribute download tracking to the token owner.
        # This keeps downloads tied to the paid purchase even if the caller is not authenticated
        # (e.g., using a copied download link in a fresh browser).
        token_owner_id = int(token_row['user_id'])
        increment_user_quota(token_owner_id, 'downloads', 1, conn)
        conn.commit()

        zip_buffer.seek(0)
        return send_file(
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
        cur.execute(
            """
            SELECT id, name
            FROM plans
            WHERE id = %s
              AND (status IS NULL OR LOWER(status) = 'available')
            """,
            (plan_id,)
        )
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
            WHERE c.user_id = %s
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
                p.id, p.user_id, p.plan_id, p.amount, p.payment_method, p.payment_status,
                p.transaction_id, p.purchased_at, p.selected_deliverables,
                p.admin_confirmed_at, p.admin_confirmed_by,
                pl.name as plan_name, pl.category, pl.image_url,
                u.username, u.email as user_email
            FROM purchases p
            JOIN plans pl ON p.plan_id = pl.id
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = %s
            ORDER BY p.purchased_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, limit, offset))
        
        raw_purchases = [dict(row) for row in cur.fetchall()]
        purchases = []
        for row in raw_purchases:
            purchase = _serialize_purchase_row(row)
            plan_id = purchase.get('plan_id')
            payment_status = purchase.get('payment_status')

            download_status = None
            last_downloaded_at = None
            if payment_status == 'completed' and plan_id:
                cur.execute(
                    """
                    SELECT MAX(created_at) AS last_downloaded_at
                    FROM download_tokens
                    WHERE user_id = %s AND plan_id = %s AND used = TRUE
                    """,
                    (user_id, plan_id)
                )
                dl_row = cur.fetchone() or {}
                ts = dl_row.get('last_downloaded_at')
                if ts is not None and hasattr(ts, 'isoformat'):
                    last_downloaded_at = ts.isoformat() + 'Z'
                download_status = 'downloaded' if ts else 'pending_download'

            purchase['download_status'] = download_status
            purchase['last_downloaded_at'] = last_downloaded_at
            purchases.append(purchase)
        
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
