---
description: "Use when reviewing, auditing, or evaluating this construction project management application for enterprise robustness, architecture quality, security risk, performance, UX/WCAG, data integrity, or release readiness."
name: "Enterprise Review Rules"
---

# Enterprise Review Rules

- Mulai dari finding dan risk, bukan ringkasan umum.
- Urutkan temuan berdasarkan severity dan blast radius.
- Untuk setiap temuan penting, sertakan evidence yang dapat ditelusuri: file, command, test, doc, atau perilaku.
- Bedakan dengan jelas:
  - bug lokal,
  - debt struktural,
  - blocker enterprise,
  - quick win.
- Jangan menyebut aplikasi "enterprise-ready" tanpa dukungan bukti untuk security, reliability, data safety, dan operability.
- Jika dokumen dan implementasi bertentangan, prioritaskan kondisi kode dan output validasi terbaru.
- Evaluasi harus menyentuh setidaknya arsitektur, security, performance, UX/WCAG, data integrity, dan operational readiness, kecuali user secara eksplisit membatasi scope.
- Hindari saran generik. Rekomendasi harus konkret, dapat dieksekusi, dan mengarah ke root cause.
- Jika validation command tersedia, gunakan sebagai penguat atau penyangkal hipotesis review.
- Saat menyusun hasil, akhiri dengan prioritas tindakan `Sekarang`, `Berikutnya`, dan `Nanti` bila itu membantu keputusan.

## Referensi Repo
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [ENTERPRISE_READINESS_ASSESSMENT.md](../../ENTERPRISE_READINESS_ASSESSMENT.md)
- [PROJECT_COSTING_EVALUATION.md](../../PROJECT_COSTING_EVALUATION.md)
