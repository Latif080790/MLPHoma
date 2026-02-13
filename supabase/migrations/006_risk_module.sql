-- Migration: 006_risk_module.sql
-- Description: Adds Risk Management capabilities linked to WBS.

CREATE TABLE IF NOT EXISTS public.risks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  wbs_id uuid REFERENCES public.wbs_items(id), -- Optional link to specific task
  
  description text not null,
  category text, -- 'Technical', 'External', 'Organizational', 'Project Management', 'Safety', 'Financial'
  
  probability integer check (probability >= 1 and probability <= 5),
  impact integer check (impact >= 1 and impact <= 5),
  risk_score integer GENERATED ALWAYS AS (probability * impact) STORED,
  
  mitigation_plan text,
  owner text, -- Person responsible
  status text default 'OPEN', -- 'OPEN', 'MITIGATED', 'CLOSED', 'ISSUE' (Escalated)
  
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies (Draft)
-- ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable read access for all users" ON public.risks FOR SELECT USING (true);
-- CREATE POLICY "Enable insert for authenticated users only" ON public.risks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
