

CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_active_users INTEGER NOT NULL DEFAULT 0,
    new_users INTEGER NOT NULL DEFAULT 0,
    returning_users INTEGER NOT NULL DEFAULT 0,
    page_views INTEGER NOT NULL DEFAULT 0,
    average_session_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    feature_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    geographic_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    product_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);