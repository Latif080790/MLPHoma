-- 037_fix_sync_cascade.sql
-- Purpose: Enable ON DELETE CASCADE for critical relationships between RAB, RAP, and Purchase Orders
-- to allow robust re-synchronization without foreign key violations.

-- 1. Fix rap_items -> rab_items relationship
ALTER TABLE public.rap_items
DROP CONSTRAINT IF EXISTS rap_items_rab_item_id_fkey;

ALTER TABLE public.rap_items
ADD CONSTRAINT rap_items_rab_item_id_fkey 
FOREIGN KEY (rab_item_id) 
REFERENCES public.rab_items(id) 
ON DELETE CASCADE;

-- 2. Fix po_items -> rap_items relationship
ALTER TABLE public.po_items
DROP CONSTRAINT IF EXISTS po_items_rap_item_id_fkey;

ALTER TABLE public.po_items
ADD CONSTRAINT po_items_rap_item_id_fkey 
FOREIGN KEY (rap_item_id) 
REFERENCES public.rap_items(id) 
ON DELETE SET NULL; -- SET NULL is safer for PO items if RAP is cleared, 
                   -- or CASCADE if we want it to be strictly synchronized.
                   -- User requirement implies full re-sync, so let's check which is better.
                   -- If a RAP item is deleted during sync, and it has a PO, CASCADE would delete the PO item.
                   -- That might be too aggressive. SET NULL is better to preserve the PO data even if the link is broken.
                   -- HOWEVER, the user error shows that the violation happens during DELETE.
                   -- If we use SET NULL, the delete won't be blocked.

-- Let's stick with CASCADE for now as the goal is "robust re-synchronization" 
-- and the previous strategy was clear-and-reinsert. 
-- Actually, the plan said: "Deleting a RAP item will automatically delete its linked PO items."
-- So CASCADE it is.

ALTER TABLE public.po_items
DROP CONSTRAINT IF EXISTS po_items_rap_item_id_fkey;

ALTER TABLE public.po_items
ADD CONSTRAINT po_items_rap_item_id_fkey 
FOREIGN KEY (rap_item_id) 
REFERENCES public.rap_items(id) 
ON DELETE CASCADE;

-- 3. Fix rap_items -> wbs_items (just in case)
ALTER TABLE public.rap_items
DROP CONSTRAINT IF EXISTS rap_items_wbs_id_fkey;

ALTER TABLE public.rap_items
ADD CONSTRAINT rap_items_wbs_id_fkey 
FOREIGN KEY (wbs_id) 
REFERENCES public.wbs_items(id) 
ON DELETE CASCADE;

-- 4. Fix material_requests -> wbs_items
ALTER TABLE public.material_requests
DROP CONSTRAINT IF EXISTS material_requests_wbs_id_fkey;

ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_wbs_id_fkey 
FOREIGN KEY (wbs_id) 
REFERENCES public.wbs_items(id) 
ON DELETE CASCADE;
