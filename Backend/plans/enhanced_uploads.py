from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
import psycopg
from psycopg.rows import dict_row
from datetime import datetime
import json
import shutil
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.auth_utils import get_current_user, require_designer, log_user_activity, check_plan_ownership

enhanced_uploads_bp = Blueprint('enhanced_uploads', __name__, url_prefix='/plans')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_FILE_EXTENSIONS = {'pdf', 'dwg', 'dxf', 'rvt', 'ifc', 'skp', 'blend'}
UPLOAD_FOLDER = 'uploads/plans'


def get_db():
    return psycopg.connect(current_app.config['DATABASE_URL'])


def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def save_file_locally(file, plan_id, file_type='image'):
    """Save file to local storage"""
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    
    # Create directory structure
    file_dir = os.path.join(UPLOAD_FOLDER, plan_id, file_type)
    os.makedirs(file_dir, exist_ok=True)
    
    file_path = os.path.join(file_dir, unique_name)
    file.save(file_path)
    
    return file_path, os.path.getsize(file_path)


@enhanced_uploads_bp.route('/detailed-upload', methods=['POST'])
@jwt_required()
@require_designer
def detailed_upload():
    """
    Enhanced plan upload with BOQs, structural specs, compliance notes, and multiple file formats
    """
    user_id, role = get_current_user()

    try:
        # Basic plan data
        plan_data = {
            'name': request.form.get('name'),
            'description': request.form.get('description'),
            'category': request.form.get('category'),
            'price': float(request.form.get('price', 0)),
            'status': request.form.get('status', 'Available'),
            'area': float(request.form.get('area', 0)),
            'bedrooms': int(request.form.get('bedrooms', 0)),
            'bathrooms': int(request.form.get('bathrooms', 0)),
            'floors': int(request.form.get('floors', 1)),
            'tags': request.form.get('tags', '').split(',') if request.form.get('tags') else []
        }

        # Validate required fields
        if not all([plan_data['name'], plan_data['category']]):
            return jsonify(message="Name and category are required"), 400

        # Handle images
        images = request.files.getlist('images')
        if not images or len(images) == 0:
            return jsonify(message="At least one image is required"), 400

        # Handle additional files (CAD, PDF, BIM)
        additional_files = request.files.getlist('files')

        plan_id = str(uuid.uuid4())
        image_paths = []
        file_records = []

        # Save images
        for image in images:
            if image and allowed_file(image.filename, ALLOWED_IMAGE_EXTENSIONS):
                file_path, file_size = save_file_locally(image, plan_id, 'images')
                image_paths.append(file_path)

        if not image_paths:
            return jsonify(message="No valid images provided"), 400

        # Save additional files
        for file in additional_files:
            if file and allowed_file(file.filename, ALLOWED_FILE_EXTENSIONS):
                file_path, file_size = save_file_locally(file, plan_id, 'files')
                file_ext = os.path.splitext(file.filename)[1].upper().replace('.', '')
                file_records.append({
                    'file_name': secure_filename(file.filename),
                    'file_type': file_ext,
                    'file_path': file_path,
                    'file_size': file_size
                })

        # Parse BOQs from JSON
        boqs = json.loads(request.form.get('boqs', '[]'))
        
        # Parse structural specs from JSON
        structural_specs = json.loads(request.form.get('structural_specs', '[]'))
        
        # Parse compliance notes from JSON
        compliance_notes = json.loads(request.form.get('compliance_notes', '[]'))

        # Database operations
        conn = get_db()
        cur = conn.cursor()
        
        try:
            # Insert plan
            created_at = datetime.utcnow()
            cur.execute("""
                INSERT INTO plans (
                    id, name, description, category, price, status, area, 
                    bedrooms, bathrooms, floors, image_url, designer_id, 
                    created_at, tags
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                plan_id,
                plan_data['name'],
                plan_data['description'],
                plan_data['category'],
                plan_data['price'],
                plan_data['status'],
                plan_data['area'],
                plan_data['bedrooms'],
                plan_data['bathrooms'],
                plan_data['floors'],
                image_paths[0],  # Primary image
                user_id,
                created_at,
                plan_data['tags']
            ))

            # Insert BOQs
            for boq in boqs:
                cur.execute("""
                    INSERT INTO boqs (
                        plan_id, item_name, quantity, unit, unit_cost, 
                        total_cost, category
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    plan_id,
                    boq.get('item_name'),
                    boq.get('quantity'),
                    boq.get('unit'),
                    boq.get('unit_cost'),
                    boq.get('total_cost'),
                    boq.get('category')
                ))

            # Insert structural specs
            for spec in structural_specs:
                cur.execute("""
                    INSERT INTO structural_specs (
                        plan_id, spec_type, specification, standard
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    plan_id,
                    spec.get('spec_type'),
                    spec.get('specification'),
                    spec.get('standard')
                ))

            # Insert compliance notes
            for note in compliance_notes:
                cur.execute("""
                    INSERT INTO compliance_notes (
                        plan_id, authority, requirement, status, notes
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    plan_id,
                    note.get('authority'),
                    note.get('requirement'),
                    note.get('status', 'compliant'),
                    note.get('notes')
                ))

            # Insert file records
            for file_record in file_records:
                cur.execute("""
                    INSERT INTO plan_files (
                        plan_id, file_name, file_type, file_path, file_size
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    plan_id,
                    file_record['file_name'],
                    file_record['file_type'],
                    file_record['file_path'],
                    file_record['file_size']
                ))

            conn.commit()
            
            # Log activity
            log_user_activity(user_id, 'upload', {
                'plan_id': plan_id,
                'plan_name': plan_data['name'],
                'category': plan_data['category'],
                'components': {
                    'images': len(image_paths),
                    'files': len(file_records),
                    'boqs': len(boqs),
                    'structural_specs': len(structural_specs),
                    'compliance_notes': len(compliance_notes)
                }
            }, conn)
            
            return jsonify({
                "message": "Plan uploaded successfully with detailed information",
                "plan_id": plan_id,
                "images": len(image_paths),
                "files": len(file_records),
                "boqs": len(boqs),
                "structural_specs": len(structural_specs),
                "compliance_notes": len(compliance_notes)
            }), 201

        except Exception as e:
            conn.rollback()
            # Cleanup files on error
            plan_dir = os.path.join(UPLOAD_FOLDER, plan_id)
            if os.path.exists(plan_dir):
                shutil.rmtree(plan_dir)
            return jsonify(message=f"Database error: {str(e)}"), 500
        finally:
            cur.close()
            conn.close()

    except Exception as e:
        return jsonify(message=f"Upload error: {str(e)}"), 500


@enhanced_uploads_bp.route('/bulk-upload', methods=['POST'])
@jwt_required()
@require_designer
def bulk_upload():
    """
    Bulk upload multiple plans at once for creators
    """
    user_id, role = get_current_user()

    try:
        # Expects a JSON array of plan data
        plans_data = request.get_json()
        
        if not isinstance(plans_data, list) or len(plans_data) == 0:
            return jsonify(message="Plans data must be a non-empty array"), 400

        conn = get_db()
        cur = conn.cursor()
        
        uploaded_plans = []
        failed_plans = []

        for idx, plan in enumerate(plans_data):
            try:
                plan_id = str(uuid.uuid4())
                created_at = datetime.utcnow()
                
                cur.execute("""
                    INSERT INTO plans (
                        id, name, description, category, price, status, area, 
                        bedrooms, bathrooms, floors, designer_id, created_at, tags
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    plan_id,
                    plan.get('name'),
                    plan.get('description'),
                    plan.get('category'),
                    plan.get('price', 0),
                    plan.get('status', 'Draft'),
                    plan.get('area', 0),
                    plan.get('bedrooms', 0),
                    plan.get('bathrooms', 0),
                    plan.get('floors', 1),
                    user_id,
                    created_at,
                    plan.get('tags', [])
                ))
                
                uploaded_plans.append(plan_id)
                
            except Exception as e:
                failed_plans.append({"index": idx, "error": str(e), "plan": plan.get('name', 'Unknown')})

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Bulk upload completed",
            "uploaded": len(uploaded_plans),
            "failed": len(failed_plans),
            "uploaded_ids": uploaded_plans,
            "failures": failed_plans
        }), 201 if len(uploaded_plans) > 0 else 400

    except Exception as e:
        return jsonify(message=f"Bulk upload error: {str(e)}"), 500


@enhanced_uploads_bp.route('/<plan_id>/details', methods=['GET'])
def get_plan_details(plan_id):
    """
    Get complete plan details including BOQs, specs, compliance, and files
    """
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Get plan
        cur.execute("""
            SELECT p.*, u.username as designer_name
            FROM plans p
            LEFT JOIN users u ON p.designer_id = u.id
            WHERE p.id = %s
        """, (plan_id,))
        
        plan = cur.fetchone()
        if not plan:
            return jsonify(message="Plan not found"), 404
        
        plan_dict = dict(plan)
        
        # Get BOQs
        cur.execute("SELECT * FROM boqs WHERE plan_id = %s", (plan_id,))
        plan_dict['boqs'] = [dict(row) for row in cur.fetchall()]
        
        # Get structural specs
        cur.execute("SELECT * FROM structural_specs WHERE plan_id = %s", (plan_id,))
        plan_dict['structural_specs'] = [dict(row) for row in cur.fetchall()]
        
        # Get compliance notes
        cur.execute("SELECT * FROM compliance_notes WHERE plan_id = %s", (plan_id,))
        plan_dict['compliance_notes'] = [dict(row) for row in cur.fetchall()]
        
        # Get files
        cur.execute("SELECT * FROM plan_files WHERE plan_id = %s", (plan_id,))
        plan_dict['files'] = [dict(row) for row in cur.fetchall()]
        
        return jsonify(plan_dict), 200
        
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cur.close()
        conn.close()


@enhanced_uploads_bp.route('/<plan_id>/version', methods=['POST'])
@jwt_required()
@require_designer
def create_plan_version(plan_id):
    """
    Create a new version of an existing plan
    """
    user_id, role = get_current_user()
    
    conn = get_db()
    cur = conn.cursor(row_factory=dict_row)
    
    try:
        # Check if plan exists and user owns it
        if not check_plan_ownership(plan_id, user_id, conn):
            return jsonify(message="Plan not found or access denied"), 404
        
        cur.execute("""
            SELECT * FROM plans WHERE id = %s
        """, (plan_id,))
        
        original_plan = cur.fetchone()
        if not original_plan:
            return jsonify(message="Plan not found or access denied"), 404
        
        # Get current max version
        cur.execute("""
            SELECT MAX(version) as max_version FROM plans 
            WHERE id = %s OR parent_plan_id = %s
        """, (plan_id, plan_id))
        
        max_version = cur.fetchone()['max_version'] or 1
        new_version = max_version + 1
        
        # Create new plan version
        new_plan_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        
        cur.execute("""
            INSERT INTO plans (
                id, name, description, category, price, status, area, 
                bedrooms, bathrooms, floors, designer_id, created_at, 
                version, parent_plan_id, tags
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            new_plan_id,
            original_plan['name'],
            original_plan['description'],
            original_plan['category'],
            original_plan['price'],
            'Draft',  # New versions start as draft
            original_plan['area'],
            original_plan['bedrooms'],
            original_plan['bathrooms'],
            original_plan['floors'],
            user_id,
            created_at,
            new_version,
            plan_id,
            original_plan['tags']
        ))
        
        conn.commit()
        
        return jsonify({
            "message": "New plan version created",
            "plan_id": new_plan_id,
            "version": new_version,
            "parent_plan_id": plan_id
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify(message=f"Error creating version: {str(e)}"), 500
    finally:
        cur.close()
        conn.close()
