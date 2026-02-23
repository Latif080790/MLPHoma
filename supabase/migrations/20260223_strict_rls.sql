-- MLPHoma STRICT RLS MIGRATION
-- Date: 2026-02-23
-- Purpose: Hardening project security by restricting access to authorized members and admins only.

-- ============================================================
-- 1. SECURITY HELPER FUNCTIONS
-- ============================================================

-- Check if current user is a global administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a member of a specific project
CREATE OR REPLACE FUNCTION public.is_project_member(p_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = p_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = p_id AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has specific project roles
CREATE OR REPLACE FUNCTION public.has_project_role(p_id TEXT, required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = p_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = p_id 
      AND user_id = auth.uid() 
      AND project_role = ANY(required_roles)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 2. RESET PERMISSIONS & ENABLE RLS
-- ============================================================

-- Revoke blanket permissions from previous "Master Fix"
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Minimum necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable RLS for all relevant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahsp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahsp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahsp_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahsp_creation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rap_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashflow_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcon_chargebacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ahsp_zone_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. PROFILES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "allow_all_access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

GRANT SELECT ON public.profiles TO authenticated, anon;
GRANT UPDATE ON public.profiles TO authenticated;

-- ============================================================
-- 4. CATALOG & SYSTEM DATA POLICIES
-- ============================================================
-- Shared Reference Data (Viewable by all, manageable by admins)
DO $$ 
DECLARE 
    t TEXT;
    catalog_tables TEXT[] := ARRAY[
        'resources', 'ahsp_items', 'ahsp_components', 'ahsp_price_history', 
        'ahsp_creation_logs', 'vendors', 'zones', 'ahsp_zone_prices', 'app_settings'
    ];
BEGIN
    FOREACH t IN ARRAY catalog_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Everyone can view catalog" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admins can manage catalog" ON public.%I', t);
        
        EXECUTE format('CREATE POLICY "Everyone can view catalog" ON public.%I FOR SELECT USING (true)', t);
        EXECUTE format('CREATE POLICY "Admins can manage catalog" ON public.%I FOR ALL USING (is_admin())', t);
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated, anon', t);
        EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    END LOOP;
END $$;

-- Audit Logs (Insert/Select for all authenticated, Immutable)
DROP POLICY IF EXISTS "allow_all_access" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_only" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_all" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_only" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_select_all" ON public.audit_logs FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- ============================================================
-- 5. PROJECT & PROJECT MEMBER POLICIES
-- ============================================================
DROP POLICY IF EXISTS "allow_all_access" ON public.projects;
DROP POLICY IF EXISTS "Project access restricted to members" ON public.projects;
DROP POLICY IF EXISTS "Authors and Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authors and Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;

CREATE POLICY "Project access restricted to members" ON public.projects
  FOR SELECT USING (is_project_member(id));
CREATE POLICY "Authors and Admins can update projects" ON public.projects
  FOR UPDATE USING (is_admin() OR auth.uid() = user_id OR has_project_role(id, ARRAY['admin', 'manager']));
CREATE POLICY "Authors and Admins can delete projects" ON public.projects
  FOR DELETE USING (is_admin() OR auth.uid() = user_id);
CREATE POLICY "Authenticated users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;

-- Project Members
DROP POLICY IF EXISTS "allow_all_access" ON public.project_members;
DROP POLICY IF EXISTS "Membership viewable by project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins manage memberships" ON public.project_members;
CREATE POLICY "Membership viewable by project members" ON public.project_members
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Admins manage memberships" ON public.project_members
  FOR ALL USING (is_admin() OR has_project_role(project_id, ARRAY['admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;


-- ============================================================
-- 6. PROJECT DATA POLICIES (Scoped by project_id)
-- ============================================================
DO $$ 
DECLARE 
    t TEXT;
    project_tables TEXT[] := ARRAY[
        'rab_items', 'rab_versions', 'rab_approvals', 'wbs_items', 'timeline_tasks', 
        'task_dependencies', 'rap_items', 'rap_data', 'progress_evidence', 'progress_logs',
        'risks', 'material_requests', 'purchase_orders', 'inventory_items', 
        'inventory_transactions', 'invoices', 'expenses', 'cashflow_projections',
        'waste_logs', 'subcon_chargebacks', 'tools_usage_logs', 'documents', 'change_orders',
        'approval_requests', 'notifications', 'material_transfer_requests', 'goods_receipts', 'work_orders'
    ];
BEGIN
    FOREACH t IN ARRAY project_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Project data visible to members" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Project data manageable by leads" ON public.%I', t);
        
        EXECUTE format('CREATE POLICY "Project data visible to members" ON public.%I FOR SELECT USING (is_project_member(project_id))', t);
        EXECUTE format('CREATE POLICY "Project data manageable by leads" ON public.%I FOR ALL USING (has_project_role(project_id, ARRAY[''admin'', ''manager'']))', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END LOOP;
END $$;

-- Table Variants & Linked Data (Linked via parent_id)
-- PO Items
DO $$ 
DECLARE 
    t TEXT;
    po_item_tables TEXT[] := ARRAY['po_items', 'purchase_order_items'];
BEGIN
    FOREACH t IN ARRAY po_item_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "PO items visible to project members" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "PO items manageable by leads" ON public.%I', t);
        
        EXECUTE format('CREATE POLICY "PO items visible to project members" ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND is_project_member(po.project_id)))', t);
        EXECUTE format('CREATE POLICY "PO items manageable by leads" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND has_project_role(po.project_id, ARRAY[''admin'', ''manager''])))', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END LOOP;
END $$;

-- Change Order Items
DROP POLICY IF EXISTS "allow_all_access" ON public.change_order_items;
DROP POLICY IF EXISTS "CO items visible to project members" ON public.change_order_items;
DROP POLICY IF EXISTS "CO items manageable by leads" ON public.change_order_items;
CREATE POLICY "CO items visible to project members" ON public.change_order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.change_orders co WHERE co.id = change_order_id AND is_project_member(co.project_id)));
CREATE POLICY "CO items manageable by leads" ON public.change_order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.change_orders co WHERE co.id = change_order_id AND has_project_role(co.project_id, ARRAY['admin', 'manager'])));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_order_items TO authenticated;

-- ============================================================
-- 7. REFRESH
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 7. REFRESH
-- ============================================================
NOTIFY pgrst, 'reload schema';
