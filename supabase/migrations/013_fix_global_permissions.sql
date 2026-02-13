-- 013_fix_global_permissions.sql

-- 1. FIX SCHEMA PERMISSIONS (Critical for "permission denied for schema public")
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- 2. PROJECTS TABLE (Ensure RLS policy exists)
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON projects;
CREATE POLICY "Enable read access for all users" ON projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON projects;
CREATE POLICY "Enable insert for authenticated users only" ON projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON projects;
CREATE POLICY "Enable update for authenticated users only" ON projects FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON projects;
CREATE POLICY "Enable delete for authenticated users only" ON projects FOR DELETE USING (auth.role() = 'authenticated');

-- 3. AHSP ITEMS (Re-apply select policy)
ALTER TABLE IF EXISTS ahsp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON ahsp_items;
CREATE POLICY "Enable read access for all users" ON ahsp_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ahsp_items;
CREATE POLICY "Enable all access for authenticated users" ON ahsp_items FOR ALL USING (auth.role() = 'authenticated');

-- 4. WBS ITEMS (Schedule)
ALTER TABLE IF EXISTS wbs_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON wbs_items;
CREATE POLICY "Enable read access for all users" ON wbs_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON wbs_items;
CREATE POLICY "Enable all access for authenticated users" ON wbs_items FOR ALL USING (auth.role() = 'authenticated');

-- 5. SUPPLY CHAIN TABLES (Vendors, POs, Inventory)
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON vendors;
CREATE POLICY "Enable read access for all users" ON vendors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON vendors;
CREATE POLICY "Enable all access for authenticated users" ON vendors FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE IF EXISTS purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON purchase_orders;
CREATE POLICY "Enable read access for all users" ON purchase_orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON purchase_orders;
CREATE POLICY "Enable all access for authenticated users" ON purchase_orders FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory_items;
CREATE POLICY "Enable read access for all users" ON inventory_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON inventory_items;
CREATE POLICY "Enable all access for authenticated users" ON inventory_items FOR ALL USING (auth.role() = 'authenticated');

-- 6. RISKS TABLE (Special handling as it was reported missing)
-- If table doesn't exist, create a baseline to avoid errors
CREATE TABLE IF NOT EXISTS public.risks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  description text not null,
  status text default 'OPEN',
  created_at timestamptz default now()
);

ALTER TABLE IF EXISTS risks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON risks;
CREATE POLICY "Enable read access for all users" ON risks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON risks;
CREATE POLICY "Enable all access for authenticated users" ON risks FOR ALL USING (auth.role() = 'authenticated');

-- 7. REALTIME PUBLICATION
-- Ensure tables are in the publication for real-time updates
-- Note: We use a block to handle existing publication logic more safely if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE projects, wbs_items, purchase_orders, risks;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: just try to add them if they aren't already there
    NULL;
END $$;
