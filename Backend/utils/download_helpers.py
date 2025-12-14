import os
import io
import json
import zipfile
import uuid
from datetime import datetime, date
from decimal import Decimal
from psycopg.rows import dict_row


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

        manifest = {
            "plan": bundle['plan'],
            "designer": bundle['designer'],
            "boqs": bundle['boqs'],
            "structural_specs": bundle['structural_specs'],
            "compliance_notes": bundle['compliance_notes'],
            "files": organized_files,
        }
        zip_file.writestr('plan_manifest.json', json.dumps(manifest, default=json_default, indent=2))

    zip_buffer.seek(0)
    download_name = f"{bundle['plan'].get('name') or 'plan'}-technical-files.zip"
    return zip_buffer, download_name, files_added
