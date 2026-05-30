-- ============================================================
-- Migration: 20260530_rab_margin_embedded
-- Tujuan: Memindahkan OH+Profit dari lump-sum ke embedded dalam
--         unit_price per item RAB.
--
-- SEBELUM: unit_price = biaya AHSP (harga pokok)
--          final_total = unit_price * volume  (belum include margin)
--          OH & Profit dihitung sebagai baris tambahan di UI
--
-- SESUDAH: base_price  = biaya AHSP (harga pokok) — dipreservasi
--          unit_price  = base_price / (1 - (OH% + Profit%)) = harga jual
--          final_total = unit_price * volume  (sudah include margin)
--
-- CATATAN: Recalculate unit_price hanya bisa dilakukan per-project
--          karena rates (OH%, Profit%) tersimpan di project.meta.rabRates.
--          Migration ini hanya mengamankan base_price. Recalculate unit_price
--          dilakukan di aplikasi saat user membuka RAB dan menekan
--          "Terapkan ke Semua Item".
-- ============================================================

BEGIN;

-- Step 1: Tambah kolom base_price jika belum ada
ALTER TABLE rab_items
  ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0;

-- Step 2: Preserve harga pokok AHSP ke base_price untuk semua item lama
--         yang belum memiliki base_price (base_price IS NULL atau 0).
--         Asumsi: unit_price lama = harga AHSP/cost (sebelum margin).
UPDATE rab_items
SET base_price = unit_price
WHERE (base_price IS NULL OR base_price = 0)
  AND unit_price IS NOT NULL
  AND unit_price > 0;

-- Step 3: Tambah kolom base_price ke index jika perlu (opsional, performa)
-- Tidak diperlukan karena query sederhana.

COMMIT;

-- ============================================================
-- Verifikasi setelah migration:
-- SELECT id, name, unit_price, base_price, final_total
-- FROM rab_items
-- WHERE project_id = '<project_id>'
-- LIMIT 10;
--
-- Harusnya: base_price = unit_price (nilai AHSP lama)
-- unit_price belum berubah (akan diupdate oleh aplikasi)
-- ============================================================
