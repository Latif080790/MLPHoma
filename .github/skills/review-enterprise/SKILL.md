---
name: review-enterprise
description: 'Lakukan review atau audit enterprise yang findings-first, evidence-based, dan fokus pada robustness aplikasi construction project management. Use for code review, architecture review, security review, performance review, UX/WCAG review, release readiness review, dan enterprise risk review.'
argument-hint: 'Opsional: area fokus seperti arsitektur, security, performance, UX, data, atau release readiness.'
user-invocable: true
---

# Review Enterprise

Gunakan skill ini saat user meminta review, audit, atau penilaian kualitas sistem dengan standar enterprise. Skill ini memaksa review tetap fokus pada temuan yang penting, berbasis bukti, dan dapat ditindaklanjuti.

## Kapan Digunakan
- Saat user meminta review kode, review aplikasi, atau audit kesiapan enterprise.
- Saat perlu menilai robustness arsitektur, security, performance, UX/WCAG, atau operational readiness.
- Saat perlu menjaga review agar tidak berubah menjadi ringkasan dangkal.

## Referensi Utama
- [ARCHITECTURE.md](../../../ARCHITECTURE.md)
- [CONTRIBUTING.md](../../../CONTRIBUTING.md)
- [ENTERPRISE_READINESS_ASSESSMENT.md](../../../ENTERPRISE_READINESS_ASSESSMENT.md)
- [PROJECT_COSTING_EVALUATION.md](../../../PROJECT_COSTING_EVALUATION.md)
- [evaluasi-konstruksi-enterprise](../evaluasi-konstruksi-enterprise/SKILL.md)

## Prosedur

### 1. Tetapkan Scope Review
- Tentukan apakah review mencakup sistem penuh atau area tertentu.
- Jika user tidak membatasi scope, minimal sentuh arsitektur, security, performance, UX/WCAG, data integrity, dan readiness operasional.

### 2. Kumpulkan Evidence
- Gunakan file, command, test, dokumen, dan perilaku sistem sebagai dasar temuan.
- Jika ada validasi executable yang murah, gunakan untuk menguatkan atau menggugurkan hipotesis review.
- Jangan menyimpulkan lebih jauh daripada bukti yang tersedia.

### 3. Temukan Risk yang Paling Penting
- Urutkan temuan menurut severity dan blast radius.
- Bedakan:
  - bug lokal,
  - debt struktural,
  - blocker enterprise,
  - quick win.
- Prioritaskan masalah fondasi di atas gejala permukaan.

### 4. Sintesis Hasil Review
- Tulis finding terlebih dulu.
- Untuk setiap finding, sertakan bukti, dampak, risiko jika dibiarkan, dan rekomendasi konkret.
- Jika tidak ada finding besar, katakan itu secara eksplisit dan tetap sebutkan gap verifikasi yang tersisa.

## Aturan Review
- Findings dulu, ringkasan belakangan.
- Hindari saran generik tanpa akar masalah yang jelas.
- Jika dokumen dan implementasi bertentangan, prioritaskan kondisi kode dan hasil validasi terbaru.
- Jangan menyebut “enterprise-ready” tanpa bukti untuk security, reliability, data safety, dan operability.
- Nyatakan tingkat keyakinan jika evidence masih parsial.

## Format Output Wajib
- Temuan berdasarkan severity.
- Open questions atau assumptions.
- Ringkasan singkat perubahan atau risiko residual.
- Prioritas tindakan `Sekarang`, `Berikutnya`, `Nanti` bila relevan.

## Kriteria Selesai
- Review berisi finding yang bisa ditindaklanjuti, bukan opini umum.
- Semua klaim penting punya evidence.
- Scope yang tidak tercakup dinyatakan eksplisit.

## Contoh Prompt
- `/review-enterprise review menyeluruh aplikasi ini untuk kesiapan enterprise`
- `/review-enterprise fokus pada architecture debt dan security risk`
- `/review-enterprise nilai apakah release saat ini cukup aman untuk scale-up`