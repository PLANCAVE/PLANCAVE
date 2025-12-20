-- db.sql - Base schema for Ramanicave
-- This defines the minimal core tables used by the application.

-- Enable pgcrypto for gen_random_uuid() if available
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
    ) THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        EXCEPTION WHEN insufficient_privilege THEN
            -- Ignore if we don't have permission; UUIDs can still be supplied by app
            NULL;
        END;
    END IF;
END$$;

-- Core users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
    first_name VARCHAR(120),
    middle_name VARCHAR(120),
    last_name VARCHAR(120),
    phone VARCHAR(20),
    profile_image TEXT,
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Core plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    status TEXT NOT NULL,
    area FLOAT NOT NULL,
    bedrooms INT NOT NULL,
    bathrooms INT NOT NULL,
    floors INT NOT NULL,
    image_url TEXT NOT NULL,
    designer_id INT REFERENCES users(id),
    description TEXT,
    tags TEXT[],
    version INTEGER DEFAULT 1,
    parent_plan_id UUID REFERENCES plans(id),
    project_type VARCHAR(50) DEFAULT 'Residential',
    target_audience VARCHAR(50) DEFAULT 'All',
    disciplines_included JSONB DEFAULT '{"architectural": true, "structural": false, "mep": {"mechanical": false, "electrical": false, "plumbing": false}, "civil": false, "fire_safety": false, "interior": false}',
    includes_boq BOOLEAN DEFAULT FALSE,
    estimated_cost_min DECIMAL(12,2),
    estimated_cost_max DECIMAL(12,2),
    package_level VARCHAR(20) DEFAULT 'basic',
    building_code VARCHAR(100),
    certifications JSONB DEFAULT '[]',
    plot_size DECIMAL(10,2),
    building_height DECIMAL(10,2),
    parking_spaces INTEGER DEFAULT 0,
    special_features JSONB DEFAULT '[]',
    license_type VARCHAR(50) DEFAULT 'single_use',
    customization_available BOOLEAN DEFAULT FALSE,
    support_duration INTEGER DEFAULT 0,
    deliverable_prices JSONB,
    file_paths JSONB DEFAULT '{"architectural": [], "structural": [], "mep": [], "civil": [], "fire_safety": [], "interior": [], "boq": [], "renders": []}',
    project_timeline_ref TEXT,
    material_specifications TEXT,
    construction_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sales_count INT DEFAULT 0
);

-- Core purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    plan_id UUID NOT NULL REFERENCES plans(id),
    purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    license_type VARCHAR(50) NOT NULL DEFAULT 'single_use',
    selected_deliverables JSONB,
    UNIQUE (user_id, plan_id)
);

-- Basic indexes for core tables
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category);
CREATE INDEX IF NOT EXISTS idx_plans_designer_id ON plans(designer_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
