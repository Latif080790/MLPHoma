-- Migration: 039_sprint2_traceability.sql
-- Description: Enforces End-to-End WBS propagation on Procurement tables and adds Immutable Audit triggers for budget alterations.

-- ==========================================
-- 1. END-TO-END WBS PROPAGATION
-- ==========================================

-- Supply Chain: Add WBS tracking to Purchase Order Items
-- This locks a purchased item back to its exact WBS origin from the Material Request.
ALTER TABLE public.po_items
ADD COLUMN IF NOT EXISTS wbs_id text REFERENCES public.wbs_items(id);

-- Depending on architecture, GRN items should also carry the WBS. If `grn_items` doesn't exist yet, we add it to the header or wait for the dedicated schema.
-- Checking if `grn` or `grn_items` exist:
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'grn') THEN
        ALTER TABLE public.grn ADD COLUMN IF NOT EXISTS wbs_id text REFERENCES public.wbs_items(id);
    END IF;
END $$;


-- Finance: Add WBS tracking to Invoices (if an invoice is specifically cut for a single WBS/MR)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS wbs_id text REFERENCES public.wbs_items(id);

-- Finance: Add WBS tracking to Expenses (Direct expenses not via PO)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS wbs_id text REFERENCES public.wbs_items(id);


-- ==========================================
-- 2. IMMUTABLE AUDIT TRAIL (Triggers)
-- ==========================================
-- We will write directly to public.audit_logs

-- A. RAP Item Budget Alteration Trigger
CREATE OR REPLACE FUNCTION trigger_log_rap_budget_change()
RETURNS trigger AS $$
BEGIN
    -- Only log if the budget actually changed
    IF NEW.qty_budget IS DISTINCT FROM OLD.qty_budget OR NEW.unit_price_budget IS DISTINCT FROM OLD.unit_price_budget THEN
        INSERT INTO public.audit_logs (user_id, action, entity, details, created_at)
        VALUES (
            -- Assuming auth.uid() is available from session, or null if system fallback
            coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'BUDGET_ALTERED',
            'rap_items',
            jsonb_build_object(
                'rap_item_id', NEW.id,
                'project_id', NEW.project_id,
                'old_qty', OLD.qty_budget,
                'new_qty', NEW.qty_budget,
                'old_price', OLD.unit_price_budget,
                'new_price', NEW.unit_price_budget,
                'old_total_budget', OLD.qty_budget * OLD.unit_price_budget,
                'new_total_budget', NEW.qty_budget * NEW.unit_price_budget
            ),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map the trigger
DROP TRIGGER IF EXISTS log_rap_budget_change_trigger ON public.rap_items;
CREATE TRIGGER log_rap_budget_change_trigger
AFTER UPDATE ON public.rap_items
FOR EACH ROW
EXECUTE FUNCTION trigger_log_rap_budget_change();


-- B. RAB Item Modification Trigger
CREATE OR REPLACE FUNCTION trigger_log_rab_modification()
RETURNS trigger AS $$
BEGIN
    -- Only log if key values changed
    IF NEW.volume IS DISTINCT FROM OLD.volume OR NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
        INSERT INTO public.audit_logs (user_id, action, entity, details, created_at)
        VALUES (
            coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'RAB_ALTERED',
            'rab_items',
            jsonb_build_object(
                'rab_item_id', NEW.id,
                'project_id', NEW.project_id,
                'old_volume', OLD.volume,
                'new_volume', NEW.volume,
                'old_price', OLD.unit_price,
                'new_price', NEW.unit_price,
                'old_total', OLD.final_total,
                'new_total', NEW.final_total
            ),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_rab_modification_trigger ON public.rab_items;
CREATE TRIGGER log_rab_modification_trigger
AFTER UPDATE ON public.rab_items
FOR EACH ROW
EXECUTE FUNCTION trigger_log_rab_modification();


-- C. Project Status Transition Trigger (e.g. Draft -> In Progress)
CREATE OR REPLACE FUNCTION trigger_log_project_status_change()
RETURNS trigger AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.audit_logs (user_id, action, entity, details, created_at)
        VALUES (
            coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'STATUS_CHANGED',
            'projects',
            jsonb_build_object(
                'project_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status
            ),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_project_status_change_trigger ON public.projects;
CREATE TRIGGER log_project_status_change_trigger
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION trigger_log_project_status_change();
