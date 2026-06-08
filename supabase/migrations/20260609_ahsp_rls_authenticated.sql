-- Migration 20260609: Tighten AHSP RLS from allow_all to require_authenticated
-- Apply via Supabase SQL Editor after confirming authenticated users can still access data.
-- Uses IF EXISTS on all DROPs so this is safe to run even if some policies don't exist.

BEGIN;

-- ============================================================
-- ahsp_items
-- Known permissive policies from migration history:
--   "AHsp global access"        (015_v3_master_final.sql)
--   "allow_all_access"          (20260219_master_rls_fix.sql)
--   "Authenticated AHSP Access" (20260215_secure_rls_final.sql) -- uses USING(true)? replaced here
-- ============================================================
DROP POLICY IF EXISTS "AHsp global access" ON public.ahsp_items;
DROP POLICY IF EXISTS "allow_all_access" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public select ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public insert ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public update ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public delete ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Authenticated AHSP Access" ON public.ahsp_items;
DROP POLICY IF EXISTS "require_authenticated" ON public.ahsp_items;

CREATE POLICY "require_authenticated" ON public.ahsp_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- ahsp_components
-- Known permissive policies from migration history:
--   "AHSP Components global access"    (20260217_fix_ahsp_policies.sql)
--   "Allow public all ahsp_components" (20260217_fix_ahsp_policies.sql)
--   "allow_all_access"                 (20260219_master_rls_fix.sql)
--   "Authenticated AHSP Component Access" (20260217_fix_ahsp_policies.sql)
-- ============================================================
DROP POLICY IF EXISTS "AHSP Components global access" ON public.ahsp_components;
DROP POLICY IF EXISTS "Allow public all ahsp_components" ON public.ahsp_components;
DROP POLICY IF EXISTS "allow_all_access" ON public.ahsp_components;
DROP POLICY IF EXISTS "Authenticated AHSP Component Access" ON public.ahsp_components;
DROP POLICY IF EXISTS "require_authenticated" ON public.ahsp_components;

CREATE POLICY "require_authenticated" ON public.ahsp_components
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- ahsp_price_history
-- Known permissive policies from migration history:
--   "Global History Access"              (019_ahsp_history_and_refinement.sql)
--   "AHSP History global access"         (20260217_fix_ahsp_policies.sql)
--   "Allow public all ahsp_price_history" (20260217_fix_ahsp_policies.sql)
--   "Allow public select ahsp_price_history" (999_add_ahsp_price_history.sql)
--   "Allow public insert ahsp_price_history" (999_add_ahsp_price_history.sql)
--   "Allow public update ahsp_price_history" (999_add_ahsp_price_history.sql)
--   "Allow public delete ahsp_price_history" (999_add_ahsp_price_history.sql)
--   "Authenticated AHSP History Access"  (20260217_fix_ahsp_policies.sql)
-- ============================================================
DROP POLICY IF EXISTS "Global History Access" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "AHSP History global access" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Allow public all ahsp_price_history" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Allow public select ahsp_price_history" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Allow public insert ahsp_price_history" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Allow public update ahsp_price_history" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Allow public delete ahsp_price_history" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "Authenticated AHSP History Access" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "allow_all_access" ON public.ahsp_price_history;
DROP POLICY IF EXISTS "require_authenticated" ON public.ahsp_price_history;

CREATE POLICY "require_authenticated" ON public.ahsp_price_history
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- ahsp_zone_prices
-- Known permissive policies from migration history:
--   "Global Zone Price Access" (018_zone_based_pricing.sql)
--   "allow_all_access"         (20260219_master_rls_fix.sql, if included in its loop)
-- ============================================================
DROP POLICY IF EXISTS "Global Zone Price Access" ON public.ahsp_zone_prices;
DROP POLICY IF EXISTS "allow_all_access" ON public.ahsp_zone_prices;
DROP POLICY IF EXISTS "require_authenticated" ON public.ahsp_zone_prices;

CREATE POLICY "require_authenticated" ON public.ahsp_zone_prices
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- resources (shared across modules)
-- Known permissive policies from migration history:
--   "Allow public select resources"  (20260215_secure_rls_final.sql)
--   "Allow public insert resources"  (20260215_secure_rls_final.sql)
--   "Allow public update resources"  (20260215_secure_rls_final.sql)
--   "Allow public delete resources"  (20260215_secure_rls_final.sql)
--   "allow_all_access"               (20260219_master_rls_fix.sql)
--   "Authenticated Resource Access"  (20260215_secure_rls_final.sql)
-- ============================================================
DROP POLICY IF EXISTS "Allow public select resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public insert resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public update resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public delete resources" ON public.resources;
DROP POLICY IF EXISTS "allow_all_access" ON public.resources;
DROP POLICY IF EXISTS "Authenticated Resource Access" ON public.resources;
DROP POLICY IF EXISTS "require_authenticated" ON public.resources;

CREATE POLICY "require_authenticated" ON public.resources
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMIT;
