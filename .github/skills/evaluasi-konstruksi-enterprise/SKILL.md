---
name: evaluasi-konstruksi-enterprise
description: 'Evaluasi aplikasi construction project management secara menyeluruh, mendalam, sistematis, teliti, akurat, presisi, komprehensif, dan enterprise-grade. Use for audit aplikasi konstruksi, architecture review, security review, performance review, UX/WCAG review, data integrity review, readiness assessment, robustness gap analysis, dan roadmap prioritas.'
argument-hint: 'Opsional: area fokus, target pengguna, modul, lingkungan, atau standar yang harus diprioritaskan.'
user-invocable: true
---

# Evaluasi Konstruksi Enterprise

Gunakan skill ini untuk mengevaluasi aplikasi manajemen proyek konstruksi secara efektif, efisien, sistematis, dan berbasis bukti sehingga hasil akhirnya bisa dipakai sebagai dasar hardening, refactor, QA, dan roadmap menuju aplikasi enterprise yang robust.

## Kapan Digunakan
- Saat diminta melakukan evaluasi end-to-end terhadap aplikasi construction project management.
- Saat perlu audit menyeluruh yang mencakup domain bisnis, arsitektur, keamanan, performa, UX, aksesibilitas, data, dan kesiapan operasional.
- Saat perlu membedakan quick wins, structural debt, dan enterprise blockers.
- Saat perlu menghasilkan rekomendasi prioritas dengan dampak, risiko, dan effort yang jelas.

## Sumber Bukti Utama
- Arsitektur dan alur sistem: [ARCHITECTURE.md](../../../ARCHITECTURE.md)
- Kesiapan enterprise dan roadmap: [ENTERPRISE_READINESS_ASSESSMENT.md](../../../ENTERPRISE_READINESS_ASSESSMENT.md)
- Evaluasi domain costing: [PROJECT_COSTING_EVALUATION.md](../../../PROJECT_COSTING_EVALUATION.md)
- Aturan kontribusi, quality gate, dan WCAG: [CONTRIBUTING.md](../../../CONTRIBUTING.md)
- QA execution baseline: [WAVE4_QA_EXECUTION_SHEET_2026-03-05.md](../../../WAVE4_QA_EXECUTION_SHEET_2026-03-05.md)
- Performance handoff: [PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md](../../../PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md)
- WCAG enforcement summary: [WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md](../../../WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md)
- Typography compliance detail: [WCAG_TYPOGRAPHY_COMPLIANCE_REPORT.md](../../../WCAG_TYPOGRAPHY_COMPLIANCE_REPORT.md)

## Area Evaluasi Wajib
1. Kecocokan domain konstruksi.
2. Ketepatan arsitektur dan batas tanggung jawab layer.
3. Kualitas data, integritas relasi, dan sinkronisasi.
4. Security, auth, authorization, dan compliance risk.
5. Reliability, error handling, observability, dan recoverability.
6. Performance, scalability, concurrency, dan main-thread pressure.
7. UX, workflow efficiency, mobile/PWA fitness, dan accessibility.
8. Testability, maintainability, developer workflow, dan release readiness.
9. Enterprise readiness: governance, auditability, extensibility, integration readiness.

## Prosedur

### 1. Tetapkan Cakupan dan Hipotesis Evaluasi
- Identifikasi tujuan evaluasi: audit umum, readiness enterprise, evaluasi modul tertentu, atau pre-release gate.
- Catat argumen pengguna: modul fokus, persona, target pasar, prioritas risiko, atau standar wajib.
- Jika konteks belum lengkap, ajukan pertanyaan singkat hanya untuk hal yang mengubah jalur evaluasi secara material.

### 2. Petakan Bukti Sebelum Menilai
- Mulai dari dokumentasi inti lalu cocokkan dengan implementasi nyata di `src/`, `supabase/`, dan konfigurasi proyek.
- Inventaris area utama: pages/modules, services, stores, workers, types, migrations, dan konfigurasi CI.
- Cari evidence yang bisa diverifikasi: command output, test status, lint/build results, file ownership, dependency hotspots, dan dokumen audit yang sudah ada.

### 3. Jalankan Baseline Teknis Paling Murah
- Gunakan baseline command berikut saat relevan:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:coverage`
- Jika command tidak bisa dijalankan atau terlalu mahal, nyatakan keterbatasannya dan lanjutkan dengan evidence statis yang tersedia.
- Jika hasil command bertentangan dengan dokumen, prioritaskan kondisi kode dan output terbaru.

### 4. Nilai Domain Konstruksi dan Kecocokan Produk
- Tinjau apakah modul inti seperti AHSP, RAB, RAP, WBS, timeline, cash flow, dan project controls saling terhubung secara konsisten.
- Pastikan workflow sesuai ekspektasi proyek konstruksi: traceability biaya, schedule linkage, forecast, approval gates, dan audit trail.
- Bedakan antara fitur yang tampak lengkap di UI dan fitur yang benar-benar robust secara data, validation, dan lifecycle.

### 5. Nilai Arsitektur dan Batas Layer
- Verifikasi apakah komponen UI, store, service, repository/data access, dan utilitas komputasi dipisahkan dengan sehat.
- Cari layer violations, file terlalu besar, duplicated logic, implicit coupling, dan state patterns yang tidak konsisten.
- Prioritaskan temuan yang menghambat testability, refactor safety, atau scaling tim engineering.

### 6. Nilai Data, Sync, dan Ketahanan Operasional
- Tinjau model data, migrasi, RLS/RBAC, schema drift, backward compatibility, dan ketergantungan lintas tabel.
- Audit offline-first behavior, queue/sync strategy, failure recovery, idempotency, dan conflict resolution.
- Periksa apakah error handling memberi recovery path yang jelas untuk user dan developer.

### 7. Nilai Security dan Compliance
- Cari kelemahan auth/session validation, authorization boundaries, public data exposure, input validation, dan sensitive action auditing.
- Evaluasi dependency risk, privilege assumptions, dan compliance-sensitive behavior yang penting untuk enterprise client.
- Jika ada ketergantungan pada konfigurasi eksternal atau database policy, tulis prasyarat dan blast radius secara eksplisit.

### 8. Nilai Performance dan Scalability
- Periksa main-thread blocking, render cost, table/list scalability, bundle strategy, lazy loading, caching, dan worker utilization.
- Cari operasi sinkron berat, pemrosesan dataset besar tanpa virtualisasi, dan alur yang rawan freeze di device lapangan.
- Bedakan bottleneck yang memengaruhi demo kecil dari bottleneck yang akan memukul deployment enterprise.

### 9. Nilai UX, WCAG, dan Workflow Lapangan
- Tinjau kejelasan informasi, density, navigation cost, keyboard accessibility, feedback state, empty/error state, dan mobile/PWA viability.
- Gunakan aturan WCAG repo sebagai baseline minimum, bukan target akhir.
- Sorot friction pada alur pengguna penting seperti costing, scheduling, approvals, dan field execution.

### 10. Sintesis Temuan Menjadi Prioritas Eksekusi
- Kelompokkan temuan ke: `Critical`, `High`, `Medium`, `Low`.
- Untuk tiap temuan, nyatakan: bukti, dampak bisnis/teknis, risiko jika dibiarkan, effort perkiraan, dan rekomendasi konkret.
- Pisahkan:
  - quick wins yang bisa dilakukan segera,
  - foundational fixes yang membuka jalur fitur enterprise,
  - roadmap jangka menengah untuk robustness dan scale.

## Aturan Keputusan
- Jika dokumentasi dan implementasi berbeda, anggap dokumen sebagai hipotesis dan kode sebagai sumber kebenaran operasional.
- Jika bukti hanya parsial, nyatakan tingkat keyakinan dan apa yang belum terverifikasi.
- Jika evaluasi terlalu luas untuk satu putaran, fokuskan dulu pada blocker dengan blast radius tertinggi.
- Jika user meminta review, prioritaskan finding dan risk, bukan ringkasan kosmetik.
- Jika sebuah masalah berasal dari fondasi, rekomendasikan perbaikan root cause alih-alih patch permukaan.

## Format Hasil yang Wajib Dihasilkan
- Executive summary singkat yang langsung menyebut posisi sistem saat ini.
- Temuan berurutan berdasarkan severity.
- Evidence per temuan: file, command, test, doc, atau perilaku yang diamati.
- Gap matrix singkat: area kuat, area rapuh, blocker enterprise, quick wins.
- Rekomendasi roadmap: sekarang, berikutnya, nanti.
- Assumptions/open questions jika ada area yang belum bisa diverifikasi.

## Kriteria Selesai
- Seluruh area evaluasi wajib sudah disentuh atau dinyatakan out-of-scope secara eksplisit.
- Setiap claim penting punya evidence yang bisa ditelusuri.
- Temuan sudah diprioritaskan dan dapat ditindaklanjuti.
- Hasil membedakan issue lokal, debt struktural, dan risiko enterprise.
- User dapat langsung memakai output untuk memutuskan hardening, refactor, atau fase roadmap berikutnya.

## Fokus Permukaan Kode yang Relevan di Repo Ini
- `src/pages/modules/` untuk workflow bisnis utama.
- `src/services/` untuk business logic dan orchestration.
- `src/store/` untuk state management dan coupling.
- `src/lib/` dan `src/workers/` untuk utilitas inti dan komputasi berat.
- `supabase/` dan `supabase_schema.sql` untuk schema, migration, dan policy risk.
- `.github/workflows/` untuk quality gates dan release discipline.

## Contoh Prompt
- `/evaluasi-konstruksi-enterprise audit penuh untuk kesiapan enterprise aplikasi ini`
- `/evaluasi-konstruksi-enterprise fokus pada security, arsitektur, dan robustness data`
- `/evaluasi-konstruksi-enterprise nilai apakah modul costing sudah layak untuk skala enterprise`
- `/evaluasi-konstruksi-enterprise evaluasi efektifitas aplikasi ini untuk operasional proyek lapangan dan kantor`