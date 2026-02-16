# UI/UX Refactor Release Notes

**Release Date:** 2026-02-16  
**Scope:** Costing Suite + cross-module interaction consistency  
**Type:** Frontend UX modernization (non-breaking data model)

## 1) Executive Summary

This release delivers a full visual and interaction upgrade for project costing workflows and adjacent operational modules. The system now uses a denser engineering-first layout, shared sticky glass UI primitives, and in-app confirmation dialogs/toasts to replace browser-native prompts.

Primary outcomes:
- Faster scanning and actioning in data-heavy tables (AHSP, RAB, RAP)
- Consistent command-center interaction patterns across modules
- Improved mobile fallback behavior for critical table workflows
- Safer destructive operations through standardized AlertDialog confirmations

## 2) UX Standards Introduced

### Visual System
- Shared compact density tokens for enterprise data screens:
  - `density-compact`
  - `panel-compact`
  - `hover-interactive`
- Sticky, glass-like utility classes for high-information screens:
  - `sticky-glass-panel`
  - `sticky-glass-tablehead`
  - `sticky-glass-footer`
  - `control-compact`

### Interaction Standards
- Browser-native `confirm/alert` patterns replaced with:
  - in-app `AlertDialog` for confirmations/destructive actions
  - `sonner` toast feedback for success/error/info
- Hover/focus action reveal standardized for dense table rows
- Sticky command bars and summary footers adopted in key modules

## 3) Module-by-Module Change Log

### A. Project Costing Shell
- Redesigned integrated costing cockpit layout with:
  - top command header
  - WBS side navigation context
  - sticky action/footer zone
  - unified tab framing for AHSP / RAB / RAP
- Added telemetry refresh and contextual summary indicators (margin, TKDN, progress)

Key file:
- `src/pages/modules/v3/ProjectCosting.tsx`

### B. AHSP (Catalog + Editors + Settings)
- AHSP catalog table restructured for estimator readability:
  - grouped Supply vs Install columns
  - category section rows
  - totals summary strip
  - coefficient guidance tooltip
- Added mobile card fallback for AHSP item browsing/actions
- Delete/import/settings actions now use in-app confirmation dialogs
- Import and validation feedback moved to toast notifications

Key files:
- `src/components/ahsp/AHSPCatalog.tsx`
- `src/components/ahsp/AHSPItemEditor.tsx`
- `src/components/ahsp/AHSPSettings.tsx`
- `src/pages/modules/AHSP/index.tsx`

### C. DKH / Resource Management
- Resource deletion and DKH import flows now use structured confirmation dialogs
- Import previews show parsed counts before commit (material/labor/equipment/subcontractor)

Key files:
- `src/components/ahsp/ResourceManager.tsx`
- `src/components/dkh/DKHManager.tsx`

### D. RAB
- RAB shell and table density polished for high-volume editing
- Sticky controls and sticky table heads standardized
- Added mobile card editing fallback for item volume/price operations
- Auto-generate WBS+Timeline now guarded by confirmation dialog
- Pareto class hinting improved with tooltip affordance

Key files:
- `src/pages/modules/RAB.tsx`
- `src/components/rab/RABTable.tsx`
- `src/components/rab/HistoryPanel.tsx`
- `src/components/rab/ImportWizard.tsx`
- `src/components/rab/RABExport.tsx`

### E. RAP
- RAP control view aligned with sticky compact table patterns
- RAB→RAP import now uses explicit confirmation dialog
- Status readability improved (badge + utilization percentage cues)
- Scheduler toast feedback normalized

Key file:
- `src/pages/modules/RAP.tsx`

### F. Timeline + WBS
- Timeline task delete now uses in-app confirmation
- WBS delete now uses in-app confirmation for parent+children removal
- WBS toolbar and top bar compacted for denser navigation

Key files:
- `src/pages/modules/Timeline.tsx`
- `src/pages/modules/WBS.tsx`

### G. Risk + TKDN
- Risk Register table and action affordance modernized (dense + sticky + hover)
- Deletion flows migrated to AlertDialog
- TKDN filters/tables compacted and aligned with shared sticky header patterns

Key files:
- `src/components/risk/RiskRegister.tsx`
- `src/components/tkdn/TKDNResourceManager.tsx`

### H. Change Management, Documents, Finance, Handover, Project Management, Auth
- Standardized destructive/critical actions from `confirm/alert` to dialogs/toasts:
  - Change order rejection confirmation
  - Document delete confirmation
  - Invoice payment confirmation
  - Project archive confirmation
  - Project delete confirmation
  - Login demo action toast
- Document version revert now uses explicit confirmation dialog

Key files:
- `src/pages/modules/v3/ChangeManagement.tsx`
- `src/pages/modules/v3/Documents.tsx`
- `src/pages/modules/v3/Finance.tsx`
- `src/pages/modules/v3/HandoverWizard.tsx`
- `src/pages/modules/ProjectManagement.tsx`
- `src/pages/auth/Login.tsx`
- `src/components/modules/DocumentVersionHistory.tsx`

### I. Shared UI Primitives
- `Dialog` and `AlertDialog` restyled to consistent glass overlay/content style
- Ensures modal consistency across all migrated confirmation flows

Key files:
- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/shadcn.css`

## 4) Behavioral Notes (Compatibility)

- No backend schema changes introduced by this release.
- No breaking changes to service/store contracts were introduced intentionally.
- Main functional changes are UX/interaction-level and confirmation flow safety.

## 5) Validation Status

Validation performed during this refactor cycle:
- Repeated TypeScript/compile error checks after major patch groups
- Targeted unit tests for touched module behavior where applicable
- Latest full-suite test run in session passed (`325 passed, 0 failed`)

## 6) Known Follow-ups (Optional)

- Additional visual parity polish can continue on lower-traffic modules to match Costing-level density standards.
- If desired, add screenshot-based regression snapshots for key cockpit screens (AHSP/RAB/RAP).
- If desired, add a short user-facing “What changed” guide for operations teams.

---

## 7) Quick Rollout Checklist

- [ ] Smoke test AHSP create/edit/delete/import in active project
- [ ] Smoke test RAB item editing + auto schedule generation
- [ ] Smoke test RAP import-from-RAB path
- [ ] Smoke test Timeline/WBS destructive actions and confirmations
- [ ] Smoke test Documents/Finance/Handover critical actions
- [ ] Verify toast and dialog behavior in both light and dark themes
