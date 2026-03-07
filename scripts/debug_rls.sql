-- 1. Check if the function exists
SELECT routine_name, routine_type, security_type
FROM information_schema.routines 
WHERE routine_name = 'user_has_rab_item_access';

-- 2. Check policies on rab_wbs_links
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'rab_wbs_links';

-- 3. Check projects table columns (especially user_id vs owner_id)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check if project_members table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'project_members' AND table_schema = 'public';

-- 5. Check rab_items sample to see if project_id is populated
SELECT id, project_id FROM public.rab_items LIMIT 5;
