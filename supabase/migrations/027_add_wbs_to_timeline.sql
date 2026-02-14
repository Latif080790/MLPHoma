-- 027_add_wbs_to_timeline.sql
-- Purpose: Add 'wbs_id' column to timeline_tasks to link tasks to WBS structure.
-- This is critical for the Gantt chart and resource loading aggregation.

DO $$
BEGIN
    -- Add 'wbs_id' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'timeline_tasks' 
        AND column_name = 'wbs_id'
    ) THEN
        ALTER TABLE public.timeline_tasks ADD COLUMN wbs_id TEXT;
        
        -- Add foreign key constraint safely
        -- We use TEXT type for ID as per the new v10 master data fix
        -- But we need to ensure the foreign key allows for loose coupling if needed, 
        -- or strict if we are sure wbs_items uses TEXT ids now.
        -- Given 025 migrated everything to TEXT, we can try to add the FK.
        
        BEGIN
            ALTER TABLE public.timeline_tasks 
            ADD CONSTRAINT timeline_tasks_wbs_id_fkey 
            FOREIGN KEY (wbs_id) REFERENCES public.wbs_items(id) ON DELETE SET NULL;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add foreign key constraint timeline_tasks_wbs_id_fkey, possibly due to type mismatch. Skipping FK for now.';
        END;
    END IF;

    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_timeline_tasks_wbs_id ON public.timeline_tasks(wbs_id);

END $$;
