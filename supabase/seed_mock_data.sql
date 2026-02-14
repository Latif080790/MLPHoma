-- ==========================================
-- MLPHoma Mock Data Seeding Script (V3.2)
-- Purpose: Populate all modules with test data for verification.
-- ==========================================

-- 1. Create a Mock Project
-- 1. Create a Mock Project
-- We must assign a user_id to see it in the app due to RLS.
-- We'll pick the first user found in auth.users.
WITH first_user AS (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
)
INSERT INTO public.projects (id, code, name, client_name, location, start_date, end_date, budget, status, user_id)
SELECT
  'MOCK-PRJ-001', 
  'PRJ-2026-0001', 
  'Pembangunan Gedung Perkantoran ABC', 
  'PT. Maju Bersama', 
  'Jakarta Selatan', 
  '2026-03-01', 
  '2026-09-01', 
  1500000000, 
  'active',
  id -- Assign to the first user found
FROM first_user
ON CONFLICT (id) 
DO UPDATE SET 
  user_id = EXCLUDED.user_id; -- Ensure ownership is claimed if row exists

-- 2. Create Master Resources (Labor, Material, Equipment)
INSERT INTO public.resources (id, code, name, type, unit, unit_price)
VALUES 
  ('res-l-001', 'LBR-SKL', 'Pekerja Terampil', 'LABOR', 'OH', 150000),
  ('res-l-002', 'LBR-TUK', 'Tukang Batu', 'LABOR', 'OH', 180000),
  ('res-m-001', 'MAT-CEM', 'Semen Portland (50kg)', 'MATERIAL', 'Sak', 65000),
  ('res-m-002', 'MAT-SND', 'Pasir Pasang', 'MATERIAL', 'm3', 250000),
  ('res-e-001', 'EQP-MIX', 'Concrete Mixer', 'EQUIPMENT', 'Hari', 350000)
ON CONFLICT (id) DO NOTHING;

-- 3. Create AHSP Master Items
INSERT INTO public.ahsp_items (id, code, name, unit, category, base_price, final_price, overhead_percentage)
VALUES 
  ('ahsp-001', 'A.2.2.1.1', 'Pemasangan 1m2 Dinding Bata Merah', 'm2', 'Pekerjaan Dinding', 120000, 132000, 10),
  ('ahsp-002', 'A.2.3.1.1', 'Plesteran 1m2 Dinding', 'm2', 'Pekerjaan Plasteran', 45000, 49500, 10)
ON CONFLICT (id) DO NOTHING;

-- 4. AHSP Components (Linking Resources to AHSP)
INSERT INTO public.ahsp_components (id, ahsp_id, resource_id, type, coefficient, unit, unit_price, subtotal)
VALUES
  ('comp-001', 'ahsp-001', 'res-l-001', 'LABOR', 0.3, 'OH', 150000, 45000),
  ('comp-002', 'ahsp-001', 'res-m-001', 'MATERIAL', 0.2, 'Sak', 65000, 13000),
  ('comp-003', 'ahsp-001', 'res-e-001', 'EQUIPMENT', 0.1, 'Hari', 350000, 35000)
ON CONFLICT (id) DO NOTHING;

-- 5. WBS structure for MOCK-PRJ-001
INSERT INTO public.wbs_items (id, project_id, code, name, level, sort_order)
VALUES 
  ('wbs-root-1', 'MOCK-PRJ-001', '1', 'Pekerjaan Persiapan', 1, 1),
  ('wbs-root-2', 'MOCK-PRJ-001', '2', 'Pekerjaan Struktur', 1, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wbs_items (id, project_id, code, name, level, parent_id, sort_order)
VALUES 
  ('wbs-child-1-1', 'MOCK-PRJ-001', '1.1', 'Mobilisasi Alat', 2, 'wbs-root-1', 1),
  ('wbs-child-2-1', 'MOCK-PRJ-001', '2.1', 'Pekerjaan Dinding Lantai 1', 2, 'wbs-root-2', 1)
ON CONFLICT (id) DO NOTHING;

-- 6. RAB Items (Linked to Project)
INSERT INTO public.rab_items (id, project_id, ahsp_code, name, unit, volume, unit_price, final_total, cost_material, cost_labor, cost_equipment)
VALUES 
  ('rab-001', 'MOCK-PRJ-001', 'A.2.2.1.1', 'Pemasangan Dinding Bata Merah - Lt 1', 'm2', 500, 132000, 66000000, 25000000, 15000000, 5000000),
  ('rab-002', 'MOCK-PRJ-001', 'A.2.3.1.1', 'Plesteran Dinding - Lt 1', 'm2', 1000, 49500, 49500000, 15000000, 20000000, 0)
ON CONFLICT (id) DO NOTHING;

-- 7. RAP Items (Logical breakdown for implementation)
INSERT INTO public.rap_items (id, project_id, rab_item_id, wbs_id, qty_budget, unit_price_budget, cost_material, cost_labor, status)
VALUES 
  ('rap-001', 'MOCK-PRJ-001', 'rab-001', 'wbs-child-2-1', 500, 110000, 25000000, 15000000, 'in_progress'),
  ('rap-002', 'MOCK-PRJ-001', 'rab-002', 'wbs-child-2-1', 1000, 40000, 15000000, 20000000, 'not_started')
ON CONFLICT (id) DO NOTHING;

-- 8. Timeline Tasks (Linked to Project & WBS)
INSERT INTO public.timeline_tasks (id, project_id, wbs_id, name, start_date, end_date, duration, progress, status, priority, dependencies)
VALUES 
  ('task-001', 'MOCK-PRJ-001', 'wbs-child-1-1', 'Mobilisasi Alat Berat', '2026-03-01', '2026-03-05', 5, 100, 'completed', 'high', '[]'),
  ('task-002', 'MOCK-PRJ-001', 'wbs-child-2-1', 'Pemasangan Bata Lt 1', '2026-03-06', '2026-03-20', 15, 20, 'in_progress', 'medium', '[{"id": "task-001", "type": "FS"}]')
ON CONFLICT (id) DO NOTHING;

-- 9. Risks for Project
INSERT INTO public.risks (id, project_id, description, category, probability, impact, risk_score, status, mitigation_plan)
VALUES 
  ('risk-001', 'MOCK-PRJ-001', 'Kenaikan harga material semen', 'FINANCIAL', 4, 3, 12, 'OPEN', 'Membeli semen dalam jumlah besar di awal (stockpiling)'),
  ('risk-002', 'MOCK-PRJ-001', 'Keterlambatan pengiriman alat berat', 'SCHEDULE', 2, 5, 10, 'OPEN', 'Menyiapkan vendor cadangan')
ON CONFLICT (id) DO NOTHING;

-- 10. Curva-S Data Points (skipped — table is computed from timeline/RAP data)

-- Finished Seeding Mock Data
