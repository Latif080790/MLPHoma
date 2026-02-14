-- 025_fix_all_remaining_id_types.sql
-- Purpose: Complete the transition from UUID to TEXT for all core application tables.
-- This ensures that custom string IDs (like "res-l-001", "ahsp-001") are supported across all modules.

DO $$
DECLARE
    r RECORD;
    drop_query TEXT;
    alter_target_query TEXT;
    alter_source_query TEXT;
    recreate_query TEXT;
    target_tables TEXT[] := ARRAY[
        'projects', 'rab_items', 'rap_items', 'wbs_items', 
        'ahsp_items', 'resources', 'ahsp_components', 
        'timeline_tasks', 'task_dependencies', 'risks',
        'purchase_orders', 'po_items', 'material_requests',
        'inventory_transactions', 'change_orders', 'change_order_items',
        'zones', 'ahsp_zone_prices', 'ahsp_price_history',
        'curvas_data_points', 'curvas_analyses', 'curvas_scenarios',
        'documents'
    ];
BEGIN
    -- 1. CREATE A TEMPORARY TABLE TO STORE FK DATA
    CREATE TEMP TABLE temp_fks_all (
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

    -- 2. POPULATE TEMP TABLE WITH ALL FKs POINTING TO OUR TARGET TABLES
    INSERT INTO temp_fks_all
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
        AND ccu.table_name = ANY(target_tables)
        AND ccu.table_schema = 'public';

    -- 3. DROP ALL IDENTIFIED FOREIGN KEYS
    FOR r IN SELECT * FROM temp_fks_all LOOP
        drop_query := format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
        BEGIN
            EXECUTE drop_query;
            RAISE NOTICE 'Dropped constraint: % on table %', r.constraint_name, r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop constraint: % (might have been dropped already)', r.constraint_name;
        END;
    END LOOP;

    -- 4. CONVERT TARGET TABLE ID COLUMNS TO TEXT
    DECLARE
        t TEXT;
    BEGIN
        FOREACH t IN ARRAY target_tables
        LOOP
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'id' AND data_type = 'uuid') THEN
                alter_target_query := format('ALTER TABLE public.%I ALTER COLUMN id TYPE TEXT USING id::TEXT', t);
                EXECUTE alter_target_query;
                -- Also update default if it was uuid_generate_v4()
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT NULL', t);
                RAISE NOTICE 'Converted % .id to TEXT', t;
            END IF;
        END LOOP;
    END;

    -- 5. CONVERT ALL REFERENCING COLUMNS TO TEXT
    FOR r IN SELECT DISTINCT table_schema, table_name, column_name FROM temp_fks_all LOOP
        -- Check if it's currently a UUID before altering
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = r.column_name AND data_type = 'uuid') THEN
            alter_source_query := format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE TEXT USING %I::TEXT', r.table_schema, r.table_name, r.column_name, r.column_name);
            EXECUTE alter_source_query;
            RAISE NOTICE 'Altered referring column % in table % to TEXT', r.column_name, r.table_name;
        END IF;
    END LOOP;

    -- 6. RE-CREATE ALL FOREIGN KEYS
    FOR r IN SELECT * FROM temp_fks_all LOOP
        recreate_query := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON DELETE %s ON UPDATE %s', 
            r.table_schema, r.table_name, r.constraint_name, r.column_name, 
            r.foreign_table_schema, r.foreign_table_name, r.foreign_column_name,
            r.on_delete, r.on_update);
        BEGIN
            EXECUTE recreate_query;
            RAISE NOTICE 'Re-created constraint: %', r.constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to recreate constraint: % (Table % column %)', r.constraint_name, r.table_name, r.column_name;
        END;
    END LOOP;

    -- 7. SPECIAL HANDLING: self-referential parent_id columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wbs_items' AND column_name = 'parent_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.wbs_items ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;
        RAISE NOTICE 'Converted wbs_items.parent_id to TEXT';
    END IF;

    RAISE NOTICE 'Migration 025 completed successfully.';
END $$;
