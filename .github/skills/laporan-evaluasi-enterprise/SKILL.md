---
name: laporan-evaluasi-enterprise
description: 'Susun laporan evaluasi aplikasi construction project management yang siap dipresentasikan ke stakeholder, owner, investor, atau steering committee. Use for executive report, board-ready assessment, enterprise readiness summary, dan strategic recommendation memo.'
argument-hint: 'Opsional: target audience, fokus modul, konteks presentasi, atau prioritas keputusan.'
user-invocable: true
---

# Laporan Evaluasi Enterprise

Gunakan skill ini untuk mengubah hasil audit teknis menjadi laporan yang tajam, ringkas, dan siap dipakai untuk pengambilan keputusan oleh stakeholder non-teknis tanpa kehilangan akurasi teknis.

## Kapan Digunakan
- Saat user meminta laporan evaluasi yang siap dipresentasikan.
- Saat perlu merangkum hasil audit menjadi memo eksekutif atau steering-committee brief.
- Saat perlu menerjemahkan finding teknis menjadi implikasi bisnis, risiko, dan prioritas tindakan.

## Prasyarat
- Jika evaluasi penuh belum tersedia, jalankan dulu workflow audit yang setara dengan [evaluasi-konstruksi-enterprise](../evaluasi-konstruksi-enterprise/SKILL.md).
- Gunakan evidence repo, command output, test result, dan dokumen audit yang relevan.

## Referensi Utama
- [ARCHITECTURE.md](../../../ARCHITECTURE.md)
- [ENTERPRISE_READINESS_ASSESSMENT.md](../../../ENTERPRISE_READINESS_ASSESSMENT.md)
- [PROJECT_COSTING_EVALUATION.md](../../../PROJECT_COSTING_EVALUATION.md)
- [PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md](../../../PERFORMANCE_WAVE_PR_HANDOFF_2026-03-05.md)
- [WAVE4_QA_EXECUTION_SHEET_2026-03-05.md](../../../WAVE4_QA_EXECUTION_SHEET_2026-03-05.md)
- [WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md](../../../WCAG_ENFORCEMENT_IMPLEMENTATION_SUMMARY.md)

## Prosedur

### 1. Tentukan Sudut Pandang Laporan
- Identifikasi audiens: owner, investor, product lead, engineering lead, atau steering committee.
- Tentukan fokus keputusan: go/no-go release, hardening, refactor, roadmap, atau enterprise readiness.
- Sesuaikan tingkat detail agar tetap dapat dipahami pembaca non-coder.

### 2. Kumpulkan Temuan yang Sudah Tervalidasi
- Ambil hanya finding yang punya evidence jelas.
- Hapus detail implementasi yang tidak mengubah keputusan.
- Bedakan antara fakta, interpretasi, dan asumsi yang belum tervalidasi.

### 3. Susun Narasi Keputusan
- Nyatakan posisi sistem saat ini secara langsung: kuat, cukup, rapuh, atau belum siap.
- Jelaskan risiko utama dan kenapa itu penting bagi skala enterprise.
- Sorot area yang sudah solid agar laporan seimbang dan kredibel.

### 4. Konversi Temuan Menjadi Prioritas Tindakan
- Kelompokkan rekomendasi ke `Sekarang`, `Berikutnya`, dan `Nanti`.
- Sertakan dampak bisnis/teknis dan effort relatif.
- Pisahkan quick wins dari debt struktural dan blocker enterprise.

## Aturan Penulisan
- Utamakan kejelasan dan akurasi, bukan jargon.
- Hindari daftar masalah tanpa konteks dampak.
- Jangan menyatakan aplikasi siap enterprise tanpa dukungan bukti yang cukup.
- Jika ada area belum terverifikasi, tulis eksplisit sebagai open question.

## Format Output Wajib
1. Executive summary.
2. Posisi sistem saat ini.
3. Temuan utama berdasarkan severity dan dampak.
4. Area yang sudah solid.
5. Enterprise blockers.
6. Prioritas tindakan: `Sekarang`, `Berikutnya`, `Nanti`.
7. Open questions atau asumsi.

## Kriteria Selesai
- Laporan bisa dibaca stakeholder non-teknis tanpa kehilangan inti teknis.
- Setiap klaim penting punya evidence.
- Prioritas tindakan jelas dan dapat dipakai untuk keputusan berikutnya.

## Contoh Prompt
- `/laporan-evaluasi-enterprise buat executive summary untuk owner proyek`
- `/laporan-evaluasi-enterprise susun laporan board-ready untuk kesiapan enterprise aplikasi ini`
- `/laporan-evaluasi-enterprise rangkum temuan audit jadi memo keputusan untuk steering committee`
