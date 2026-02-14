-- 020_fix_schema_and_permissions.sql

-- 1. Fix missing column in timeline_tasks
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS assigned_resources TEXT[] DEFAULT '{}';

-- 2. Fix permissions for sequences (e.g. project_code_seq)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Ensure table permissions are correct for authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. Fix specific sequence if needed (explicitly)
-- CREATE SEQUENCE IF NOT EXISTS project_code_seq; -- Should already exist
GRANT USAGE, SELECT ON SEQUENCE project_code_seq TO authenticated;
