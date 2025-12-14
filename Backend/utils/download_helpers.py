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


def resolve_plan_file_path(file_path: str) -> str | None:
    """Resolve stored relative file paths to absolute disk locations."""
    if not file_path:
        return None

    if os.path.isabs(file_path) and os.path.exists(file_path):
        return file_path

    normalized = file_path.lstrip('/')
    candidate_paths = [file_path, normalized, os.path.join('uploads', normalized)]

    for candidate in candidate_paths:
        absolute_candidate = candidate if os.path.isabs(candidate) else os.path.join(os.getcwd(), candidate)
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


def fetch_plan_bundle(plan_id: str, conn):
    cur = conn.cursor(row_factory=dict_row)
    try:
        cur.execute(
            """
            SELECT p.*, 
                   u.first_name AS designer_first_name,
                   u.last_name AS designer_last_name,
                   u.email AS designer_email,
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


def build_manifest_pdf(bundle, organized_files):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER
    margin = 72  # 1 inch

    def new_text_object():
        text_obj = c.beginText()
        text_obj.setTextOrigin(margin, height - margin)
        text_obj.setLeading(14)
        return text_obj

    text = new_text_object()

    def ensure_space(lines_needed: int = 1):
        nonlocal text
        if text.getY() - (lines_needed * 14) < margin:
            c.drawText(text)
            c.showPage()
            text = new_text_object()

    def write_heading(title: str):
        ensure_space(2)
        text.setFont("Helvetica-Bold", 16)
        text.textLine(title)
        text.setFont("Helvetica", 11)

    def write_section(title: str, items: list[str]):
        ensure_space(len(items) + 2)
        text.setFont("Helvetica-Bold", 12)
        text.textLine(title)
        text.setFont("Helvetica", 10)
        wrapper = textwrap.TextWrapper(width=80)
        for item in items:
            for wrapped_line in wrapper.wrap(item):
                ensure_space()
                text.textLine(f"• {wrapped_line}")
        text.textLine("")

    plan = bundle['plan']
    designer = bundle['designer']
    customer = bundle.get('customer') or {}
    plan_name = plan.get('name') or 'Plan Manifest'

    # Header branding block
    c.setFillColor(colors.HexColor('#0f2a2a'))
    c.rect(0, height - 80, width, 80, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#9fe1d5'))
    c.setFont('Helvetica', 10)
    c.drawCentredString(width / 2, height - 35, 'THE')
    c.setFont('Helvetica-Bold', 28)
    c.drawCentredString(width / 2, height - 55, 'PLANCAVE')
    c.setFont('Helvetica-Bold', 16)
    c.setFillColor(colors.black)
    text.setFont('Helvetica-Bold', 16)
    text.textLine(plan_name)
    text.setFont('Helvetica', 11)
    text.textLine(f"Plan ID: {plan.get('id', 'N/A')}  |  Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    text.textLine("")

    if customer:
        full_name = ' '.join(filter(None, [customer.get('first_name'), customer.get('last_name')])).strip() or customer.get('email') or 'Esteemed Customer'
        honorific = 'Mr/Mrs '
        write_section('Delivered to', [f"{honorific}{full_name}", f"Email: {customer.get('email', 'N/A')}"])

    overview_lines = [
        f"Category: {plan.get('category') or 'N/A'}",
        f"Project type: {plan.get('project_type') or 'N/A'}",
        f"Package level: {plan.get('package_level') or 'N/A'}",
        f"Price: KSH {plan.get('price'):,}" if plan.get('price') else "Price: Not specified",
        f"Area: {plan.get('area')} m²" if plan.get('area') else "Area: Not specified",
        f"Bedrooms: {plan.get('bedrooms') or 'N/A'}  |  Bathrooms: {plan.get('bathrooms') or 'N/A'}  |  Floors: {plan.get('floors') or 'N/A'}",
        f"License: {plan.get('license_type') or 'N/A'}  |  Customization: {'Available' if plan.get('customization_available') else 'Not available'}",
    ]
    if plan.get('estimated_cost_min') and plan.get('estimated_cost_max'):
        overview_lines.append(
            f"Estimated build cost: KSH {plan['estimated_cost_min']:,} - {plan['estimated_cost_max']:,}"
        )
    write_section("Plan Overview", overview_lines)

    designer_lines = [
        f"Designer: {designer.get('first_name') or ''} {designer.get('last_name') or ''}".strip() or "Designer: N/A",
        f"Email: {designer.get('email') or 'N/A'}",
        f"Phone: {designer.get('phone') or 'N/A'}",
    ]
    write_section("Designer", designer_lines)

    # Compliance sections summary
    write_section(
        "Technical Components",
        [
            f"Bill of Quantities entries: {len(bundle['boqs'])}",
            f"Structural specifications: {len(bundle['structural_specs'])}",
            f"Compliance notes: {len(bundle['compliance_notes'])}",
        ]
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
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(colors.HexColor('#4b5563'))
    c.drawCentredString(width / 2, 40, 'PlanCave · Confidential technical package · Auto-generated manifest')
    c.save()
    buffer.seek(0)
    return buffer


def build_plan_zip(bundle):
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

        manifest_pdf = build_manifest_pdf(bundle, organized_files)
        safe_plan_name = re.sub(r"[^A-Za-z0-9]+", "-", (bundle['plan'].get('name') or 'plan')).strip('-') or 'plan'
        zip_file.writestr(f"manifest/{safe_plan_name}-manifest.pdf", manifest_pdf.getvalue())

    zip_buffer.seek(0)
    download_name = f"{bundle['plan'].get('name') or 'plan'}-technical-files.zip"
    return zip_buffer, download_name, files_added
