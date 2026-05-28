---
name: supabase-enterprise-audit
description: 'Audit Supabase secara mendalam untuk aplikasi construction project management. Use for schema review, RLS review, RBAC review, migration safety audit, SQL editor cleanup audit, data governance review, auth boundary review, dan enterprise database readiness assessment.'
argument-hint: 'Opsional: area fokus seperti RLS, migrations, schema drift, auth, cleanup, atau production safety.'
user-invocable: true
---

# Supabase Enterprise Audit

Gunakan skill ini untuk mengevaluasi fondasi database dan keamanan Supabase secara teliti, akurat, dan aman, terutama untuk memastikan schema, RLS, migration flow, dan governance cukup kuat untuk kebutuhan enterprise.

## Kapan Digunakan
- Saat diminta audit Supabase, RLS, migrasi, atau keamanan data.
- Saat perlu menilai apakah fondasi database cukup aman untuk scale-up enterprise.
- Saat perlu memisahkan technical debt migration dari risk produksi yang nyata.
- Saat perlu review sebelum schema change, hardening, cleanup SQL editor, atau rollout environment baru.

## Sumber Bukti Utama
- Base schema: [supabase_schema.sql](../../../supabase_schema.sql)
- Migration guide: [MIGRATION_GUIDE.md](../../../MIGRATION_GUIDE.md)
- Manual migration guide: [MANUAL_MIGRATION_GUIDE.md](../../../MANUAL_MIGRATION_GUIDE.md)
- Quick reference migration: [QUICK_REFERENCE_MIGRATION.md](../../../QUICK_REFERENCE_MIGRATION.md)
- Critical migration summary: [CRITICAL_MIGRATION_SUMMARY.md](../../../CRITICAL_MIGRATION_SUMMARY.md)
- Supabase migration notes: [supabase/migrations/MIGRATION_20260226_README.md](../../../supabase/migrations/MIGRATION_20260226_README.md)
- SQL cleanup analysis: [SQL_EDITOR_CLEANUP_ANALYSIS.md](../../../SQL_EDITOR_CLEANUP_ANALYSIS.md)
- SQL cleanup checklist: [SUPABASE_SQL_EDITOR_CLEANUP_CHECKLIST.md](../../../SUPABASE_SQL_EDITOR_CLEANUP_CHECKLIST.md)

## Fokus Audit Wajib
1. Struktur schema dan relasi inti.
2. RLS, RBAC, dan authorization boundary.
3. Ketergantungan tabel, function, trigger, dan policy.
4. Migration hygiene, replay safety, rollback practicality, dan drift risk.
5. Auth/session assumptions dan akses lintas proyek.
6. Data governance: auditability, ownership, traceability, dan sensitive operations.
7. Operational safety: cleanup risk, production blast radius, dan deploy discipline.

## Prosedur

### 1. Tetapkan Cakupan Audit
- Tentukan apakah audit fokus pada keamanan, migrasi, cleanup, schema, atau readiness produksi.
- Bedakan environment target: local, staging, production, atau repo-only assessment.
- Jika akses ke project Supabase tersedia, audit read-only lebih dulu sebelum menyentuh perubahan apa pun.

### 2. Petakan Surface Area Database
- Baca base schema dan migration docs untuk memahami model data yang diharapkan.
- Inventaris migration files, helper SQL, dan script yang pernah dipakai manual.
- Cari area rawan seperti duplicate numbering, manual SQL editor steps, function deprecations, dan emergency fixes.

### 3. Audit Authorization dan RLS
- Verifikasi apakah policy mengikuti prinsip least privilege.
- Cari policy permisif seperti `USING (true)` atau `WITH CHECK (true)` tanpa pembatasan yang layak.
- Tinjau dependency chain policy terhadap tabel seperti `project_members`, helper functions, dan role assumptions.
- Nilai failure mode: apa yang terjadi jika dependency function/table tidak ada atau datanya kosong.

### 4. Audit Migration Safety
- Tinjau apakah urutan migrasi bisa direplay dengan aman di environment baru.
- Cari migration yang sudah dieksekusi manual tapi belum tercermin rapi dalam histori.
- Periksa apakah rollback realistis atau hanya teoritis.
- Sorot perubahan yang bisa menyebabkan downtime, data loss, auth lockout, atau schema drift.

### 5. Audit Governance dan Operability
- Periksa apakah audit trail, ownership, dan action logging cukup untuk enterprise control.
- Tinjau apakah ada operasi sensitif tanpa pembatasan atau observability yang memadai.
- Nilai kualitas dokumentasi operasional: apakah engineer lain bisa menjalankan recovery, validation, dan deploy dengan aman.

### 6. Gunakan Tooling Tambahan Saat Tersedia
- Jika terhubung ke Supabase tools, mulai dengan read-only inspection seperti logs, advisors, dan table inventory.
- Gunakan query read-only untuk verifikasi policy, function, dan dependency sebelum merekomendasikan perubahan.
- Jangan menjalankan migration, reset, merge, atau cleanup destruktif selama audit kecuali user secara eksplisit meminta perubahan.

### 7. Sintesis Temuan
- Kelompokkan temuan ke `Critical`, `High`, `Medium`, `Low`.
- Untuk setiap temuan, nyatakan:
  - evidence,
  - impact,
  - blast radius,
  - likelihood,
  - rekomendasi,
  - effort relatif.
- Pisahkan antara:
  - fix keamanan mendesak,
  - debt migration/documentation,
  - improvement governance jangka menengah.

## Aturan Keputusan
- Jika ada konflik antara schema file dan state produksi yang terdokumentasi, nyatakan adanya drift dan jangan mengasumsikan keduanya sinkron.
- Jika policy terlihat aman tetapi bergantung pada object yang rapuh, nilai itu tetap sebagai risk.
- Jika cleanup SQL editor berpotensi menghapus jejak penting untuk audit atau rollback, anggap sebagai risiko tinggi.
- Jika belum ada bukti runtime, tandai temuan sebagai partially verified alih-alih menyimpulkan terlalu jauh.

## Format Hasil
- Executive summary singkat.
- Temuan berdasarkan severity.
- Daftar risiko produksi paling kritis.
- Penilaian readiness untuk hardening, migration replay, dan governance.
- Prioritas tindakan: `Sekarang`, `Berikutnya`, `Nanti`.
- Open questions atau verifikasi lanjutan yang diperlukan.

## Kriteria Selesai
- RLS, migration safety, schema drift, dan governance sudah ditinjau atau dinyatakan out-of-scope.
- Semua klaim utama punya evidence yang dapat ditelusuri.
- Temuan membedakan masalah dokumentasi, masalah proses, dan risiko produksi nyata.
- Output cukup jelas untuk memandu hardening atau cleanup berikutnya.

## Contoh Prompt
- `/supabase-enterprise-audit audit RLS dan migration safety untuk aplikasi ini`
- `/supabase-enterprise-audit cek apakah fondasi Supabase sudah layak untuk enterprise`
- `/supabase-enterprise-audit fokus pada schema drift, manual migration, dan cleanup risk`