---
description: "Susun laporan evaluasi aplikasi construction project management yang siap dipresentasikan ke stakeholder, owner, investor, atau steering committee. Use for executive report, board-ready assessment, enterprise readiness summary, dan strategic recommendation memo."
name: "Laporan Evaluasi Enterprise"
argument-hint: "Masukkan fokus, target audience, modul, atau konteks presentasi."
agent: "agent"
---

Buat laporan evaluasi yang rapi, tajam, dan siap dipresentasikan untuk aplikasi construction project management ini.

Gunakan temuan yang sudah ada di percakapan atau kumpulkan evidence yang diperlukan dari repo. Jika evaluasi penuh belum dilakukan, jalankan workflow yang setara dengan skill `evaluasi-konstruksi-enterprise` terlebih dahulu sebelum menyusun laporan akhir.

## Tujuan
- Mengubah hasil audit teknis menjadi laporan yang mudah dipakai untuk pengambilan keputusan.
- Menjaga isi tetap berbasis evidence, bukan opini umum.
- Menonjolkan posisi aplikasi saat ini, risiko utama, dan langkah prioritas menuju enterprise-grade robustness.

## Format Output
1. Executive summary singkat.
2. Posisi sistem saat ini: kuat, cukup, rapuh, atau belum siap.
3. Temuan utama berurutan berdasarkan severity dan dampak bisnis.
4. Area yang sudah solid dan bisa dipertahankan.
5. Enterprise blockers yang harus diselesaikan sebelum scale-up.
6. Rekomendasi prioritas:
   - Sekarang
   - Berikutnya
   - Nanti
7. Estimasi dampak dan effort relatif.
8. Open questions atau asumsi yang belum tervalidasi.

## Aturan Penulisan
- Tulis untuk pembaca non-coder yang tetap perlu keputusan teknis yang akurat.
- Jangan tenggelam dalam detail implementasi yang tidak memengaruhi keputusan.
- Setiap klaim penting harus ditopang oleh evidence dari file, test, command, atau dokumen repo.
- Bedakan quick wins, debt struktural, dan risiko enterprise.
- Jika ada area yang belum terverifikasi, nyatakan eksplisit.

## Sumber Referensi Utama
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [ENTERPRISE_READINESS_ASSESSMENT.md](../../ENTERPRISE_READINESS_ASSESSMENT.md)
- [PROJECT_COSTING_EVALUATION.md](../../PROJECT_COSTING_EVALUATION.md)
- [PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md](../../PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md)
- [WAVE4_QA_EXECUTION_SHEET_2026-03-05.md](../../WAVE4_QA_EXECUTION_SHEET_2026-03-05.md)
- [WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md](../../WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md)
