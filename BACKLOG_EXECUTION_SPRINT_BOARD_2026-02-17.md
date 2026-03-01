# Backlog Execution Sprint Board (v2.0)

**Date:** 2026-02-17  
**Mode:** Execution-ready technical backlog  
**Source:** GAP_MATRIX_V2_IMPLEMENTATION_2026-02-17.md

## Current Execution Snapshot
- ✅ Crash fix deployed in code: hook-order stabilization pada halaman costing.
- ✅ Validation: no editor/type problems on changed file + targeted tests passed.
- ✅ **WCAG 2.1 AA Typography Compliance COMPLETE** (359 violations fixed, automated enforcement active)
- ✅ **Sprint 0 COMPLETE** (All 3 epics: WCAG compliance, costing stability, release safety)
- ✅ **ESLint Critical Errors Fixed** (19 errors resolved across 14 files)
- ✅ **Sprint 3 COMPLETE** - Predictive & quality controls delivered (S3.1 + S3.2 + S3.3)
- ✅ **Sprint 4 COMPLETE** - Error handling & cross-cutting domains delivered (S4.1 + S4.2 + S4.3 + S4.4 + S4.5)
- ✅ **Sprint 5.1 COMPLETE** - Feature schema modularized per-domain with centralized versioning
- ✅ **Sprint 5.2 COMPLETE** - Strict validation enforced for feature snapshot save/restore
- ✅ **Sprint 5.3 COMPLETE** - Feature config audit trail integrated (who/when/changes)
- ✅ **Sprint 5.4 COMPLETE** - Module page skeleton standardized across 10 v3 pages
- ✅ **Lint blocker cleanup (v3 scope) COMPLETE** - react-hooks/purity errors resolved on standardized pages
- ✅ **v3 warning hygiene phase-1 COMPLETE** - unused imports and hook dependency warnings reduced on target pages
- ✅ **v3 warning hygiene phase-2 COMPLETE** - remaining `no-explicit-any` warnings removed on target pages
- ✅ **v3 warning hygiene phase-3 COMPLETE** - standardized 10-page scope now lint-clean (0 warning / 0 error)
- ✅ **v3 lint sweep COMPLETE** - all `src/pages/modules/v3/*.tsx` now lint-clean (0 warning / 0 error)
- ✅ **non-v3 lint error stabilization COMPLETE** - `src/pages/modules/*.tsx` now 0 error (warning backlog remains)
- ✅ **non-v3 warning quick-wins phase-1 COMPLETE** - warnings reduced from 87 to 65 (`no-unused-vars` cleanup)
- ✅ **non-v3 warning quick-wins phase-2 COMPLETE** - warnings reduced from 65 to 55 (typed cleanup on CashFlow + CurvaS)
- ✅ **non-v3 warning quick-wins phase-3a COMPLETE** - warnings reduced from 55 to 49 (FeatureSettings + RAB + RAP)
- ✅ **non-v3 warning quick-wins phase-3b COMPLETE** - warnings reduced from 49 to 29 (Timeline + Resource typed cleanup)
- ✅ **non-v3 warning quick-wins phase-3c COMPLETE** - warnings reduced from 29 to 0 (Progress + Reports typed cleanup)
- ✅ **services lint error stabilization COMPLETE** - `src/services/*.ts` now 0 error (fixed 5 `prefer-const` blockers)
- ✅ **services warning quick-wins phase-1 COMPLETE** - warnings reduced from 154 to 135 (unused-vars + typed cleanup on low-risk files)

---

## Sprint 0 (Hotfix & Stabilization) — ✅ COMPLETE

### Epic S0.0 WCAG Accessibility Foundation — ✅ COMPLETE
- [x] Phase 1: Fix 103 WCAG typography violations in module pages
  - Files: 19 module pages (CommandCenter, Finance, RAP, Progress, etc.)
  - Result: All text-[9/10/11px] replaced with text-xs (12px minimum)
- [x] Phase 2: Install ESLint enforcement infrastructure
  - Files: `.eslintrc.cjs`, `.eslintignore`
  - Result: 4 WCAG rules active, custom error messages
- [x] Phase 3: Fix 256 WCAG violations in component library
  - Files: 129 component files (AHSP, RAB, Supply, Finance, etc.)
  - Result: 100% WCAG 2.1 AA typography compliance
- [x] Automated enforcement: Pre-commit hooks + CI/CD pipeline
  - Files: `.husky/pre-commit`, `.github/workflows/eslint.yml`, `package.json`
  - Result: New violations automatically blocked
- [x] Documentation: Developer guidelines and setup guides
  - Files: `CONTRIBUTING.md`, `SETUP_HOOKS.md`, `WCAG_TYPOGRAPHY_COMPLIANCE_REPORT.md`
  - Result: Complete compliance audit and implementation summary
- **Status**: ✅ Deployed to GitHub, automated enforcement active
- **Next**: Enable branch protection rules on GitHub repository

### Epic S0.1 Costing Runtime Stability — ✅ COMPLETE
- [x] Fix hook order violation in costing page (prevent React runtime invariant crash)
  - File: `src/pages/modules/v3/ProjectCosting.tsx`
  - Result: all hooks now run before conditional return.
- [x] Add guard regression test/scenario for project switching (no active project -> active project)
  - File: `src/pages/modules/v3/__tests__/ProjectCosting.test.tsx`
  - Result: 6 comprehensive test scenarios covering hook order compliance
  - Tests: no project state, project switching, rapid switching, data fetching, edge cases
  - Status: ✅ Test documentation complete (tests skipped - need child component mocking)

### Epic S0.2 Release Safety — ✅ COMPLETE
- [x] Add smoke checklist in repo docs for `/costing` route
  - File: `UIUX_REFACTOR_RELEASE_NOTES_2026-02-16.md`
  - Result: Comprehensive 3-priority smoke test checklist added
  - Coverage: AHSP/RAB/RAP modules, cross-module integration, WCAG compliance, performance
  - Status: ✅ Smoke test checklist documented with execution template

---

## Code Quality Improvements — ✅ COMPLETE (2026-02-28)

### ESLint Critical Error Fixes
- [x] Fixed 19 ESLint errors across 14 files
  - `react/no-unescaped-entities`: Escaped 12 quote instances in JSX
  - `no-empty`: Added comments to 2 intentionally empty catch blocks
  - `no-require-imports`: Converted 2 `require()` to dynamic `import()`
  - `prefer-const`: Fixed 1 variable declaration
  - `react/no-unknown-property`: Fixed 1 data attribute
  - Function hoisting: Fixed 1 variable access before declaration
- [x] Code improvements
  - Memoized impure functions for consistent rendering (LoadingSkeleton, ApprovalInbox)
  - Used lazy state initializers for date calculations (RAPGeneratorSimple)
  - Documented intentional patterns (empty catch blocks)
- **Files Modified**: 14 components (AHSP, Finance, RAB, Timeline, UI)
- **Commit**: 3da9a92
- **Status**: ✅ Deployed to GitHub
- **Note**: Remaining warnings (1188) are mostly unused imports and valid state sync patterns

---

## Sprint 1 (Control Gates) — IN PROGRESS

### Epic S1.1 Budget Guard on Procurement — ✅ COMPLETE
- [x] Add service contract for budget-availability check before PO commit
  - New file: `src/services/budgetGuardService.ts`
- [x] Add store/action wrapper for guarded PO submit flow
  - Candidate file: `src/store/` (supply/procurement-related store)
- [x] UI feedback states for over-budget block + approval-required prompt
  - Candidate files:
    - `src/components/supply/**`
    - `src/pages/modules/**`

### Epic S1.2 Material Transfer Request (MTR) Approval Flow — ✅ COMPLETE
- [x] Define frontend model and status enum (`PENDING`, `APPROVED`, `REJECTED`)
  - New file: `src/types/materialTransfer.ts`
- [x] Add request form + PM approval dialog scaffolding
  - New files:
    - `src/components/supply/MaterialTransferRequestDialog.tsx`
    - `src/components/supply/MaterialTransferApprovalPanel.tsx`
- [x] Add notification badge integration point for pending approvals
  - Candidate files:
    - `src/components/layout/**`
    - `src/pages/Home.tsx`

### Epic S1.3 Unified Approval Queue (Minimum Slice) — ✅ COMPLETE
- [x] Introduce queue item interface (cross-domain)
  - New file: `src/types/approvalQueue.ts`
- [x] Build queue widget (PO/MTR/Invoice payment scope awal)
  - New file: `src/components/dashboard/ApprovalQueueWidget.tsx`
- [x] Render queue widget in command center/home
  - File: `src/pages/modules/v3/CommandCenter.tsx`

---

## Sprint 2 (Traceability & Governance) — IN PROGRESS

### Epic S2.1 WBS Trace Flow (MR -> PO -> GRN -> AP)
- [x] Define trace-link metadata contract
  - New file: `src/types/traceability.ts`
- [x] Add trace chip/metadata visibility in key views
  - Candidate files:
    - `src/components/supply/**`
    - `src/pages/modules/v3/Finance.tsx`

### Epic S2.2 Immutable Document Governance — ✅ COMPLETE
- [x] Version-chain policy in frontend service adapter
  - Candidate file: `src/services/documentService.ts`
- [x] Archive/active indicator + lock UI state
  - Candidate files:
    - `src/pages/modules/v3/Documents.tsx`
    - `src/components/modules/DocumentVersionHistory.tsx`

### Epic S2.3 Unified Audit Trail (Append-only oriented) — ✅ COMPLETE
- [x] Add audit log event helper
  - New file: `src/lib/auditTrail.ts`
- [x] Inject events on critical actions (approve/reject/delete/payment)
  - Candidate files:
    - `src/pages/modules/v3/Finance.tsx`
    - `src/pages/modules/v3/ChangeManagement.tsx`
    - `src/pages/modules/v3/Documents.tsx`

---

## Sprint 3 (Predictive & Quality Controls)

### Epic S3.1 Evidence-Gated Progress
- [x] Introduce progress evidence type (photo/timestamp/location)
  - New file: `src/types/progressEvidence.ts`
- [x] Gate progress submission when evidence incomplete
  - Candidate files:
    - `src/pages/modules/Timeline.tsx`
    - `src/components/timeline/**`

### Epic S3.2 Critical Path Warning
- [x] Add warning service for schedule deviation thresholds
  - New file: `src/services/scheduleAlertService.ts`
- [x] Add warning panel to command center
  - File: `src/pages/modules/v3/CommandCenter.tsx`

### Epic S3.3 Rolling Cashflow Forecast
- [x] Add simple rolling forecast utility (4/8 week)
  - New file: `src/lib/cashflowForecast.ts`
- [x] Add forecast widget in finance/dashboard
  - File: `src/pages/modules/v3/Finance.tsx`

---

## Sprint 4 (Error Handling & Cross-cutting Domains) — IN PROGRESS

### Epic S4.1 Error Taxonomy per Domain — ✅ COMPLETE
- [x] Definisikan error taxonomy per domain di `errorMessages.ts`
  - File: `src/lib/errorMessages.ts`
- [x] Tambahkan test unit taxonomy domain + category parsing
  - New file: `src/lib/__tests__/errorMessages.test.ts`

### Epic S4.2 Async Workflow Error Pipeline
- [x] Wajibkan `useErrorHandler` / `handleAsync` di async workflow halaman v3
  - Files: `ChangeManagement`, `CostForecastDashboard`, `Documents`, `Finance`, `HandoverWizard`, `ProjectOverview`, `Settings`, `StrategySimulation`

### Epic S4.3 External Error Logging
- [x] Integrasi external logging hook di `ErrorBoundary`
  - Files: `src/components/common/ErrorBoundary.tsx`, `src/services/errorLoggingService.ts`

### Epic S4.4 Sync Correlation ID
- [x] Tambahkan correlation ID ke `SyncQueueManager` tasks
  - File: `src/lib/supabaseSyncService.ts`

### Epic S4.5 Service Test Hardening (remaining)
- [x] Tambah test: documentVersion/rabPriceOverride/rapProfit/timelineScenario/userManagement/ahspSnapshot/tkdn
  - Files:
    - `src/services/__tests__/documentVersionService.test.ts`
    - `src/services/__tests__/rabPriceOverrideService.test.ts`
    - `src/services/__tests__/rapProfitService.test.ts`
    - `src/services/__tests__/timelineScenarioService.test.ts`
    - `src/services/__tests__/userManagementService.test.ts`
    - `src/services/__tests__/ahspSnapshotService.test.ts`
    - `src/services/__tests__/tkdnService.test.ts`

---

## Sprint 5 (Feature Config Governance + UI Consistency) — IN PROGRESS

### Epic S5.1 Feature Schema Modularization — ✅ COMPLETE
- [x] Pisahkan `featureSchema.ts` per domain menjadi modul `src/config/features/*.ts`
  - Files:
    - `src/config/features/shared.ts`
    - `src/config/features/{projectManagement,wbs,ahsp,rab,timeline,rap,curvaS,resourcePlanning,cashflow,progressTracking,reporting}.ts`
    - `src/config/features/featureConfig.ts`
    - `src/config/features/versioning.ts`
    - `src/config/features/index.ts`
    - `src/config/featureSchema.ts` (compatibility re-export)
- [x] Migrasikan konsumsi utama ke modular import `src/config/features`
  - Files: `featureStore`, `featureDefaults`, `featureMigrations`, `featureApi`, `FeatureSettings`, `ImpactAnalysis`, `rabSample`
- [x] Validasi terfokus lulus
  - Tests: `featureStore.test.ts`, `featureMigrations.test.ts` (pass)

### Epic S5.2 Strict Snapshot Validation — ✅ COMPLETE
- [x] Perketat validasi runtime untuk `saveSnapshot` + `restoreSnapshot`
  - File: `src/store/featureStore.ts`
  - Rules: validasi struktur `FeatureConfig`, validasi project consistency, sanitasi snapshot invalid dari localStorage
- [x] Tambah regression test untuk snapshot invalid
  - File: `src/store/__tests__/featureStore.test.ts`
  - Cases: reject save invalid shape, ignore invalid snapshot list/restore
- [x] Validasi terfokus lulus
  - Tests: `featureStore.test.ts`, `featureMigrations.test.ts` (pass)

### Epic S5.3 Feature Config Audit Trail — ✅ COMPLETE
- [x] Integrasi `featureStore` dengan `auditService` untuk perubahan config dan snapshot lifecycle
  - File: `src/store/featureStore.ts`
  - Events: `set_config`, `update_module`, `reset_to_default`, `save_snapshot`, `restore_snapshot`
- [x] Tambahkan actor context (siapa) dari `authStore` (`userId`, `userName`) di payload audit
  - File: `src/store/featureStore.ts`
- [x] Tambahkan metadata perubahan (changes) di detail audit
  - Fields: `operation`, `changedModules`/`changedFields`, `snapshotId`, `snapshotName`, `schemaVersion`
- [x] Validasi terfokus lulus
  - Tests: `featureStore.test.ts`, `featureMigrations.test.ts` (pass)

### Epic S5.4 Standardized Page Skeleton (10 v3 pages) — ✅ COMPLETE
- [x] Tambah komponen shared skeleton state untuk modul (`ModuleHeader` + loading/error/empty)
  - New file: `src/components/common/ModulePageState.tsx`
- [x] Terapkan standardisasi state pada 10 halaman v3
  - Files:
    - `src/pages/modules/v3/CommandCenter.tsx`
    - `src/pages/modules/v3/ProjectCosting.tsx`
    - `src/pages/modules/v3/ChangeManagement.tsx`
    - `src/pages/modules/v3/CostForecastDashboard.tsx`
    - `src/pages/modules/v3/Documents.tsx`
    - `src/pages/modules/v3/Finance.tsx`
    - `src/pages/modules/v3/HandoverWizard.tsx`
    - `src/pages/modules/v3/ProjectOverview.tsx`
    - `src/pages/modules/v3/Settings.tsx`
    - `src/pages/modules/v3/StrategySimulation.tsx`
- [x] Validation
  - Editor/type check: pass (no errors)
  - Targeted test: `ProjectCosting.test.tsx` pass (6/6) after stabilizing hook-order regression test

---

## Definition of Done (Execution)
- Build/compile clean on changed scope.
- No runtime crash on target flows.
- Destructive/approval flows always show explicit confirmation.
- New UI pieces covered by at least one focused test where practical.
- Release notes/gap matrix updated for every completed epic.
