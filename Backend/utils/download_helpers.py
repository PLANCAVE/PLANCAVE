import os
import io
import json
import zipfile
import uuid
import re
import textwrap
from datetime import datetime, date
from decimal import Decimal
from psycopg.rows import dict_row
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics


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
            SELECT first_name, last_name, username AS email
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "first_name": row.get('first_name'),
            "last_name": row.get('last_name'),
            "email": row.get('email'),
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
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER
    margin = 72  # 1 inch
    header_height = 120

    def new_text_object():
        text_obj = c.beginText()
        text_obj.setTextOrigin(margin, height - margin)
        text_obj.setLeading(16)
        return text_obj

    text = new_text_object()

    def ensure_space(lines_needed: int = 1):
        nonlocal text
        if text.getY() - (lines_needed * 14) < margin:
            c.drawText(text)
            c.showPage()
            text = new_text_object()

    def format_value(value, default="N/A"):
        if value is None:
            return default
        if isinstance(value, (list, tuple, set)):
            cleaned = [str(v) for v in value if v not in (None, '', [])]
            return ', '.join(cleaned) if cleaned else default
        if isinstance(value, (datetime, date)):
            return value.strftime('%Y-%m-%d')
        if isinstance(value, bool):
            return 'Yes' if value else 'No'
        if value == '' or (isinstance(value, str) and not value.strip()):
            return default
        return str(value)

    def format_currency(value):
        if value in (None, ''):
            return 'N/A'
        try:
            return f"KSH {float(value):,.2f}"
        except (ValueError, TypeError):
            return str(value)

    def write_section(title: str, items: list[str], accent: str = '#0f766e'):
        ensure_space(len(items) + 3)
        text.setFillColor(colors.HexColor(accent))
        text.setFont("Times-Bold", 13)
        text.textLine(title.upper())
        text.setFillColor(colors.black)
        text.setFont("Times-Roman", 11)
        wrapper = textwrap.TextWrapper(width=90)
        for item in items:
            for wrapped_line in wrapper.wrap(item):
                ensure_space()
                text.textLine(f"• {wrapped_line}")
        text.textLine("")

    def write_paragraph(title: str, body: str, accent: str = '#0f766e'):
        ensure_space(4)
        text.setFillColor(colors.HexColor(accent))
        text.setFont("Times-Bold", 13)
        text.textLine(title.upper())
        text.setFillColor(colors.black)
        text.setFont("Times-Roman", 11)
        wrapper = textwrap.TextWrapper(width=95)
        for wrapped_line in wrapper.wrap(body or 'N/A'):
            ensure_space()
            text.textLine(wrapped_line)
        text.textLine("")

    def ensure_list(value) -> list[str]:
        if value in (None, '', [], ()):  # noqa: E711
            return []
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict):
                    return [f"{k}: {format_value(v)}" for k, v in parsed.items()]
                return [str(parsed)]
            except Exception:
                return [value]
        if isinstance(value, dict):
            return [f"{k}: {format_value(v)}" for k, v in value.items()]
        if isinstance(value, (list, tuple, set)):
            return [format_value(v) for v in value]
        return [str(value)]

    def draw_logo_banner():
        start_color = colors.HexColor('#0f2a2a')
        end_color = colors.HexColor('#1d5c5a')
        steps = 80
        for i in range(steps):
            ratio = i / (steps - 1)
            blended = colors.Color(
                start_color.red + (end_color.red - start_color.red) * ratio,
                start_color.green + (end_color.green - start_color.green) * ratio,
                start_color.blue + (end_color.blue - start_color.blue) * ratio,
            )
            y = (height - header_height) + (i * (header_height / steps))
            c.setFillColor(blended)
            c.rect(0, y, width, (header_height / steps) + 1, stroke=0, fill=1)

        c.setFillColor(colors.HexColor('#0a1e1e'))
        c.rect(0, height - header_height, width, 2, stroke=0, fill=1)
        c.setFillColor(colors.HexColor('#27b3a5'))
        c.rect(0, height - 2, width, 2, stroke=0, fill=1)

        logo_color = colors.HexColor('#c0f5e7')
        accent_y = height - header_height / 2 + 12
        c.setStrokeColor(logo_color)
        c.setLineWidth(1.2)
        line_length = 60
        gap = 12
        c.line(width / 2 - line_length - gap, accent_y, width / 2 - gap, accent_y)
        c.line(width / 2 + gap, accent_y, width / 2 + line_length + gap, accent_y)

        c.setFillColor(logo_color)
        c.setFont('Helvetica', 10)
        c.drawCentredString(width / 2, accent_y + 6, 'THE')

        tracking = 6
        title_font = 'Times-Bold'
        title_size = 32
        base_width = pdfmetrics.stringWidth('RAMANICAVE', title_font, title_size)
        total_width = base_width + tracking * (len('RAMANICAVE') - 1)
        start_x = (width - total_width) / 2
        text_obj = c.beginText()
        text_obj.setTextOrigin(start_x, height - header_height + 28)
        text_obj.setFont(title_font, title_size)
        text_obj.setCharSpace(tracking)
        text_obj.setFillColor(logo_color)
        text_obj.textLine('RAMANICAVE')
        c.drawText(text_obj)

        underline_y = height - header_height + 20
        c.setLineWidth(1)
        c.line(start_x, underline_y, start_x + 50, underline_y)
        c.line(start_x + total_width - 50, underline_y, start_x + total_width, underline_y)

    plan = bundle['plan']
    designer = bundle['designer']
    customer_info = customer or bundle.get('customer') or {}
    plan_name = plan.get('name') or 'Plan Manifest'

    draw_logo_banner()
    text.setTextOrigin(margin, height - margin - header_height + 36)
    text.setFont('Times-Bold', 18)
    text.textLine(plan_name)
    text.setFont('Times-Roman', 12)
    generated_line = f"Plan ID: {plan.get('id', 'N/A')}  |  Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    text.textLine(generated_line)
    text.textLine("")

    if customer_info:
        full_name = ' '.join(filter(None, [customer_info.get('first_name'), customer_info.get('last_name')])).strip() or customer_info.get('email') or 'Esteemed Customer'
        honorific = 'Mr/Mrs '
        write_section('Delivered to', [f"{honorific}{full_name}", f"Email: {customer_info.get('email', 'N/A')}"])

    tags_list = ensure_list(plan.get('tags'))
    overview_pairs = [
        ("Status", plan.get('status')),
        ("Category", plan.get('category')),
        ("Project type", plan.get('project_type')),
        ("Target audience", plan.get('target_audience')),
        ("Package level", plan.get('package_level')),
        ("Includes BOQ", plan.get('includes_boq')),
        ("License type", plan.get('license_type')),
        ("Customization available", plan.get('customization_available')),
        ("Support duration (months)", plan.get('support_duration')),
        ("Design code", plan.get('design_code')),
        ("Building code", plan.get('building_code')),
        ("Primary image", plan.get('image_url')),
        ("Tags", ', '.join(tags_list) if tags_list else 'N/A'),
        ("Created", plan.get('created_at')),
        ("Updated", plan.get('updated_at')),
    ]
    overview_lines = [f"{label}: {format_value(value)}" for label, value in overview_pairs]
    write_section("Plan Overview", overview_lines)

    layout_lines = [
        f"Price: {format_currency(plan.get('price'))}",
        f"Estimated Cost Range: {format_currency(plan.get('estimated_cost_min'))} - {format_currency(plan.get('estimated_cost_max'))}",
        f"Area: {format_value(plan.get('area'))} m²" if plan.get('area') else "Area: N/A",
        f"Plot Size: {format_value(plan.get('plot_size'))}",
        f"Bedrooms: {format_value(plan.get('bedrooms'))}",
        f"Bathrooms: {format_value(plan.get('bathrooms'))}",
        f"Floors: {format_value(plan.get('floors'))}",
        f"Building Height: {format_value(plan.get('building_height'))}",
        f"Parking Spaces: {format_value(plan.get('parking_spaces'))}",
    ]
    write_section("Dimensions & Layout", layout_lines)

    special_features = ensure_list(plan.get('special_features'))
    write_section(
        "Special Features & Amenities",
        special_features if special_features else ["N/A"]
    )

    certifications = ensure_list(plan.get('certifications'))
    compliance_lines = [
        f"Building code: {format_value(plan.get('building_code'))}",
    ]
    if certifications:
        compliance_lines.extend([f"Certification: {item}" for item in certifications])
    else:
        compliance_lines.append("Certification: N/A")
    write_section("Compliance & Certifications", compliance_lines)

    write_paragraph("Plan Description", plan.get('description') or 'N/A')
    write_paragraph("Project Timeline", plan.get('project_timeline_ref') or 'N/A')
    write_paragraph("Material Specifications", plan.get('material_specifications') or 'N/A')
    write_paragraph("Construction Notes", plan.get('construction_notes') or 'N/A')

    designer_name = ' '.join(filter(None, [designer.get('first_name'), designer.get('last_name')])).strip()
    designer_email = designer.get('email') or designer.get('username') or 'Not provided'
    designer_lines = [
        f"Designer: {designer_name or 'N/A'}",
        f"Email: {designer_email if designer_email else 'N/A'}",
        f"Phone: {format_value(designer.get('phone'))}",
    ]
    write_section("Designer", designer_lines)

    technical_summary = [
        f"Bill of Quantities entries: {len(bundle['boqs'])}",
        f"Structural specifications: {len(bundle['structural_specs'])}",
        f"Compliance notes: {len(bundle['compliance_notes'])}",
        f"Attached files: {len(organized_files)}",
    ]
    write_section("Technical Components", technical_summary)

    def summarize_collection(title: str, records: list[dict], formatter, limit: int = 12):
        if not records:
            write_section(title, ["N/A"])
            return
        lines = []
        for record in records[:limit]:
            lines.append(formatter(record))
        remaining = len(records) - limit
        if remaining > 0:
            lines.append(f"…and {remaining} more entries")
        write_section(title, lines)

    summarize_collection(
        "Bill of Quantities",
        bundle['boqs'],
        lambda boq: f"{format_value(boq.get('item_name'), 'Item')} · Qty: {format_value(boq.get('quantity'))} {format_value(boq.get('unit'), '')} · Unit cost: {format_currency(boq.get('unit_cost'))} · Total: {format_currency(boq.get('total_cost'))}"
    )

    summarize_collection(
        "Structural Specifications",
        bundle['structural_specs'],
        lambda spec: f"{format_value(spec.get('spec_type'), 'Spec')} – {format_value(spec.get('specification'))} (Standard: {format_value(spec.get('standard'))})"
    )

    summarize_collection(
        "Compliance Notes",
        bundle['compliance_notes'],
        lambda note: f"{format_value(note.get('authority'), 'Authority')} · Requirement: {format_value(note.get('requirement'))} · Status: {format_value(note.get('status'), 'N/A')} · Notes: {format_value(note.get('notes'))}"
    )

    discipline_badges = []
    disciplines = plan.get('disciplines_included') or {}
    if isinstance(disciplines, str):
        try:
            disciplines = json.loads(disciplines)
        except Exception:
            disciplines = {}

    if disciplines:
        if disciplines.get('architectural'):
            discipline_badges.append('Architectural set included')
        if disciplines.get('structural'):
            discipline_badges.append('Structural engineering package')
        mep = disciplines.get('mep') or {}
        if any(mep.get(k) for k in ['mechanical', 'electrical', 'plumbing']):
            discipline_badges.append('MEP coordination models')
        if disciplines.get('civil'):
            discipline_badges.append('Civil works documentation')
        if disciplines.get('fire_safety'):
            discipline_badges.append('Fire & life safety compliance')
        if disciplines.get('interior'):
            discipline_badges.append('Interior fit-out package')
        write_section("Disciplines Included", discipline_badges)
    else:
        write_section("Disciplines Included", ["N/A"])

    file_paths = plan.get('file_paths')
    if isinstance(file_paths, str):
        try:
            file_paths = json.loads(file_paths)
        except Exception:
            file_paths = {}
    if not isinstance(file_paths, dict):
        file_paths = {}

    media_lines = []
    for key, value in file_paths.items():
        if isinstance(value, list):
            media_lines.append(f"{key.replace('_', ' ').title()}: {len(value)} asset(s)")
        else:
            media_lines.append(f"{key.replace('_', ' ').title()}: {format_value(value)}")
    if plan.get('image_url'):
        media_lines.insert(0, f"Primary image path: {plan.get('image_url')}")
    write_section("Media & Asset Inventory", media_lines or ["N/A"])

    file_lines = []
    for f in organized_files:
        descriptor = f.get('file_type') or 'FILE'
        display_name = f.get('file_name') or os.path.basename(f.get('file_path') or '') or 'Unnamed file'
        archive_path = f.get('archive_path', f.get('file_path', ''))
        line = f"{descriptor} · {display_name} (stored at {archive_path})"
        file_lines.append(line)

    if file_lines:
        write_section("Files & Deliverables", file_lines)

    c.drawText(text)
    c.setFont('Times-Italic', 10)
    c.setFillColor(colors.HexColor('#4b5563'))
    c.drawCentredString(width / 2, 40, 'Ramanicave · Confidential technical package · Auto-generated manifest')
    c.save()
    buffer.seek(0)
    return buffer


def build_plan_zip(bundle, customer=None):
    zip_buffer = io.BytesIO()
    files_added = 0

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        organized_files = []
        for plan_file in bundle['files']:
            resolved_path = resolve_plan_file_path(plan_file.get('file_path'))
            if not resolved_path or not os.path.exists(resolved_path):
                continue

            archive_path = resolve_archive_path(plan_file)
            zip_file.write(resolved_path, archive_path)
            organized_entry = dict(plan_file)
            organized_entry['archive_path'] = archive_path
            organized_files.append(organized_entry)
            files_added += 1

        manifest_pdf = build_manifest_pdf(bundle, organized_files, customer=customer)
        safe_plan_name = re.sub(r"[^A-Za-z0-9]+", "-", (bundle['plan'].get('name') or 'plan')).strip('-') or 'plan'
        zip_file.writestr(f"plan-details/{safe_plan_name}-manifest.pdf", manifest_pdf.getvalue())

    zip_buffer.seek(0)
    download_name = f"{bundle['plan'].get('name') or 'plan'}-technical-files.zip"
    return zip_buffer, download_name, files_added
