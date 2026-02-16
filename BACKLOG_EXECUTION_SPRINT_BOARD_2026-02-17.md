# Backlog Execution Sprint Board (v2.0)

**Date:** 2026-02-17  
**Mode:** Execution-ready technical backlog  
**Source:** GAP_MATRIX_V2_IMPLEMENTATION_2026-02-17.md

## Current Execution Snapshot
- ✅ Crash fix deployed in code: hook-order stabilization pada halaman costing.
- ✅ Validation: no editor/type problems on changed file + targeted tests passed.
- ▶️ Backlog now moved from planning into sprint board tasks.

---

## Sprint 0 (Hotfix & Stabilization) — STARTED

### Epic S0.1 Costing Runtime Stability
- [x] Fix hook order violation in costing page (prevent React runtime invariant crash)
  - File: `src/pages/modules/v3/ProjectCosting.tsx`
  - Result: all hooks now run before conditional return.
- [ ] Add guard regression test/scenario for project switching (no active project -> active project)
  - Target: add test near costing route/render flow
  - Candidate files:
    - `src/pages/modules/v3/ProjectCosting.tsx`
    - `src/test/**` (new component test)

### Epic S0.2 Release Safety
- [ ] Add smoke checklist in repo docs for `/costing` route
  - File: `UIUX_REFACTOR_RELEASE_NOTES_2026-02-16.md`

---

## Sprint 1 (Control Gates) — NEXT

### Epic S1.1 Budget Guard on Procurement
- [ ] Add service contract for budget-availability check before PO commit
  - New file: `src/services/budgetGuardService.ts`
- [ ] Add store/action wrapper for guarded PO submit flow
  - Candidate file: `src/store/` (supply/procurement-related store)
- [ ] UI feedback states for over-budget block + approval-required prompt
  - Candidate files:
    - `src/components/supply/**`
    - `src/pages/modules/**`

### Epic S1.2 Material Transfer Request (MTR) Approval Flow
- [ ] Define frontend model and status enum (`PENDING`, `APPROVED`, `REJECTED`)
  - New file: `src/types/materialTransfer.ts`
- [ ] Add request form + PM approval dialog scaffolding
  - New files:
    - `src/components/supply/MaterialTransferRequestDialog.tsx`
    - `src/components/supply/MaterialTransferApprovalPanel.tsx`
- [ ] Add notification badge integration point for pending approvals
  - Candidate files:
    - `src/components/layout/**`
    - `src/pages/Home.tsx`

### Epic S1.3 Unified Approval Queue (Minimum Slice)
- [ ] Introduce queue item interface (cross-domain)
  - New file: `src/types/approvalQueue.ts`
- [ ] Build queue widget (PO/MTR/Invoice payment scope awal)
  - New file: `src/components/dashboard/ApprovalQueueWidget.tsx`
- [ ] Render queue widget in command center/home
  - File: `src/pages/Home.tsx`

---

## Sprint 2 (Traceability & Governance)

### Epic S2.1 WBS Trace Flow (MR -> PO -> GRN -> AP)
- [ ] Define trace-link metadata contract
  - New file: `src/types/traceability.ts`
- [ ] Add trace chip/metadata visibility in key views
  - Candidate files:
    - `src/components/supply/**`
    - `src/pages/modules/v3/Finance.tsx`

### Epic S2.2 Immutable Document Governance
- [ ] Version-chain policy in frontend service adapter
  - Candidate file: `src/services/documentService.ts`
- [ ] Archive/active indicator + lock UI state
  - Candidate files:
    - `src/pages/modules/v3/Documents.tsx`
    - `src/components/modules/DocumentVersionHistory.tsx`

### Epic S2.3 Unified Audit Trail (Append-only oriented)
- [ ] Add audit log event helper
  - New file: `src/lib/auditTrail.ts`
- [ ] Inject events on critical actions (approve/reject/delete/payment)
  - Candidate files:
    - `src/pages/modules/v3/Finance.tsx`
    - `src/pages/modules/v3/ChangeManagement.tsx`
    - `src/pages/modules/v3/Documents.tsx`

---

## Sprint 3 (Predictive & Quality Controls)

### Epic S3.1 Evidence-Gated Progress
- [ ] Introduce progress evidence type (photo/timestamp/location)
  - New file: `src/types/progressEvidence.ts`
- [ ] Gate progress submission when evidence incomplete
  - Candidate files:
    - `src/pages/modules/Timeline.tsx`
    - `src/components/timeline/**`

### Epic S3.2 Critical Path Warning
- [ ] Add warning service for schedule deviation thresholds
  - New file: `src/services/scheduleAlertService.ts`
- [ ] Add warning panel to command center
  - Candidate file: `src/pages/Home.tsx`

### Epic S3.3 Rolling Cashflow Forecast
- [ ] Add simple rolling forecast utility (4/8 week)
  - New file: `src/lib/cashflowForecast.ts`
- [ ] Add forecast widget in finance/dashboard
  - Candidate files:
    - `src/pages/modules/v3/Finance.tsx`
    - `src/pages/Home.tsx`

---

## Definition of Done (Execution)
- Build/compile clean on changed scope.
- No runtime crash on target flows.
- Destructive/approval flows always show explicit confirmation.
- New UI pieces covered by at least one focused test where practical.
- Release notes/gap matrix updated for every completed epic.
