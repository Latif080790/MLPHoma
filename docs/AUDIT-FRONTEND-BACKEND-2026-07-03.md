# Audit Menyeluruh Frontend UI/UX & Backend — MLPHoma

**Tanggal:** 2026-07-03
**Metode:** Analisis statis seluruh codebase (313 file .tsx + 266 file .ts), 101 migrasi Supabase, 2 Edge Functions, konfigurasi build/deploy, hasil typecheck/lint/test aktual.
**Baseline:** Evaluasi 2026-05-21 skor 71/100 → pasca Phase 0–5 + redesign ≈ 86/100.

---

## 0. Ringkasan Eksekutif

Fondasi aplikasi **sehat**: `tsc --noEmit` bersih (0 error), **554/554 test lulus** (71 file test), 165 index database, arsitektur service-layer rapi (70 services), navigasi terpusat (`navRegistry`), dan offline-sync queue berbasis IndexedDB yang matang.

Namun audit menemukan **1 insiden keamanan kritis (P0)**, **3 gap arsitektural besar** (fitur yang sudah dibangun tapi tidak pernah disambungkan), dan **hutang konsistensi UI/UX** yang menahan aplikasi di level "86" dan mencegahnya jadi produk enterprise yang benar-benar solid:

| Kategori | Temuan utama |
|---|---|
| 🔴 Keamanan | Service role key ter-commit di git; auth fail-open; tanpa security headers |
| 🟠 Arsitektur | realtimeManager 0 konsumen; React Query hanya 1/19 halaman; RBAC tidak dipakai di route |
| 🟡 UI/UX | AsyncBoundary hanya 1 pemakai; 2 sistem tema paralel; bahasa campur ID/EN; responsivitas halaman v3 minim |
| 🟢 Kebersihan | 7 halaman legacy mati + 36 file sampah di root; 466 lint warning |

---

## 1. TEMUAN KRITIS — WAJIB DIPERBAIKI SEGERA (P0)

### SEC-01 · Service role key Supabase ter-commit di repository
- File `.env` **ter-track di git** (masuk sejak commit `54e8b53`) dan berisi `SUPABASE_SERVICE_KEY` berupa JWT asli (221 karakter, prefix `eyJhbGciO...`) — persis di bawah komentar *"DANGER: Never commit this!"*.
- Service role key **melewati semua RLS**. Siapa pun yang punya akses repo (atau clone lama) bisa membaca/menulis seluruh database produksi.
- **Tindakan:**
  1. **Rotate** service role key di Supabase Dashboard sekarang (Settings → API → regenerate).
  2. `git rm --cached .env` lalu commit (`.gitignore` sudah benar, tapi file terlanjur ter-track sehingga ignore tidak berlaku).
  3. Purge dari riwayat (`git filter-repo` / BFG) bila repo pernah di-push ke remote yang bisa diakses pihak lain.
  4. Rotate juga anon key + VAPID keys sekalian (ikut bocor di file yang sama).

### SEC-02 · Autentikasi fail-open
- [ProtectedRoute.tsx](src/components/auth/ProtectedRoute.tsx): jika `supabase` undefined (env tidak terbaca), **semua route protected dibuka tanpa login** ("dev mode"). Kesalahan konfigurasi env di produksi = aplikasi terbuka total.
- **Tindakan:** fail-closed di production build (`import.meta.env.PROD` → tampilkan error screen, bukan bypass).

### SEC-03 · Kebijakan RLS permisif — TERVERIFIKASI LIVE (2026-07-03 via Supabase MCP)

Project live: **MLPhoma** `gtpcjjjzjjzpgpxwjzqf` (ACTIVE_HEALTHY). Hasil audit langsung ke database produksi:

**Yang SUDAH benar:**
- RLS **enabled di 100% tabel** `public` (130+ tabel).
- Tabel inti sudah project-scoped dengan benar: `finance_transactions`, `finance_invoices`, `contracts`, `projects` memakai `is_project_member_by_text(project_id)` / `EXISTS project_members ... auth.uid()` / `has_role(...)`. Hardened policies **terbukti sudah diterapkan** untuk tabel-tabel ini.
- Role `anon` hanya punya GRANT **SELECT di 10 tabel**, **nol** grant tulis → anon key yang bocor **tidak bisa** mass-delete/insert.

**Yang MASIH BOCOR (P0 — `SEC-05` di bawah):**
- Security advisor: **414 notice** (411 WARN). Yang dominan: **295 policy `rls_policy_always_true`** (`USING (true)`).
- **34 tabel bisa di-UPDATE/DELETE oleh SEMBARANG user login** (ada policy `USING(true)` + `authenticated` punya grant tulis), lintas-proyek/tenant. Termasuk sensitif:
  - **`profiles`** (UPDATE/DELETE always-true) → **privilege escalation**: user bisa `UPDATE profiles SET role='admin'` pada dirinya sendiri lalu jadi admin. Policy benar (`auth.uid()=id`) ada, TAPI karena policy RLS di-OR, yang `true` menang.
  - **`project_members`** (UPDATE/DELETE always-true) → user bisa menambah dirinya ke proyek mana pun = akses data tenant lain (lateral movement).
  - **`audit_logs`** (UPDATE/DELETE always-true) → jejak audit bisa dihapus/diubah.
  - **`approval_requests`** (UPDATE always-true) → bypass workflow approval.
  - Lainnya: `expenses, cashflow_projections, change_orders, change_order_items, po_items, purchase_orders, documents, progress_evidence, progress_logs, timeline_tasks, risks, rap_data, rap_items, wbs_items, inventory_*, material_*, notifications, vendors, zones, waste_logs, subcon_chargebacks, tools_usage_logs, rab_wbs_links, ahsp_price_history, ahsp_zone_prices, app_settings`.
- **PII/config leak (P1):** `anon` bisa SELECT `profiles` (semua nama/role user, tanpa login), plus `app_settings`, `vendors`, `resources`, `zones`, catalog `ahsp_*`.
- **38 fungsi SECURITY DEFINER** dapat dieksekusi `anon` & `authenticated` via `/rest/v1/rpc/*` → perlu review escalation.
- **38 fungsi `search_path` mutable** → hardening (`SET search_path=''`).
- **Storage bucket `project-evidence` publik & listable** → siapa pun bisa daftar/lihat SEMUA file bukti lintas proyek.
- **Leaked-password protection OFF** di Auth (HaveIBeenPwned) → aktifkan (toggle).
- `rab_snapshots` & `rap_snapshots`: RLS on tapi **0 policy** = deny-all (fitur mungkin diam-diam gagal atau tabel tak terpakai — cek).
- `hardened_rls_policies.sql` di root `supabase/` (di luar `migrations/`) → tak ikut `db push`; pindahkan ke migrasi bernomor.

### SEC-05 · Remediasi RLS always-true (baru, dari SEC-03)
Buat migrasi hardening yang, untuk 34 tabel di atas, **hapus policy `USING(true)`** dan ganti dengan project-scoped (`is_project_member_by_text(project_id)`) atau self-scoped (`auth.uid()=id` untuk profiles) + role-gate untuk aksi sensitif. Prioritas P0: `profiles`, `project_members`, `audit_logs`, `approval_requests`. **Risiko:** frontend mungkin mengandalkan akses longgar (app tidak selalu set konteks proyek) → butuh test per modul sebelum apply penuh.

### SEC-04 · Tanpa security headers di deployment
- `vercel.json` hanya berisi cache headers. Tidak ada `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **Tindakan:** tambahkan blok headers standar ke `vercel.json`.

---

## 2. YANG PERLU DIPERBAIKI (P1 — bug & janji arsitektur yang belum ditepati)

### ARCH-01 · `realtimeManager` tidak pernah disambungkan (0 konsumen)
- [src/lib/realtimeManager.ts](src/lib/realtimeManager.ts) (Phase 4) dengan `subscribeToProjectRealtime` / `subscribeToUserRealtime` **tidak diimpor file mana pun**. Akibatnya: perubahan approval, timeline, dan invoice dari user lain **tidak pernah muncul realtime** — hanya notifikasi (via `notificationStore`) yang realtime.
- **Tindakan:** panggil `subscribeToProjectRealtime(activeProjectId, queryClient)` di `AppShell`/provider saat project aktif berubah.

### ARCH-02 · Tiga paradigma data hidup berdampingan
- React Query: **hanya 1 halaman** (CommandCenter) padahal `QueryClientProvider` + konfigurasi staleTime sudah global.
- Zustand + offline sync queue (`supabaseSyncService`, 1.258 baris): store legacy (rab, ahsp, wbs, curvaS, project...).
- `useEffect` + `useState` + panggilan service langsung: mayoritas halaman v3 (Finance, SupplyChain, dst).
- Akibat: cache tidak konsisten, tidak ada invalidation lintas halaman, loading state ditulis manual berulang, dan `AsyncBoundary` tidak bisa diadopsi merata.
- **Tindakan:** tetapkan standar (rekomendasi: React Query untuk server-state semua halaman v3; Zustand hanya untuk client-state + offline queue), migrasi bertahap per halaman.

### ARCH-03 · RBAC ada tapi tidak dipakai
- `rbacService` punya permission matrix formal; `ProtectedRoute` mendukung `requiredRoles` — tapi **App.tsx tidak pernah mengirim `requiredRoles`**, dan `PermissionGuard` hanya dipakai 3 file. Semua user terautentikasi bisa membuka semua modul termasuk Finance & Settings.
- **Tindakan:** deklarasikan `requiredRoles` per item di `navRegistry` → teruskan ke route + sembunyikan item sidebar yang tidak boleh diakses; bungkus aksi mutasi sensitif dengan `PermissionGuard`.

### UI-01 · Sistem async state Phase 5 tidak diadopsi
- `AsyncBoundary` dipakai **1 file**; `useAsyncState` senasib. Halaman menulis skeleton/error/empty sendiri-sendiri; `EmptyState` hanya di 14 file, Skeleton di 7 halaman.
- **Tindakan:** jadikan `AsyncBoundary` wajib pada setiap tab/section data di halaman v3 (mudah bila ARCH-02 dieksekusi).

### UI-02 · Dua sistem tema paralel & 121 file `dark:`
- `index.html` mengatur tema via `localStorage('theme')` + class `dark`, sedangkan `sonner.tsx` memakai `next-themes` (provider-nya tidak ada di App). Aturan redesign NATA LABA ("tanpa `dark:` pairs, pakai alpha tokens") dilanggar 121 file.
- **Tindakan:** pilih satu mekanisme (custom hook `useIsDark` sudah ada), cabut `next-themes`, dan jadwalkan konversi `dark:` → token per modul (lanjutan sprint4 wbs-token).

### UI-03 · Aksesibilitas
- 2 error lint WCAG aktif: `text-[9px]` di [WBSBulkPaste.tsx:51](src/components/wbs/WBSBulkPaste.tsx#L51) — satu-satunya blocker `npm run lint`.
- Atribut `aria-*` hanya di 54/275 file komponen; `window.confirm/alert` masih dipakai 5 tempat (tidak konsisten dengan AlertDialog Radix yang sudah tersedia).
- Praktik bagus yang sudah ada: skip-link WCAG 2.4.1 di AppShell, sr-status announcer di SupplyChain — jadikan pola ini standar.

### UI-04 · Responsivitas halaman v3 minim
- Kelas breakpoint (`sm:/md:/lg:`) nyaris nol di level halaman: QHSE & ProjectCosting **0**, Maintenance/ScheduleOps/Settings/SubcontractorManagement **1**. Aplikasi konstruksi dipakai di lapangan via tablet/HP — tabel lebar & grid KPI berisiko rusak di bawah 1024px.
- **Tindakan:** audit visual per halaman di 360px/768px; pola: KPI grid → `grid-cols-2 lg:grid-cols-4`, tabel → wrapper `overflow-x-auto` + kolom prioritas, toolbar → wrap.

### DATA-01 · Query tanpa batas & over-fetching
- 77 pemakaian `select('*')`; hanya 10/70 services memakai `.range()/.limit()`. Proyek berumur panjang (ribuan transaksi inventory/invoice) akan memperlambat halaman dan membengkakkan payload.
- **Tindakan:** kolom eksplisit untuk tabel besar + paginasi server-side (pola `usePaginatedData` sudah ada, tinggal dipakai).

### MISC-01 · Perubahan belum di-commit
- `FinanceAPTab.tsx` berisi fix `useShallow` (benar untuk Zustand v5, mencegah infinite re-render getSnapshot) yang **belum di-commit**. Pola `useFinanceStore(s => ({...}))` tanpa `useShallow` kemungkinan masih ada di file lain — layak disapu sekalian.

### MISC-02 · Edge Function `scheduler-cron` masih prototipe
- Komentar di kode: *"For now, we just log them to prove automation works"*. Notifikasi overdue-task dibuat tanpa dedup (potensi spam tiap invocation), pakai `SERVICE_ROLE_KEY`, tanpa verifikasi caller (siapa pun yang tahu URL bisa memicunya).
- **Tindakan:** tambahkan auth header check (mis. `CRON_SECRET`), dedup notifikasi per task per hari, dan idempotency.

---

## 3. YANG PERLU DIKURANGI / DIHAPUS (P2 — pengurangan beban)

1. **7 halaman legacy mati**: `src/pages/modules/{CashFlow,ProjectCosting,RAB,RAP,ResourcePlan,WBS}.tsx` + `AHSP/index.tsx` — tidak ada di `navRegistry`, tidak diimpor App.tsx. Rencana knip ([2026-06-27-dead-code-audit.md](docs/superpowers/plans/2026-06-27-dead-code-audit.md)) sudah ditulis, **belum dieksekusi**. Catatan: fungsionalitas RAB/WBS/AHSP tetap hidup via `FeatureEditor` (`/features`) — yang dihapus hanya rute mati.
2. **Sampah root direktori**: 36 file `.txt/.log/.html/.js` (mis. `sdfsdfsd.txt`, `temp_dump.txt`, `fix.js`, `fix2.js`, `tsc_errors*.txt`, `build_output.log`, `ALL CHAT GEMINI MODUL .txt`), folder `_archive/`, `backups/`, plus ±25 file dokumentasi Markdown lama yang tumpang tindih. Pindahkan yang bernilai ke `docs/archive/`, hapus sisanya, tambahkan pola ke `.gitignore`.
3. **Dependensi ganda**: `motion` dan `framer-motion` terpasang dua-duanya (paket yang sama, dua versi); `@types/react-router-dom` v5 untuk react-router v7 (tidak berguna). `next-themes` bisa dicabut (lihat UI-02).
4. **Lint ratchet**: turunkan `--max-warnings 493` secara bertahap; 295 warning `any` + 43 `console` adalah target sapuan per-modul.
5. **File monster**: `GanttChart.tsx` 1.419 baris, `SupplyChain.tsx` 1.065, `Maintenance.tsx` 995, `Documents.tsx` 864, `supabaseSyncService.ts` 1.258 — pecah mengikuti pola dekomposisi yang sudah sukses di QHSE/AHSP.

---

## 4. YANG PERLU DITAMBAHKAN (P2 — fitur/pengaman yang hilang)

1. **Guard rute berbasis role** (lihat ARCH-03) — prasyarat multi-user enterprise.
2. **Error tracking produksi**: `errorLoggingService` hanya aktif jika `VITE_ERROR_LOG_ENDPOINT` di-set (kemungkinan tidak pernah). Integrasikan Sentry/GlitchTip + source maps agar crash di lapangan terlihat.
3. **Test level halaman**: 71 file test terkonsentrasi di `lib/services/store`; baru **1 test halaman** (`ProjectCosting.test.tsx`). Tambahkan smoke test render + interaksi utama untuk 5 halaman tersibuk (CommandCenter, Finance, SupplyChain, ScheduleOps, QHSE).
4. **CI pipeline**: tidak ada workflow GitHub Actions — minimal `tsc && lint && vitest run && build` per PR, plus knip sebagai ratchet dead-code.
5. **Fitur lapangan di FieldTasks** (300 baris, sangat tipis): foto kamera + EXIF (service sudah ada: `exifService`, `progressEvidenceService`), geotag (`geofenceService`), dan antrian offline untuk input progres — nilai jual utama aplikasi konstruksi mobile.
6. **Halaman User/Team Management**: `userManagementService` + `rbacService` ada, tapi tidak ada UI admin untuk mengatur role anggota — role hanya bisa diubah lewat SQL.
7. **Indikator versi & changelog in-app** (Settings) — memudahkan support saat PWA ter-cache versi lama.

---

## 5. YANG PERLU DIKEMBANGKAN (P3 — pendalaman fitur eksisting)

1. **Konsolidasi data layer ke React Query** (ARCH-02) — membuka: optimistic updates seragam, invalidation lintas modul (approval → budget → dashboard), dan integrasi realtime yang bersih.
2. **Offline-first yang jujur**: `supabaseSyncService` bagus untuk write-queue, tapi konflik masih last-write-wins kecuali AHSP (optimistic lock `_expected_updated_at`). Perluas pola sentinel itu ke RAB/WBS/timeline. UX-nya juga: `SyncStatusBanner` sudah ada, tambahkan tombol "lihat antrian & retry per item".
3. **Bundle**: initial `index.js` 424 KB + `chart-vendor` 423 KB; `xlsx` (419 KB), `jspdf` (381 KB), `html2canvas` (198 KB) sebaiknya `import()` dinamis saat ekspor dipicu, bukan di manualChunks yang tetap terunduh. Aktifkan `rollup-plugin-visualizer` sekali per rilis.
4. **PWA cache**: runtime cache `NetworkFirst` untuk seluruh URL Supabase menyimpan respons API terautentikasi di Cache Storage — pertimbangkan `NetworkOnly` untuk endpoint sensitif (finance) atau bersihkan cache saat logout.
5. **Zone pricing cascade & project-level RLS untuk AHSP** — dua item yang memang ditunda dari sprint AHSP jangka menengah.
6. **BI Report Builder & StrategySimulation** — kedua halaman ini paling muda; lengkapi persistensi template & ekspor terjadwal setelah fondasi di atas beres.

---

## 6. YANG PERLU DISEMPURNAKAN (polish berkelanjutan)

1. **Konsistensi bahasa**: UI campur — nav "Subkontraktor" vs "Projects/Settings", empty-state Indonesia di 36 file vs Inggris di 15. Tetapkan Bahasa Indonesia sebagai bahasa produk, buat `src/lib/i18n/strings.ts` terpusat (belum perlu library i18n penuh).
2. **Konvensi penamaan migrasi**: tiga skema campur (`075_`, `20260226_`, `999_`) — `999_add_ahsp_price_history.sql` akan selalu diurutkan terakhir secara leksikal. Standarkan timestamp `YYYYMMDDHHMMSS_` mulai sekarang.
3. **Toast & konfirmasi**: 140 `toast.error` dengan gaya pesan beragam; `errorMessages.ts` (499 baris) sudah ada — rutekan semua error lewat helper itu agar bahasa & tone seragam.
4. **Noise test**: `CashFlow.test.tsx` memicu `indexedDB is not defined` (idb-keyval tak dimock di jsdom) — test tetap lulus tapi log kotor; mock `idb-keyval` di `test/setup`.
5. **Kebersihan console**: 43 `console.*` di kode produksi → ganti `errorLoggingService`/hapus.
6. **Dokumentasi**: `ARCHITECTURE.md`/`README` belum mencerminkan realita v3 (masih menyebut struktur lama); satu halaman "peta modul + paradigma data" akan memangkas onboarding.

---

## 7. Peta Jalan yang Disarankan

| Sprint | Fokus | Item |
|---|---|---|
| **Sprint A (segera, 1–2 hari)** | Keamanan | SEC-01 rotate+purge, SEC-02 fail-closed, SEC-04 headers, commit fix FinanceAPTab |
| **Sprint B (1 minggu)** | Kebersihan | Eksekusi knip dead-code plan, bersihkan root, hapus dupe deps, fix 2 error WCAG, mock idb di test |
| **Sprint C (1–2 minggu)** | Arsitektur | Wire realtimeManager, RBAC route guards + UI admin role, verifikasi & keraskan RLS (SEC-03), amankan scheduler-cron |
| **Sprint D (2–4 minggu)** | Data layer | Migrasi halaman v3 ke React Query + AsyncBoundary per halaman (mulai Finance & SupplyChain), paginasi service besar |
| **Sprint E (berkelanjutan)** | UX polish | Responsivitas per halaman, konsolidasi tema, i18n terpusat, FieldTasks kamera/geotag, page-level tests + CI |

**Catatan verifikasi:** status RLS/live database tidak bisa saya periksa langsung karena konektor MCP *claude.ai Supabase* (dan Figma) belum diotorisasi — bila ingin audit RLS live pada sesi berikutnya, otorisasi dulu via pengaturan connector claude.ai.
