-- ==========================================
-- Clear Mock Data Script
-- Purpose: Remove all mock/test data from database
-- ==========================================

-- CAUTION: This will delete data!
-- Run only if you want to clean the database

DO $$
BEGIN
    -- Delete in reverse order of dependencies to avoid foreign key violations
    
    -- 1. Delete risks
    DELETE FROM public.risks WHERE project_id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock risks';
    
    -- 2. Delete timeline tasks
    DELETE FROM public.timeline_tasks WHERE project_id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock timeline tasks';
    
    -- 3. Delete RAP items
    DELETE FROM public.rap_items WHERE project_id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock RAP items';
    
    -- 4. Delete RAB items
    DELETE FROM public.rab_items WHERE project_id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock RAB items';
    
    -- 5. Delete WBS items
    DELETE FROM public.wbs_items WHERE project_id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock WBS items';
    
    -- 6. Delete AHSP components (mock ones only)
    DELETE FROM public.ahsp_components WHERE id IN ('comp-001', 'comp-002', 'comp-003');
    RAISE NOTICE 'Deleted mock AHSP components';
    
    -- 7. Delete AHSP items (mock ones only)
    DELETE FROM public.ahsp_items WHERE id IN ('ahsp-001', 'ahsp-002');
    RAISE NOTICE 'Deleted mock AHSP items';
    
    -- 8. Delete resources (mock ones only)
    DELETE FROM public.resources WHERE id LIKE 'res-%';
    RAISE NOTICE 'Deleted mock resources';
    
    -- 9. Delete mock project
    DELETE FROM public.projects WHERE id = 'MOCK-PRJ-001';
    RAISE NOTICE 'Deleted mock project';
    
    -- 10. Optionally delete mock user (be careful with this!)
    -- DELETE FROM public.profiles WHERE email = 'user@example.com';
    -- DELETE FROM auth.users WHERE email = 'user@example.com';

    RAISE NOTICE 'Mock data cleanup completed';
END $$;
