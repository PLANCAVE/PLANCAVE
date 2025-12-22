from flask import Blueprint, request, jsonify, current_app
import os
import re
import json
import requests
import psycopg
from psycopg.rows import dict_row

try:
    from .site_knowledge import SITE_KNOWLEDGE
except Exception:
    SITE_KNOWLEDGE = {}

ai_bp = Blueprint('ai', __name__, url_prefix='/ai')


def get_db():
    return psycopg.connect(
        current_app.config['DATABASE_URL'],
        connect_timeout=5,
    )


def _is_top_selling_question(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    return any(k in msg for k in [
        'top-selling', 'top selling', 'best selling', 'bestselling', 'most sold', 'most popular'
    ])


def _is_general_chat(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False

    plan_tokens = {'plan', 'plans', 'bedroom', 'bedrooms', 'floor', 'floors', 'boq', 'budget'}
    if any(token in msg for token in plan_tokens):
        return False

    general_keywords = {
        'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'thank you',
        'thanks', 'your name', 'who are you', 'what is your name', 'name', 'how are you',
        'nice to meet you', 'are you there', 'help me', 'can you chat', 'talk to me',
    }
    if any(kw in msg for kw in general_keywords):
        return True

    # Short, non-plan prompts should feel conversational.
    # Exclude common follow-up tokens; these should be handled by the LLM with history.
    followups = {'yes', 'no', 'ok', 'okay', 'sure', 'more', 'continue', 'go on', 'why', 'how', 'what', 'which'}
    if msg in followups:
        return False
    return len(msg) <= 120


def _is_recommendation_intent(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    triggers = [
        'recommend', 'suggest', 'find me', 'show me', 'give me plans', 'plans under', 'under $', 'below $',
        'budget', 'looking for a plan', 'need a plan', 'similar plans', 'alternatives', 'top selling', 'top-selling',
    ]
    return any(t in msg for t in triggers)


def _is_site_help_intent(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    triggers = [
        'help', 'support', 'contact', 'refund', 'returns', 'policy', 'privacy', 'terms', 'license', 'licence',
        'payment', 'paystack', 'mpesa', 'download', 'invoice', 'receipt', 'account', 'login', 'signup', 'register',
    ]
    return any(t in msg for t in triggers)


def _is_design_or_build_advice_intent(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    triggers = [
        'foundation', 'structural', 'beam', 'column', 'slab', 'roof', 'truss', 'reinforcement',
        'materials', 'cement', 'steel', 'concrete', 'brick', 'block', 'sand',
        'cost', 'estimate', 'budgeting', 'boq', 'bill of quantities',
        'climate', 'coastal', 'rain', 'hot', 'humid', 'wind', 'earthquake',
        'mumbai', 'india', 'permit', 'approval', 'regulation', 'code',
    ]
    return any(t in msg for t in triggers)


def _general_chat_reply(message: str) -> str:
    msg = (message or '').strip().lower()
    if 'name' in msg:
        return (
            "I'm Ramani AI — your house-plan assistant. I can chat with you about ideas, answer questions, and help "
            "find or customise plans. Tell me what you're looking for or ask anything you like."
        )
    if any(greet in msg for greet in ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening']):
        return (
            "Hey there! I'm Ramani AI. I can chat normally and also guide you through finding, customising, or "
            "understanding house plans. What would you like to talk about?"
        )
    if 'how are you' in msg:
        return "I'm doing great and ready to help! What would you like to discuss about homes or designs today?"
    return (
        "I'm Ramani AI. Happy to chat! Ask me anything — from general design questions to detailed help with house "
        "plans, budgets, BOQs, or custom projects."
    )


def _top_selling_plans(conn, limit: int = 6) -> list[dict]:
    limit = max(1, min(int(limit or 6), 10))
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT p.id, p.name, p.price
            FROM plans p
            WHERE (p.status IS NULL OR p.status ILIKE 'available' OR p.status ILIKE 'published' OR p.status ILIKE 'active')
            ORDER BY COALESCE(p.sales_count, 0) DESC, p.created_at DESC
            LIMIT %s
            """,
            (limit,)
        )
        return [dict(r) for r in (cur.fetchall() or [])]
    finally:
        cur.close()


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
        "stream": False,
    }
    try:
        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code != 200:
            try:
                current_app.logger.warning(f"LLM non-200: {resp.status_code} body={resp.text[:400]}")
            except Exception:
                pass
            return None
        data = resp.json() if resp.content else {}
        choices = data.get('choices') or []
        if not choices:
            try:
                current_app.logger.warning(f"LLM no choices. keys={list(data.keys())}")
            except Exception:
                pass
            return None
        first = choices[0] or {}

        # OpenAI chat format
        msg = first.get('message') or {}
        content = msg.get('content')
        if isinstance(content, str) and content.strip():
            return content.strip()

        # Some servers use plain completion format
        text = first.get('text')
        if isinstance(text, str) and text.strip():
            return text.strip()

        # Streaming-like delta format (when server misbehaves or proxies)
        delta = first.get('delta') or {}
        dcontent = delta.get('content')
        if isinstance(dcontent, str) and dcontent.strip():
            return dcontent.strip()

        try:
            current_app.logger.warning(f"LLM malformed choice: {json.dumps(first)[:400]}")
        except Exception:
            pass
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
    # Handle common phrases that don't include explicit numbers.
    if 'single storey' in msg or 'single story' in msg or 'one storey' in msg or 'one story' in msg:
        return 1
    if 'two storey' in msg or 'two story' in msg or 'double storey' in msg or 'double story' in msg:
        return 2
    if 'bungalow' in msg:
        return 1
    if 'duplex' in msg:
        return 2
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


def _is_greeting(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    # Keep it conservative; avoid classifying normal queries as greetings.
    return msg in {
        'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
        'hi there', 'hello there', 'hey there',
    }


def _is_bedroom_comparison_question(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False
    patterns = [
        r"choose between\s*2\s*bed", 
        r"choose between\s*2\s*bedrooms?",
        r"2\s*bedrooms?\s*vs\s*3\s*bedrooms?",
        r"2\s*bed\s*vs\s*3\s*bed",
        r"2\s*bedrooms?\s*or\s*3\s*bedrooms?",
    ]
    return any(re.search(p, msg) for p in patterns)


def _bedroom_comparison_reply() -> str:
    return (
        "Choosing between 2 vs 3 bedrooms depends mostly on household size and how you plan to use the space:\n\n"
        "2 bedrooms is best if:\n"
        "- You have 1–3 people, or want a compact home\n"
        "- You want lower build cost and easier maintenance\n"
        "- You can use the living room as flex space\n\n"
        "3 bedrooms is best if:\n"
        "- You have 3–6 people (family home)\n"
        "- You want a guest room / home office\n"
        "- You want better resale value in many markets\n\n"
        "Tell me your budget and whether you prefer single storey or two storey, and I’ll recommend the best options."
    )


def _is_stopword_token(t: str) -> bool:
    # Keep this small and practical: tokens that frequently appear in chat prompts
    # but do not help match plan names/descriptions.
    return t in {
        'must', 'include', 'including', 'with', 'without', 'need', 'needs', 'want', 'wants',
        'budget', 'under', 'below', 'less', 'than', 'max', 'minimum', 'maximum', 'price', 'cost',
        'single', 'double', 'storey', 'storeys', 'story', 'stories', 'floor', 'floors', 'one', 'two',
        'show', 'me', 'any', 'some', 'plans', 'plan', 'please', 'only', 'also', 'the', 'a',
        'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'this', 'that', 'it', 'is',
        'boq',
    }


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


def _is_focused_plan_question(message: str) -> bool:
    msg = (message or '').strip().lower()
    if not msg:
        return False

    keywords = [
        'tell me more', 'explain', 'summarize', 'summary', 'what is included', 'what\'s included',
        'included', 'deliverables', 'files', 'boq', 'bill of quantities', 'suitable', 'suitability',
        'risk', 'risks', 'price', 'cost', 'estimate', 'materials', 'material', 'construction',
        'permit', 'approval', 'regulation', 'code', 'local authority', 'location', 'city', 'country',
        'mumbai', 'india',
        'area', 'plot', 'plot size', 'bedrooms', 'bathrooms', 'floors',
        'license', 'licence', 'customize', 'customisation', 'customization', 'timeline', 'support',
    ]
    return any(k in msg for k in keywords)


def _focused_plan_fallback_reply(focused_plan: dict) -> str:
    name = focused_plan.get('name') or 'This plan'
    price = focused_plan.get('price')
    bedrooms = focused_plan.get('bedrooms')
    bathrooms = focused_plan.get('bathrooms')
    floors = focused_plan.get('floors')
    area = focused_plan.get('area')
    includes_boq = focused_plan.get('includes_boq')
    desc = (focused_plan.get('description') or '').strip()

    bits = []
    if bedrooms is not None:
        bits.append(f"Bedrooms: {bedrooms}")
    if bathrooms is not None:
        bits.append(f"Bathrooms: {bathrooms}")
    if floors is not None:
        bits.append(f"Floors: {floors}")
    if area is not None:
        bits.append(f"Area: {area}")
    if price is not None:
        try:
            bits.append(f"Price: $ {float(price):,.0f}")
        except Exception:
            bits.append(f"Price: {price}")

    boq_text = "Yes" if includes_boq else "No"
    lines = [
        f"{name}",
        "", 
        "Key details:",
        *(f"- {b}" for b in bits),
        f"- BOQ included: {boq_text}",
    ]
    if desc:
        lines.extend(["", "Description:", desc])

    return "\n".join(lines).strip()


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

    raw_tokens = [t for t in re.split(r"\s+", (message or '').strip()) if len(t) >= 3]
    tokens = []
    for t in raw_tokens:
        tl = t.strip().lower()
        tl = re.sub(r"[^a-z0-9_]+", "", tl)
        if not tl or len(tl) < 3:
            continue
        # Avoid accidentally filtering with numbers like 500, 1000, etc.
        if tl.isdigit():
            continue
        if _is_stopword_token(tl):
            continue
        tokens.append(tl)
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
        results = [dict(r) for r in rows]
        if results:
            return results

        # Fallback: if the user asked for BOQ, do not let noisy tokens eliminate results.
        # Retry with BOQ filter + without text tokens.
        if wants_boq and tokens:
            cur.execute(
                """
                SELECT
                    p.id, p.name, p.description, p.price, p.category, p.project_type,
                    p.package_level, p.area, p.bedrooms, p.bathrooms, p.floors,
                    p.includes_boq, p.deliverable_prices,
                    COALESCE(p.sales_count, 0) AS sales_count,
                    0 AS total_views
                FROM plans p
                WHERE (p.status IS NULL OR p.status ILIKE 'available' OR p.status ILIKE 'published' OR p.status ILIKE 'active')
                  AND (p.includes_boq = TRUE)
                ORDER BY COALESCE(p.sales_count, 0) DESC, p.created_at DESC NULLS LAST
                LIMIT %s
                """,
                (max_limit,),
            )
            rows2 = cur.fetchall() or []
            return [dict(r) for r in rows2]

        return []
    finally:
        cur.close()


def _fallback_response(message: str, plans: list[dict]) -> dict:
    """Deterministic fallback when LLM server is down."""
    if not plans:
        return {
            "reply": (
                "I can help. Tell me your budget, bedrooms, floors (single/two storey), and whether BOQ is required. "
                "You can also tap a Quick pick below."
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

    lines.append("\nTell me more about what you need (budget, bedrooms, floors, BOQ) and I’ll refine the list.")

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

    if _is_greeting(message) and not plan_id:
        quick_replies = [
            "Recommend 3 plans under $500 with BOQ",
            "I want a modern 3 bedroom house plan",
            "Single storey (1 floor)",
            "Two storey (2 floors)",
        ]
        return jsonify({
            "reply": "Hi! Tell me what you want to build (budget, bedrooms, floors, and BOQ) and I’ll recommend plans that fit.",
            "suggested_plans": [],
            "quick_replies": quick_replies,
            "actions": [],
            "llm_used": False,
        }), 200

    # Avoid hard-coded intent branching for comparisons; prefer LLM.

    limit = _env_int('AI_SUGGESTION_LIMIT', 8)

    conn = get_db()
    try:
        # General AI edge-cases: only search plans if user is asking for recommendations.
        # For general advice/help questions, searching plans often creates irrelevant outputs.
        is_recommendation = (not plan_id) and _is_recommendation_intent(message)
        plans = _search_plans(conn, message, limit=limit) if is_recommendation else []

        plan_facts = []
        if is_recommendation:
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
            "You are Ramanicave's AI assistant (Ramani AI). You are friendly, interactive and conversational. "
            "You can chat about house plans, design decisions, and help users choose a plan. "
            "When recommending plans, only reference the provided plan_candidates and focused_plan. Do not invent plan features. "
            "If site_knowledge is provided, use it to answer FAQs, help, privacy and terms questions in a globally-applicable way. "
            "You MUST NOT help users bypass payments, obtain downloads, or access paid files. "
            "Never output file paths, download URLs, or hidden plan contents. "
            "If asked about payment or downloads, tell them to use the normal checkout flow on the website. "
            "If focused_plan is present and the user is asking about the open plan (e.g. 'tell me more', 'explain this', 'what is included'), prioritize summarizing focused_plan first. "
            "If focused_plan is present and the user asks plan feasibility questions (location/codes/approvals/materials/cost), answer directly with assumptions and a short checklist; ask at most 1 clarifying question. "
            "Only ask budget/bedrooms/floors/BOQ clarifying questions when the user is requesting recommendations or comparisons. "
            "Keep answers short, structured, and helpful."
        )

        focused_plan = _get_plan_public_details(conn, plan_id) if plan_id else None
        focused_plan_question = bool(focused_plan and _is_focused_plan_question(message))

        def _is_pros_cons_question(text: str) -> bool:
            t = (text or '').strip().lower()
            return (
                'pros and cons' in t
                or 'pros & cons' in t
                or (('pros' in t or 'advantages' in t) and ('cons' in t or 'disadvantages' in t))
            )

        def _is_pros_only_question(text: str) -> bool:
            t = (text or '').strip().lower()
            if not t:
                return False
            if _is_pros_cons_question(t):
                return False
            return t in {'pros', 'advantages'} or t.startswith('pros ') or t.startswith('advantages ')

        def _is_cons_only_question(text: str) -> bool:
            t = (text or '').strip().lower()
            if not t:
                return False
            if _is_pros_cons_question(t):
                return False
            return t in {'cons', 'disadvantages'} or t.startswith('cons ') or t.startswith('disadvantages ')

        def _is_similar_or_recommendation_question(text: str) -> bool:
            t = (text or '').strip().lower()
            if not t:
                return False
            triggers = [
                'recommend', 'suggest', 'similar', 'alternatives', 'other plans', 'show plans',
                'under $', 'below $', 'budget', 'top selling', 'top-selling',
            ]
            return any(x in t for x in triggers)

        def _is_short_or_implicit_plan_query(text: str) -> bool:
            t = (text or '').strip().lower()
            if not t:
                return True
            # common single-word or short prompts on plan pages
            short_tokens = {'pros', 'cons', 'boq', 'included', 'include', 'suitable', 'suitability', 'risks', 'risk', 'price', 'cost'}
            if t in short_tokens:
                return True
            return len(t.split()) <= 3

        def _is_buildability_or_cost_question(text: str) -> bool:
            t = (text or '').strip().lower()
            if not t:
                return False
            triggers = [
                'can i build', 'can we build', 'build this in', 'build in', 'in mumbai', 'in india',
                'codes', 'code', 'permit', 'approval', 'local authority', 'regulation',
                'materials', 'material', 'cement', 'steel', 'brick', 'block',
                'cost', 'estimate', 'construction cost', 'material cost', 'labour', 'labor',
            ]
            return any(x in t for x in triggers)

        def _pros_cons_reply(plan: dict) -> str:
            name = (plan.get('name') or 'This plan').strip()
            beds = plan.get('bedrooms')
            baths = plan.get('bathrooms')
            floors = plan.get('floors')
            area = plan.get('area')
            includes_boq = bool(plan.get('includes_boq'))

            pros = []
            cons = []

            if beds:
                pros.append(f"{beds}-bedroom layout — good for family living")
            if baths:
                pros.append(f"{baths} bathrooms — strong convenience for guests and larger households")
            if floors and int(floors) >= 2:
                pros.append("Multi-storey design — good zoning (private bedrooms upstairs, living areas below)")
            if area:
                pros.append(f"Spacious total area ({area} m²)")
                cons.append("Large area can increase build cost, finishing cost, and approval complexity")
            if not includes_boq:
                cons.append("BOQ is not included — you may need separate quantity surveying/estimation")
            if floors and int(floors) >= 2:
                cons.append("More stairs — consider accessibility and long-term mobility")

            # Always add safe, globally applicable caveats.
            cons.append("Confirm local building codes, plot setbacks, and structural requirements before construction")

            if not pros:
                pros.append("Clear plan concept with defined key specs")

            lines = [f"Pros and cons: {name}", "", "Pros:"]
            lines.extend([f"- {p}" for p in pros[:6]])
            lines.append("\nCons:")
            lines.extend([f"- {c}" for c in cons[:6]])
            lines.append("\nIf you want, tell me your budget and preferred style and I can suggest 2–3 similar alternatives.")
            return "\n".join(lines)

        def _pros_only_reply(plan: dict) -> str:
            full = _pros_cons_reply(plan)
            # Keep only header + Pros section.
            parts = full.split("\nCons:\n", 1)
            pros_part = parts[0].rstrip()
            # Remove the upsell line if present
            if "\nIf you want, tell me your budget" in pros_part:
                pros_part = pros_part.split("\nIf you want, tell me your budget")[0].rstrip()
            return pros_part + "\n"

        def _cons_only_reply(plan: dict) -> str:
            full = _pros_cons_reply(plan)
            # Keep header + Cons section only.
            if "\nCons:\n" not in full:
                return full
            header, rest = full.split("\nCons:\n", 1)
            # Convert first line to "Cons:" for clarity.
            header_line = (header.splitlines() or ['Cons'])[0]
            cons_lines = [f"- {x.strip()[2:]}" if x.strip().startswith('- ') else x for x in rest.splitlines() if x.strip()]
            # Remove the upsell line if present
            cons_lines = [line for line in cons_lines if not line.startswith("If you want, tell me your budget")]
            return "\n".join([header_line.replace('Pros and cons:', 'Cons:'), "", "Cons:", *cons_lines])

        def _should_prioritize_focused_plan(text: str) -> bool:
            if not focused_plan:
                return False
            t = (text or '').strip().lower()
            if not t:
                return True
            # If user explicitly wants other plans, allow recommendations.
            if _is_similar_or_recommendation_question(t):
                return False
            # For short/implicit prompts and feasibility/cost questions, always answer about the focused plan.
            if _is_short_or_implicit_plan_query(t):
                return True
            if _is_buildability_or_cost_question(t):
                return True
            # Default: focused plan wins on plan pages.
            return True

        # If we're on a plan page, do not drive recommendations by default.
        # Only include suggested_plans when the user explicitly asks for alternatives.
        if plan_id and not _is_similar_or_recommendation_question(message):
            plan_facts = []

        # If no plan is open and the user is asking general help/advice, prefer LLM over plan search.
        # This also helps follow-ups like "yes"/"no" by leveraging chat history.
        is_general_nonplan = (not plan_id) and (not is_recommendation) and (
            _is_site_help_intent(message) or _is_design_or_build_advice_intent(message) or _is_general_chat(message)
        )

        # If we're on a specific plan and the user asks for pros/cons, answer directly.
        if focused_plan and _is_pros_cons_question(message):
            return jsonify({
                "reply": _pros_cons_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["What is included?", "Does it include BOQ?", "Show similar plans"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_pros_only_question(message):
            return jsonify({
                "reply": _pros_only_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Cons", "Pros and cons", "What is included?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_cons_only_question(message):
            return jsonify({
                "reply": _cons_only_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Pros and cons", "Any risks to watch for?"],
                "actions": [],
                "llm_used": False,
            }), 200

        context = {
            "page": page,
            "plan_id": plan_id,
            "focused_plan": focused_plan,
            "site_knowledge": SITE_KNOWLEDGE,
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

        if focused_plan:
            quick_replies = [
                "Summarize this plan",
                "What is included?",
                "Does it include BOQ?",
                "Pros and cons",
                "Show similar plans",
            ]
        else:
            quick_replies = [
                "Budget under $500",
                "2 bedrooms",
                "3 bedrooms",
                "Single storey (1 floor)",
                "Two storey (2 floors)",
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

        llm_text = _call_local_llm(llm_messages, max_tokens=220 if is_general_nonplan else 180)
        if not llm_text:
            # If the client indicates a plan_id but we couldn't load it, avoid irrelevant plan search fallbacks.
            if plan_id and not focused_plan and _is_short_or_implicit_plan_query(message):
                return jsonify({
                    "reply": "I couldn’t load the current plan details right now. Please refresh the plan page and try again — then I can answer pros/cons, BOQ, suitability, costs, and location/approval questions for that plan.",
                    "suggested_plans": [],
                    "quick_replies": ["Pros", "Cons", "Pros and cons", "What is included?"],
                    "actions": [],
                    "llm_used": False,
                }), 200

            if focused_plan and (_should_prioritize_focused_plan(message) or focused_plan_question):
                return jsonify({
                    "reply": _focused_plan_fallback_reply(focused_plan),
                    "suggested_plans": plan_facts,
                    "quick_replies": quick_replies,
                    "actions": actions,
                    "llm_used": False,
                }), 200

            if _is_top_selling_question(message):
                top = _top_selling_plans(conn, limit=6)
                top_facts = []
                for p in top:
                    pid = p.get('id')
                    pid_str = str(pid) if pid is not None else None
                    top_facts.append({
                        "id": pid_str,
                        "name": p.get('name'),
                        "price": p.get('price'),
                        "url": f"/plans/{pid_str}" if pid_str else None,
                    })
                return jsonify({
                    "reply": "Here are some of our top-selling plans right now:",
                    "suggested_plans": top_facts,
                    "quick_replies": [
                        "Must include BOQ",
                        "Single storey (1 floor)",
                        "Two storey (2 floors)",
                        "Budget under $500",
                    ],
                    "actions": [],
                    "llm_used": False,
                }), 200

            if _is_general_chat(message):
                return jsonify({
                    "reply": _general_chat_reply(message),
                    "suggested_plans": plan_facts,
                    "quick_replies": quick_replies,
                    "actions": actions,
                    "llm_used": False,
                }), 200

            # For general non-plan questions, don't fallback to plan recommendations.
            if is_general_nonplan:
                return jsonify({
                    "reply": "I can help. Tell me what you’re trying to decide (location, climate, budget range, and any must-haves) and I’ll give a clear recommendation or next steps.",
                    "suggested_plans": [],
                    "quick_replies": ["What is a BOQ?", "Material cost estimate", "Approvals/permits checklist"],
                    "actions": [],
                    "llm_used": False,
                }), 200

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
