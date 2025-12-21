from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
import os
import uuid
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import json
import math
from utils.cloudinary_config import upload_to_cloudinary

plans_bp = Blueprint('plans', __name__, url_prefix='/plans')

# Upload directory for local storage (fallback if GCS not configured)
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, '..', '..'))
UPLOAD_FOLDER = os.path.join(_PROJECT_ROOT, 'uploads', 'plans')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Technical plan files commonly come in multiple CAD/BIM formats.
# Keep this list permissive so discipline uploads (civil/fire/etc.) don't fail unexpectedly.
ALLOWED_EXTENSIONS_PLANS = {'pdf', 'dwg', 'dxf', 'rvt', 'ifc', 'skp', 'zip'}
ALLOWED_EXTENSIONS_BOQ = {'xlsx', 'xls', 'pdf'}
ALLOWED_EXTENSIONS_IMAGES = {'jpg', 'jpeg', 'png'}

def get_current_user():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    role = claims.get('role')
    return user_id, role

def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])

def allowed_file(filename, allowed_set):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_set

def safe_float(value, default=None):
    """Safely convert string to float, handling empty strings"""
    if not value or str(value).strip() == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=None):
    """Safely convert string to int, handling empty strings"""
    if not value or str(value).strip() == '':
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def save_file_locally(file, plan_id, category, filename):
    """Save file to local storage organized by discipline"""
    safe_filename = secure_filename(filename)
    unique_name = f"{uuid.uuid4()}_{safe_filename}"
    
    dir_path = os.path.join(UPLOAD_FOLDER, plan_id, category)
    os.makedirs(dir_path, exist_ok=True)
    
    file_path = os.path.join(dir_path, unique_name)
    file.save(file_path)
    
    return f"/uploads/plans/{plan_id}/{category}/{unique_name}"


def resolve_upload_absolute_path(relative_path: str) -> str:
    if not relative_path:
        return ''
    if relative_path.startswith('http://') or relative_path.startswith('https://'):
        return ''
    relative = relative_path.lstrip('/')
    return os.path.join(_PROJECT_ROOT, relative)


def add_plan_file_record(records, file_type: str, relative_path: str, original_name: str | None = None):
    if not relative_path:
        return

    absolute_path = resolve_upload_absolute_path(relative_path)
    file_size = os.path.getsize(absolute_path) if absolute_path and os.path.exists(absolute_path) else None
    file_name = secure_filename(original_name) if original_name else os.path.basename(relative_path)

    records.append({
        'file_name': file_name,
        'file_type': file_type,
        'file_path': relative_path,
        'file_size': file_size
    })


@plans_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_plan():
    """
    Comprehensive Professional Construction Plan Upload
    Handles all disciplines, BOQ, compliance, and multi-file uploads
    """
    user_id, role = get_current_user()
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Admins and Designers only"), 403

    form = request.form
    files = request.files

    # Validate required fields
    required_fields = ['name', 'category', 'project_type', 'description', 'price', 'area', 'floors', 'package_level']
    for field in required_fields:
        if field not in form or str(form[field]).strip() == '':
            return jsonify(message=f"Missing or empty required field: {field}"), 400

    # Validate numeric fields
    try:
        price = float(form['price'])
        if price <= 0:
            return jsonify(message="Price must be a positive number"), 400
    except (ValueError, TypeError):
        return jsonify(message="Invalid price format"), 400

    try:
        area = float(form['area'])
        if area <= 0:
            return jsonify(message="Area must be a positive number"), 400
    except (ValueError, TypeError):
        return jsonify(message="Invalid area format"), 400

    try:
        floors = int(form['floors'])
        if floors <= 0:
            return jsonify(message="Floors must be a positive integer"), 400
    except (ValueError, TypeError):
        return jsonify(message="Invalid floors format"), 400

    # Validate thumbnail
    if 'thumbnail' not in files:
        return jsonify(message="Thumbnail image is required"), 400

    # Enforce mandatory deliverables
    if 'architectural_files' not in files or len(request.files.getlist('architectural_files')) == 0:
        return jsonify(message="Architectural files are required"), 400

    if 'renders' not in files or len(request.files.getlist('renders')) == 0:
        return jsonify(message="Renders are required"), 400

    plan_id = str(uuid.uuid4())
    created_at = datetime.utcnow()
    plan_file_records = []

    # Initialize file paths storage
    file_paths = {
        'architectural': [],
        'structural': [],
        'mep': [],
        'civil': [],
        'fire_safety': [],
        'interior': [],
        'boq': [],
        'renders': []
    }

    try:
        # Save Architectural Files
        if 'architectural_files' in files:
            arch_files = request.files.getlist('architectural_files')
            for file in arch_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'architectural', file.filename)
                    file_paths['architectural'].append(path)
                    add_plan_file_record(plan_file_records, 'ARCHITECTURAL', path, file.filename)

        # Save Structural Files
        if 'structural_files' in files:
            struct_files = request.files.getlist('structural_files')
            for file in struct_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'structural', file.filename)
                    file_paths['structural'].append(path)
                    add_plan_file_record(plan_file_records, 'STRUCTURAL', path, file.filename)

        # Save MEP Files
        if 'mep_mechanical_files' in files:
            mep_files = request.files.getlist('mep_mechanical_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/mechanical', file.filename)
                    file_paths['mep'].append(path)
                    add_plan_file_record(plan_file_records, 'MEP_MECHANICAL', path, file.filename)

        if 'mep_electrical_files' in files:
            mep_files = request.files.getlist('mep_electrical_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/electrical', file.filename)
                    file_paths['mep'].append(path)
                    add_plan_file_record(plan_file_records, 'MEP_ELECTRICAL', path, file.filename)

        if 'mep_plumbing_files' in files:
            mep_files = request.files.getlist('mep_plumbing_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/plumbing', file.filename)
                    file_paths['mep'].append(path)
                    add_plan_file_record(plan_file_records, 'MEP_PLUMBING', path, file.filename)

        # Save Civil Files
        if 'civil_files' in files:
            civil_files = request.files.getlist('civil_files')
            for file in civil_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS | ALLOWED_EXTENSIONS_IMAGES):
                    path = save_file_locally(file, plan_id, 'civil', file.filename)
                    file_paths['civil'].append(path)
                    add_plan_file_record(plan_file_records, 'CIVIL', path, file.filename)

        # Save Fire Safety Files
        if 'fire_safety_files' in files:
            fire_files = request.files.getlist('fire_safety_files')
            for file in fire_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS | ALLOWED_EXTENSIONS_IMAGES):
                    path = save_file_locally(file, plan_id, 'fire_safety', file.filename)
                    file_paths['fire_safety'].append(path)
                    add_plan_file_record(plan_file_records, 'FIRE_SAFETY', path, file.filename)

        # Save Interior Files
        if 'interior_files' in files:
            interior_files = request.files.getlist('interior_files')
            for file in interior_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS | ALLOWED_EXTENSIONS_IMAGES):
                    path = save_file_locally(file, plan_id, 'interior', file.filename)
                    file_paths['interior'].append(path)
                    add_plan_file_record(plan_file_records, 'INTERIOR', path, file.filename)

        # Save 3D Renders
        if 'renders' in files:
            render_files = request.files.getlist('renders')
            for file in render_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMAGES | {'pdf'}):
                    path = save_file_locally(file, plan_id, 'renders', file.filename)
                    file_paths['renders'].append(path)
                    add_plan_file_record(plan_file_records, 'RENDER', path, file.filename)

        # Save BOQ Files
        if form.get('includes_boq') == 'true':
            if 'boq_architectural' in files:
                file = files['boq_architectural']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'architectural_boq_{file.filename}')
                    file_paths['boq'].append(path)
                    add_plan_file_record(plan_file_records, 'BOQ_ARCHITECTURAL', path, file.filename)

            if 'boq_structural' in files:
                file = files['boq_structural']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'structural_boq_{file.filename}')
                    file_paths['boq'].append(path)
                    add_plan_file_record(plan_file_records, 'BOQ_STRUCTURAL', path, file.filename)

            if 'boq_mep' in files:
                file = files['boq_mep']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'mep_boq_{file.filename}')
                    file_paths['boq'].append(path)
                    add_plan_file_record(plan_file_records, 'BOQ_MEP', path, file.filename)

            if 'cost_summary' in files:
                file = files['cost_summary']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'cost_summary_{file.filename}')
                    file_paths['boq'].append(path)
                    add_plan_file_record(plan_file_records, 'BOQ_COST_SUMMARY', path, file.filename)

        # Save Thumbnail to Cloudinary
        thumbnail = files['thumbnail']
        try:
            thumbnail_path = upload_to_cloudinary(thumbnail, public_id=f"{plan_id}_thumbnail")
        except ValueError as e:
            return jsonify(message=str(e)), 500
        add_plan_file_record(plan_file_records, 'THUMBNAIL', thumbnail_path, thumbnail.filename)

        # Save Gallery Images
        gallery_paths = []
        if 'gallery' in files:
            gallery_files = request.files.getlist('gallery')
            for file in gallery_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMAGES):
                    try:
                        path = upload_to_cloudinary(file, folder=f"plancave_plans/{plan_id}/gallery")
                        gallery_paths.append(path)
                    except ValueError as e:
                        return jsonify(message=str(e)), 500
                    add_plan_file_record(plan_file_records, 'GALLERY', path, file.filename)

        # Attach gallery paths to file_paths so details endpoint can build a gallery
        if gallery_paths:
            file_paths['gallery'] = gallery_paths

        # Parse JSON fields
        disciplines_included = json.loads(form.get('disciplines_included', '{}'))
        certifications = json.loads(form.get('certifications', '[]'))
        special_features = json.loads(form.get('special_features', '[]'))

        # Optional per-deliverable pricing (stored in DB; price becomes cumulative)
        deliverable_prices_raw = form.get('deliverable_prices')
        deliverable_prices = None
        if deliverable_prices_raw:
            try:
                deliverable_prices = json.loads(deliverable_prices_raw)
            except Exception:
                return jsonify(message="deliverable_prices must be valid JSON"), 400

            if not isinstance(deliverable_prices, dict):
                return jsonify(message="deliverable_prices must be a JSON object"), 400

            # Enforce required deliverables
            required_price_keys = ['architectural', 'renders']
            for key in required_price_keys:
                if key not in deliverable_prices:
                    return jsonify(message=f"deliverable_prices missing required key: {key}"), 400

            try:
                cumulative_price = 0.0
                for _, v in deliverable_prices.items():
                    if v is None or v == '':
                        continue
                    cumulative_price += float(v)
                if cumulative_price <= 0:
                    return jsonify(message="Cumulative deliverable_prices must be a positive number"), 400
                price = cumulative_price
            except (ValueError, TypeError):
                return jsonify(message="deliverable_prices values must be numeric"), 400

        # Insert into database
        conn = get_db()
        cur = conn.cursor()

        try:
            cur.execute("""
                INSERT INTO plans (
                    id, name, category, project_type, description, target_audience,
                    price, area, plot_size, bedrooms, bathrooms, floors,
                    building_height, parking_spaces, special_features,
                    disciplines_included, includes_boq, package_level,
                    building_code, certifications, license_type,
                    customization_available, support_duration,
                    estimated_cost_min, estimated_cost_max,
                    project_timeline_ref, material_specifications, construction_notes,
                    file_paths, image_url, deliverable_prices, designer_id, status, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                );
            """, (
                plan_id,
                form['name'],
                form.get('category', ''),  
                form.get('project_type', 'Residential'),
                form.get('description', ''),
                form.get('target_audience', 'All'),
                price,  # already validated
                area,   # already validated
                safe_float(form.get('plot_size'), None),
                safe_int(form.get('bedrooms'), None),
                safe_int(form.get('bathrooms'), None),
                floors,  # already validated
                safe_float(form.get('building_height'), None),
                safe_int(form.get('parking_spaces'), 0),
                json.dumps(special_features),
                json.dumps(disciplines_included),
                form.get('includes_boq', 'false').lower() == 'true',
                form.get('package_level', 'basic'),
                form.get('building_code', 'Kenya Building Code'),
                json.dumps(certifications),
                form.get('license_type', 'single_use'),
                form.get('customization_available', 'false').lower() == 'true',
                safe_int(form.get('support_duration'), 0),
                safe_float(form.get('estimated_cost_min'), None),
                safe_float(form.get('estimated_cost_max'), None),
                form.get('project_timeline_ref', ''),
                form.get('material_specifications', ''),
                form.get('construction_notes', ''),
                json.dumps(file_paths),
                thumbnail_path,
                json.dumps(deliverable_prices) if deliverable_prices is not None else None,
                user_id,
                'Available',
                created_at
            ))
            for record in plan_file_records:
                cur.execute(
                    """
                    INSERT INTO plan_files (plan_id, file_name, file_type, file_path, file_size)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        plan_id,
                        record['file_name'],
                        record['file_type'],
                        record['file_path'],
                        record['file_size']
                    )
                )

            conn.commit()

            return jsonify({
                "message": "Professional plan uploaded successfully!",
                "plan_id": plan_id,
                "disciplines": list(disciplines_included.keys()),
                "package_level": form.get('package_level', 'basic'),
                "includes_boq": form.get('includes_boq', 'false') == 'true',
                "file_counts": {
                    "architectural": len(file_paths['architectural']),
                    "structural": len(file_paths['structural']),
                    "mep": len(file_paths['mep']),
                    "civil": len(file_paths['civil']),
                    "fire_safety": len(file_paths['fire_safety']),
                    "interior": len(file_paths['interior']),
                    "boq": len(file_paths['boq']),
                    "renders": len(file_paths['renders']),
                    "gallery": len(gallery_paths)
                }
            }), 201

        except Exception as e:
            conn.rollback()
            current_app.logger.error(f"Database error: {e}")
            return jsonify(message=f"Database error: {str(e)}"), 500
        finally:
            cur.close()
            conn.close()

    except Exception as e:
        current_app.logger.error(f"Upload error: {e}")
        return jsonify(message=f"Upload failed: {str(e)}"), 500


@plans_bp.route('/<plan_id>', methods=['PUT', 'PATCH'])
@jwt_required()
def update_plan(plan_id):
    """Edit an existing plan's details and media.

    Designers can update their own plans; admins can update any plan.
    All fields are optional; only provided ones are updated.
    """
    user_id, role = get_current_user()
    if role not in ['admin', 'designer']:
        return jsonify(message="Access denied: Admins and Designers only"), 403

    form = request.form
    files = request.files

    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        # Check existing plan and ownership
        cur.execute("SELECT * FROM plans WHERE id = %s", (plan_id,))
        existing = cur.fetchone()
        if not existing:
            return jsonify(message="Plan not found"), 404

        if role != 'admin' and existing['designer_id'] != user_id:
            return jsonify(message="You do not have permission to edit this plan"), 403

        update_fields = {}

        # Simple text/number fields we allow updating
        simple_fields = [
            'name', 'project_type', 'description', 'target_audience', 'category',
            'building_code', 'license_type', 'project_timeline_ref',
            'material_specifications', 'construction_notes'
        ]
        for field in simple_fields:
            if field in form:
                update_fields[field] = form.get(field)

        # Numeric fields
        if 'price' in form:
            price = safe_float(form.get('price'))
            if price is not None and price > 0:
                update_fields['price'] = price
        if 'area' in form:
            area = safe_float(form.get('area'))
            if area is not None and area > 0:
                update_fields['area'] = area
        if 'plot_size' in form:
            update_fields['plot_size'] = safe_float(form.get('plot_size'))
        if 'bedrooms' in form:
            update_fields['bedrooms'] = safe_int(form.get('bedrooms'))
        if 'bathrooms' in form:
            update_fields['bathrooms'] = safe_int(form.get('bathrooms'))
        if 'floors' in form:
            floors = safe_int(form.get('floors'))
            if floors is not None and floors > 0:
                update_fields['floors'] = floors
        if 'building_height' in form:
            update_fields['building_height'] = safe_float(form.get('building_height'))
        if 'parking_spaces' in form:
            update_fields['parking_spaces'] = safe_int(form.get('parking_spaces'))
        if 'support_duration' in form:
            update_fields['support_duration'] = safe_int(form.get('support_duration'))
        if 'estimated_cost_min' in form:
            update_fields['estimated_cost_min'] = safe_float(form.get('estimated_cost_min'))
        if 'estimated_cost_max' in form:
            update_fields['estimated_cost_max'] = safe_float(form.get('estimated_cost_max'))

        # Booleans and enums
        if 'includes_boq' in form:
            update_fields['includes_boq'] = form.get('includes_boq', 'false').lower() == 'true'
        if 'package_level' in form:
            update_fields['package_level'] = form.get('package_level')
        if 'customization_available' in form:
            update_fields['customization_available'] = form.get('customization_available', 'false').lower() == 'true'

        # JSON fields
        if 'disciplines_included' in form:
            try:
                update_fields['disciplines_included'] = json.dumps(json.loads(form.get('disciplines_included') or '{}'))
            except json.JSONDecodeError:
                pass
        if 'certifications' in form:
            try:
                update_fields['certifications'] = json.dumps(json.loads(form.get('certifications') or '[]'))
            except json.JSONDecodeError:
                pass
        if 'special_features' in form:
            try:
                update_fields['special_features'] = json.dumps(json.loads(form.get('special_features') or '[]'))
            except json.JSONDecodeError:
                pass

        # File paths JSON
        file_paths = existing.get('file_paths')
        if isinstance(file_paths, str):
            try:
                file_paths = json.loads(file_paths)
            except Exception:
                file_paths = {}
        if not isinstance(file_paths, dict):
            file_paths = {}

        # Replace thumbnail if provided
        if 'thumbnail' in files:
            thumb = files['thumbnail']
            if thumb and allowed_file(thumb.filename, ALLOWED_EXTENSIONS_IMAGES):
                try:
                    thumb_path = upload_to_cloudinary(thumb, public_id=f"{plan_id}_thumbnail_updated")
                    update_fields['image_url'] = thumb_path
                except ValueError as e:
                    return jsonify(message=str(e)), 500

        # Add extra gallery images if provided
        if 'gallery' in files:
            gallery_files = request.files.getlist('gallery')
            new_gallery_paths = []
            for file in gallery_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMAGES):
                    try:
                        path = upload_to_cloudinary(file, folder=f"plancave_plans/{plan_id}/gallery")
                        new_gallery_paths.append(path)
                    except ValueError as e:
                        return jsonify(message=str(e)), 500

            if new_gallery_paths:
                existing_gallery = file_paths.get('gallery') or []
                file_paths['gallery'] = existing_gallery + new_gallery_paths

        # Persist updated file_paths if changed
        if file_paths != existing.get('file_paths'):
            update_fields['file_paths'] = json.dumps(file_paths)

        if not update_fields:
            return jsonify(message="No changes provided"), 400

        set_clauses = []
        values = []
        for col, val in update_fields.items():
            set_clauses.append(f"{col} = %s")
            values.append(val)
        values.append(plan_id)

        sql = f"UPDATE plans SET {', '.join(set_clauses)} WHERE id = %s"
        cur.execute(sql, tuple(values))
        conn.commit()

        return jsonify(message="Plan updated successfully"), 200

    except Exception as e:
        conn.rollback()
        current_app.logger.error(f"Error updating plan {plan_id}: {e}")
        return jsonify(message="Failed to update plan"), 500
    finally:
        cur.close()
        conn.close()


@plans_bp.route('/trending', methods=['GET'])
def get_trending():
    """Public trending endpoint based on plan views (last 30 days)."""
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        limit = request.args.get('limit', default=4, type=int)
        limit = max(1, min(limit or 4, 12))

        cur.execute(
            """
            WITH type_views AS (
                SELECT
                    p.project_type,
                    SUM(pa.views_count) AS total_views
                FROM plan_analytics pa
                JOIN plans p ON pa.plan_id = p.id
                WHERE p.status = 'Available'
                  AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
                  AND p.project_type IS NOT NULL
                  AND TRIM(p.project_type) <> ''
                GROUP BY p.project_type
            )
            SELECT project_type, COALESCE(total_views, 0) AS total_views
            FROM type_views
            ORDER BY total_views DESC
            LIMIT 5
            """
        )
        top_types = [dict(r) for r in cur.fetchall()]
        top_type = (top_types[0].get('project_type') if top_types else None)

        plans: list[dict] = []
        if top_type:
            cur.execute(
                """
                SELECT
                    p.id, p.name, p.category, p.project_type, p.description, p.package_level,
                    p.price, p.area, p.bedrooms, p.bathrooms, p.floors, p.includes_boq,
                    p.disciplines_included, p.sales_count, p.image_url, p.created_at, p.certifications,
                    COALESCE(SUM(pa.views_count), 0) AS total_views
                FROM plans p
                LEFT JOIN plan_analytics pa ON pa.plan_id = p.id
                  AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
                WHERE p.status = 'Available'
                  AND p.project_type = %s
                GROUP BY p.id
                ORDER BY total_views DESC, p.sales_count DESC, p.created_at DESC
                LIMIT %s
                """,
                (top_type, limit)
            )
            rows = cur.fetchall() or []
            for row in rows:
                plan_dict = dict(row)
                if plan_dict.get('disciplines_included'):
                    plan_dict['disciplines_included'] = json.loads(plan_dict['disciplines_included']) if isinstance(plan_dict['disciplines_included'], str) else plan_dict['disciplines_included']
                if plan_dict.get('certifications'):
                    plan_dict['certifications'] = json.loads(plan_dict['certifications']) if isinstance(plan_dict['certifications'], str) else plan_dict['certifications']
                plans.append(plan_dict)

        return jsonify({
            'top_types': top_types,
            'top_type': top_type,
            'plans': plans,
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error computing trending: {e}")
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@plans_bp.route('/', methods=['GET'])
def browse_plans():
    """
    Browse Plans
    Public endpoint to browse plans with filtering, search, sort, and pagination.
    """
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        search = request.args.get('search', type=str)
        category = request.args.get('category', type=str)
        project_type = request.args.get('project_type', type=str)
        package_level = request.args.get('package_level', type=str)
        bedrooms = request.args.get('bedrooms', type=int)
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        includes_boq = request.args.get('includes_boq', type=str)
        sort_by = request.args.get('sort_by', default='created_at', type=str)
        order = request.args.get('order', default='desc', type=str)
        limit = request.args.get('limit', default=20, type=int)
        offset = request.args.get('offset', default=0, type=int)

        allowed_sort_fields = ['price', 'sales_count', 'created_at', 'area']
        sort_by = sort_by if sort_by in allowed_sort_fields else 'created_at'
        order = 'ASC' if order.lower() == 'asc' else 'DESC'

        where_clauses = ["status = 'Available'"]
        values = []

        if search:
            where_clauses.append("(LOWER(name) LIKE %s OR LOWER(description) LIKE %s)")
            search_pattern = f"%{search.lower()}%"
            values.extend([search_pattern, search_pattern])
        if category:
            where_clauses.append("category = %s")
            values.append(category)
        if project_type:
            where_clauses.append("project_type = %s")
            values.append(project_type)
        if package_level:
            where_clauses.append("package_level = %s")
            values.append(package_level)
        if bedrooms is not None:
            where_clauses.append("bedrooms = %s")
            values.append(bedrooms)
        if min_price is not None:
            where_clauses.append("price >= %s")
            values.append(min_price)
        if max_price is not None:
            where_clauses.append("price <= %s")
            values.append(max_price)
        if includes_boq:
            where_clauses.append("includes_boq = %s")
            values.append(includes_boq.lower() == 'true')

        where_sql = " AND ".join(where_clauses)

        # Use an alias so we can safely read the count when using dict_row
        count_query = f"SELECT COUNT(*) AS total FROM plans WHERE {where_sql};"
        cur.execute(count_query, tuple(values))
        count_row = cur.fetchone()
        # count_row may be a dict (with row_factory=dict_row) or a sequence
        total_count = count_row["total"] if isinstance(count_row, dict) else count_row[0]
        total_pages = math.ceil(total_count / limit) if limit > 0 else 0
        current_page = (offset // limit) + 1

        next_page = current_page + 1 if current_page < total_pages else None
        prev_page = current_page - 1 if current_page > 1 else None

        data_query = f"""
            SELECT id, name, category, project_type, description, package_level, price, area, 
                   bedrooms, bathrooms, floors, includes_boq, disciplines_included,
                   sales_count, image_url, created_at, certifications
            FROM plans
            WHERE {where_sql}
            ORDER BY {sort_by} {order}
            LIMIT %s OFFSET %s;
        """
        cur.execute(data_query, tuple(values + [limit, offset]))
        rows = cur.fetchall()
        
        plans = []
        for row in rows:
            plan_dict = dict(row)
            # Parse JSON fields
            if plan_dict.get('disciplines_included'):
                plan_dict['disciplines_included'] = json.loads(plan_dict['disciplines_included']) if isinstance(plan_dict['disciplines_included'], str) else plan_dict['disciplines_included']
            if plan_dict.get('certifications'):
                plan_dict['certifications'] = json.loads(plan_dict['certifications']) if isinstance(plan_dict['certifications'], str) else plan_dict['certifications']
            plans.append(plan_dict)

        return jsonify({
            "metadata": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(plans),
                "sort_by": sort_by,
                "order": order,
                "total_pages": total_pages,
                "current_page": current_page,
                "next_page": next_page,
                "prev_page": prev_page,
            },
            "results": plans
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error browsing plans: {e}")
        # Return the actual error message for easier debugging in prototype
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@plans_bp.route('/simple/<plan_id>', methods=['GET'])
def get_simple_plan_details(plan_id):
    """Get full details for a single plan by ID"""
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)

    try:
        query = """
            SELECT id, name, project_type, description, category, target_audience,
                   package_level, price, area, plot_size, bedrooms, bathrooms, floors,
                   building_height, parking_spaces, special_features, disciplines_included,
                   includes_boq, building_code, certifications, license_type,
                   customization_available, support_duration, estimated_cost_min,
                   estimated_cost_max, project_timeline_ref, material_specifications,
                   construction_notes, file_paths, image_url, designer_id, status,
                   sales_count, created_at
            FROM plans
            WHERE id = %s;
        """
        cur.execute(query, (plan_id,))
        row = cur.fetchone()

        if not row:
            return jsonify(message="Plan not found"), 404

        plan = dict(row)

        # Parse JSON fields
        if plan.get('disciplines_included'):
            plan['disciplines_included'] = json.loads(plan['disciplines_included']) if isinstance(plan['disciplines_included'], str) else plan['disciplines_included']
        if plan.get('special_features'):
            plan['special_features'] = json.loads(plan['special_features']) if isinstance(plan['special_features'], str) else plan['special_features']
        if plan.get('certifications'):
            plan['certifications'] = json.loads(plan['certifications']) if isinstance(plan['certifications'], str) else plan['certifications']
        if plan.get('file_paths') and isinstance(plan['file_paths'], str):
            plan['file_paths'] = json.loads(plan['file_paths'])

        return jsonify(plan), 200

    except Exception as e:
        current_app.logger.error(f"Error getting plan details: {e}")
        return jsonify(error="Failed to load plan details"), 500
    finally:
        cur.close()
        conn.close()
