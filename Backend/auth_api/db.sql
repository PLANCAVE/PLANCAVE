-- db.sql - Base schema for PlanCave
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
    password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sales_count INT DEFAULT 0
);

-- Basic indexes for core tables
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category);
CREATE INDEX IF NOT EXISTS idx_plans_designer_id ON plans(designer_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
