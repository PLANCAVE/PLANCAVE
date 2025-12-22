import os
import io
import json
import zipfile
import uuid
import re
import textwrap
import requests
from datetime import datetime, date
from decimal import Decimal
from psycopg.rows import dict_row


def _normalize_selected_deliverables(selected_deliverables) -> set[str] | None:
    if selected_deliverables is None:
        return None
    if isinstance(selected_deliverables, (list, tuple, set)):
        return {str(x) for x in selected_deliverables if str(x).strip()}
    if isinstance(selected_deliverables, str):
        try:
            parsed = json.loads(selected_deliverables)
            if isinstance(parsed, list):
                return {str(x) for x in parsed if str(x).strip()}
        except Exception:
            return {selected_deliverables} if selected_deliverables.strip() else None
        return None
    return None


def _deliverable_key_for_file_type(file_type: str | None) -> str | None:
    if not file_type:
        return None
    ft = str(file_type).upper()
    if ft.startswith('ARCH'):
        return 'architectural'
    if ft.startswith('STRUCT'):
        return 'structural'
    if ft.startswith('MEP'):
        return 'mep'
    if ft.startswith('CIVIL'):
        return 'civil'
    if ft.startswith('FIRE'):
        return 'fire_safety'
    if ft.startswith('INTERIOR'):
        return 'interior'
    if ft.startswith('BOQ'):
        return 'boq'
    if ft.startswith('RENDER'):
        return 'renders'
    return None


def _free_deliverables_from_prices(deliverable_prices) -> set[str]:
    prices = deliverable_prices
    if prices is None:
        return set()
    if isinstance(prices, str):
        try:
            prices = json.loads(prices)
        except Exception:
            prices = None
    if not isinstance(prices, dict):
        return set()

    free: set[str] = set()
    for k, v in prices.items():
        if not isinstance(k, str):
            continue
        if v is None or v == '':
            continue
        try:
            if float(v) == 0.0:
                free.add(k)
        except Exception:
            continue
    return free


def _filter_files_by_selected_deliverables(files: list[dict], selected_deliverables, deliverable_prices=None) -> list[dict]:
    allowed = _normalize_selected_deliverables(selected_deliverables)
    if allowed is None:
        # Full plan purchase / admin / designer downloads
        return files

    # Option A: always include deliverables priced at 0 (free add-ons)
    allowed = set(allowed)
    allowed |= _free_deliverables_from_prices(deliverable_prices)

    if not allowed:
        return files

    filtered: list[dict] = []
    for f in files or []:
        key = _deliverable_key_for_file_type((f or {}).get('file_type'))
        if key is None:
            continue
        if key in allowed:
            filtered.append(f)
    return filtered


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


def fetch_user_contact(user_id: int | None, conn):
    if not user_id:
        return None

    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT first_name, last_name, username, email
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        )
        row = cur.fetchone()
        if not row:
            return None

        primary_email = (row.get('email') or '').strip()
        fallback_email = (row.get('username') or '').strip()

        return {
            "first_name": row.get('first_name'),
            "last_name": row.get('last_name'),
            "email": primary_email or fallback_email,
        }
    finally:
        cur.close()


def fetch_plan_bundle(plan_id: str, conn):
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT p.*, 
                   u.first_name AS designer_first_name,
                   u.last_name AS designer_last_name,
                   u.email AS designer_email,
                   u.username AS designer_username,
                   u.phone AS designer_phone
            FROM plans p
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE p.id = %s
            """,
            (plan_id,)
        )
        plan_row = cur.fetchone()
        if not plan_row:
            return None

        plan_dict = dict(plan_row)
        designer = {
            "id": plan_dict.get('designer_id'),
            "first_name": plan_dict.pop('designer_first_name', None),
            "last_name": plan_dict.pop('designer_last_name', None),
            "email": plan_dict.pop('designer_email', None),
            "username": plan_dict.pop('designer_username', None),
            "phone": plan_dict.pop('designer_phone', None),
        }

        cur.execute("SELECT * FROM boqs WHERE plan_id = %s ORDER BY created_at ASC", (plan_id,))
        boqs = [dict(row) for row in cur.fetchall()]

        cur.execute("SELECT * FROM structural_specs WHERE plan_id = %s ORDER BY created_at ASC", (plan_id,))
        structural_specs = [dict(row) for row in cur.fetchall()]

        cur.execute("SELECT * FROM compliance_notes WHERE plan_id = %s ORDER BY created_at ASC", (plan_id,))
        compliance_notes = [dict(row) for row in cur.fetchall()]

        cur.execute(
            """
            SELECT file_name, file_type, file_path, file_size, uploaded_at
            FROM plan_files
            WHERE plan_id = %s
            ORDER BY uploaded_at ASC
            """,
            (plan_id,)
        )
        files = [dict(row) for row in cur.fetchall()]

        return {
            "plan": plan_dict,
            "designer": designer,
            "boqs": boqs,
            "structural_specs": structural_specs,
            "compliance_notes": compliance_notes,
            "files": files,
        }
    finally:
        cur.close()


ARCHIVE_FOLDERS = {
    'ARCHITECTURAL': 'technical/architectural',
    'STRUCTURAL': 'technical/structural',
    'MEP_MECHANICAL': 'technical/mep/mechanical',
    'MEP_ELECTRICAL': 'technical/mep/electrical',
    'MEP_PLUMBING': 'technical/mep/plumbing',
    'CIVIL': 'technical/civil',
    'FIRE_SAFETY': 'technical/fire-safety',
    'INTERIOR': 'technical/interior',
    'RENDER': 'media/renders',
    'THUMBNAIL': 'media/thumbnail',
    'GALLERY': 'media/gallery',
    'BOQ_ARCHITECTURAL': 'boq/architectural',
    'BOQ_STRUCTURAL': 'boq/structural',
    'BOQ_MEP': 'boq/mep',
    'BOQ_COST_SUMMARY': 'boq/cost-summary',
}


def resolve_archive_path(plan_file: dict, default_folder: str = 'files') -> str:
    file_type = (plan_file.get('file_type') or '').upper()
    base_folder = ARCHIVE_FOLDERS.get(file_type)

    if not base_folder:
        if file_type in {'PDF', 'DWG', 'DXF', 'RVT', 'IFC', 'SKP', 'BLEND'}:
            base_folder = f"technical/{file_type.lower()}"
        else:
            base_folder = f"{default_folder}/{file_type.lower()}" if file_type else default_folder

    filename = plan_file.get('file_name')
    if not filename:
        path = plan_file.get('file_path') or ''
        filename = os.path.basename(path) or 'file'

    return f"{base_folder}/{filename}"


def build_manifest_pdf(bundle, organized_files, customer=None):
    raise RuntimeError('ReportLab manifest generation has been removed. Use build_manifest_pdf_html (WeasyPrint).')


def build_manifest_pdf_html(bundle, organized_files, customer=None):
    """Generate a premium manifest PDF using HTML+CSS (WeasyPrint)."""

    try:
        from weasyprint import HTML  # type: ignore
    except Exception:
        raise RuntimeError(
            "WeasyPrint is required for manifest generation but native libraries are missing. "
            "On Ubuntu, install: libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 shared-mime-info"
        )

    def format_value(value, default="N/A"):
        if value is None:
            return default
        if isinstance(value, (datetime, date)):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        if isinstance(value, bool):
            return 'Yes' if value else 'No'
        if value == '' or (isinstance(value, str) and not value.strip()):
            return default
        return str(value)

    def ensure_dict(value) -> dict:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {}

    def ensure_list(value) -> list:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, (tuple, set)):
            return list(value)
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict):
                    return [parsed]
                return [parsed]
            except Exception:
                return [value]
        return [value]

    def safe_float(value):
        try:
            return float(value)
        except Exception:
            return None

    def safe_int(value):
        try:
            return int(value)
        except Exception:
            return None

    def fmt_currency(value):
        n = safe_float(value)
        if n is None:
            return 'N/A'
        return f"{n:,.2f}"

    def fmt_compact(value):
        n = safe_float(value)
        if n is None:
            return format_value(value)
        if n >= 1_000_000:
            return f"{n/1_000_000:.1f}M"
        if n >= 1_000:
            return f"{n/1_000:.1f}k"
        return f"{n:,.0f}"

    def esc(s: str) -> str:
        return (
            str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
        )

    plan = (bundle or {}).get('plan') or {}
    designer = (bundle or {}).get('designer') or {}
    customer_info = customer or (bundle or {}).get('customer') or {}

    title = format_value(plan.get('name'), 'Plan Manifest')
    plan_id = format_value(plan.get('id'))
    generated_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

    customer_name = ' '.join(filter(None, [customer_info.get('first_name'), customer_info.get('last_name')])).strip() or customer_info.get('email') or 'Customer'
    designer_name = ' '.join(filter(None, [designer.get('first_name'), designer.get('last_name')])).strip() or designer.get('username') or 'Designer'

    files = organized_files or []

    tags = [str(x) for x in ensure_list(plan.get('tags')) if str(x).strip()]
    certifications = [str(x) for x in ensure_list(plan.get('certifications')) if str(x).strip()]
    special_features = [str(x) for x in ensure_list(plan.get('special_features')) if str(x).strip()]
    disciplines = ensure_dict(plan.get('disciplines_included'))

    disciplines_badges = []
    if disciplines.get('architectural'):
        disciplines_badges.append('Architectural')
    if disciplines.get('structural'):
        disciplines_badges.append('Structural')
    mep = disciplines.get('mep')
    if isinstance(mep, str):
        mep = ensure_dict(mep)
    if isinstance(mep, dict) and any(mep.get(k) for k in ['mechanical', 'electrical', 'plumbing']):
        disciplines_badges.append('MEP')
    if disciplines.get('civil'):
        disciplines_badges.append('Civil')
    if disciplines.get('fire_safety'):
        disciplines_badges.append('Fire safety')
    if disciplines.get('interior'):
        disciplines_badges.append('Interior')

    # If plan.image_url is remote, we can render it directly in WeasyPrint.
    cover_image_url = plan.get('image_url')
    if not (isinstance(cover_image_url, str) and re.match(r'^https?://', cover_image_url, re.IGNORECASE)):
        cover_image_url = None

    boqs = (bundle or {}).get('boqs') or []
    structural_specs = (bundle or {}).get('structural_specs') or []
    compliance_notes = (bundle or {}).get('compliance_notes') or []

    file_count = len(files)
    boq_count = len(boqs)
    spec_count = len(structural_specs)
    compliance_count = len(compliance_notes)

    css = """
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-center {
        content: "PLANCAVE · " counter(page) " / " counter(pages);
        color: #64748b;
        font-size: 9px;
      }
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #0f172a;
      font-size: 10.5pt;
      line-height: 1.35;
    }
    .cover {
      padding: 16px 16px 14px;
      border-radius: 18px;
      background: linear-gradient(135deg,#0f172a 0%, #0b3a3a 45%, #0f766e 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }
    .cover::after {
      content: "";
      position: absolute;
      inset: -80px -80px auto auto;
      width: 260px;
      height: 260px;
      border-radius: 999px;
      background: rgba(255,255,255,0.10);
      filter: blur(1px);
    }
    .brand { letter-spacing: .34em; font-size: 10px; text-transform: uppercase; opacity: .92; }
    .title { font-size: 28px; font-weight: 800; margin: 8px 0 6px; }
    .meta { font-size: 12px; opacity: .92; }
    .cover-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 12px; margin-top: 12px; }
    .cover-card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.10); padding: 10px 12px; }
    .cover-card h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; opacity: .9; }
    .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); margin: 2px 6px 2px 0; font-size: 10px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
    .kpi { border-radius: 14px; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.10); padding: 10px 10px; }
    .kpi .label { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; opacity: .9; }
    .kpi .value { font-size: 18px; font-weight: 800; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .card { border-radius: 14px; border: 1px solid #e2e8f0; padding: 12px; background: #ffffff; }
    .card h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #0f766e; }
    .kv { width: 100%; border-collapse: collapse; }
    .kv td { padding: 5px 0; vertical-align: top; }
    .kv td:first-child { color: #475569; width: 42%; }
    .kv td:last-child { font-weight: 600; }
    .section { margin-top: 14px; }
    .section h2 { font-size: 13px; margin: 0 0 8px; letter-spacing: .12em; text-transform: uppercase; }
    .muted { color: #475569; }
    .small { font-size: 9.5px; }
    .pill { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #ecfeff; border: 1px solid #99f6e4; color: #0f766e; font-size: 9.5px; margin: 2px 6px 2px 0; }
    .pill.gray { background: #f1f5f9; border-color: #e2e8f0; color: #0f172a; }
    .table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .table th { background: #f1f5f9; padding: 9px; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; text-align: left; }
    .table td { padding: 9px; border-top: 1px solid #e2e8f0; }
    .table tr:nth-child(even) td { background: #fbfdff; }
    .right { text-align: right; }
    .page-break { break-before: page; }
    .cover-image {
      width: 100%;
      height: 120px;
      border-radius: 16px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.22);
    }
    .footer { margin-top: 12px; font-size: 9px; color: #64748b; text-align: center; }
    """

    file_rows = "".join(
        f"<tr><td><span class='pill'>{esc(f.get('file_type') or '')}</span></td><td>{esc(f.get('file_name') or os.path.basename(f.get('file_path') or '') or '')}</td><td class='small muted'>{esc(f.get('archive_path') or '')}</td></tr>"
        for f in files
    )

    boq_rows = "".join(
        f"<tr><td>{esc(format_value(b.get('item_name'), 'Item'))}</td><td class='right'>{esc(format_value(b.get('quantity'), ''))}</td><td>{esc(format_value(b.get('unit'), ''))}</td><td class='right'>{esc(fmt_currency(b.get('unit_cost')))}</td><td class='right'>{esc(fmt_currency(b.get('total_cost')))}</td></tr>"
        for b in boqs[:18]
    )

    spec_rows = "".join(
        f"<tr><td>{esc(format_value(s.get('spec_type'), 'Spec'))}</td><td>{esc(format_value(s.get('specification'), ''))}</td><td>{esc(format_value(s.get('standard'), ''))}</td></tr>"
        for s in structural_specs[:18]
    )

    compliance_rows = "".join(
        f"<tr><td>{esc(format_value(n.get('authority'), 'Authority'))}</td><td>{esc(format_value(n.get('requirement'), ''))}</td><td>{esc(format_value(n.get('status'), ''))}</td><td>{esc(format_value(n.get('notes'), ''))}</td></tr>"
        for n in compliance_notes[:18]
    )

    badges_html = "".join(f"<span class='pill'>{esc(x)}</span>" for x in disciplines_badges)
    tags_html = "".join(f"<span class='pill gray'>{esc(x)}</span>" for x in tags[:10])
    certs_html = "".join(f"<span class='pill'>{esc(x)}</span>" for x in certifications[:10])
    features_html = "".join(f"<span class='pill gray'>{esc(x)}</span>" for x in special_features[:12])

    html = f"""
    <html>
      <head>
        <meta charset='utf-8' />
        <style>{css}</style>
      </head>
      <body>
        <div class='cover'>
          <div class='brand'>RAMANICAVE</div>
          <div class='title'>{esc(title)}</div>
          <div class='meta'>Plan ID: {esc(plan_id)} • Generated: {esc(generated_at)}</div>

          <div class='kpis'>
            <div class='kpi'><div class='label'>Files</div><div class='value'>{esc(file_count)}</div></div>
            <div class='kpi'><div class='label'>BOQ items</div><div class='value'>{esc(boq_count)}</div></div>
            <div class='kpi'><div class='label'>Specs</div><div class='value'>{esc(spec_count)}</div></div>
            <div class='kpi'><div class='label'>Compliance</div><div class='value'>{esc(compliance_count)}</div></div>
          </div>

          <div class='cover-grid'>
            <div class='cover-card'>
              <h3>Package snapshot</h3>
              <div>
                {badges_html if badges_html else "<span class='chip'>General</span>"}
              </div>
              <div style='margin-top:8px; font-size: 11px; opacity:.92;'>
                {esc(format_value(plan.get('category')))} • {esc(format_value(plan.get('project_type')))} • {esc(format_value(plan.get('package_level')))}
              </div>
            </div>
            <div class='cover-card'>
              <h3>Pricing</h3>
              <div style='font-size: 18px; font-weight: 800;'>$ {esc(fmt_compact(plan.get('price')))}</div>
              <div style='font-size: 11px; opacity:.9;'>License: {esc(format_value(plan.get('license_type')))}</div>
            </div>
          </div>

          {f"<div style='margin-top:12px;'><img class='cover-image' src='{esc(cover_image_url)}' /></div>" if cover_image_url else ""}
        </div>

        <div class='grid'>
          <div class='card'>
            <h3>Delivered to</h3>
            <table class='kv'>
              <tr><td>Name</td><td>{esc(customer_name)}</td></tr>
              <tr><td>Email</td><td>{esc(format_value(customer_info.get('email')))}</td></tr>
            </table>
          </div>
          <div class='card'>
            <h3>Designer</h3>
            <table class='kv'>
              <tr><td>Name</td><td>{esc(designer_name)}</td></tr>
              <tr><td>Email</td><td>{esc(format_value(designer.get('email') or designer.get('username')))}</td></tr>
              <tr><td>Phone</td><td>{esc(format_value(designer.get('phone')))}</td></tr>
            </table>
          </div>
        </div>

        <div class='section'>
          <h2>Tags, certifications & highlights</h2>
          <div class='card'>
            <div class='muted small'>Tags</div>
            <div style='margin-top:6px;'>{tags_html if tags_html else "<span class='muted small'>N/A</span>"}</div>
            <div style='margin-top:10px;' class='muted small'>Certifications</div>
            <div style='margin-top:6px;'>{certs_html if certs_html else "<span class='muted small'>N/A</span>"}</div>
            <div style='margin-top:10px;' class='muted small'>Special features</div>
            <div style='margin-top:6px;'>{features_html if features_html else "<span class='muted small'>N/A</span>"}</div>
          </div>
        </div>

        <div class='section'>
          <h2>Plan overview</h2>
          <div class='card'>
            <table class='kv'>
              <tr><td>Category</td><td>{esc(format_value(plan.get('category')))}</td></tr>
              <tr><td>Project type</td><td>{esc(format_value(plan.get('project_type')))}</td></tr>
              <tr><td>Package level</td><td>{esc(format_value(plan.get('package_level')))}</td></tr>
              <tr><td>License type</td><td>{esc(format_value(plan.get('license_type')))}</td></tr>
              <tr><td>Building code</td><td>{esc(format_value(plan.get('building_code')))}</td></tr>
              <tr><td>Includes BOQ</td><td>{esc(format_value(plan.get('includes_boq')))}</td></tr>
              <tr><td>Area</td><td>{esc(format_value(plan.get('area')))}</td></tr>
              <tr><td>Bedrooms</td><td>{esc(format_value(plan.get('bedrooms')))}</td></tr>
              <tr><td>Bathrooms</td><td>{esc(format_value(plan.get('bathrooms')))}</td></tr>
              <tr><td>Floors</td><td>{esc(format_value(plan.get('floors')))}</td></tr>
              <tr><td>Estimated cost</td><td>$ {esc(fmt_compact(plan.get('estimated_cost_min')))} – $ {esc(fmt_compact(plan.get('estimated_cost_max')))}</td></tr>
            </table>
          </div>
        </div>

        <div class='section'>
          <h2>Description & execution notes</h2>
          <div class='card'>
            <div class='muted small'>Description</div>
            <div style='margin-top:6px;'>{esc(format_value(plan.get('description'), 'N/A'))}</div>
            <div style='margin-top:10px;' class='muted small'>Materials</div>
            <div style='margin-top:6px;'>{esc(format_value(plan.get('material_specifications'), 'N/A'))}</div>
            <div style='margin-top:10px;' class='muted small'>Construction notes</div>
            <div style='margin-top:6px;'>{esc(format_value(plan.get('construction_notes'), 'N/A'))}</div>
          </div>
        </div>

        <div class='page-break'></div>

        <div class='section'>
          <h2>Files & deliverables (full inventory)</h2>
          <div class='card'>
            {'<div class="muted">No files found.</div>' if not files else ''}
            {'<table class="table"><thead><tr><th>Type</th><th>File</th><th>Archive path</th></tr></thead><tbody>' + file_rows + '</tbody></table>' if files else ''}
          </div>
        </div>

        <div class='section'>
          <h2>BOQ summary (top items)</h2>
          <div class='card'>
            {'<div class="muted">No BOQ entries.</div>' if not boqs else ''}
            {'<table class="table"><thead><tr><th>Item</th><th class="right">Qty</th><th>Unit</th><th class="right">Unit cost</th><th class="right">Total</th></tr></thead><tbody>' + boq_rows + '</tbody></table>' if boqs else ''}
            {f"<div class='muted small' style='margin-top:8px;'>Showing first 18 of {esc(boq_count)} items.</div>" if boq_count > 18 else ""}
          </div>
        </div>

        <div class='section'>
          <h2>Structural specifications (summary)</h2>
          <div class='card'>
            {'<div class="muted">No structural specs.</div>' if not structural_specs else ''}
            {'<table class="table"><thead><tr><th>Type</th><th>Specification</th><th>Standard</th></tr></thead><tbody>' + spec_rows + '</tbody></table>' if structural_specs else ''}
            {f"<div class='muted small' style='margin-top:8px;'>Showing first 18 of {esc(spec_count)} specs.</div>" if spec_count > 18 else ""}
          </div>
        </div>

        <div class='section'>
          <h2>Compliance notes (summary)</h2>
          <div class='card'>
            {'<div class="muted">No compliance notes.</div>' if not compliance_notes else ''}
            {'<table class="table"><thead><tr><th>Authority</th><th>Requirement</th><th>Status</th><th>Notes</th></tr></thead><tbody>' + compliance_rows + '</tbody></table>' if compliance_notes else ''}
            {f"<div class='muted small' style='margin-top:8px;'>Showing first 18 of {esc(compliance_count)} notes.</div>" if compliance_count > 18 else ""}
          </div>
        </div>

        <div class='footer'>RAMANICAVE • Confidential technical package • Auto-generated manifest</div>
      </body>
    </html>
    """

    try:
        html_obj = HTML(string=html)
        pdf_bytes = html_obj.write_pdf()
        return io.BytesIO(pdf_bytes)
    except Exception as e:
        raise RuntimeError(f"Failed to generate PDF: {str(e)}")


def build_plan_zip(bundle, customer=None, selected_deliverables=None):
    zip_buffer = io.BytesIO()
    files_added = 0

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        organized_files = []
        deliverable_prices = (bundle.get('plan') or {}).get('deliverable_prices')
        files_to_package = _filter_files_by_selected_deliverables(
            bundle.get('files') or [],
            selected_deliverables,
            deliverable_prices=deliverable_prices,
        )
        for plan_file in files_to_package:
            resolved_path = resolve_plan_file_path(plan_file.get('file_path'))
            archive_path = resolve_archive_path(plan_file)

            if resolved_path and os.path.exists(resolved_path):
                zip_file.write(resolved_path, archive_path)
                organized_entry = dict(plan_file)
                organized_entry['archive_path'] = archive_path
                organized_files.append(organized_entry)
                files_added += 1
                continue

            file_url = plan_file.get('file_path')
            if isinstance(file_url, str) and re.match(r'^https?://', file_url, re.IGNORECASE):
                try:
                    resp = requests.get(file_url, timeout=15)
                    if resp.status_code != 200:
                        continue
                    zip_file.writestr(archive_path, resp.content)
                    organized_entry = dict(plan_file)
                    organized_entry['archive_path'] = archive_path
                    organized_files.append(organized_entry)
                    files_added += 1
                except Exception:
                    continue
                continue

            continue

        manifest_pdf = build_manifest_pdf_html(bundle, organized_files, customer=customer)
        safe_plan_name = re.sub(r"[^A-Za-z0-9]+", "-", (bundle['plan'].get('name') or 'plan')).strip('-') or 'plan'
        zip_file.writestr(f"plan-details/{safe_plan_name}-manifest.pdf", manifest_pdf.getvalue())

    zip_buffer.seek(0)
    download_name = f"{bundle['plan'].get('name') or 'plan'}-technical-files.zip"
    return zip_buffer, download_name, files_added
