-- Comprehensive Plan Upload System - Database Schema Update
-- Add all professional construction plan fields

-- Project Classification
ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'Residential';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'All';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;

-- Disciplines Included (JSON structure)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS disciplines_included JSONB DEFAULT '{"architectural": false, "structural": false, "mep": {"mechanical": false, "electrical": false, "plumbing": false}, "civil": false, "fire_safety": false, "interior": false}';

-- BOQ & Costing
ALTER TABLE plans ADD COLUMN IF NOT EXISTS includes_boq BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_cost_min DECIMAL(12,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_cost_max DECIMAL(12,2);

-- Package Level
ALTER TABLE plans ADD COLUMN IF NOT EXISTS package_level VARCHAR(20) DEFAULT 'basic';

-- Compliance & Standards
ALTER TABLE plans ADD COLUMN IF NOT EXISTS building_code VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';

-- Technical Specifications
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plot_size DECIMAL(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS building_height DECIMAL(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS parking_spaces INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS special_features JSONB DEFAULT '[]';

-- Licensing
ALTER TABLE plans ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'single_use';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS customization_available BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS support_duration INTEGER DEFAULT 0; -- in months

-- File Paths (JSON structure for organized file storage)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS file_paths JSONB DEFAULT '{"architectural": [], "structural": [], "mep": [], "civil": [], "fire_safety": [], "interior": [], "boq": [], "renders": []}';

-- Additional metadata
ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_timeline_ref TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS material_specifications TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS construction_notes TEXT;

-- Update existing plans with default values
UPDATE plans SET 
    project_type = 'Residential',
    target_audience = 'All',
    disciplines_included = '{"architectural": true, "structural": false, "mep": {"mechanical": false, "electrical": false, "plumbing": false}, "civil": false, "fire_safety": false, "interior": false}',
    package_level = 'basic',
    license_type = 'single_use'
WHERE project_type IS NULL;
