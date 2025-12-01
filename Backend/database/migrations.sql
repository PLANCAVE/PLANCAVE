-- Enhanced Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Purchases/Transactions table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    transaction_id VARCHAR(255),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quota_type)
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);

-- User Reviews/Ratings
CREATE TABLE IF NOT EXISTS plan_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plan_id, user_id)
);

-- Enhanced Plans table with detailed upload fields
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE plans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS parent_plan_id UUID REFERENCES plans(id);

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
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

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
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, plan_id)
);

-- Plan analytics table
CREATE TABLE IF NOT EXISTS plan_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    date DATE NOT NULL,
    UNIQUE(plan_id, date)
);

-- User views tracking
CREATE TABLE IF NOT EXISTS plan_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- Create indexes for performance
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
CREATE INDEX IF NOT EXISTS idx_favorites_plan_id ON favorites(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan_id ON plan_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_user_id ON plan_reviews(user_id);
