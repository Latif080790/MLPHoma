# GAP MATRIX v2.0 (Planned vs Implemented vs Pending)

**Date:** 2026-02-17  
**Scope:** MLPHoma transformation tracking after UI/UX refactor batch  
**Purpose:** Memetakan gap implementasi aktual terhadap target Masterplan v2.0

## Status Legend
- **Implemented**: Sudah tersedia dan dipakai di codebase
- **Partial**: Sudah ada pondasi, namun belum end-to-end
- **Pending**: Belum diimplementasikan atau masih konseptual

## A) Cross-Module Foundation

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Design density standard | Enterprise dense UI konsisten lintas modul | Implemented | Utility class global + dipakai lintas page | Perlu coverage 100% semua halaman low-traffic | Audit visual terakhir + parity pass | High |
| Safe confirmation flow | Semua aksi destruktif melalui in-app confirmation | Implemented | Migrasi luas dari browser confirm/alert ke AlertDialog | Masih perlu review edge-flow tersisa | Tambah checklist QA destructive actions | High |
| Dialog visual consistency | Primitive dialog seragam (glass/sticky style) | Implemented | Dialog & AlertDialog sudah diseragamkan | Risiko drift pada komponen custom lama | Lock design token di guideline internal | Medium |
| Mobile fallback data table | Tabel kritis tetap usable di HP | Partial | AHSP/RAB sudah punya fallback card mode | Belum semua tabel besar punya fallback | Prioritaskan Supply Chain + Finance table mobile | High |

## B) Project Costing Core (AHSP/RAB/RAP)

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Costing cockpit terpadu | Shell komando + WBS context + tab integrasi | Implemented | Costing shell baru aktif | Belum semua insight bisnis real-time | Tambah panel KPI operasional lanjutan | High |
| AHSP estimator ergonomics | Supply/Install split, sectioning, totals | Implemented | Tabel AHSP sudah direstruktur | Validasi user lapangan belum formal | UAT estimator 3 skenario utama | High |
| RAB high-density editing | Sticky controls + auto-schedule guard | Implemented | RAB table + confirm workflow aktif | Belum ada autosave granular per edit | Tambah optimistic/autosave indicator | Medium |
| RAP control readability | Status badge + import guard + compact view | Implemented | RAP control view sudah diselaraskan | Integrasi impact analysis belum dalam | Tambah “variance root-cause” widget | Medium |
| Snapshot/versioning costing | Freeze nilai kontrak saat baseline | Pending | Belum ada mekanisme snapshot formal | Risiko mutasi nilai historis | Definisikan schema snapshot + lock state | Critical |

## C) Schedule, WBS, Progress

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| WBS-Timeline UX safety | Delete/edit flow aman + jelas | Implemented | Confirm delete sudah aktif | Belum ada permission matrix detail | Tambah role-based action guard | High |
| Progress evidence-based | Progress wajib bukti (foto/GPS/time) | Pending | Belum enforce pipeline evidence | Risiko progress bias/manipulasi | Implementasi validation gate progress | Critical |
| Critical path alerting | Early warning jalur kritis | Pending | Belum ada alert CPM operasional | Risiko keterlambatan tak terdeteksi dini | Tambah CPM alert service + widget | High |
| Shadow S-Curve (CCO aware) | Plan/Actual/Shadow curve terpisah | Pending | Belum tersedia penuh | Risiko salah baca deviasi | Tambah data model shadow progress | Medium |

## D) Supply Chain & Finance Control

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| End-to-end WBS procurement | MR -> PO -> GRN -> AP terikat WBS | Pending | Alur penuh belum aktif | Cost leakage tinggi tanpa traceability | Bangun module flow bertahap dari MR | Critical |
| Budget guard saat PO | Hard check RAP balance sebelum PO | Pending | Guard backend belum aktif | Over-budget risk tanpa hard block | RPC check_budget_availability + approval override | Critical |
| Material re-allocation approval | Transfer material wajib approval PM | Pending | Belum ada workflow MTR formal | Reclass cost tidak terkendali | Tambah tabel/request status + dashboard queue | High |
| 3-way matching AP | PO vs GRN vs Invoice validation | Pending | Belum enforce rule secara sistemik | Fraud/overpayment risk | Rule engine + blocking payment gate | Critical |
| Cashflow forecasting | Prediksi defisit/surplus kas | Partial | Finance view ada, forecasting belum matang | Keputusan cash kurang proaktif | Tambah rolling forecast 4–8 minggu | High |

## E) Change Management & Documents Governance

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CCO/VO lifecycle | Draft -> review -> approve -> addendum | Partial | UI change module ada + confirm flow | Belum end-to-end governance legal/finance | Definisikan state machine + mandatory fields | High |
| Impact analysis card | Dampak biaya/waktu sebelum approve | Partial | Struktur UI ada, engine belum penuh | Approval tidak berbasis data lengkap | Hitung otomatis delta biaya/waktu | High |
| Immutable document versioning | Tidak overwrite, semua versi terlacak | Partial | Version history UI tersedia | Governance archive/active belum ketat | Tambah policy version chain + lock | High |
| QR validation dokumen lapangan | Scan untuk validasi versi terbaru | Pending | Belum tersedia | Risiko pakai gambar kadaluarsa | Implement QR stamp + validator endpoint | Critical |
| Audit trail tamper-proof | Log persetujuan/perubahan tidak bisa dimanipulasi | Partial | Jejak aksi ada di beberapa area | Belum unified dan immutable | Tambah append-only audit log service | Critical |

## F) Security, Roles, and Operational Discipline

| Area | Target v2.0 | Status | Evidence (Current) | Gap / Risk | Next Action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Granular role permissions | Akses per fitur/aksi sensitif | Pending | Role guard detail belum lengkap | Risiko data exposure & unauthorized action | Definisikan RBAC matrix + middleware checks | Critical |
| Approval queue command center | Satu antrean persetujuan semua modul | Pending | Belum ada queue unified | Bottleneck approval manual (chat) | Bangun approval inbox lintas domain | High |
| Ops KPI risk monitor | Top risk + overdue + anomaly ringkas | Partial | Beberapa komponen ada terpisah | Belum menjadi cockpit tunggal | Satukan ke Command Center v2 | High |

## G) Prioritized Execution Roadmap (Recommended)

## Sprint 1 (Stability + Control Gates)
1. Implement hard budget guard untuk procurement (`RAP check` + override approval).  
2. Implement MTR workflow dasar (request, pending, approve/reject, posting).  
3. Implement unified approval queue (minimal PO + transfer + invoice pay).

## Sprint 2 (Traceability + Governance)
1. Implement end-to-end WBS trace flow MR -> PO -> GRN -> AP.  
2. Implement immutable document version chain + archive policy.  
3. Implement append-only audit log untuk aksi sensitif.

## Sprint 3 (Predictive + Quality)
1. Implement progress evidence gate (foto + timestamp + GPS).  
2. Implement critical-path warning + schedule deviation monitor.  
3. Implement cashflow forecast + risk summary widget pada Command Center.

## H) Decision Notes for Reviewer
- Batch refactor saat ini sudah kuat di UX consistency dan interaction safety.  
- Gap terbesar ada di **backend control engine** (budget guard, approval workflow, immutable governance).  
- Prioritas bisnis tertinggi tetap: **stop leakage dulu**, lalu **predictive optimization**.

## I) Execution Board
- Backlog eksekusi sprint tersedia di:
	- `BACKLOG_EXECUTION_SPRINT_BOARD_2026-02-17.md`
