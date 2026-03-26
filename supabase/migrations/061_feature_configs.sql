-- ============================================================
-- 061_feature_configs.sql
-- Persistent per-project feature configuration.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feature_configs (
  project_id   TEXT PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  config       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_configs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS allow_all_feature_configs ON public.feature_configs;
CREATE POLICY allow_all_feature_configs ON public.feature_configs FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_feature_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_configs_updated_at ON public.feature_configs;
CREATE TRIGGER trg_feature_configs_updated_at
  BEFORE UPDATE ON public.feature_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_configs_updated_at();
