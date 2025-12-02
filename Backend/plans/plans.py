from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
import os
import uuid
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import json

plans_bp = Blueprint('plans', __name__, url_prefix='/plans')

# Upload directory for local storage (fallback if GCS not configured)
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads', 'plans')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS_PLANS = {'pdf', 'dwg', 'zip'}
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

def save_file_locally(file, plan_id, category, filename):
    """Save file to local storage organized by discipline"""
    safe_filename = secure_filename(filename)
    unique_name = f"{uuid.uuid4()}_{safe_filename}"
    
    # Create directory structure
    dir_path = os.path.join(UPLOAD_FOLDER, plan_id, category)
    os.makedirs(dir_path, exist_ok=True)
    
    file_path = os.path.join(dir_path, unique_name)
    file.save(file_path)
    
    # Return relative path
    return f"/uploads/plans/{plan_id}/{category}/{unique_name}"


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
    required_fields = ['name', 'project_type', 'description', 'price', 'area', 'floors', 'package_level']
    for field in required_fields:
        if field not in form:
            return jsonify(message=f"Missing required field: {field}"), 400

    # Validate thumbnail
    if 'thumbnail' not in files:
        return jsonify(message="Thumbnail image is required"), 400

    plan_id = str(uuid.uuid4())
    created_at = datetime.utcnow()

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

        # Save Structural Files
        if 'structural_files' in files:
            struct_files = request.files.getlist('structural_files')
            for file in struct_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'structural', file.filename)
                    file_paths['structural'].append(path)

        # Save MEP Files
        if 'mep_mechanical_files' in files:
            mep_files = request.files.getlist('mep_mechanical_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/mechanical', file.filename)
                    file_paths['mep'].append(path)

        if 'mep_electrical_files' in files:
            mep_files = request.files.getlist('mep_electrical_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/electrical', file.filename)
                    file_paths['mep'].append(path)

        if 'mep_plumbing_files' in files:
            mep_files = request.files.getlist('mep_plumbing_files')
            for file in mep_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'mep/plumbing', file.filename)
                    file_paths['mep'].append(path)

        # Save Civil Files
        if 'civil_files' in files:
            civil_files = request.files.getlist('civil_files')
            for file in civil_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'civil', file.filename)
                    file_paths['civil'].append(path)

        # Save Fire Safety Files
        if 'fire_safety_files' in files:
            fire_files = request.files.getlist('fire_safety_files')
            for file in fire_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS):
                    path = save_file_locally(file, plan_id, 'fire_safety', file.filename)
                    file_paths['fire_safety'].append(path)

        # Save Interior Files
        if 'interior_files' in files:
            interior_files = request.files.getlist('interior_files')
            for file in interior_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PLANS | ALLOWED_EXTENSIONS_IMAGES):
                    path = save_file_locally(file, plan_id, 'interior', file.filename)
                    file_paths['interior'].append(path)

        # Save 3D Renders
        if 'renders' in files:
            render_files = request.files.getlist('renders')
            for file in render_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMAGES | {'pdf'}):
                    path = save_file_locally(file, plan_id, 'renders', file.filename)
                    file_paths['renders'].append(path)

        # Save BOQ Files
        if form.get('includes_boq') == 'true':
            if 'boq_architectural' in files:
                file = files['boq_architectural']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'architectural_boq_{file.filename}')
                    file_paths['boq'].append(path)

            if 'boq_structural' in files:
                file = files['boq_structural']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'structural_boq_{file.filename}')
                    file_paths['boq'].append(path)

            if 'boq_mep' in files:
                file = files['boq_mep']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'mep_boq_{file.filename}')
                    file_paths['boq'].append(path)

            if 'cost_summary' in files:
                file = files['cost_summary']
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_BOQ):
                    path = save_file_locally(file, plan_id, 'boq', f'cost_summary_{file.filename}')
                    file_paths['boq'].append(path)

        # Save Thumbnail
        thumbnail = files['thumbnail']
        thumbnail_path = save_file_locally(thumbnail, plan_id, 'images', thumbnail.filename)

        # Save Gallery Images
        gallery_paths = []
        if 'gallery' in files:
            gallery_files = request.files.getlist('gallery')
            for file in gallery_files:
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMAGES):
                    path = save_file_locally(file, plan_id, 'images/gallery', file.filename)
                    gallery_paths.append(path)

        # Parse JSON fields
        disciplines_included = json.loads(form.get('disciplines_included', '{}'))
        certifications = json.loads(form.get('certifications', '[]'))
        special_features = json.loads(form.get('special_features', '[]'))

        # Insert into database
        conn = get_db()
        cur = conn.cursor()

        try:
            cur.execute("""
                INSERT INTO plans (
                    id, name, project_type, description, target_audience,
                    price, area, plot_size, bedrooms, bathrooms, floors,
                    building_height, parking_spaces, special_features,
                    disciplines_included, includes_boq, package_level,
                    building_code, certifications, license_type,
                    customization_available, support_duration,
                    estimated_cost_min, estimated_cost_max,
                    project_timeline_ref, material_specifications, construction_notes,
                    file_paths, image_url, designer_id, status, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s
                );
            """, (
                plan_id,
                form['name'],
                form.get('project_type', 'Residential'),
                form.get('description', ''),
                form.get('target_audience', 'All'),
                float(form['price']),
                float(form.get('area', 0)),
                float(form.get('plot_size', 0)) if form.get('plot_size') else None,
                int(form.get('bedrooms', 0)) if form.get('bedrooms') else None,
                int(form.get('bathrooms', 0)) if form.get('bathrooms') else None,
                int(form.get('floors', 1)),
                float(form.get('building_height', 0)) if form.get('building_height') else None,
                int(form.get('parking_spaces', 0)),
                json.dumps(special_features),
                json.dumps(disciplines_included),
                form.get('includes_boq', 'false').lower() == 'true',
                form.get('package_level', 'basic'),
                form.get('building_code', 'Kenya Building Code'),
                json.dumps(certifications),
                form.get('license_type', 'single_use'),
                form.get('customization_available', 'false').lower() == 'true',
                int(form.get('support_duration', 0)),
                float(form.get('estimated_cost_min', 0)) if form.get('estimated_cost_min') else None,
                float(form.get('estimated_cost_max', 0)) if form.get('estimated_cost_max') else None,
                form.get('project_timeline_ref', ''),
                form.get('material_specifications', ''),
                form.get('construction_notes', ''),
                json.dumps(file_paths),
                thumbnail_path,
                user_id,
                'Available',
                created_at
            ))
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
        limit = request.args.get('limit', default=12, type=int)
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

        count_query = f"SELECT COUNT(*) FROM plans WHERE {where_sql};"
        cur.execute(count_query, tuple(values))
        total_count = cur.fetchone()[0]

        data_query = f"""
            SELECT id, name, project_type, description, package_level, price, area, 
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
                "order": order
            },
            "results": plans
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error browsing plans: {e}")
        return jsonify(error="Something went wrong"), 500
    finally:
        cur.close()
        conn.close()
