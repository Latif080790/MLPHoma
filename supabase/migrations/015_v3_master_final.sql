-- 015_v3_master_final.sql
-- PURPOSE: Fix UUID Type Mismatch and Consolidate SQL Permissions/Schema.

-- 1. FIX PROJECT ID TYPE (Critical for "P-001" string IDs)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all foreign keys that reference projects(id) using Postgres Catalogs (More reliable than info_schema)
    FOR r IN (
        SELECT 
            cl.relname AS table_name, 
            con.conname AS constraint_name
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        WHERE con.contype = 'f' 
        AND con.confrelid = 'public.projects'::regclass
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Safely convert projects.id to text if it's still UUID
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'id') = 'uuid' THEN
        ALTER TABLE public.projects ALTER COLUMN id TYPE text USING id::text;
        ALTER TABLE public.projects ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;
    END IF;

    -- Ensure all project_id columns in known tables are TEXT
    FOR r IN (
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE column_name = 'project_id' 
        AND table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' ALTER COLUMN project_id TYPE text USING project_id::text';
    END LOOP;
END $$;

-- 2. DYNAMIC COLUMN CHECK (Fix user_id if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.projects ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. CONSOLIDATED RLS POLICIES
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global Projects Access" ON public.projects;
CREATE POLICY "Global Projects Access" 
ON public.projects FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL OR auth.role() = 'service_role' OR auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Sub-table Policies
ALTER TABLE IF EXISTS public.wbs_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WBS global access" ON public.wbs_items;
CREATE POLICY "WBS global access" ON public.wbs_items FOR ALL USING (true);

ALTER TABLE IF EXISTS public.ahsp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AHsp global access" ON public.ahsp_items;
CREATE POLICY "AHsp global access" ON public.ahsp_items FOR ALL USING (true);

ALTER TABLE IF EXISTS public.rap_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RAP global access" ON public.rap_items;
CREATE POLICY "RAP global access" ON public.rap_items FOR ALL USING (true);

-- 4. GLOBAL PERMISSIONS
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, authenticated;

-- 5. RE-INITIALIZE REALTIME
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- 6. INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_projects_id_text ON public.projects(id);
CREATE INDEX IF NOT EXISTS idx_wbs_project_id ON public.wbs_items(project_id);
CREATE INDEX IF NOT EXISTS idx_rab_project_id ON public.rab_items(project_id);

-- 7. AUTO-GENERATED PROJECT NUMBER (REQUESTED BY USER)
-- Create a sequence for project numbering
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq START 1;

-- Function to generate code like PRJ-0001
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        NEW.code := 'PRJ-' || LPAD(nextval('public.project_code_seq')::text, 4, '0');
    END IF;
    
    -- Also ensure ID is set if not provided (to handle text-based IDs)
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := NEW.code; -- Use the code as ID for consistency if requested as 'safe generated number'
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to apply before insert
DROP TRIGGER IF EXISTS trg_auto_project_code ON public.projects;
CREATE TRIGGER trg_auto_project_code
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.generate_project_code();
