-- 028_temp_debug_projects.sql
-- Run this in SQL Editor to see if the project exists and who owns it

SELECT id, code, name, user_id, status 
FROM public.projects;

-- Also check how many users are in auth.users
SELECT count(*) as total_users FROM auth.users;

-- Check if any user matches the project's user_id
SELECT p.id as project_id, p.user_id, u.email 
FROM public.projects p
LEFT JOIN auth.users u ON p.user_id = u.id;
