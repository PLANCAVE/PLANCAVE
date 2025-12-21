-- migrations.sql - Extended schema and application-specific tables
-- This file builds on top of db.sql and is designed to be idempotent.

-- Enhanced Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);

-- Email verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Ensure existing users are active
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

-- Purchases/Transactions table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    transaction_id VARCHAR(255),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Selected deliverables for partial purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS selected_deliverables JSONB;

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_metadata JSONB;

-- Admin confirmation columns
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS admin_confirmed_at TIMESTAMP NULL;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS admin_confirmed_by INTEGER NULL REFERENCES users(id);

-- Stable external order reference
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP NULL;

-- Backfill missing order IDs for existing purchases
UPDATE purchases
SET order_id = COALESCE(order_id, 'ORD-' || UPPER(SUBSTRING(md5(random()::text), 1, 10)))
WHERE order_id IS NULL;

-- Ensure uniqueness for order references
CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchases_order_id ON purchases(order_id);

-- Ensure uniqueness of user/plan purchases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_purchases_user_plan'
    ) THEN
        ALTER TABLE purchases
            ADD CONSTRAINT uniq_purchases_user_plan UNIQUE (user_id, plan_id);
    END IF;
END$$;

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_cart_user_plan'
    ) THEN
        ALTER TABLE cart_items
            ADD CONSTRAINT uniq_cart_user_plan UNIQUE (user_id, plan_id);
    END IF;
END$$;

-- User Activity Tracking
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- 'login', 'purchase', 'view', 'download', 'upload'
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Quotas (for subscription limits)
CREATE TABLE IF NOT EXISTS user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL, -- 'downloads', 'uploads', 'storage'
    quota_limit INTEGER DEFAULT -1, -- -1 = unlimited
    quota_used INTEGER DEFAULT 0,
    reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_user_quotas_user_type'
    ) THEN
        ALTER TABLE user_quotas
            ADD CONSTRAINT uniq_user_quotas_user_type UNIQUE (user_id, quota_type);
    END IF;
END$$;

-- Initialize default quotas for existing users
INSERT INTO user_quotas (user_id, quota_type, quota_limit, quota_used)
SELECT u.id, 'downloads', -1, 0
FROM users u
LEFT JOIN user_quotas uq ON u.id = uq.user_id AND uq.quota_type = 'downloads'
WHERE uq.user_id IS NULL;

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_favorites_user_plan'
    ) THEN
        ALTER TABLE favorites
            ADD CONSTRAINT uniq_favorites_user_plan UNIQUE (user_id, plan_id);
    END IF;
END$$;

-- User Reviews/Ratings
CREATE TABLE IF NOT EXISTS plan_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_plan_reviews_plan_user'
    ) THEN
        ALTER TABLE plan_reviews
            ADD CONSTRAINT uniq_plan_reviews_plan_user UNIQUE (plan_id, user_id);
    END IF;
END$$;

-- Enhanced Plans table with detailed upload fields
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE plans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS parent_plan_id UUID REFERENCES plans(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS deliverable_prices JSONB;

-- Bill of Quantities (BOQs) table
CREATE TABLE IF NOT EXISTS boqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Structural specifications table
CREATE TABLE IF NOT EXISTS structural_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    spec_type VARCHAR(100) NOT NULL, -- e.g., 'foundation', 'roofing', 'walls'
    specification TEXT NOT NULL,
    standard VARCHAR(100), -- e.g., 'BS 8110', 'ACI 318'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance notes table
CREATE TABLE IF NOT EXISTS compliance_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    authority VARCHAR(100) NOT NULL, -- e.g., 'NEMA', 'NCA', 'Local Authority'
    requirement TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'compliant', -- 'compliant', 'pending', 'not_applicable'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan files table (for CAD, PDF, BIM files)
CREATE TABLE IF NOT EXISTS plan_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'CAD', 'PDF', 'BIM', 'DWG', 'RVT'
    file_path TEXT NOT NULL,
    file_size BIGINT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download tokens table for secure, one-time customer downloads
CREATE TABLE IF NOT EXISTS download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    token UUID UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_user ON download_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_plan ON download_tokens(plan_id);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'owner', 'editor', 'viewer'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_team_members_team_user'
    ) THEN
        ALTER TABLE team_members
            ADD CONSTRAINT uniq_team_members_team_user UNIQUE (team_id, user_id);
    END IF;
END$$;

-- Team collections (shared favorites)
CREATE TABLE IF NOT EXISTS team_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collection plans (many-to-many)
CREATE TABLE IF NOT EXISTS collection_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES team_collections(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_collection_plans_collection_plan'
    ) THEN
        ALTER TABLE collection_plans
            ADD CONSTRAINT uniq_collection_plans_collection_plan UNIQUE (collection_id, plan_id);
    END IF;
END$$;

-- Plan analytics table
CREATE TABLE IF NOT EXISTS plan_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    date DATE NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uniq_plan_analytics_plan_date'
    ) THEN
        ALTER TABLE plan_analytics
            ADD CONSTRAINT uniq_plan_analytics_plan_date UNIQUE (plan_id, date);
    END IF;
END$$;

-- User views tracking
CREATE TABLE IF NOT EXISTS plan_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- Additional plan fields from update_plans_schema.sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'Residential';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'All';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS disciplines_included JSONB DEFAULT '{"architectural": false, "structural": false, "mep": {"mechanical": false, "electrical": false, "plumbing": false}, "civil": false, "fire_safety": false, "interior": false}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS includes_boq BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_cost_min DECIMAL(12,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_cost_max DECIMAL(12,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS package_level VARCHAR(20) DEFAULT 'basic';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS building_code VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plot_size DECIMAL(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS building_height DECIMAL(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS parking_spaces INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS special_features JSONB DEFAULT '[]';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'single_use';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS customization_available BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS support_duration INTEGER DEFAULT 0; -- in months
ALTER TABLE plans ADD COLUMN IF NOT EXISTS file_paths JSONB DEFAULT '{"architectural": [], "structural": [], "mep": [], "civil": [], "fire_safety": [], "interior": [], "boq": [], "renders": []}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_timeline_ref TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS material_specifications TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS construction_notes TEXT;

-- Update existing plans with default values where missing
UPDATE plans
SET 
    project_type = COALESCE(project_type, 'Residential'),
    target_audience = COALESCE(target_audience, 'All'),
    disciplines_included = COALESCE(disciplines_included, '{"architectural": true, "structural": false, "mep": {"mechanical": false, "electrical": false, "plumbing": false}, "civil": false, "fire_safety": false, "interior": false}'),
    package_level = COALESCE(package_level, 'basic'),
    license_type = COALESCE(license_type, 'single_use');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boqs_plan_id ON boqs(plan_id);
CREATE INDEX IF NOT EXISTS idx_structural_specs_plan_id ON structural_specs(plan_id);
CREATE INDEX IF NOT EXISTS idx_compliance_notes_plan_id ON compliance_notes(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_files_plan_id ON plan_files(plan_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_plans_collection_id ON collection_plans(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_plans_plan_id ON collection_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_analytics_plan_id ON plan_analytics(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_analytics_date ON plan_analytics(date);
CREATE INDEX IF NOT EXISTS idx_plan_views_plan_id ON plan_views(plan_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_plan_id ON purchases(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT_EXISTS idx_favorites_plan_id ON favorites(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan_id ON plan_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_user_id ON plan_reviews(user_id);
