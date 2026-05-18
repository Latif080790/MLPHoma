-- Migration 074: BI report templates

CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
  dataset TEXT NOT NULL CHECK (dataset IN ('DASHBOARD_KPI', 'RISK_REGISTER', 'PURCHASE_ORDERS')),
  chart_type TEXT NOT NULL DEFAULT 'TABLE' CHECK (chart_type IN ('TABLE', 'BAR', 'LINE', 'AREA', 'PIE')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_project_updated
  ON public.report_templates(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_templates_dataset
  ON public.report_templates(dataset);

CREATE INDEX IF NOT EXISTS idx_report_templates_shared
  ON public.report_templates(is_shared);

CREATE OR REPLACE FUNCTION public.update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER trg_report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_report_templates_updated_at();

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_templates_select ON public.report_templates;
CREATE POLICY report_templates_select
  ON public.report_templates
  FOR SELECT
  USING (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  );

DROP POLICY IF EXISTS report_templates_insert ON public.report_templates;
CREATE POLICY report_templates_insert
  ON public.report_templates
  FOR INSERT
  WITH CHECK (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  );

DROP POLICY IF EXISTS report_templates_update ON public.report_templates;
CREATE POLICY report_templates_update
  ON public.report_templates
  FOR UPDATE
  USING (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  )
  WITH CHECK (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  );

DROP POLICY IF EXISTS report_templates_delete ON public.report_templates;
CREATE POLICY report_templates_delete
  ON public.report_templates
  FOR DELETE
  USING (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  );
