-- 022_fix_id_types_cascade.sql
-- Purpose: Robustly convert ID columns to TEXT across the system by dynamically handling foreign keys.
-- This script will:
-- 1. Identify all foreign keys pointing to projects, rab_items, rap_items, and wbs_items.
-- 2. Drop them.
-- 3. Convert all participating columns to TEXT.
-- 4. Re-create them.

DO $$
DECLARE
    r RECORD;
    drop_query TEXT;
    alter_target_query TEXT;
    alter_source_query TEXT;
    recreate_query TEXT;
BEGIN
    -- 1. CREATE A TEMPORARY TABLE TO STORE FK DATA
    CREATE TEMP TABLE temp_fks (
        table_schema TEXT,
        table_name TEXT,
        constraint_name TEXT,
        column_name TEXT,
        foreign_table_schema TEXT,
        foreign_table_name TEXT,
        foreign_column_name TEXT,
        on_delete TEXT,
        on_update TEXT
    ) ON COMMIT DROP;

    -- 2. POPULATE TEMP TABLE WITH RELEVANT FKs
    INSERT INTO temp_fks
    SELECT 
        tc.table_schema, 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema, 
        ccu.table_name AS foreign_table_name, 
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema 
        JOIN information_schema.constraint_column_usage AS ccu 
          ON ccu.constraint_name = tc.constraint_name 
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
    WHERE 
        tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name IN ('projects', 'rab_items', 'rap_items', 'wbs_items')
        AND ccu.table_schema = 'public';

    -- 3. DROP ALL IDENTIFIED FOREIGN KEYS
    FOR r IN SELECT * FROM temp_fks LOOP
        drop_query := format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
        EXECUTE drop_query;
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;

    -- 4. CONVERT TARGET TABLE ID COLUMNS TO TEXT
    -- projects
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.projects ALTER COLUMN id TYPE TEXT USING id::TEXT;
    END IF;
    -- rab_items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rab_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.rab_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
    END IF;
    -- rap_items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.rap_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
    END IF;
    -- wbs_items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wbs_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.wbs_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
    END IF;

    -- 5. CONVERT ALL REFERENCING COLUMNS TO TEXT
    FOR r IN SELECT DISTINCT table_schema, table_name, column_name FROM temp_fks LOOP
        alter_source_query := format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE TEXT USING %I::TEXT', r.table_schema, r.table_name, r.column_name, r.column_name);
        EXECUTE alter_source_query;
        RAISE NOTICE 'Altered column % in table % to TEXT', r.column_name, r.table_name;
    END LOOP;

    -- 6. RE-CREATE ALL FOREIGN KEYS
    FOR r IN SELECT * FROM temp_fks LOOP
        recreate_query := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON DELETE %s ON UPDATE %s', 
            r.table_schema, r.table_name, r.constraint_name, r.column_name, 
            r.foreign_table_schema, r.foreign_table_name, r.foreign_column_name,
            r.on_delete, r.on_update);
        EXECUTE recreate_query;
        RAISE NOTICE 'Re-created constraint: %', r.constraint_name;
    END LOOP;

    -- 7. CLEAN UP OTHER CORE COLUMNS (project_id, etc. in items tables)
    -- ensure projects.project_id (if exists - wait, projects usually don't have project_id)
    -- ensure rab_items.project_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rab_items' AND column_name = 'project_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.rab_items ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;
    END IF;
    -- ensure rap_items.project_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'project_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.rap_items ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;
    END IF;
    -- ensure wbs_items.project_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wbs_items' AND column_name = 'project_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.wbs_items ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;
    END IF;
    -- ensure wbs_items.parent_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wbs_items' AND column_name = 'parent_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.wbs_items ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;
    END IF;

    RAISE NOTICE 'Migration 022 completed successfully.';
END $$;

-- 8. Add/Update additional columns for RAP consistency (Safety duplication from 021)
DO $$
BEGIN
    -- rap_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'cost_material') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_material numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'cost_labor') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_labor numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'cost_equipment') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_equipment numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'cost_subcon') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_subcon numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'period_key') THEN
        ALTER TABLE public.rap_items ADD COLUMN period_key text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'planned_volume') THEN
        ALTER TABLE public.rap_items ADD COLUMN planned_volume numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'actual_volume') THEN
        ALTER TABLE public.rap_items ADD COLUMN actual_volume numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rap_items' AND column_name = 'status') THEN
        ALTER TABLE public.rap_items ADD COLUMN status text DEFAULT 'not_started';
    END IF;
END $$;
