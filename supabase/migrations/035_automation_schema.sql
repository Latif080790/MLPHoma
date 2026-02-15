-- ============================================================
-- Migration 035: Automation Schema (Notifications & Tools)
-- Purpose: Support Edge Functions (scheduler-cron)
-- ============================================================

-- 0. ENABLE EXTENSIONS (Required for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (Idempotent)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'INFO';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_link TEXT;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_project ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see notifications for their projects OR specifically for them
DROP POLICY IF EXISTS "Select Notifications" ON public.notifications;
CREATE POLICY "Select Notifications" ON public.notifications FOR SELECT
USING (
    (project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = notifications.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    ))
    OR
    (user_id = auth.uid())
);

-- Policy: Service Role (Edge Functions) can insert
DROP POLICY IF EXISTS "Insert Notifications System" ON public.notifications;
CREATE POLICY "Insert Notifications System" ON public.notifications FOR INSERT
WITH CHECK (true); -- Allow all inserts (controlled by app/service role) OR restict to service_role only in production via Grants


-- 2. TOOLS USAGE LOGS (For Auto-Rent Calculation)
CREATE TABLE IF NOT EXISTS public.tools_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id TEXT NOT NULL,
    resource_id TEXT NOT NULL, -- Link to resources table (tools)
    log_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, IDLE, RETURNED
    hours_used NUMERIC DEFAULT 0,
    rent_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_usage_project_date ON public.tools_usage_logs(project_id, log_date);

-- RLS for Tools Usage
ALTER TABLE public.tools_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select Tools Usage" ON public.tools_usage_logs;
CREATE POLICY "Select Tools Usage" ON public.tools_usage_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = tools_usage_logs.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- Policy: Service Role can insert/update
DROP POLICY IF EXISTS "Manage Tools Usage System" ON public.tools_usage_logs;
CREATE POLICY "Manage Tools Usage System" ON public.tools_usage_logs FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- DONE
-- Run this in Supabase SQL Editor to enable automation targets.
-- ============================================================
