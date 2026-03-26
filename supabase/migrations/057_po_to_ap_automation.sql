-- Migration: 057_po_to_ap_automation.sql
-- Description: Automatically generate a finance_invoice (AP) when a Purchase Order is APPROVED.

CREATE OR REPLACE FUNCTION public.fn_po_approved_to_ap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Trigger only on status change to APPROVED
    IF (OLD.status IS DISTINCT FROM 'APPROVED' AND NEW.status = 'APPROVED') THEN
        
        -- 2. Idempotency Check: Don't create if already exists for this PO
        IF NOT EXISTS (SELECT 1 FROM public.finance_invoices WHERE po_id = NEW.id::text) THEN
            
            -- 3. Insert Invoice (AP)
            INSERT INTO public.finance_invoices (
                id,
                project_id,
                po_id,
                vendor_name,
                invoice_number,
                description,
                amount,
                total_amount,
                due_date,
                status,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid()::text,
                NEW.project_id,
                NEW.id::text,
                NEW.vendor_name,
                'INV-PO-' || NEW.po_number,
                'Auto-generated from Approved PO: ' || NEW.po_number,
                NEW.total_amount,
                NEW.total_amount,
                (CURRENT_DATE + INTERVAL '30 days')::DATE,
                'UNPAID',
                NOW(),
                NOW()
            );
            
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Attach trigger to purchase_orders
DROP TRIGGER IF EXISTS tr_po_approved_to_ap ON public.purchase_orders;
CREATE TRIGGER tr_po_approved_to_ap
    AFTER UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_po_approved_to_ap();
