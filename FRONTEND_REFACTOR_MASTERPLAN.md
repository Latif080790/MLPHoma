# Frontend Refactor Master Plan — MLPHoma

**Dokumen ini dibuat untuk developer MLPHoma sebagai panduan refactor frontend yang terstruktur, aman, dan tetap kompatibel dengan sistem yang sudah berjalan.**

> **Last Updated:** 15 Februari 2026  
> **Baseline Test:** 293/293 passing · 0 TS errors · 30 test files  
> **Scope:** Frontend SPA (`src/`) — tidak termasuk backend/supabase-migration

---

## 1) Tujuan Utama Refactor

Refactor frontend MLPHoma harus mencapai sasaran berikut:

1. **Konsistensi arsitektur** antar modul v3 dan modul legacy.
2. **Keterbacaan alur data** dari UI → Store (Zustand) → Service → Sync Queue → Supabase.
3. **Pengurangan technical debt** tanpa merusak fitur produksi yang sudah stabil.
4. **Skalabilitas tim**: developer baru bisa memahami sistem dengan cepat dan bekerja dengan pola yang sama.
5. **Reliability**: error runtime menurun, observability naik, coverage test layanan/frontend kritikal meningkat.
6. **Boundary enforcement**: menghapus semua akses Supabase langsung dari layer komponen/page.

---

## 2) Gambaran Sistem Frontend Saat Ini (As-Is)

### 2.1 Runtime Stack

| Layer          | Teknologi                                  |
|----------------|--------------------------------------------|
| Framework      | React 18.3 + TypeScript 5.9                |
| Build          | Vite 5                                     |
| UI Library     | shadcn/ui + Radix + Tailwind 3.4           |
| Router         | HashRouter (`react-router` v7)             |
| State          | Zustand 5 (16 domain stores)               |
| DB Client      | `@supabase/supabase-js` 2.46               |
| Validation     | Zod 3.24                                   |
| Charts         | Recharts 2.15                              |
| Export         | jsPDF 4 + xlsx 0.18                        |
| Testing        | Vitest 1.6 + @testing-library/react 14     |
| Animations     | Motion 12 (framer-motion fork)             |

### 2.2 Codebase Inventory (Numerik)

| Kategori                   | Jumlah  | Lokasi                         |
|----------------------------|---------|--------------------------------|
| Zustand Stores             | 16      | `src/store/*.ts`               |
| Domain Services            | 26      | `src/services/*.ts`            |
| Type definition files      | 18      | `src/types/*.ts`               |
| v3 Page Modules            | 9       | `src/pages/modules/v3/`        |
| Legacy Page Modules        | 10      | `src/pages/modules/`           |
| Component folders          | 18+     | `src/components/*`             |
| Custom Hooks               | 8       | `src/hooks/*`                  |
| Lib utilities              | 20+     | `src/lib/*`                    |
| Test files                 | 30      | `src/**/__tests__/*.test.ts`   |
| Supabase migrations        | 33      | `supabase/migrations/`         |
| Web Workers                | 1       | `src/workers/createCpmWorker`  |

### 2.3 Struktur Arsitektur Utama

MLPHoma sudah memiliki layering yang cukup baik:

```
┌─────────────────────────────────────────────────────────┐
│   UI Layer (Pages + Components)                         │
│   9 v3 pages + 10 legacy pages + 60+ components        │
├─────────────────────────────────────────────────────────┤
│   State Layer (Zustand Stores)                          │
│   16 domain stores · cached getters · optimistic update │
├─────────────────────────────────────────────────────────┤
│   Service Layer (Domain Services)                       │
│   26 services · row↔domain mapping · business logic     │
├─────────────────────────────────────────────────────────┤
│   Sync/Persistence Layer                                │
│   SyncQueueManager · retry 3x · localStorage fallback   │
├─────────────────────────────────────────────────────────┤
│   Validation Layer                                      │
│   Zod schemas · validationMiddleware · runtime checks   │
├─────────────────────────────────────────────────────────┤
│   Supabase Backend (81+ tables · RLS enabled)           │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Kekuatan Sistem yang Harus Dipertahankan

- Pattern sync queue sudah matang dan wajib dipertahankan.
- Formula perhitungan sudah disentralisasi di `calculationService`.
- 11 dari 26 service sudah punya test dan lulus.
- Pemisahan domain store sudah jelas.
- Feature flag system (`featureStore` + `featureSchema`) sudah ada fondasi.
- CPM computation sudah di-offload ke Web Worker.

### 2.5 Pain Points Frontend Saat Ini (Hasil Audit)

#### A. Routing masih hybrid v3 + legacy
- `App.tsx` memuat 11 v3 routes dan 10 legacy routes bersamaan.
- Tidak ada mekanisme redirect legacy → v3.

#### B. Konfigurasi navigasi hardcoded
- Sidebar `NAV_ITEMS` di `AppShell.tsx` = array literal 13 item.
- Belum 100% sumber dari `config/routes.ts`.
- `ModuleKey` di `routes.ts` punya 23 key, tapi hanya 13 muncul di sidebar.

#### C. 8 file melanggar layer boundary (Direct Supabase)
File-file ini mengakses Supabase langsung, bypass service layer:

| File | Pelanggaran |
|------|-------------|
| `store/ahspStore.ts` | **10+ direct `.from()` calls** — heaviest offender |
| `store/projectStore.ts` | Import `supabase` + `fetchProjects` langsung |
| `pages/modules/v3/CommandCenter.tsx` | `assertSupabase()` dalam page |
| `pages/modules/v3/Settings.tsx` | `.from('projects').select/update` langsung |
| `pages/modules/v3/HandoverWizard.tsx` | `.from('projects').update` langsung |
| `components/finance/ThreeWayMatch.tsx` | `.from('purchase_orders')` + `.from('grn')` |
| `components/dkh/DKHManager.tsx` | Sync to Supabase langsung |
| `components/ahsp/ResourceManager.tsx` | Sync to Supabase langsung |

#### D. Store pattern inconsistency

5 dari 16 store **tidak punya `loading`/`error` state** sama sekali:

| Store | loading? | error? | cached getter? |
|-------|----------|--------|----------------|
| `projectStore` | ❌ | ❌ | ✅ `createCachedGetter` |
| `timelineStore` | ❌ | ❌ | ✅ `createCachedGetterWithKey` |
| `rabStore` | ❌ | ❌ | ✅ `createCachedGetterWithKey` |
| `curvaSStore` | ❌ | ❌ | ❌ |
| `featureStore` | ❌ | ❌ | ❌ |

Tambahan inkonsistensi:
- `rapStore` menggunakan `isLoading` sementara semua store lain pakai `loading`.
- `tkdnStore` punya `loading` tapi tidak `error`.
- Hanya **4 dari 16 store** menggunakan cached getter.

#### E. Service test coverage masih rendah: 57.7% untested

15 service belum punya test:

| # | Service | Domain | Risk |
|---|---------|--------|------|
| 1 | `supplyChainService` (335 baris) | Supply Chain core | **TINGGI** — ada budget locking |
| 2 | `handoverService` | Handover | SEDANG |
| 3 | `progressBillingService` | Progress/Finance | **TINGGI** |
| 4 | `progressEvidenceService` | Progress | SEDANG |
| 5 | `workOrderService` | Operations | SEDANG |
| 6 | `grnService` | Goods Receipt | SEDANG |
| 7 | `materialTransferService` | Supply Chain | SEDANG |
| 8 | `documentVersionService` | Documents | RENDAH |
| 9 | `smartMRService` | Smart MR | SEDANG |
| 10 | `rabPriceOverrideService` | RAB | SEDANG |
| 11 | `rapProfitService` | RAP | SEDANG |
| 12 | `timelineScenarioService` | Timeline | SEDANG |
| 13 | `userManagementService` | Auth/Admin | SEDANG |
| 14 | `tkdnService` | TKDN | RENDAH |
| 15 | `ahspSnapshotService` | AHSP | RENDAH |

#### F. i18n belum diadopsi

`i18next` dan `react-i18next` ada di `package.json` tapi **zero usage** di seluruh `src/`.
Ada string Indonesia hardcoded (misal "Gagal memuat data TKDN" di `tkdnStore`).

#### G. Technical debt legacy masih hidup
- `rabUtils.ts` — 4 fungsi `@deprecated`, masih di-import.
- `validationSchemas.ts` — 4 export `@deprecated`.
- Folder `components/progress/` kosong (hanya `__tests__/` empty).

#### H. Ukuran halaman v3 tidak merata / terlalu besar

| v3 Page | Baris | Catatan |
|---------|-------|---------|
| `CommandCenter.tsx` | 440 | Direct supabase + banyak inline logic |
| `Finance.tsx` | 386 | Perlu dipecah ke sub-komponen |
| `HandoverWizard.tsx` | 308 | Direct supabase |
| `ChangeManagement.tsx` | 294 | |
| `SupplyChain.tsx` | 264 | |
| `Documents.tsx` | 224 | |
| `Settings.tsx` | 168 | Direct supabase |
| `ScheduleOps.tsx` | 78 | Sudah clean (wrapper) |
| `ProjectCosting.tsx` | 51 | Sudah clean (wrapper) |

---

## 3) Domain Dependency Map

Diagram di bawah menunjukkan ketergantungan antar domain — penting untuk menentukan urutan refactor:

```
                    ┌──────────────┐
                    │   PROJECT    │ ← Root entity, semua domain bergantung
                    └──────┬───────┘
           ┌───────────────┼───────────────────┐
           ▼               ▼                   ▼
    ┌──────────┐    ┌──────────┐        ┌──────────┐
    │   WBS    │    │   AHSP   │        │ FEATURE  │
    │          │    │ (Catalog)│        │  CONFIG  │
    └────┬─────┘    └────┬─────┘        └──────────┘
         │               │
         ▼               ▼
    ┌──────────┐    ┌──────────┐
    │ TIMELINE │◄───│   RAB    │ (RAB items link to timeline tasks)
    │ (Gantt)  │    │ (Budget) │
    └────┬─────┘    └────┬─────┘
         │               │
         ▼               ▼
    ┌──────────┐    ┌──────────┐
    │ CURVA-S  │    │   RAP    │ (time-phased dari RAB + Timeline)
    │  (EVM)   │    │          │
    └──────────┘    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ SUPPLY   │ │FINANCE │ │ CASHFLOW │
        │  CHAIN   │ │        │ │          │
        └────┬─────┘ └────┬───┘ └──────────┘
             │            │
             ▼            ▼
        ┌──────────┐ ┌────────────┐
        │   GRN    │ │ PROGRESS   │
        │  + M.O.  │ │ BILLING    │
        └──────────┘ └────────────┘

   Cross-cutting domains (dipakai oleh banyak modul):
   ┌────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────┐
   │ APPROVAL   │ │ NOTIFICATION │ │  AUDIT   │ │ RISK │
   └────────────┘ └──────────────┘ └──────────┘ └──────┘
   ┌────────────┐ ┌──────────────┐ ┌──────────┐
   │ CHANGE     │ │  DOCUMENTS   │ │  TKDN    │
   │ ORDER      │ │              │ │          │
   └────────────┘ └──────────────┘ └──────────┘
```

**Implikasi untuk refactor:**
- Refactor `PROJECT` dan `AHSP` store/service dulu karena paling banyak dependents.
- `TIMELINE` dan `RAB` harus stabil sebelum sentuh `RAP`, `CURVA-S`, `CASHFLOW`.
- Cross-cutting domains (`APPROVAL`, `NOTIFICATION`, `AUDIT`) bisa direfactor paralel.

---

## 4) Prinsip Refactor Wajib (Guardrails)

Seluruh tim wajib mengikuti guardrails berikut saat refactor:

1. **No big-bang rewrite**: refactor harus incremental per domain.
2. **Backward compatibility**: jangan memutus flow data produksi.
3. **Root-cause fix**: jangan hanya patch gejala.
4. **Test-first untuk area risk tinggi**: tambah/kuatkan test sebelum perubahan besar.
5. **Single source of truth** untuk route map, transform mapper, dan kontrak domain.
6. **Observability by default**: semua error kritikal harus terpetakan dan bisa dilacak.
7. **Zero direct DB in UI**: tidak boleh ada query `.from()` di components/pages.
8. **Store contract standar**: semua store wajib punya `loading` + `error` state.

---

## 5) Target Arsitektur Frontend (To-Be)

### 5.1 Layering yang Diinginkan

```
┌─────────────────────────────────────────────────────┐
│  Page / Component (UI)                              │
│  - Render, interaksi user, orchestration ringan     │
│  - DILARANG akses Supabase langsung                 │
├─────────────────────────────────────────────────────┤
│  Feature Hooks (Use Case Layer)                     │
│  - Side effects UI, combinator store/service        │
│  - Contoh: useScheduleOpsController                 │
├─────────────────────────────────────────────────────┤
│  Zustand Store (State + Intent Actions)             │
│  - State normalized: { byId, allIds, loading, error}│
│  - Action memanggil service, bukan logic DB         │
│  - Wajib cached getter untuk collection besar       │
├─────────────────────────────────────────────────────┤
│  Domain Service (Data access + Mapping)             │
│  - Semua query Supabase ada di sini                 │
│  - Mapper: toDomain(row) / toPersistence(entity)    │
│  - Business rule validation                         │
├─────────────────────────────────────────────────────┤
│  Sync Queue + Shared Utils                          │
│  - SyncQueueManager, calculationService, validators │
├─────────────────────────────────────────────────────┤
│  Supabase Client (thin wrapper)                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 Standarisasi Kontrak Data

Wajib ada dua model eksplisit per domain:

- **Persistence Model**: format DB/supabase (`snake_case`).
- **Domain/UI Model**: format aplikasi (`camelCase`).

Lalu siapkan mapper baku per domain:

```typescript
// src/services/mappers/timelineMapper.ts
export function toDomain(row: TimelineTaskRow): TimelineTask { ... }
export function toPersistence(entity: TimelineTask): TimelineTaskRow { ... }
```

Tujuannya:
- menghilangkan transform ad-hoc di banyak tempat,
- mencegah bug field mismatch (`updated_at`, `created_at`, dsb),
- memudahkan audit dan test.

### 5.3 Standarisasi Store Contract

Semua 16 store harus mengikuti contract minimum:

```typescript
interface StandardStoreContract {
  loading: boolean        // BUKAN isLoading
  error: string | null
  // ... domain-specific state
}
```

Store dengan collection besar wajib menggunakan cached getter:
- `{ byId: Record<string, T>, allIds: string[] }` pattern, atau
- `createCachedGetterWithKey` dari `cachedGetter.ts`.

### 5.4 Standarisasi Error Model

Semua domain mengembalikan salah satu pola ini:

1. `Result<T, AppError>` (direkomendasikan), atau
2. throw `AppError` yang selalu dimap via `useErrorHandler`.

Jangan campur throw string mentah, throw Error generik, dan return null tanpa konteks.

### 5.5 Route Config sebagai Single Source of Truth

```typescript
// src/config/routes.ts (target)
export interface RouteEntry {
  key: ModuleKey
  path: string
  label: string
  icon: LucideIcon
  color: string
  status: 'stable-v3' | 'legacy-supported' | 'legacy-deprecated'
  showInNav: boolean
  requiredRole?: string[]
}

export const ROUTES: RouteEntry[] = [ ... ]
```

`AppShell.tsx` membaca `ROUTES.filter(r => r.showInNav)` — tidak lagi hardcode.

---

## 6) Roadmap Refactor Bertahap (12 Minggu / 6 Sprint)

> Durasi dapat disesuaikan kapasitas tim, tetapi urutan prioritas sebaiknya dipertahankan.
> Setiap sprint = 2 minggu.

---

### SPRINT 0 — Baseline & Freeze Rules (Minggu 1-2)

**Target:** kondisi awal terukur sebelum refactor.

| # | Task | File/Area | Effort | Owner |
|---|------|-----------|--------|-------|
| 0.1 | Bekukan coding rules (dokumen ini) jadi acuan tim | `FRONTEND_REFACTOR_MASTERPLAN.md` | 0.5d | Lead |
| 0.2 | Setup ESLint rule `no-restricted-imports` untuk block `supabase` di `src/components/**` dan `src/pages/**` | `.eslintrc` / `eslint.config.js` | 0.5d | Lead |
| 0.3 | Tetapkan KPI baseline: runtime errors/day, render time halaman berat, flaky test count | Monitoring/manual | 1d | Lead + QA |
| 0.4 | Mapping modul → domain owner developer | Spreadsheet/board | 0.5d | PM |
| 0.5 | Buat refactor board (epic, task, owner, risk) | Project management tool | 0.5d | PM |
| 0.6 | Run `vitest run --coverage` dan catat baseline coverage per service | Terminal | 0.5d | Dev |

**Deliverables:** Refactor board, KPI baseline report, ESLint guard aktif (warning mode).

---

### SPRINT 1 — Routing & Navigation + Store Contract Fix (Minggu 3-4)

**Target:** route map tunggal, sidebar dari config, store contract seragam.

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 1.1 | Extend `routes.ts`: tambah `RouteEntry` interface (label, icon, color, status, showInNav) | `src/config/routes.ts` | 1d | — |
| 1.2 | Ubah `AppShell.tsx`: hapus hardcoded `NAV_ITEMS`, baca dari `routes.ts` | `src/components/layout/AppShell.tsx` | 1d | 1.1 |
| 1.3 | Klasifikasi route: tandai `stable-v3` vs `legacy-supported` vs `legacy-deprecated` | `src/config/routes.ts` | 0.5d | 1.1 |
| 1.4 | Tambah redirect dari legacy paths ke v3 equivalents di `App.tsx` | `src/App.tsx` | 1d | 1.3 |
| 1.5 | Tambah `loading: boolean` + `error: string\|null` ke 5 store yang belum punya | `projectStore`, `timelineStore`, `rabStore`, `curvaSStore`, `featureStore` | 2d | — |
| 1.6 | Fix `rapStore`: rename `isLoading` → `loading` | `src/store/rapStore.ts` | 0.5d | — |
| 1.7 | Fix `tkdnStore`: tambah `error: string\|null` | `src/store/tkdnStore.ts` | 0.5d | — |
| 1.8 | Snapshot test: route config → navigation links match | `src/config/__tests__/routes.test.ts` (new) | 1d | 1.2 |
| 1.9 | Smoke test navigasi seluruh sidebar (manual QA) | — | 0.5d | 1.2 |

**Risk & Mitigasi:**
- Dead links sidebar → snapshot test + manual QA.
- Legacy bookmark users → redirect fallback.

**Sprint 1 Total Effort:** ~8.5d (2 dev + QA)

---

### SPRINT 2 — Layer Boundary Enforcement (Minggu 5-6)

**Target:** hapus semua akses Supabase langsung dari komponen/page/store (8 file offender).

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 2.1 | Buat `src/services/ahspService.ts` — pindahkan 10+ query dari `ahspStore` ke service | `ahspStore.ts` → `ahspService.ts` (new) | 3d | — |
| 2.2 | Buat `src/services/projectService.ts` — pindahkan `fetchProjects` + query dari `projectStore` ke service | `projectStore.ts` → `projectService.ts` (new) | 1.5d | — |
| 2.3 | Pindahkan query dari `CommandCenter.tsx` ke service (dashboard aggregation) | `CommandCenter.tsx` → `dashboardService.ts` | 1d | — |
| 2.4 | Pindahkan query dari `Settings.tsx` ke `projectService` | `Settings.tsx` | 0.5d | 2.2 |
| 2.5 | Pindahkan query dari `HandoverWizard.tsx` ke `handoverService` | `HandoverWizard.tsx` | 0.5d | — |
| 2.6 | Pindahkan query dari `ThreeWayMatch.tsx` ke `financeService` | `ThreeWayMatch.tsx` | 1d | — |
| 2.7 | Refactor sync dari `DKHManager.tsx` + `ResourceManager.tsx` ke service | 2 files | 1d | 2.1 |
| 2.8 | Tambahkan mapper `toDomain`/`toPersistence` untuk domain: timeline, finance, supply-chain | `src/services/mappers/` (new folder) | 2d | — |
| 2.9 | Upgrade ESLint rule dari warning → error untuk direct supabase import | `.eslintrc` | 0.5d | 2.1–2.7 |
| 2.10 | Test mapper contract (toDomain ↔ toPersistence roundtrip) | `src/services/mappers/__tests__/` (new) | 1d | 2.8 |

**Risk & Mitigasi:**
- Regressi perilaku bisnis → jalankan test existing sebelum+sesudah setiap PR.
- Data shape berubah → contract test toDomain ↔ toPersistence.

**Sprint 2 Total Effort:** ~12d (2-3 dev)

---

### SPRINT 3 — State Normalization & Test Coverage Boost (Minggu 7-8)

**Target:** store state stabil, render terkontrol, test coverage naik signifikan.

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 3.1 | Implementasi normalized state `{ byId, allIds }` di `ahspStore` (terbesar: 1152 baris) | `src/store/ahspStore.ts` | 2d | Sprint 2 |
| 3.2 | Tambah cached getter ke store yang belum punya (12 store) — prioritaskan `financeStore`, `supplyChainStore`, `wbsStore`, `curvaSStore` | 4+ stores | 2d | — |
| 3.3 | Audit & fix infinite re-render risk: profiling `CommandCenter`, `Finance`, `ChangeManagement` | 3 v3 pages | 1d | — |
| 3.4 | Test `supplyChainService` (335 baris, high risk: budget locking) | `supplyChainService.test.ts` (new) | 1.5d | — |
| 3.5 | Test `progressBillingService` (high risk) | `progressBillingService.test.ts` (new) | 1d | — |
| 3.6 | Test `handoverService` | `handoverService.test.ts` (new) | 0.5d | — |
| 3.7 | Test `workOrderService` | `workOrderService.test.ts` (new) | 0.5d | — |
| 3.8 | Test `grnService` | `grnService.test.ts` (new) | 0.5d | — |
| 3.9 | Test `materialTransferService` | `materialTransferService.test.ts` (new) | 0.5d | — |
| 3.10 | Test `smartMRService` | `smartMRService.test.ts` (new) | 0.5d | — |

**KPI Target akhir sprint:**
- Service test coverage: dari 42% → 70%+.
- Render count warning `CommandCenter` dan `Finance` = 0.

**Sprint 3 Total Effort:** ~10d (2-3 dev)

---

### SPRINT 4 — Error Handling & Cross-cutting Domains (Minggu 9-10)

**Target:** error pipeline konsisten, cross-cutting domains bersih.

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 4.1 | Definisikan error taxonomy per domain di `errorMessages.ts` | `src/lib/errorMessages.ts` | 1d | — |
| 4.2 | Wajibkan `useErrorHandler` / `handleAsync` di semua async workflow v3 pages (9 pages) | 9 v3 page files | 2d | — |
| 4.3 | Integrasi error logging eksternal (hook di `ErrorBoundary.tsx` — resolve TODO) | `ErrorBoundary.tsx` | 1d | — |
| 4.4 | Tambah correlation ID ke `SyncQueueManager` tasks | `supabaseSyncService.ts` | 0.5d | — |
| 4.5 | Test `documentVersionService` | `documentVersionService.test.ts` (new) | 0.5d | — |
| 4.6 | Test `rabPriceOverrideService` | `rabPriceOverrideService.test.ts` (new) | 0.5d | — |
| 4.7 | Test `rapProfitService` | `rapProfitService.test.ts` (new) | 0.5d | — |
| 4.8 | Test `timelineScenarioService` | `timelineScenarioService.test.ts` (new) | 0.5d | — |
| 4.9 | Test `userManagementService` | `userManagementService.test.ts` (new) | 0.5d | — |
| 4.10 | Test `ahspSnapshotService` + `tkdnService` | 2 test files (new) | 0.5d | — |

**KPI Target akhir sprint:**
- Service test coverage: 70% → **100%** (26/26 tested).
- Semua async error di v3 pages melewati `useErrorHandler`.

**Sprint 4 Total Effort:** ~8d (2 dev)

---

### SPRINT 5 — Feature Config Governance + UI Consistency (Minggu 11-12)

**Target:** feature flag jadi governance layer, UI konsisten antar modul.

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 5.1 | Pisahkan `featureSchema.ts` per domain (modular import + versioning) | `src/config/featureSchema.ts` → `src/config/features/*.ts` | 1.5d | — |
| 5.2 | Validasi strict saat save/restore snapshot di `featureStore` | `src/store/featureStore.ts` | 1d | 5.1 |
| 5.3 | Audit trail perubahan config (siapa, kapan, changes) | `featureStore` + `auditService` integration | 1d | 5.2 |
| 5.4 | Standardisasi page skeleton: ModuleHeader, loading/error/empty states across all 9 v3 pages | 9 v3 page files | 2d | — |
| 5.5 | Extract reusable table/filter/form pattern menjadi shared component | `src/components/shared/DataTable.tsx` (new) | 1.5d | — |
| 5.6 | Pecah `CommandCenter.tsx` (440 baris) jadi sub-komponen | `CommandCenter.tsx` → 3-4 widget files | 1.5d | Sprint 2 |
| 5.7 | Pecah `Finance.tsx` (386 baris) jadi sub-komponen | `Finance.tsx` → tab components | 1.5d | Sprint 2 |
| 5.8 | Hapus deprecated exports di `rabUtils.ts` jika sudah tidak di-import | `src/lib/rabUtils.ts` | 0.5d | — |
| 5.9 | Hapus deprecated exports di `validationSchemas.ts` jika sudah tidak di-import | `src/lib/validationSchemas.ts` | 0.5d | — |
| 5.10 | Evaluasi & activate i18n infrastructure (atau strip dependency jika tidak akan dipakai) | `package.json`, project-wide decision | 0.5d | PM decision |

**Sprint 5 Total Effort:** ~11.5d (2-3 dev)

---

### SPRINT 6 — Integration Tests, Legacy Cleanup & Documentation Lock (Minggu 13-14)

**Target:** sistem siap scaling, legacy bersih, dokumentasi final.

| # | Task | File Target | Effort | Depends On |
|---|------|-------------|--------|------------|
| 6.1 | Integration test: Change Order → Approval → Notification → Audit flow | `src/services/__tests__/integration/` (new) | 1.5d | Sprint 4 |
| 6.2 | Integration test: Timeline update → Progress/Cashflow impact | integration test (new) | 1d | Sprint 3 |
| 6.3 | Integration test: PO status → RAP committed/actual update | integration test (new) | 1d | Sprint 3 |
| 6.4 | Remove/redirect legacy routes yang sudah fully replaced by v3 | `src/App.tsx` | 1d | Sprint 1 |
| 6.5 | Remove unused legacy page modules (setelah dipastikan v3 menggantikan) | `src/pages/modules/*.tsx` | 1d | 6.4 |
| 6.6 | Buat ADR (Architecture Decision Records) untuk semua keputusan refactor | `docs/adr/` (new folder) | 1d | — |
| 6.7 | Update `ARCHITECTURE.md` menjadi final (post-refactor state) | `ARCHITECTURE.md` | 1d | All sprints |
| 6.8 | Setup CI quality gates: `tsc --noEmit` + `vitest run` wajib pass sebelum merge | CI config (GitHub Actions / Vercel) | 1d | — |
| 6.9 | Final KPI measurement: bandingkan dengan baseline Sprint 0 | Monitoring | 0.5d | 0.3 |
| 6.10 | Clean `components/progress/` — isi komponen atau hapus folder kosong | `src/components/progress/` | 0.5d | — |

**Sprint 6 Total Effort:** ~9.5d (2 dev + QA)

---

### Ringkasan Effort per Sprint

| Sprint | Fokus | Effort | Dev Needed |
|--------|-------|--------|------------|
| 0 | Baseline & Freeze | ~3.5d | 1 Lead + PM |
| 1 | Routing + Store Contract | ~8.5d | 2 Dev + QA |
| 2 | Layer Boundary Enforcement | ~12d | 2-3 Dev |
| 3 | State Normalization + Tests | ~10d | 2-3 Dev |
| 4 | Error Handling + Test 100% | ~8d | 2 Dev |
| 5 | Feature Config + UI | ~11.5d | 2-3 Dev |
| 6 | Integration + Cleanup + Docs | ~9.5d | 2 Dev + QA |
| **Total** | | **~63d** | **~14 weeks with 2 devs** |

---

## 7) Prioritas Domain Refactor (Wajib vs Lanjut)

### Prioritas WAJIB (Eksekusi Dulu)

| # | Domain/Area | Alasan | Sprint |
|---|-------------|--------|--------|
| 1 | Routing + Navigation unifikasi | Foundation — semua modul bergantung pada navigasi | S1 |
| 2 | Store contract standar (loading/error) | 5 store tidak punya, 2 inkonsisten — bikin susah debug | S1 |
| 3 | Layer boundary enforcement (8 file offender) | Arch violation paling banyak; `ahspStore` = heaviest | S2 |
| 4 | Domain mapper `toDomain`/`toPersistence` | Mencegah repeated bug `updated_at` style | S2 |
| 5 | `ahspStore` refactor (1152 baris, 10+ direct DB calls) | Store terbesar, paling melanggar boundary | S2 |
| 6 | Test 15 service untested | 57.7% service tanpa test — berbahaya untuk refactor | S3-S4 |
| 7 | Error handling unifikasi | Adopsi `useErrorHandler` belum konsisten lintas v3 pages | S4 |
| 8 | Feature config governance | Fondasi feature flag sudah ada, perlu dimatangkan | S5 |

### Prioritas LANJUT (Setelah Stabil)

| # | Domain/Area | Alasan | Sprint |
|---|-------------|--------|--------|
| 1 | Legacy module retirement bertahap | Tunggu v3 replace semua fungsi | S6 |
| 2 | Fine-tuning performa (profiling `CommandCenter`, `Finance`) | Setelah boundary bersih | S5 |
| 3 | i18n adoption (atau strip jika tidak dipakai) | Decision needed dari PM | S5 |
| 4 | A11y hardening lintas modul | Nice-to-have setelah stabil | Post-S6 |
| 5 | Additional Web Workers (data-heavy rendering) | Hanya 1 worker saat ini (CPM). Bisa menambah jika perlu | Post-S6 |

---

## 8) Coding Standards Refactor (Mandatory)

### 8.1 Layer Boundary Rules

| Rule | Detail |
|------|--------|
| **DILARANG** query Supabase dari komponen/page | Semua `.from()` harus di `src/services/` atau `src/lib/` |
| **DILARANG** import `supabase` dari `supabaseClient` di store | Store hanya memanggil service functions |
| Semua mapper data harus reusable dan ter-test | `src/services/mappers/` |
| Component max ~250 baris | Lebih besar → pecah jadi sub-komponen |

### 8.2 Store Rules

| Rule | Detail |
|------|--------|
| Semua store wajib `loading: boolean` + `error: string\|null` | BUKAN `isLoading`, BUKAN tanpa error |
| Collection store wajib cached getter | `createCachedGetter` / `createCachedGetterWithKey` |
| Action async harus set `loading=true` di awal, `false` di finally | Toast error optional, `error` state wajib |
| Naming convention: `loading` (bukan `isLoading`), `error` (bukan `errorMsg`) | Konsisten di 16 store |

### 8.3 Error & Naming Rules

| Rule | Detail |
|------|--------|
| Semua error async diproses oleh `useErrorHandler` atau `handleAsync` | Tidak ada silent swallow |
| UI/domain: `camelCase` | `createdAt`, `projectId` |
| Persistence layer: `snake_case` | `created_at`, `project_id` — hanya di mapper/service |
| Hindari tipe `any` pada boundary utama | Generic `Record<string, unknown>` kalau perlu |

### 8.4 PR Rules

Setiap PR refactor harus melampirkan:
1. Dampak arsitektur (domain apa, layer mana).
2. Daftar risiko + mitigasi.
3. Bukti test (screenshot/log vitest).
4. Tidak boleh menurunkan pass-rate test existing.

---

## 9) Test Strategy untuk Refactor

### 9.1 Test Pyramid (Pragmatis)

```
       ╱╲
      ╱  ╲     Integration Flow Tests (3-5 targeted)
     ╱    ╲    Cross-domain workflows berisiko tinggi
    ╱──────╲
   ╱        ╲   Store Tests (selektif)
  ╱   Action ╲  Action kritikal + selector stability
 ╱   kritikal ╲
╱──────────────╲
╱                ╲  Service Tests (WAJIB per domain: 26/26)
╱  Contract data  ╲ row↔domain mapping + branch logic
╱    row↔domain    ╲
╱──────────────────────╲
╱                        ╲  Unit Tests (utama)
╱  mapper, validator,     ╲ pure domain functions, calculationService
╱  formatter, idGenerator  ╲
╱────────────────────────────╲
```

### 9.2 Test Status Saat Ini vs Target

| Kategori | Saat Ini | Target Akhir Sprint 4 | Target Akhir Sprint 6 |
|----------|----------|----------------------|----------------------|
| Service tests | 11/26 (42%) | **26/26 (100%)** | 26/26 + 3 integration |
| Lib tests | 7 files | 7 files | 7+ mapper tests |
| Store tests | 2 files | 2 files | 4+ files |
| Total test count | 293 | ~380 | ~420+ |
| TS errors | 0 | 0 | 0 |

### 9.3 Definition of Done per Task Refactor

- TypeScript: `tsc --noEmit` lolos.
- Unit/service test terkait lolos.
- Tidak menurunkan pass-rate test existing.
- Coverage domain terkait tidak turun.

---

## 10) Risk Register (Frontend Refactor)

| # | Risk | Dampak | Severity | Kontrol/Mitigasi |
|---|------|--------|----------|-----------------|
| 1 | **Route regressions** | Navigasi gagal, halaman blank | HIGH | Route snapshot test + smoke test + redirect fallback |
| 2 | **Data mapping mismatch** | Error runtime/sync (contoh kasus `updated_at`) | HIGH | Mapper terpusat + contract tests `toDomain ↔ toPersistence` |
| 3 | **Store re-render storms** | Performa turun / infinite loop | HIGH | Cached getter standar + profiling + ESLint warn |
| 4 | **ahspStore regression** (1152 baris) | Store terbesar, refactor terberat | HIGH | Refactor incremental, per-method, test sebelum+sesudah |
| 5 | **Inconsistent error handling** | Debugging sulit, UX buruk | MEDIUM | Single error pipeline via `useErrorHandler` |
| 6 | **Scope creep** | Refactor tidak selesai tepat waktu | MEDIUM | Phase gate + backlog freeze per sprint |
| 7 | **Legacy bookmark break** | User lama pakai bookmark legacy path | LOW | Redirect route dari legacy → v3 |
| 8 | **i18n dead dependency** | Bundle size membengkak tanpa manfaat | LOW | Keputusan PM: adopt atau strip |

---

## 11) RACI Mini (Peran Tim)

| Peran | Tanggung Jawab |
|-------|---------------|
| **Frontend Lead** | Tetapkan standar arsitektur, review PR refactor high-impact, resolve technical blockers |
| **Domain Developer Owner** | Eksekusi task per domain, jaga kualitas test, update dokumentasi domain |
| **QA/Tester** | Regression checklist lintas modul, validasi UAT, smoke test navigasi |
| **Tech/Product Manager** | Prioritas bisnis, keputusan i18n/feature flag scope, phase gate approval |

---

## 12) Checklist Eksekusi Praktis per PR Refactor

### Sebelum Coding
- [ ] Scope task jelas (file, domain, impact area).
- [ ] Risiko dan fallback plan tertulis di PR description.
- [ ] Test existing masih hijau (`vitest run`).

### Saat Coding
- [ ] Refactor incremental, bukan rewrite massal.
- [ ] Pertahankan kompatibilitas API internal store/service.
- [ ] Tambahkan/ubah test bersamaan dengan refactor.
- [ ] Tidak ada `any` baru di boundary (service ↔ store, store ↔ component).

### Sebelum Merge
- [ ] `npx tsc --noEmit` = 0 errors.
- [ ] `npx vitest run` ≥ current pass count (tidak boleh turun).
- [ ] Reviewer memahami alasan perubahan DAN dampaknya.
- [ ] Dokumentasi arsitektur/domain ter-update jika diperlukan.
- [ ] No direct supabase import di `src/components/` atau `src/pages/`.

---

## 13) Outcome yang Diharapkan Setelah Roadmap Selesai

| Metrik | Sebelum Refactor | Target Sesudah |
|--------|-----------------|---------------|
| Direct supabase di UI/store | 8 files | **0 files** |
| Store tanpa loading/error | 5 stores | **0 stores** |
| Service test coverage | 42% (11/26) | **100% (26/26)** |
| Total tests | 293 | **420+** |
| TS errors | 0 | **0** (dijaga CI) |
| Deprecated exports hidup | 8 | **0** |
| Halaman v3 > 300 baris | 3 pages | **0 pages** (dipecah) |
| Route config = source of truth | ❌ Partial | **✅ Full** |

---

## 14) Lampiran: File Inventory per Domain

### Stores (16 files)

| Store | Lines | cached getter | loading | error | Sync via |
|-------|-------|--------------|---------|-------|----------|
| `ahspStore` | 1152 | ❌ | ✅ (object) | toast only | **Direct DB + syncService** |
| `wbsStore` | 519 | ❌ | ✅ | ✅ | syncService |
| `curvaSStore` | 463 | ❌ | ❌ | ❌ | syncService |
| `rabStore` | 342 | ✅ | ❌ | ❌ | syncService |
| `timelineStore` | 338 | ✅ | ❌ | ❌ | syncService |
| `projectStore` | 329 | ✅ | ❌ | ❌ | **Direct DB + syncService** |
| `authStore` | 286 | ❌ | ✅ | ✅ | Direct (auth API) |
| `featureStore` | 276 | ❌ | ❌ | ❌ | syncService |
| `financeStore` | 262 | ❌ | ✅ | ✅ | service |
| `supplyChainStore` | 213 | ❌ | ✅ (object) | ✅ | service |
| `notificationStore` | 163 | ❌ | ✅ | ✅ | service |
| `tkdnStore` | 134 | ❌ | ✅ | ❌ | syncService |
| `changeOrderStore` | 127 | ❌ | ✅ + preview | ✅ | service |
| `rapStore` | 119 | ✅ | **isLoading** ⚠️ | ✅ | service |
| `approvalStore` | 110 | ❌ | ✅ | ✅ | service |
| `riskStore` | 79 | ❌ | ✅ | ✅ | service |

### Services (26 files) — Test Status

| Service | Tested? | Test File |
|---------|---------|-----------|
| approvalService | ✅ | approvalService.test.ts |
| auditService | ✅ | auditService.test.ts |
| changeOrderCascade | ✅ | changeOrderCascade.test.ts |
| changeOrderService | ✅ | changeOrderService.test.ts |
| dashboardService | ✅ | dashboardService.test.ts |
| documentService | ✅ | documentService.test.ts |
| financeService | ✅ | financeService.test.ts |
| notificationService | ✅ | notificationService.test.ts |
| rapService | ✅ | rapService.test.ts |
| riskService | ✅ | riskService.test.ts |
| timelineService | ✅ | timelineService.test.ts |
| ahspSnapshotService | ❌ | — |
| documentVersionService | ❌ | — |
| grnService | ❌ | — |
| handoverService | ❌ | — |
| materialTransferService | ❌ | — |
| progressBillingService | ❌ | — |
| progressEvidenceService | ❌ | — |
| rabPriceOverrideService | ❌ | — |
| rapProfitService | ❌ | — |
| smartMRService | ❌ | — |
| supplyChainService | ❌ | — |
| timelineScenarioService | ❌ | — |
| tkdnService | ❌ | — |
| userManagementService | ❌ | — |
| workOrderService | ❌ | — |

### Types (18 files)

`ahsp`, `approval`, `audit`, `change-order`, `curvaS`, `finance`, `grn`, `material-transfer`, `notification`, `project`, `rab`, `rap`, `risk`, `supply-chain`, `timeline`, `tkdn`, `wbs`, `work-order`

---

## 15) Lampiran Referensi Internal (Current Source of Truth)

Dokumen dan file teknis yang **wajib** dibaca semua developer:

| # | File | Isi |
|---|------|-----|
| 1 | `ARCHITECTURE.md` | Arsitektur sistem keseluruhan, data flow, DB schema |
| 2 | `MIGRATION_GUIDE.md` | Detail migrasi calculationService + syncService |
| 3 | `CRITICAL_MIGRATION_SUMMARY.md` | Ringkasan 4 phase migrasi kritikal |
| 4 | `FRONTEND_REFACTOR_MASTERPLAN.md` | **Dokumen ini** — rencana refactor + sprint backlog |
| 5 | `src/App.tsx` | Entry routing + code splitting |
| 6 | `src/config/routes.ts` | Route map + module key registry |
| 7 | `src/components/layout/AppShell.tsx` | Shell layout + sidebar navigation |
| 8 | `src/lib/supabaseSyncService.ts` | Centralized sync queue (877 baris) |
| 9 | `src/lib/calculationService.ts` | Standar formula AHSP/RAB/markup |
| 10 | `src/lib/validationMiddleware.ts` | Runtime Zod wrapper + batch validate |
| 11 | `src/config/featureSchema.ts` | Feature flag type definitions |
| 12 | `src/hooks/useErrorHandler.ts` | Centralized error handling hook |

Dokumen ini harus dijaga tetap update seiring progres sprint refactor.
