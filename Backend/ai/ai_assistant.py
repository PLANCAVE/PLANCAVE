from flask import Blueprint, request, jsonify, current_app
import os
import re
import json
import requests
import psycopg
from psycopg.rows import dict_row

ai_bp = Blueprint('ai', __name__, url_prefix='/ai')


def get_db():
    return psycopg.connect(
        current_app.config['DATABASE_URL'],
        connect_timeout=5,
    )


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default


def _llm_url() -> str:
    return (os.getenv('LLAMA_SERVER_URL') or 'http://127.0.0.1:8080/v1/chat/completions').strip()


def _llm_model() -> str:
    model = (os.getenv('LLAMA_MODEL') or '').strip()
    if model:
        return model
    # llama.cpp server typically exposes the loaded gguf filename as the model id
    return 'llama-2-7b-chat.Q2_K.gguf'


def _call_local_llm(messages: list[dict], temperature: float = 0.4, max_tokens: int = 350) -> str | None:
    """Best-effort call to a local llama.cpp OpenAI-compatible server.

    Returns assistant text or None if the server is unavailable.
    """
    url = _llm_url()
    payload = {
        "model": _llm_model(),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code != 200:
            return None
        data = resp.json() if resp.content else {}
        choices = data.get('choices') or []
        if not choices:
            return None
        msg = (choices[0] or {}).get('message') or {}
        content = msg.get('content')
        if isinstance(content, str) and content.strip():
            return content.strip()
    except Exception:
        return None
    return None


def _safe_float(val):
    try:
        if val is None or val == '':
            return None
        return float(val)
    except Exception:
        return None


def _extract_budget(message: str) -> tuple[float | None, float | None]:
    """Very small heuristic parser for budget mentions in user message."""
    msg = (message or '').lower()

    m = re.search(r"\$\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$?\s*(\d+(?:\.\d+)?)", msg)
    if m:
        return _safe_float(m.group(1)), _safe_float(m.group(2))

    m = re.search(r"under\s*\$\s*(\d+(?:\.\d+)?)", msg)
    if m:
        return None, _safe_float(m.group(1))

    m = re.search(r"below\s*\$\s*(\d+(?:\.\d+)?)", msg)
    if m:
        return None, _safe_float(m.group(1))

    m = re.search(r"\$\s*(\d+(?:\.\d+)?)", msg)
    if m:
        # Single number; treat as max
        return None, _safe_float(m.group(1))

    return None, None


def _extract_bedrooms(message: str) -> int | None:
    msg = (message or '').lower()
    m = re.search(r"(\d+)\s*(?:bed|beds|bedroom|bedrooms)", msg)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def _extract_floors(message: str) -> int | None:
    msg = (message or '').lower()
    m = re.search(r"(\d+)\s*(?:floor|floors|storey|storeys|story|stories)", msg)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def _wants_boq(message: str) -> bool:
    msg = (message or '').lower()
    return 'boq' in msg or 'bill of quantities' in msg


def _plan_has_deliverable(plan_row: dict, key: str) -> bool:
    prices = plan_row.get('deliverable_prices')
    if prices is None:
        return False
    if isinstance(prices, str):
        try:
            prices = json.loads(prices)
        except Exception:
            prices = None
    if not isinstance(prices, dict):
        return False
    return key in prices


def _deliverable_label(key: str) -> str:
    mapping = {
        'architectural': 'Architectural',
        'structural': 'Structural',
        'mep': 'MEP',
        'civil': 'Civil',
        'fire_safety': 'Fire Safety',
        'interior': 'Interior',
        'boq': 'BOQ',
        'renders': '3D Renders',
    }
    return mapping.get(key, key.replace('_', ' ').title())


def _get_plan_public_details(conn, plan_id: str) -> dict | None:
    if not plan_id:
        return None
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT
                p.id, p.name, p.description, p.price, p.category, p.project_type,
                p.area, p.bedrooms, p.bathrooms, p.floors, p.includes_boq,
                p.created_at
            FROM plans p
            WHERE p.id = %s
            LIMIT 1
            """,
            (plan_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get('id') is not None:
            d['id'] = str(d['id'])
        return d
    finally:
        cur.close()


def _search_plans(conn, message: str, limit: int = 8) -> list[dict]:
    """DB-only plan retrieval.

    This is intentionally simple: it uses LIKE matching + numeric filters.
    Later you can upgrade to Postgres FTS or embeddings.
    """
    max_limit = max(1, min(int(limit or 8), 12))

    budget_min, budget_max = _extract_budget(message)
    bedrooms = _extract_bedrooms(message)
    floors = _extract_floors(message)
    wants_boq = _wants_boq(message)

    tokens = [t for t in re.split(r"\s+", (message or '').strip()) if len(t) >= 3]
    tokens = tokens[:6]

    where = ["(p.status IS NULL OR p.status ILIKE 'available' OR p.status ILIKE 'published' OR p.status ILIKE 'active')"]
    params: list = []

    if budget_min is not None:
        where.append("(p.price::float >= %s)")
        params.append(float(budget_min))
    if budget_max is not None:
        where.append("(p.price::float <= %s)")
        params.append(float(budget_max))

    if bedrooms is not None:
        where.append("p.bedrooms = %s")
        params.append(int(bedrooms))

    if floors is not None:
        where.append("p.floors = %s")
        params.append(int(floors))

    if wants_boq:
        where.append("(p.includes_boq = TRUE)")

    if tokens:
        like_parts = []
        for t in tokens:
            like_parts.append("(p.name ILIKE %s OR p.description ILIKE %s OR COALESCE(p.category,'') ILIKE %s OR p.project_type ILIKE %s)")
            q = f"%{t}%"
            params.extend([q, q, q, q])
        where.append("(" + " OR ".join(like_parts) + ")")

    where_sql = " AND ".join(where) if where else "TRUE"

    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            f"""
            SELECT
                p.id, p.name, p.description, p.price, p.category, p.project_type,
                p.package_level, p.area, p.bedrooms, p.bathrooms, p.floors,
                p.includes_boq, p.deliverable_prices,
                COALESCE(p.sales_count, 0) AS sales_count,
                0 AS total_views
            FROM plans p
            WHERE {where_sql}
            ORDER BY COALESCE(p.sales_count, 0) DESC, p.created_at DESC NULLS LAST
            LIMIT %s
            """,
            tuple(params + [max_limit]),
        )
        rows = cur.fetchall() or []
        return [dict(r) for r in rows]
    finally:
        cur.close()


def _fallback_response(message: str, plans: list[dict]) -> dict:
    """Deterministic fallback when LLM server is down."""
    if not plans:
        return {
            "reply": (
                "I couldn't find matching plans with the details provided. "
                "Tell me: budget (e.g. under $500), bedrooms, floors, and whether you need BOQ/MEP/Structural."
            ),
            "suggested_plans": [],
        }

    lines = [
        "Here are a few plans that match what you asked for:",
    ]
    suggested = []
    for p in plans[:5]:
        pid = p.get('id')
        pid_str = str(pid) if pid is not None else None
        suggested.append({
            "id": pid_str,
            "name": p.get('name'),
            "price": p.get('price'),
            "url": f"/plans/{pid_str}" if pid_str else None,
        })
        bits = []
        if p.get('bedrooms') is not None:
            bits.append(f"{p.get('bedrooms')} beds")
        if p.get('floors') is not None:
            bits.append(f"{p.get('floors')} floors")
        if p.get('includes_boq'):
            bits.append("BOQ")
        meta = (" · ".join(bits)) if bits else ""
        lines.append(f"- {p.get('name')} ($ {float(p.get('price') or 0):,.0f}){(' · ' + meta) if meta else ''}")

    lines.append("\nIf you tell me your budget + bedrooms/floors, I can narrow it down to the best 3.")

    return {
        "reply": "\n".join(lines),
        "suggested_plans": suggested,
    }


@ai_bp.route('/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    page = (data.get('page') or '').strip()
    plan_id = (data.get('plan_id') or '').strip()
    history = data.get('messages') or []

    if not message:
        return jsonify(message="message is required"), 400

    limit = _env_int('AI_SUGGESTION_LIMIT', 8)

    conn = get_db()
    try:
        plans = _search_plans(conn, message, limit=limit)

        plan_facts = []
        for p in plans[:8]:
            deliverable_keys = []
            for k in ['architectural', 'structural', 'mep', 'civil', 'fire_safety', 'interior', 'boq', 'renders']:
                if _plan_has_deliverable(p, k) or (k == 'boq' and p.get('includes_boq')):
                    deliverable_keys.append(_deliverable_label(k))

            pid = p.get('id')
            pid_str = str(pid) if pid is not None else None
            plan_facts.append({
                "id": pid_str,
                "name": p.get('name'),
                "price": p.get('price'),
                "url": f"/plans/{pid_str}" if pid_str else None,
            })

        system = (
            "You are Ramanicave's AI assistant. You are friendly, interactive and conversational. "
            "You can chat about house plans, design decisions, and help users choose a plan. "
            "When recommending plans, only reference the provided plan_candidates and focused_plan. Do not invent plan features. "
            "You MUST NOT help users bypass payments, obtain downloads, or access paid files. "
            "Never output file paths, download URLs, or hidden plan contents. "
            "If asked about payment or downloads, tell them to use the normal checkout flow on the website. "
            "Always ask 1-2 clarifying questions if key info is missing (budget, bedrooms, floors, BOQ). "
            "Keep answers short, structured, and helpful."
        )

        focused_plan = _get_plan_public_details(conn, plan_id) if plan_id else None

        context = {
            "page": page,
            "plan_id": plan_id,
            "focused_plan": focused_plan,
            "plan_candidates": plan_facts,
        }

        actions = []
        if focused_plan and focused_plan.get('id'):
            actions.append({
                "type": "open_plan",
                "label": "Open this plan",
                "url": f"/plans/{focused_plan.get('id')}",
            })
        elif plan_facts and plan_facts[0].get('id'):
            actions.append({
                "type": "open_plan",
                "label": "Open top match",
                "url": f"/plans/{plan_facts[0].get('id')}",
            })

        quick_replies = [
            "Budget under $500",
            "2 bedrooms",
            "3 bedrooms",
            "Single storey",
            "Two storey",
            "Must include BOQ",
        ]

        llm_messages: list[dict] = [{"role": "system", "content": system}]
        if isinstance(history, list):
            for m in history[-10:]:
                role = (m or {}).get('role')
                content = (m or {}).get('content')
                if role in ('user', 'assistant') and isinstance(content, str) and content.strip():
                    llm_messages.append({"role": role, "content": content.strip()})

        llm_messages.append({
            "role": "user",
            "content": f"Context JSON: {json.dumps(context, default=str)}\n\nUser message: {message}",
        })

        llm_text = _call_local_llm(llm_messages, max_tokens=120)
        if not llm_text:
            fallback = _fallback_response(message, plans)
            return jsonify({
                "reply": fallback["reply"],
                "suggested_plans": fallback["suggested_plans"],
                "quick_replies": quick_replies,
                "actions": actions,
                "llm_used": False,
            }), 200

        return jsonify({
            "reply": llm_text,
            "suggested_plans": plan_facts,
            "quick_replies": quick_replies,
            "actions": actions,
            "llm_used": True,
        }), 200

    except Exception as e:
        current_app.logger.error(f"AI chat error: {e}")
        return jsonify(message=str(e)), 500
    finally:
        conn.close()
