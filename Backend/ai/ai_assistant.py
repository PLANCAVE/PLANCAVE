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


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "y", "on"}


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


def _extract_any_budget_value(message: str) -> float | None:
    lo, hi = _extract_budget(message)
    if hi is not None:
        return hi
    if lo is not None:
        return lo
    return None


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
    return {
        'architectural': 'Architectural',
        'structural': 'Structural',
        'mep': 'MEP',
        'civil': 'Civil',
        'fire_safety': 'Fire Safety',
        'interior': 'Interior',
        'boq': 'BOQ',
        'renders': '3D Renders',
    }.get(key, key)


def _last_meaningful_line(text: str) -> str:
    last = ''
    for line in (text or '').splitlines():
        s = line.strip()
        if s:
            last = s
    return last


def _last_user_like_line(text: str) -> str:
    lines = [(ln or '').strip() for ln in (text or '').splitlines()]
    lines = [ln for ln in lines if ln]
    if not lines:
        return ''

    assistant_snippets = (
        # recommendations block
        "budget range",
        "bedrooms + floors",
        "must-have",
        "must have",
        "any dealbreakers",
        "dealbreakers",
        "what budget + bedrooms + floors",
        "must boq be included",
        # utilities block
        "water source",
        "sewage",
        "power plan",
        "grid/solar",
        "ventilation",
        "ac strategy",
        "off-grid",
        "off grid",
        "is your area urban",
    )

    assistant_prefixes = (
        "you're viewing",
        "you are viewing",
        "ask me for",
        "recommendations (",
        "utilities (",
        "pros:",
        "cons:",
        "pros and cons",
        "what budget",
        "is your area",
        "do you need",
        "which do you need",
    )

    def _looks_like_assistant_line(s: str) -> bool:
        sl = s.lower().strip()
        if not sl:
            return True
        # checklist / bullets from assistant blocks
        if sl.startswith('-'):
            return True
        # sometimes the bullet marker is stripped; skip common assistant checklist fragments
        if any(sn in sl for sn in assistant_snippets):
            return True
        # assistant checklists often contain + separators
        if ' + ' in sl:
            return True
        # common assistant block headings / prompts
        if any(sl.startswith(p) for p in assistant_prefixes):
            return True
        # assistant "label: value" lines in pasted transcripts
        if re.match(r"^(pros|cons)\s*:\s*", sl):
            return True
        return False

    for ln in reversed(lines):
        if not _looks_like_assistant_line(ln):
            return ln
    return lines[-1]


def _normalize_for_intent(text: str) -> str:
    t = (text or '').strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def _has_token(text: str, token: str) -> bool:
    return re.search(rf"\b{re.escape(token)}\b", text or '', flags=re.IGNORECASE) is not None


def _is_price_question(text: str) -> bool:
    t = _normalize_for_intent(text)
    if not t:
        return False
    if 'how much is this plan' in t or 'how much is the plan' in t:
        return True
    return (
        _has_token(t, 'price')
        or (_has_token(t, 'cost') and ('plan' in t or 'this' in t))
        or 'how much' in t
    )


def _match_any(t: str, phrases: list[str]) -> bool:
    if not t:
        return False
    return any(p in t for p in phrases)


EDGE_CASE_INTENTS: list[dict] = [
    {
        "key": "included",
        "phrases": [
            "what is included", "whats included", "what's included", "what do i get", "what do you include",
            "what comes with", "package contents", "deliverables", "what will i receive", "what will i get",
            "included in the plan", "included in this plan", "included files", "what files are included",
            "what is in the package", "what is in the bundle", "plan package", "what do i receive",
            "what's in it", "what is inside", "what am i buying", "what am i paying for",
        ],
    },
    {
        "key": "boq_general",
        "phrases": [
            "what is a boq", "boq meaning", "define boq", "bill of quantities", "what does boq include",
            "boq breakdown", "boq list", "quantity survey", "quantity surveyor", "qs", "cost schedule",
            "materials schedule", "pricing schedule", "takeoff", "take off", "material takeoff",
            "cost estimate from drawings", "estimate from drawings", "bill quantities", "bill of quantity",
        ],
    },
    {
        "key": "cost_estimate",
        "phrases": [
            "how much to build", "how much does it cost to build", "construction cost", "build cost",
            "estimate cost", "cost estimate", "rough cost", "ballpark cost", "budget to build",
            "total cost", "overall cost", "material cost", "labour cost", "labor cost",
            "cost per sqm", "cost per m2", "cost per square meter", "cost per square metre",
            "cost per sq ft", "cost per square foot", "foundation cost", "finishing cost",
            "cheap to build", "affordable to build", "expensive to build",
        ],
    },
    {
        "key": "permits",
        "phrases": [
            "permit", "permits", "approval", "approvals", "planning permission", "building permit",
            "council approval", "local authority", "zoning", "setback", "setbacks", "plot setback",
            "code compliance", "building code", "regulations", "regulation", "standards", "inspection",
            "occupancy certificate", "cofo", "c of o", "certificate of occupancy",
        ],
    },
    {
        "key": "site_soil",
        "phrases": [
            "soil", "soil test", "soil testing", "geotech", "geotechnical", "bearing capacity",
            "foundation", "footing", "raft foundation", "pile", "piles", "strip foundation",
            "slope", "steep", "hilly", "flood", "flooding", "water table", "high water table",
            "swamp", "swampy", "clay", "sandy", "rocky", "laterite",
        ],
    },
    {
        "key": "climate",
        "phrases": [
            "climate", "weather", "hot", "humid", "dry", "cold", "rain", "rainy", "storm",
            "wind", "windy", "coastal", "salt air", "seaside", "harmattan", "dust",
            "insulation", "ventilation", "cross ventilation", "natural ventilation", "heat",
            "thermal", "cooling", "shading", "sun", "sunlight",
        ],
    },
    {
        "key": "timeline",
        "phrases": [
            "how long", "timeline", "duration", "time to build", "construction time", "build time",
            "schedule", "phases", "stages", "how many months", "how many weeks",
            "start to finish", "finish in", "complete in", "project timeline", "estimated time",
            "how fast", "fast build", "quick build", "delays", "delay",
        ],
    },
    {
        "key": "contractor",
        "phrases": [
            "contractor", "builder", "engineer", "architect", "quantity surveyor", "qs",
            "project manager", "site supervisor", "foreman", "labour", "labor", "workers",
            "hire", "hiring", "tender", "quotation", "quote", "bids", "estimate from contractor",
            "how to choose", "how to select", "recommend a contractor", "reliable contractor",
        ],
    },
    {
        "key": "customization",
        "phrases": [
            "customize", "customisation", "customization", "modify", "modification", "change the plan",
            "edit the plan", "adjust the plan", "alter", "revise", "revision", "can i change",
            "add a room", "remove a room", "add bathroom", "add toilet", "add garage", "add parking",
            "change roof", "change elevation", "change facade", "mirror", "flip the plan",
            "resize", "scale", "reduce size", "increase size",
        ],
    },
    {
        "key": "suitability",
        "phrases": [
            "suitable", "suitability", "is it good for", "is this good for", "family", "kids",
            "elderly", "parents", "wheelchair", "accessible", "accessibility", "stairs",
            "rural", "urban", "city", "village", "suburban", "estate", "gated",
            "small plot", "big plot", "narrow plot", "wide plot", "corner plot",
            "privacy", "noise", "security",
        ],
    },
    {
        "key": "utilities",
        "phrases": [
            "water", "plumbing", "sewage", "septic", "soakaway", "drainage", "stormwater",
            "electricity", "power", "generator", "solar", "inverter", "battery", "wiring",
            "hvac", "air conditioning", "ac", "cooling", "heating", "ventilation",
            "internet", "network", "cctv", "security camera",
        ],
    },
    {
        "key": "payment_download",
        "phrases": [
            "payment", "pay", "checkout", "buy", "purchase", "card", "transaction",
            "paystack", "failed payment", "pending payment", "verify payment", "receipt",
            "download", "access", "link", "get files", "where is my download", "i can't download",
            "download not working", "missing files", "send to email", "email link",
            "refund", "cancel", "money back",
        ],
    },
    {
        "key": "file_formats",
        "phrases": [
            "pdf", "cad", "dwg", "dxf", "sketchup", "3d", "render", "renders",
            "architectural", "structural", "mep", "electrical drawing", "plumbing drawing",
            "foundation drawing", "section", "elevation", "floor plan", "site plan",
            "dimensions", "dimension", "scale", "units", "meters", "square meters",
            "sq ft", "square feet",
        ],
    },
    {
        "key": "compare_recommend",
        "phrases": [
            "compare", "vs", "versus", "difference", "which is better", "better plan",
            "recommend", "suggest", "alternatives", "similar", "other plans", "best plan",
            "top plans", "top selling", "popular", "best urban plans", "best rural plans",
            "modern plans", "luxury plans", "cheap plans", "simple plans", "duplex", "bungalow",
            "townhouse", "apartment",
        ],
    },
    {"key": "structure", "phrases": ["structural", "structure", "beam", "column", "slab", "reinforcement", "rebar"]},
    {"key": "mep", "phrases": ["electrical", "wiring", "outlet", "switch", "panel", "circuit", "plumbing", "drain", "pipes"]},
    {"key": "roofing", "phrases": ["roof", "roofing", "roof type", "pitch", "flat roof", "gutter", "waterproof"]},
    {"key": "openings", "phrases": ["window", "windows", "door", "doors", "natural light", "ventilation"]},
    {"key": "stairs_access", "phrases": ["stairs", "stair", "staircase", "wheelchair", "accessible", "accessibility"]},
    {"key": "maintenance_resale", "phrases": ["maintenance", "upkeep", "repair", "resale", "sell", "value"]},
    {"key": "pricing_policies", "phrases": ["tax", "vat", "gst", "discount", "coupon", "promo", "promotion"]},
    {"key": "legal_privacy", "phrases": ["privacy", "terms", "license", "licence", "copyright", "data"]},
]


def _edge_case_intent_key(text: str) -> str | None:
    t = _normalize_for_intent(text)
    for item in EDGE_CASE_INTENTS:
        if _match_any(t, item.get('phrases') or []):
            return item.get('key')
    return None


def _edge_case_reply(key: str, focused_plan: dict | None) -> str:
    name = (focused_plan or {}).get('name') or 'this plan'
    includes_boq = bool((focused_plan or {}).get('includes_boq'))
    floors = (focused_plan or {}).get('floors')
    area = (focused_plan or {}).get('area')

    def _edge_style(title: str, bullets: list[str], question: str | None = None) -> str:
        lines = [title, ""]
        for b in (bullets or [])[:8]:
            lines.append(f"- {b}")
        if question:
            lines.extend(["", question])
        return "\n".join(lines)

    if key == 'included':
        return _edge_style(
            f"What’s included: {name}",
            [
                "Architectural drawings (the core plan set)",
                "Any extra deliverables listed on the plan page (structural/MEP/renders if available)",
                "BOQ is included only when the plan explicitly says BOQ included",
            ],
            "Which do you need: architectural only, or a full set (architectural + structural/MEP)?"
        )
    if key == 'boq_general':
        return _edge_style(
            "BOQ (Bill of Quantities)",
            [
                "A quantity + cost breakdown used to estimate construction",
                "Usually prepared by a Quantity Surveyor (QS) from the drawings",
                "Varies by location because unit rates change",
                "Best used together with a clear finish level (basic/standard/premium)",
            ],
            "Do you want BOQ for pricing only, or also for procurement (materials schedule)?"
        )
    if key == 'cost_estimate':
        return _edge_style(
            f"Build cost (how to estimate): {name}",
            [
                "Pick finish level: basic / standard / premium",
                "Get a local QS or contractor estimate from the drawings",
                "Add approvals + siteworks + utilities",
                "Keep contingency (often 10–15%)",
            ],
            "What’s your city/region and finish level (basic/standard/premium)?"
        )
    if key == 'permits':
        return _edge_style(
            "Approvals / permits (typical checklist)",
            [
                "Planning/zoning compliance (use, setbacks, height)",
                "Building permit approval",
                "Structural review / engineer sign-off (often required)",
                "Inspections during construction",
            ],
            "What city/region are you building in?"
        )
    if key == 'site_soil':
        extra = False
        if floors:
            try:
                extra = int(floors) >= 2
            except Exception:
                extra = False
        bullets = [
            "Do a soil test (bearing capacity + water table)",
            "Check flood risk + confirm drainage plan",
            "Foundation type must match the soil (engineer guidance)",
        ]
        if extra:
            bullets.append("Multi-storey buildings are more sensitive to soil/foundation quality")
        return _edge_style(
            "Site & soil checks (before you build)",
            bullets,
            "Is your site flat or sloped, and do you have a soil test result already?"
        )
    if key == 'climate':
        return _edge_style(
            "Climate fit (quick checklist)",
            [
                "Hot/humid: cross-ventilation + shading + reflective roofing",
                "Rainy/coastal: strong drainage + corrosion-resistant materials",
                "Dry/dusty: good sealing + easy-clean finishes + filtered ventilation",
            ],
            "What’s your climate: hot-humid, dry, coastal, or cold?"
        )
    if key == 'timeline':
        return _edge_style(
            "Timeline (typical phases)",
            [
                "Approvals + planning",
                "Foundation",
                "Superstructure",
                "Roofing",
                "MEP (electrical/plumbing)",
                "Finishes + external works",
            ],
            "Are you targeting basic, standard, or premium finish?"
        )
    if key == 'contractor':
        return _edge_style(
            "Contractor selection (quick checklist)",
            [
                "Verify past projects (photos + site visits if possible)",
                "Written quote: scope + timeline + milestones",
                "Clarify who supplies materials and who handles approvals",
                "Define change-orders + contingency",
            ],
            "What city/region are you building in?"
        )
    if key == 'customization':
        return _edge_style(
            "Customization (what’s safe vs high-risk)",
            [
                "Safer: room sizing/layout tweaks, facade/finish changes",
                "Medium: adding/removing bathrooms, reworking kitchen layouts",
                "High-risk: adding floors, moving columns/beams, major roof changes (needs engineer)",
            ],
            "What exact change do you want (add room, reduce size, change roof, etc.)?"
        )
    if key == 'suitability':
        bullets = [
            "Plot size + setbacks (local rules)",
            "Access needs (stairs vs accessibility)",
            "Family/lifestyle (parking, outdoor space, privacy)",
            "Budget for structure + finishes",
        ]
        if area:
            bullets.append(f"Total area: {area} m² (check plot + setbacks)")
        return _edge_style(
            f"Suitability: {name}",
            bullets,
            "What’s your plot size and city/region?"
        )
    if key == 'utilities':
        return _edge_style(
            "Utilities (planning checklist)",
            [
                "Water source + storage (tank/borehole where needed)",
                "Sewage (public sewer vs septic + soakaway)",
                "Power plan (grid/solar/inverter/generator)",
                "Ventilation/AC strategy",
            ],
            "Is your area urban (utilities available) or rural (off-grid likely)?"
        )
    if key == 'payment_download':
        boq_line = "Yes" if includes_boq else "No"
        return _edge_style(
            f"Payments & downloads: {name}",
            [
                f"BOQ included: {boq_line}",
                "Complete checkout on the website to access paid files",
                "Download from your Purchases/download section",
                "If payment is pending/failed, retry from Purchases so it can be verified",
            ],
            "Is this about a failed payment, or you can’t find your download after paying?"
        )
    if key == 'file_formats':
        return _edge_style(
            "File formats (what to expect)",
            [
                "Most plans are delivered as PDF drawings",
                "Some plans include extra sets (structural/MEP/renders) if listed",
                "CAD/DWG availability depends on the specific plan package",
            ],
            "Do you need PDF only, or CAD/DWG as well?"
        )
    if key == 'compare_recommend':
        return _edge_style(
            "Recommendations (so I can pick the best matches)",
            [
                "Budget range",
                "Bedrooms + floors",
                "Must-have: BOQ included or not",
                "Any dealbreakers (stairs, parking, plot size)",
            ],
            "What budget + bedrooms + floors do you want, and must BOQ be included?"
        )
    if key == 'structure':
        return _edge_style(
            "Structure (what to confirm)",
            [
                "Have a structural engineer review the drawings for your soil + local code",
                "Confirm column/beam layout isn’t changed during construction",
                "Ensure reinforcement and concrete grades match the structural design",
                "Account for site conditions (water table, slope, soil type)",
            ],
            "Are you building on clay/sandy soil, or do you already have a soil test?"
        )
    if key == 'mep':
        return _edge_style(
            "MEP (electrical/plumbing) planning",
            [
                "Confirm electrical load (AC, water heaters, cooking) before wiring",
                "Plan plumbing routes early to avoid costly rework",
                "Decide sewage system (sewer vs septic) and drainage strategy",
                "Keep access points for maintenance (valves, cleanouts, panels)",
            ],
            "Do you want to run on-grid power only, or include solar/inverter as well?"
        )
    if key == 'roofing':
        return _edge_style(
            "Roofing (risk checklist)",
            [
                "Confirm roof type suits rainfall/wind in your area",
                "Prioritize waterproofing details (flashings, valleys, gutters)",
                "Ensure proper slope/drainage to prevent ponding",
                "Coastal areas: use corrosion-resistant materials",
            ],
            "Is your area heavy-rain, coastal, or high-wind?"
        )
    if key == 'openings':
        return _edge_style(
            "Windows/doors (comfort + security)",
            [
                "Ventilation: place windows for cross-breeze where possible",
                "Security: consider burglary-proofing where needed",
                "Heat: use shading and reduce west-facing glazing in hot climates",
                "Waterproofing: ensure proper sill detailing in rainy zones",
            ],
            "Do you care more about ventilation, security, or heat control?"
        )
    if key == 'stairs_access':
        return _edge_style(
            "Stairs & accessibility",
            [
                "Multi-storey means daily stairs—plan for long-term mobility",
                "Keep stair width/handrails safe and code-compliant",
                "If elderly/accessible needs: consider a ground-floor bedroom",
                "Good lighting on stairs reduces fall risk",
            ],
            "Will elderly family members use the home daily?"
        )
    if key == 'maintenance_resale':
        return _edge_style(
            "Maintenance & resale",
            [
                "Simpler rooflines and durable finishes reduce long-term upkeep",
                "Good ventilation and damp-proofing prevent mould/repairs",
                "Parking + storage + practical layout help resale value",
                "Avoid over-customizing for a very niche buyer profile",
            ],
            "Is your priority low-maintenance, or maximum resale value?"
        )
    if key == 'pricing_policies':
        return _edge_style(
            "Pricing, taxes & discounts",
            [
                "Prices/charges may vary by region and payment method",
                "Tax/VAT applicability depends on your location",
                "Discounts (if any) usually require a valid coupon or promo",
            ],
            "What country are you paying from, and are you using a promo code?"
        )
    if key == 'legal_privacy':
        return _edge_style(
            "Privacy & terms (high level)",
            [
                "Plans are typically licensed for use; don’t share paid files publicly",
                "For privacy: use only official checkout/download flows",
                "If you need a formal invoice/receipt, use the Purchases section",
            ],
            "Are you asking about usage rights (license), or personal data/privacy?"
        )
    return "Tell me a bit more (location, budget, and must-haves) and I’ll give a precise answer."


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

    # Users sometimes paste a full transcript; route intents off the last meaningful line.
    routed_message = (_last_user_like_line(message) or message).strip()

    if _env_bool('AI_ROUTING_DEBUG', False):
        try:
            current_app.logger.info(
                f"ai.chat route_debug plan_id={plan_id!r} page={page!r} "
                f"raw_len={len(message or '')} routed={routed_message!r}"
            )
        except Exception:
            pass

    if not message:
        return jsonify(message="message is required"), 400

    if _is_greeting(routed_message) and not plan_id:
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
        # IMPORTANT: even on a plan page, allow cross-plan recommendations if the user explicitly asks.
        is_recommendation = _is_recommendation_intent(routed_message)
        plans = _search_plans(conn, routed_message, limit=limit) if is_recommendation else []

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
        focused_plan_question = bool(focused_plan and _is_focused_plan_question(routed_message))

        if _env_bool('AI_ROUTING_DEBUG', False):
            try:
                current_app.logger.info(
                    f"ai.chat route_debug focused_plan={'yes' if bool(focused_plan) else 'no'} "
                    f"is_recommendation={'yes' if bool(is_recommendation) else 'no'}"
                )
            except Exception:
                pass

        def _first_meaningful_line(text: str) -> str:
            for line in (text or '').splitlines():
                s = line.strip().lower()
                if s:
                    return s
            return ''

        # Hard guard: if the client didn't provide plan_id / we couldn't load focused_plan,
        # do NOT show recommendation prompts for plan-page quick picks.
        short_tokens = {'pros', 'cons', 'boq', 'price', 'cost', 'included', 'include', 'suitable', 'suitability', 'risk', 'risks'}
        if (not focused_plan) and (_normalize_for_intent(routed_message) in short_tokens) and (not is_recommendation):
            return jsonify({
                "reply": (
                    "I can help — but I can’t see the plan you’re viewing right now. "
                    "Please refresh/open the plan page so it sends the plan id (or paste the plan link/name), "
                    "then I’ll answer pros/cons, BOQ, price, what’s included, suitability, and risks."
                ),
                "suggested_plans": [],
                "quick_replies": ["Paste plan link", "Pros", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        # If the user is asking about "this plan" but we couldn't load the plan context,
        # avoid misrouting into recommendation prompts.
        if (not focused_plan) and plan_id and _is_focused_plan_question(routed_message) and (not is_recommendation):
            return jsonify({
                "reply": (
                    "I can help, but I couldn’t load the current plan details right now. "
                    "Please refresh the plan page and try again — then I can summarize the plan and answer pros/cons, BOQ, price, suitability, and risks."
                ),
                "suggested_plans": [],
                "quick_replies": ["Refresh plan page", "Pros", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if (not focused_plan) and (not plan_id) and _is_focused_plan_question(routed_message) and (not is_recommendation):
            return jsonify({
                "reply": (
                    "I can help — but I can’t see which plan you’re viewing right now. "
                    "Please open the plan page (or paste the plan link/name), and I’ll summarize it and answer pros/cons, BOQ, price, suitability, and risks."
                ),
                "suggested_plans": [],
                "quick_replies": ["Paste plan link", "Pros", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        def _is_boq_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            # Explicit BOQ questions only; avoid catching recommendation queries that happen to contain 'boq'.
            # Patterns: "Does it include BOQ?", "Is BOQ included?", "BOQ?", "What about BOQ"
            return (
                ('does it include' in t and 'boq' in t) or
                ('is boq' in t) or
                ('boq included' in t) or
                ('what about boq' in t) or
                ('boq?' in t) or
                ('bill of quantities' in t)
            )

        def _is_show_similar_plans(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            return (
                'show similar plans' in t
                or 'similar plans' in t
                or 'show similar' in t
                or 'similar to this' in t
                or 'alternatives to this' in t
            )

        def _is_risks_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            return (
                'risks' in t or 'risk' in t or 'watch for' in t or 'what are the risks' in t
                or 'any risks' in t or 'potential issues' in t or 'problems' in t
            )

        def _is_build_location_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            return (
                'where can i build' in t or 'where can i best build' in t
                or 'best place to build' in t or 'where to build' in t
                or 'suitable location' in t or 'best location' in t
            )

        # === Comprehensive intent detection for 100+ edge cases ===
        def _is_whats_included_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'what is included' in t or 'whats included' in t or 'what do i get' in t
                or 'included files' in t or 'deliverables' in t or 'package contents' in t
                or 'what comes with' in t or 'what files' in t
            )

        def _is_files_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'files' in t or 'drawings' in t or 'plans' in t or 'documents' in t
                or 'pdf' in t or 'cad' in t or 'dwg' in t or 'sketchup' in t
            )

        def _is_deliverables_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'deliverables' in t or 'what deliverables' in t or 'package includes' in t
                or 'what is in the package' in t
            )

        def _is_materials_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'materials' in t or 'material list' in t or 'what materials' in t
                or 'cement' in t or 'steel' in t or 'brick' in t or 'blocks' in t
                or 'finishes' in t or 'roofing' in t
            )

        def _is_labor_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'labor' in t or 'labour' in t or 'workers' in t or 'team' in t
                or 'contractor' in t or 'builder' in t or 'trades' in t
            )

        def _is_timeline_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'timeline' in t or 'how long' in t or 'duration' in t or 'time to build' in t
                or 'construction time' in t or 'build time' in t or 'schedule' in t
            )

        def _is_modification_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'modify' in t or 'custom' in t or 'customize' in t or 'change' in t
                or 'alter' in t or 'adjust' in t or 'edit' in t or 'modification' in t
            )

        def _is_permit_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'permit' in t
                or 'permits' in t
                or 'approval' in t
                or 'approvals' in t
                or 'council' in t
                or 'authority' in t
                or 'building permit' in t
                or 'planning permission' in t
                or 'permit required' in t
            )

        def _is_code_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'code' in t or 'codes' in t or 'building code' in t or 'regulation' in t
                or 'compliance' in t or 'standards' in t or 'zoning' in t
            )

        def _is_soil_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'soil' in t or 'ground' in t or 'foundation' in t or 'footing' in t
                or 'bearing capacity' in t or 'soil test' in t or 'geotech' in t
            )

        def _is_climate_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'climate' in t or 'weather' in t or 'rain' in t or 'wind' in t
                or 'temperature' in t or 'humidity' in t or 'seasonal' in t
            )

        def _is_accessibility_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'accessibility' in t or 'accessible' in t or 'wheelchair' in t
                or 'disabled' in t or 'ramp' in t or 'handrail' in t or 'aging' in t
            )

        def _is_parking_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'parking' in t or 'garage' in t or 'car' in t or 'vehicle' in t
                or 'driveway' in t or 'carport' in t
            )

        def _is_outdoor_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'outdoor' in t or 'garden' in t or 'yard' in t or 'patio' in t
                or 'balcony' in t or 'terrace' in t or 'deck' in t
            )

        def _is_energy_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'energy' in t or 'solar' in t or 'power' in t or 'electricity' in t
                or 'insulation' in t or 'efficiency' in t or 'sustainable' in t
            )

        def _is_water_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'water' in t or 'plumbing' in t or 'drainage' in t or 'sewage' in t
                or 'septic' in t or 'rainwater' in t or 'tank' in t
            )

        def _is_vastu_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'vastu' in t or 'vaastu' in t or 'direction' in t or 'orientation' in t
                or 'facing' in t or 'east facing' in t or 'north facing' in t
            )

        def _is_family_size_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'family' in t or 'children' in t or 'kids' in t or 'baby' in t
                or 'elderly' in t or 'parents' in t or 'guests' in t or 'how many people' in t
            )

        def _is_future_proof_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'future' in t or 'expand' in t or 'extension' in t or 'add floor' in t
                or 'renovate' in t or 'upgrade' in t or 'flexible' in t
            )

        def _is_maintenance_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'maintenance' in t or 'upkeep' in t or 'cleaning' in t or 'repair' in t
                or 'durable' in t or 'long lasting' in t or 'wear' in t
            )

        def _is_resale_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'resale' in t or 'sell' in t or 'value' in t or 'investment' in t
                or 'market' in t or 'appreciate' in t or 'demand' in t
            )

        def _is_payment_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'payment' in t or 'pay' in t or 'checkout' in t or 'buy' in t
                or 'purchase' in t or 'card' in t or 'transaction' in t
            )

        def _is_download_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'download' in t or 'access' in t or 'link' in t or 'file' in t
                or 'after purchase' in t or 'get files' in t or 'receive' in t
            )

        def _is_refund_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'refund' in t or 'money back' in t or 'cancel' in t or 'return' in t
                or 'guarantee' in t or 'satisfaction' in t
            )

        def _is_support_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'support' in t or 'help' in t or 'contact' in t or 'assist' in t
                or 'issue' in t or 'problem' in t or 'trouble' in t
            )

        def _is_comparison_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'compare' in t or 'vs' in t or 'versus' in t or 'difference' in t
                or 'better' in t or 'which one' in t or 'choose' in t
            )

        def _is_measurement_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'size' in t or 'dimension' in t or 'measure' in t or 'area' in t
                or 'square feet' in t or 'sq ft' in t or 'meters' in t or 'm²' in t
            )

        def _is_ceiling_height_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'ceiling' in t or 'height' in t or 'room height' in t or 'floor to ceiling' in t
                or 'vertical space' in t
            )

        def _is_window_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'window' in t or 'windows' in t or 'natural light' in t or 'ventilation' in t
                or 'opening' in t or 'glazing' in t
            )

        def _is_door_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'door' in t or 'doors' in t or 'entrance' in t or 'main door' in t
                or 'door size' in t or 'door width' in t
            )

        def _is_stair_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'stair' in t or 'stairs' in t or 'staircase' in t or 'steps' in t
                or 'rise' in t or 'tread' in t or 'landing' in t
            )

        def _is_roof_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'roof' in t or 'roofing' in t or 'roof type' in t or 'pitch' in t
                or 'flat roof' in t or 'sloped roof' in t or 'terrace roof' in t
            )

        def _is_foundation_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'foundation' in t or 'footing' in t or 'base' in t or 'structural base' in t
                or 'raft foundation' in t or 'strip foundation' in t
            )

        def _is_flooring_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'floor' in t or 'flooring' in t or 'floor finish' in t or 'tiles' in t
                or 'marble' in t or 'wood' in t or 'vinyl' in t
            )

        def _is_kitchen_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'kitchen' in t or 'cooking' in t or 'cabinets' in t or 'counter' in t
                or 'sink' in t or 'appliances' in t
            )

        def _is_bathroom_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'bathroom' in t or 'toilet' in t or 'shower' in t or 'bathtub' in t
                or 'sanitary' in t or 'fixtures' in t
            )

        def _is_structural_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'structural' in t or 'structure' in t or 'load' in t or 'beam' in t
                or 'column' in t or 'slab' in t or 'reinforcement' in t
            )

        def _is_electrical_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'electrical' in t or 'wiring' in t or 'outlet' in t or 'switch' in t
                or 'panel' in t or 'circuit' in t or 'power' in t
            )

        def _is_hvac_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'hvac' in t
                or 'air conditioning' in t
                or 'ac' in t
                or 'cooling' in t
                or 'heating' in t
                or 'ventilation' in t
                or 'duct' in t
            )

        def _is_fire_safety_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'fire' in t or 'safety' in t or 'extinguish' in t or 'alarm' in t
                or 'emergency' in t or 'exit' in t or 'sprinkler' in t
            )

        def _is_privacy_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'privacy' in t or 'policy' in t or 'data' in t or 'personal info' in t
                or ' gdpr' in t or 'secure' in t
            )

        def _is_terms_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'terms' in t or 'conditions' in t or 'agreement' in t or 'license' in t
                or 'usage rights' in t or 'copyright' in t
            )

        def _is_shipping_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'shipping' in t or 'delivery' in t or 'logistics' in t or 'courier' in t
                or 'receive' in t or 'dispatch' in t
            )

        def _is_subscription_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'subscription' in t or 'member' in t or 'account' in t or 'renew' in t
                or 'expire' in t or 'access period' in t
            )

        def _is_mobile_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'mobile' in t or 'phone' in t or 'app' in t or 'android' in t
                or 'ios' in t or 'responsive' in t
            )

        def _is_language_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'language' in t or 'translate' in t or 'english' in t or 'local' in t
                or 'multilingual' in t or 'region' in t
            )

        def _is_currency_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'currency' in t or 'price' in t or 'cost' in t or 'rate' in t
                or 'exchange' in t or 'usd' in t or 'local currency' in t
            )

        def _is_tax_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'tax' in t or 'vat' in t or 'gst' in t or 'inclusive' in t
                or 'taxable' in t or 'invoice' in t
            )

        def _is_discount_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'discount' in t or 'offer' in t or 'promotion' in t or 'sale' in t
                or 'coupon' in t or 'code' in t or 'deal' in t
            )


        def _is_budget_only_message(text: str) -> bool:
            raw = (text or '').strip()
            if not raw:
                return False
            # If user only drops a budget (often pasted with plan details), treat as budget-only.
            any_budget = _extract_any_budget_value(raw)
            if any_budget is None:
                return False
            t = _normalize_for_intent(raw)
            # If they explicitly ask a different question, don't treat as budget-only.
            if _is_pros_cons_question(t) or _is_pros_only_question(t) or _is_cons_only_question(t):
                return False
            if _is_boq_question(t) or _is_show_similar_plans(t):
                return False
            # Very short messages like "$400000" or "budget $400000".
            return len(t.split()) <= 6

        def _is_pros_cons_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            return (
                'pros and cons' in t
                or 'pros & cons' in t
                or ((_has_token(t, 'pros') or _has_token(t, 'advantages')) and (_has_token(t, 'cons') or _has_token(t, 'disadvantages')))
            )

        def _is_pros_only_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            if _is_pros_cons_question(t):
                return False
            first = _first_meaningful_line(text)
            if first in {'pros', 'advantages'} or first.startswith('pros ') or first.startswith('advantages '):
                return True
            # Robust: allow pros token anywhere, as long as cons isn't also requested.
            return (_has_token(t, 'pros') or _has_token(t, 'advantages')) and not (_has_token(t, 'cons') or _has_token(t, 'disadvantages'))

        def _is_cons_only_question(text: str) -> bool:
            t = _normalize_for_intent(text)
            if not t:
                return False
            if _is_pros_cons_question(t):
                return False
            first = _first_meaningful_line(text)
            if first in {'cons', 'disadvantages'} or first.startswith('cons ') or first.startswith('disadvantages '):
                return True
            # Robust: allow cons token anywhere, as long as pros isn't also requested.
            return (_has_token(t, 'cons') or _has_token(t, 'disadvantages')) and not (_has_token(t, 'pros') or _has_token(t, 'advantages'))

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
            return "\n".join(lines)

        def _pros_only_reply(plan: dict) -> str:
            name = (plan.get('name') or 'This plan').strip()
            beds = plan.get('bedrooms')
            baths = plan.get('bathrooms')
            floors = plan.get('floors')
            area = plan.get('area')
            includes_boq = bool(plan.get('includes_boq'))

            pros = []
            if beds:
                pros.append(f"{beds}-bedroom layout — good for family living")
            if baths:
                pros.append(f"{baths} bathrooms — strong convenience for guests and larger households")
            if floors and int(floors) >= 2:
                pros.append("Multi-storey design — good zoning (private bedrooms upstairs, living areas below)")
            if area:
                pros.append(f"Spacious total area ({area} m²)")
            if not pros:
                pros.append("Clear plan concept with defined key specs")

            lines = [f"Pros: {name}", "", "Pros:"]
            lines.extend([f"- {p}" for p in pros[:6]])
            return "\n".join(lines) + "\n"

        def _cons_only_reply(plan: dict) -> str:
            name = (plan.get('name') or 'This plan').strip()
            floors = plan.get('floors')
            area = plan.get('area')
            includes_boq = bool(plan.get('includes_boq'))

            cons = []
            if area:
                cons.append("Large area can increase build cost, finishing cost, and approval complexity")
            if not includes_boq:
                cons.append("BOQ is not included — you may need separate quantity surveying/estimation")
            if floors and int(floors) >= 2:
                cons.append("More stairs — consider accessibility and long-term mobility")
            cons.append("Confirm local building codes, plot setbacks, and structural requirements before construction")
            if not cons:
                cons.append("Consider local approvals and site-specific requirements")

            lines = [f"Cons: {name}", "", "Cons:"]
            lines.extend([f"- {c}" for c in cons[:6]])
            return "\n".join(lines) + "\n"

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
        # Only include suggested_plans when the user explicitly asks for alternatives/recommendations.
        if plan_id and not (_is_similar_or_recommendation_question(routed_message) or _is_recommendation_intent(routed_message)):
            plan_facts = []

        # If no plan is open and the user is asking general help/advice, prefer LLM over plan search.
        # This also helps follow-ups like "yes"/"no" by leveraging chat history.
        is_general_nonplan = (not plan_id) and (not is_recommendation) and (
            _is_site_help_intent(routed_message) or _is_design_or_build_advice_intent(routed_message) or _is_general_chat(routed_message)
        )

        # If we're on a specific plan and the user asks for pros/cons, answer directly.
        if focused_plan and _is_pros_cons_question(routed_message):
            return jsonify({
                "reply": _pros_cons_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Cons", "Any risks to watch for?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_pros_only_question(routed_message):
            return jsonify({
                "reply": _pros_only_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Cons", "Pros and cons", "Any risks to watch for?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_cons_only_question(routed_message):
            return jsonify({
                "reply": _cons_only_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Pros and cons", "Any risks to watch for?"],
                "actions": [],
                "llm_used": False,
            }), 200

        # If the user is asking to understand the open plan ("tell me more", "explain this"),
        # respond with a focused plan summary instead of generic recommendation prompts.
        if focused_plan and (not is_recommendation) and _is_focused_plan_question(routed_message):
            return jsonify({
                "reply": _focused_plan_fallback_reply(focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_price_question(routed_message):
            price = focused_plan.get('price')
            name = focused_plan.get('name') or 'this plan'
            if price is None:
                reply = f"Price: {name}\n\n- Price is not available for this plan yet."
            else:
                try:
                    reply = f"Price: {name}\n\n- $ {float(price):,.0f}"
                except Exception:
                    reply = f"Price: {name}\n\n- {price}"
            return jsonify({
                "reply": reply,
                "suggested_plans": plan_facts,
                "quick_replies": ["What’s included?", "Does it include BOQ?", "Any risks to watch for?"],
                "actions": [],
                "llm_used": False,
            }), 200

        edge_key = _edge_case_intent_key(routed_message)
        # Don't override explicit recommendation searches (we want plan results in that case).
        if edge_key and not is_recommendation:
            return jsonify({
                "reply": _edge_case_reply(edge_key, focused_plan),
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        # Cross-plan recommendations: if user asks for recommendations/similar/budget/alternatives, search and return plans
        # even if we're on a plan page. This must come before the plan-specific quick-reply handlers.
        if is_recommendation:
            # We already have 'plans' and 'plan_facts' populated from earlier.
            # If no results, return a helpful fallback.
            if not plans:
                return jsonify({
                    "reply": "I couldn’t find matches for that. Try adjusting budget, bedrooms, floors, or tell me what you want to change.",
                    "suggested_plans": [],
                    "quick_replies": ["Budget under $500", "3 bedrooms", "Must include BOQ"],
                    "actions": [],
                    "llm_used": False,
                }), 200
            return jsonify({
                "reply": _fallback_response("", plans)["reply"],
                "suggested_plans": plan_facts,
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        # Focused-plan quick replies that should not echo the plan details block.
        if focused_plan and _is_boq_question(routed_message):
            includes_boq = bool(focused_plan.get('includes_boq'))
            if includes_boq:
                reply = "Yes — BOQ is included for this plan."
            else:
                reply = (
                    "No — BOQ is not included for this plan.\n\n"
                    "If you want one, you can: \n"
                    "- Ask a quantity surveyor to prepare a BOQ from the drawings\n"
                    "- Or request a BOQ add-on (if available for this plan)"
                )
            return jsonify({
                "reply": reply,
                "suggested_plans": [],
                "quick_replies": ["Pros", "Cons", "Show similar plans"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_show_similar_plans(routed_message):
            # Build a query from the focused plan so we actually return alternatives.
            # Keep it simple and DB-only (no feature invention).
            q_parts = []
            try:
                if focused_plan.get('bedrooms') is not None:
                    q_parts.append(f"{int(focused_plan.get('bedrooms'))} bedrooms")
            except Exception:
                pass
            try:
                if focused_plan.get('floors') is not None:
                    q_parts.append(f"{int(focused_plan.get('floors'))} floors")
            except Exception:
                pass
            if focused_plan.get('category'):
                q_parts.append(str(focused_plan.get('category')))
            if focused_plan.get('project_type'):
                q_parts.append(str(focused_plan.get('project_type')))
            query = " ".join([p for p in q_parts if p]).strip() or (focused_plan.get('name') or '')

            similar = _search_plans(conn, query, limit=limit)
            # Remove the current plan from results if present.
            fid = str(focused_plan.get('id')) if focused_plan.get('id') is not None else None
            similar = [p for p in (similar or []) if str(p.get('id')) != fid]
            if not similar:
                return jsonify({
                    "reply": "I couldn’t find close alternatives right now. Try telling me what you want to change (cheaper, fewer floors, must include BOQ, etc.) and I’ll suggest the closest matches.",
                    "suggested_plans": [],
                    "quick_replies": ["Cheaper alternatives", "Must include BOQ", "2 floors"],
                    "actions": [],
                    "llm_used": False,
                }), 200

            return jsonify({
                "reply": _fallback_response("", similar)["reply"].replace("Here are a few plans that match what you asked for:", "Here are a few similar plans:"),
                "suggested_plans": [
                    {
                        "id": str(p.get('id')) if p.get('id') is not None else None,
                        "name": p.get('name'),
                        "price": p.get('price'),
                        "url": f"/plans/{str(p.get('id'))}" if p.get('id') is not None else None,
                    }
                    for p in similar[:5]
                ],
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_budget_only_message(routed_message):
            b = _extract_any_budget_value(routed_message)
            b_text = f"$ {float(b):,.0f}" if b is not None else "that budget"
            return jsonify({
                "reply": (
                    f"Got it — budget {b_text}.\n\n"
                    "Quick clarification (pick one): is this your **construction budget** (to build the house), or your **plan purchase budget** (to buy drawings/BOQ add-ons)?"
                ),
                "suggested_plans": [],
                "quick_replies": ["Construction budget", "Plan purchase budget"],
                "actions": [],
                "llm_used": False,
            }), 200

        # Focused-plan direct-answer handlers to avoid generic fallback.
        if focused_plan and _is_risks_question(routed_message):
            name = focused_plan.get('name') or 'This plan'
            floors = focused_plan.get('floors')
            area = focused_plan.get('area')
            includes_boq = bool(focused_plan.get('includes_boq'))

            risks = []
            if area:
                risks.append(f"Large area ({area} m²) can increase build cost, finishing cost, and approval complexity")
            if not includes_boq:
                risks.append("BOQ is not included — you may need separate quantity surveying/estimation")
            if floors and int(floors) >= 2:
                risks.append("More stairs — consider accessibility and long-term mobility")
            risks.append("Confirm local building codes, plot setbacks, and structural requirements before construction")
            if not risks:
                risks.append("Review site-specific conditions and local approvals before starting")

            lines = [f"Risks to watch for: {name}", ""]
            for r in risks[:6]:
                lines.append(f"- {r}")
            return jsonify({
                "reply": "\n".join(lines),
                "suggested_plans": [],
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                "actions": [],
                "llm_used": False,
            }), 200

        if focused_plan and _is_build_location_question(routed_message):
            name = focused_plan.get('name') or 'This plan'
            floors = focused_plan.get('floors')
            area = focused_plan.get('area')

            tips = []
            if floors and int(floors) >= 2:
                tips.append("Multi-storey designs work best on plots with good access and stable soil; avoid very steep slopes.")
            if area:
                tips.append(f"Ensure the plot can accommodate at least {area} m² plus setbacks and driveway.")
            tips.append("Check local zoning: some areas restrict multi-storey or minimum plot sizes.")
            tips.append("Prefer sites with utility connections (water, electricity, sewage) nearby to reduce costs.")

            lines = [f"Where to best build: {name}", ""]
            for t in tips:
                lines.append(f"- {t}")
            lines.extend([
                "",
                "Tell me your city/region and I can give more specific guidance (soil type, climate, approvals)."
            ])
            return jsonify({
                "reply": "\n".join(lines),
                "suggested_plans": [],
                "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
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
            "content": f"Context JSON: {json.dumps(context, default=str)}\n\nUser message: {routed_message}",
        })

        llm_text = _call_local_llm(llm_messages, max_tokens=220 if is_general_nonplan else 180)
        if not llm_text:
            # If the client indicates a plan_id but we couldn't load it, avoid irrelevant plan search fallbacks.
            if plan_id and not focused_plan and _is_short_or_implicit_plan_query(routed_message):
                return jsonify({
                    "reply": "I couldn’t load the current plan details right now. Please refresh the plan page and try again — then I can answer pros/cons, BOQ, suitability, costs, and location/approval questions for that plan.",
                    "suggested_plans": [],
                    "quick_replies": ["Refresh plan page", "Pros", "Does it include BOQ?"],
                    "actions": [],
                    "llm_used": False,
                }), 200

            if focused_plan and (_should_prioritize_focused_plan(routed_message) or focused_plan_question):
                return jsonify({
                    "reply": _focused_plan_fallback_reply(focused_plan),
                    "suggested_plans": plan_facts,
                    "quick_replies": ["Pros", "Cons", "Does it include BOQ?"],
                    "actions": [],
                    "llm_used": False,
                }), 200

            if _is_top_selling_question(routed_message):
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

            if _is_general_chat(routed_message):
                return jsonify({
                    "reply": _general_chat_reply(routed_message),
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
