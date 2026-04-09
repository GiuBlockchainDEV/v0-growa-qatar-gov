-- Growa Qatar - Seed Data
-- Step 0.5: Supabase bootstrap artifacts
--
-- SEED DATA DISCIPLINE:
-- 1. Seed data is for development and testing only
-- 2. Production data should NEVER be seeded automatically
-- 3. Keep seed data realistic but safe (no real credentials)
-- 4. Seed data should be idempotent (can run multiple times)
--
-- Seed data will be populated in Phase 1, Step 1.8:
-- - Qatar country instance
-- - Sample organizations (Ministry, Hassad Food, QDB)
-- - Sample departments
-- - Role templates
-- - Legal labels

-- Placeholder: Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Seed data will be added in Phase 1
SELECT 'Growa Qatar seed placeholder - Phase 0 complete' AS status;
