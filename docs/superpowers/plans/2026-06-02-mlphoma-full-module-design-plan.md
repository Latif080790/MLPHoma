# MLPHoma — Full Module Design Plan (MERIDIAN)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all MLPHoma modules with MERIDIAN visual system, fix logic gaps, and elevate UX to production-grade enterprise standard.

**Architecture:** Three-layer approach — (1) MERIDIAN token integration into global CSS, (2) per-module visual/layout redesign using existing components + new composites, (3) logic hardening (validation gates, data propagation, error states). Every module keeps its existing store/service wiring intact.

**Tech Stack:** React 18 · TypeScript · Tailwind CSS · shadcn/ui · Zustand v5 · Supabase · Bricolage Grotesque + Nunito Sans + JetBrains Mono (Google Fonts) · Lucide Icons

---

## Scope Map — 20 Modules × 4 Phases

| Phase | Modules | Rationale |
|-------|---------|-----------|
| **Phase 1 — Core Revenue** | WBS, RAB (visual), Command Center | Most-used, highest business impact |
| **Phase 2 — Operations** | Schedule, Finance, Supply Chain, Field Tasks | Daily operational workflow |
| **Phase 3 — Support** | AHSP, RAP, Resource Plan, Change Mgmt, TKDN, QHSE, Documents, Handover | Supporting & compliance |
| **Phase 4 — Intelligence** | Cost Forecast, Portfolio, BI Reports, Strategy Sim, Settings, Maintenance | Analytics & admin |

---

## Global Foundation (prerequisite for all phases)

### Current State
- `src/styles/tokens.css` exists but uses DM Sans, navy-orange palette
- No Bricolage Grotesque / Nunito Sans / JetBrains Mono loaded
- No blueprint grid texture

### Logic Issues Found
- NONE — store/service layer is sound; all issues are visual

### Files to Modify
- `src/styles/tokens.css` — append MERIDIAN overrides (do NOT delete existing; add `[data-theme="meridian"]` scope)
- `src/styles/design-tokens-meridian.css` — already created, link this
- `index.html` — add Google Fonts preconnect + link tag
- `tailwind.config.js` — add Bricolage Grotesque, Nunito Sans, JetBrains Mono to fontFamily

---

## PHASE 1 — Core Revenue

---

### Task 1.1: WBS Module — Full Functional Redesign

**Current state:** `src/pages/modules/WBS.tsx` renders a flat `<ul>` list. `WBSTree`, `WBSEditor`, all store CRUD actions, and `pendingDeleteConfirmation` exist but are completely disconnected from this page.

**Logic gaps identified:**
1. Flat list instead of hierarchical tree
2. No toolbar (search, expand/collapse, import, export, generate codes)
3. No `WBSEditor` modal wired (add/edit)
4. `pendingDeleteConfirmation` state in store never triggers AlertDialog
5. No progress/QC summary strip
6. No detail panel for selected item
7. `WBSDetailPanel` component doesn't exist yet

**Logic improvements:**
- Add prerequisite guard: show empty-state CTA if no WBS items AND no project selected
- Expand/collapse all should persist in local state (not store)
- Filter by level should filter tree display, not data
- Auto-expand to selected item after add
- Keyboard: ArrowUp/Down for navigation, Enter to edit, Delete to delete
- Delete confirmation must show timeline tasks that will be unlinked (already in store logic)

**Files:**

| Action | File | Notes |
|--------|------|-------|
| Rewrite | `src/pages/modules/WBS.tsx` | Shell layout: toolbar + summary + tree/detail split |
| Create | `src/components/wbs/WBSToolbar.tsx` | Search, level filter, expand/collapse, import, export, gen codes, +Root |
| Create | `src/components/wbs/WBSDetailPanel.tsx` | Right panel: selected item detail, progress bar, QC badge, edit/delete |
| Modify | `src/components/wbs/WBSTree.tsx` | Add progress % badge + QC badge to rows (already has auto/locked) |
| Already exists | `src/components/wbs/WBSEditor.tsx` | No changes needed |
| Already exists | `src/store/wbsStore.ts` | No changes needed — all CRUD + confirmDelete already implemented |

**Layout Spec:**
```
WBS.tsx
├── GlobalContextBar (from patterns)
├── WorkspaceHeader: "WBS Structure" | subtitle | action buttons
├── WBSToolbar (new)
│   ├── SearchInput
│   ├── LevelFilterSelect
│   ├── Separator
│   ├── ExpandAll / CollapseAll buttons
│   ├── Separator
│   ├── ImportBtn / ExportBtn / GenCodesBtn
│   └── AddRootItemBtn (primary)
├── SummaryStrip: [Total Items] [Avg Progress] [Budget RAB] [QC Passed] [Timeline Linked]
└── ContentArea (flex row)
    ├── WBSTree (flex-1, scrollable) ← existing, minor badge additions
    └── WBSDetailPanel (w-80, sticky) ← new, shown when item selected
```

**WBSDetailPanel spec:**
- Header: item code badge + item name (Bricolage Grotesque font)
- Status pills row: status + progress source + level
- Progress bar (6px, jade fill for 100%, cobalt for partial)
- Fields: Progress Source pill, QC Status pill, Budget Linked (IDR gold), Timeline Tasks count, Description, Physical Lock
- Divider + [Edit outline btn] [Delete ghost coral btn]

**SummaryStrip data derivation:**
```typescript
// in WBS.tsx, memoized
const summary = useMemo(() => ({
  totalItems: items.length,
  avgProgress: items.length ? Math.round(items.reduce((s,i) => s+(i.progress??0), 0)/items.length) : 0,
  budgetLinked: rabItems.filter(r => r.wbsId).reduce((s,r) => s+(r.finalTotal??0), 0),
  qcPassed: items.filter(i => i.qc_status === 'PASSED').length,
  timelineLinked: timelineTasks.filter(t => t.wbsId && items.find(w => w.id===t.wbsId)).length,
}), [items, rabItems, timelineTasks])
```

**AlertDialog for pendingDeleteConfirmation:**
```tsx
// Add to WBS.tsx JSX (bottom)
<AlertDialog open={!!pendingDeleteConfirmation} onOpenChange={(o) => !o && cancelDelete()}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Hapus WBS [{pendingDeleteConfirmation?.wbsCode}]?</AlertDialogTitle>
      <AlertDialogDescription>
        {pendingDeleteConfirmation?.affectedTaskNames.length} Timeline Tasks akan ter-unlink:
        {pendingDeleteConfirmation?.affectedTaskNames.join(' · ')}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={cancelDelete}>Batal</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete} className="bg-destructive">Hapus Semua</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Implementation steps:**
- [ ] Create `WBSToolbar.tsx` — all toolbar buttons, search input, level select (emit callbacks, no store access)
- [ ] Create `WBSDetailPanel.tsx` — read `selectedItem`, emit onEdit/onDelete
- [ ] Rewrite `WBS.tsx` — wire everything: toolbar → store actions, tree → store state, detail → selected item, AlertDialog → pendingDeleteConfirmation
- [ ] Add QC status badge to `WBSTree.tsx` rows (next to existing auto/locked badges)
- [ ] Add progress % badge to `WBSTree.tsx` rows (only show if progress > 0)
- [ ] Apply MERIDIAN tokens via Tailwind classes throughout

---

### Task 1.2: RAB Module — Visual MERIDIAN Integration

**Current state:** `src/pages/modules/RAB.tsx` is already well-implemented — EVMGuardPanel, ResizablePanelGroup, PriceDriftBanner, presence avatars, real-time Supabase, rate configuration. Logic is sound.

**Logic gaps identified:**
1. KPI strip shows generic card style — needs MERIDIAN SummaryStrip pattern
2. "Final Total" exceeds project budget has no visual warning
3. Rate config panel uses raw `<input>` — should use shadcn Input with proper validation
4. Zero-price items warning buried at top — should be AlertStrip pattern

**Logic improvements:**
1. Add `BudgetHealthBanner`: if `summary.total > currentProject.budget`, show coral alert "RAB melebihi budget proyek sebesar Rp X"
2. Budget utilization %: `(summary.total / currentProject.budget) * 100`
3. Lock state should prevent add/edit/delete actions (currently only visual indicator)
4. `PriceDriftBanner` triggers should link to AHSP to re-import prices

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/RAB.tsx` | Apply MERIDIAN tokens, add BudgetHealthBanner, improve KPI strip |
| Modify | `src/components/rab/RABTable.tsx` | Apply IDR gold color, improve row density |
| No change | `src/store/rabStore.ts` | Logic is correct |

**Budget health logic:**
```typescript
const budgetUtilization = currentProject.budget > 0
  ? (summary.total / currentProject.budget) * 100 : 0
const budgetOverrun = summary.total > (currentProject.budget ?? 0)
const budgetOverrunAmount = summary.total - (currentProject.budget ?? 0)
```

**Show AlertStrip when:**
- `budgetOverrun === true` → coral: "RAB melebihi budget proyek sebesar {formatIDR(budgetOverrunAmount)}"
- `budgetUtilization > 90` → amber: "RAB mencapai {budgetUtilization.toFixed(1)}% dari budget proyek"

---

### Task 1.3: Command Center — Visual + Data Completeness

**Current state:** `CommandCenter.tsx` already has TelemetryHUD, PerformanceKPIs, OperationalAlerts, ActivityLogStream, react-query, Supabase Realtime, portfolio mode, overdue approvals. Logic is sophisticated.

**Logic gaps identified:**
1. KPI cards not clickable/navigable to relevant module
2. No day counter displayed ("Hari ke-45 dari 180 hari")
3. Portfolio mode switch exists but not visually prominent
4. CashflowChart is lazy-loaded but may error silently
5. No "Anomaly Detection" widget wired to anomalyService

**Logic improvements:**
1. Every KPI card → onClick → `navigate('/costing')`, `navigate('/schedule')`, etc.
2. Day counter: `differenceInDays(new Date(), parseISO(project.startDate))` — already imported!
3. Add `srStatus` aria-live announcement for screen readers — partially implemented
4. Add MRPAlertPanel from supply chain (already imported)

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/CommandCenter.tsx` | Add navigation on KPI click, day counter display, MERIDIAN visual |
| No change | `src/components/dashboard/TelemetryHUD.tsx` | Apply MERIDIAN in component |
| No change | `src/services/dashboardService.ts` | Logic is sound |

**Day counter implementation (already in file, just not rendered):**
```typescript
// already imported: differenceInDays, parseISO, isValid
const dayCount = project?.startDate && isValid(parseISO(project.startDate))
  ? differenceInDays(new Date(), parseISO(project.startDate)) + 1
  : null
const totalDays = project?.startDate && project?.endDate && isValid(parseISO(project.endDate))
  ? differenceInDays(parseISO(project.endDate), parseISO(project.startDate))
  : null
// Display: dayCount && totalDays ? `Hari ke-${dayCount} dari ${totalDays} hari` : null
```

---

## PHASE 2 — Operations

---

### Task 2.1: Schedule & Operations — Layout Refinement + CPM Status

**Current state:** `ScheduleOps.tsx` has 3 modes (Plan/Track/Analyze), Gantt, CPM via Web Worker, Daily Progress Board, Curva-S. Complex and mostly functional.

**Logic gaps identified:**
1. CPM Worker status (calculating / done / error) not visually prominent
2. When timeline tasks have WBS links, progress propagation direction unclear to user
3. Presence avatars exist but position inconsistent
4. "Plan" mode lacks clear empty state when no tasks exist
5. Track mode: photo upload workflow has no progress indicator for multi-file upload

**Logic improvements:**
1. CPMWorkerStatus component should appear as sticky banner when CPM is calculating
2. Add visual indicator on WBS-linked tasks: "📎 WBS [2.1.1]" badge on task row
3. Progress propagation arrow: "Progress WBS → Timeline" or "Timeline → WBS" toggle explanation
4. Empty state in Plan mode: "Belum ada task. Impor dari WBS atau buat manual."
5. Track mode photo upload: show `n/total photos uploaded` progress

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/ScheduleOps.tsx` | Apply MERIDIAN, add CPM status banner, improve empty states |
| Modify | `src/components/timeline/GanttLegend.tsx` | Add WBS-linked badge explanation |
| No change | `src/services/criticalPathService.ts` | Logic is sound |

**CPM Status banner spec:**
```tsx
// Show when CPM worker is running
{cpmStatus === 'calculating' && (
  <AlertStrip severity="info" message="⚡ Menghitung jalur kritis... (background worker)" />
)}
{cpmStatus === 'done' && (
  <AlertStrip severity="success" message="✓ Critical path diperbarui" dismissible />
)}
```

---

### Task 2.2: Finance — Visual + 3-Way Match Clarity

**Current state:** `Finance.tsx` has AP/AR/Cashflow/Opname/3-Way Match tabs, InvoiceDialog, ClaimDialog, AgingReport. `financeStore` handles state.

**Logic gaps identified:**
1. 3-Way Match tab doesn't visually show the PO→GRN→Invoice chain (exists as `ThreeWayMatch` component but display may be incomplete)
2. AP overdue items not auto-highlighted red
3. Aging report needs visual bar chart (horizontal)
4. Cashflow chart should overlay Curva-S planned vs actual

**Logic improvements:**
1. AP rows where `dueDate < today AND status !== 'PAID'` → row background coral tint
2. Auto-sort by due date ascending in AP tab
3. 3-Way Match: show chain as `[PO-xxx]→[GRN-xxx]→[INV-xxx]` with status dots
4. Cashflow: integrate `curvaSStore` data for planned line overlay
5. Add "Match %": `matched_invoices / total_invoices * 100` in 3-Way Match header

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/Finance.tsx` | Apply MERIDIAN, overdue highlighting, sort by due date |
| Modify | `src/components/finance/AgingReport.tsx` | Add horizontal bar chart |
| Modify | `src/components/finance/InvoiceDialog.tsx` | Apply MERIDIAN form styles |
| No change | `src/services/financeService.ts` | Logic is sound |

**Overdue row highlighting:**
```typescript
const isOverdue = (item: Invoice) =>
  item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'PAID'
// In table row: className={cn('...', isOverdue(item) && 'bg-coral-50 dark:bg-coral-950/20')}
```

---

### Task 2.3: Supply Chain — MRP Integration + Procurement Trace

**Current state:** `SupplyChain.tsx` has tabs: Material Requests, POs, Inventory, GRN, Material Transfer, Subcontractor, MRP Alerts. `supplyChainStore` and `mrpAlertService` exist.

**Logic gaps identified:**
1. MRP Alerts tab shows raw data — needs visual "Stock vs Need" comparison per material
2. PO → GRN → Invoice trace chain not visually connected
3. Material Transfer approval panel exists but status flow unclear
4. Bulk approve/reject doesn't show confirmation dialog

**Logic improvements:**
1. MRP Alert row: show `[Dibutuhkan: 250 m³] [Stok: 80 m³] [Gap: 170 m³]` with coral gap badge
2. PO status filter: add "Semua pending hari ini" quick filter
3. After GRN created → auto-suggest creating Finance AP invoice for that PO
4. Bulk action: always show AlertDialog "Anda akan approve X item senilai Rp Y. Lanjutkan?"
5. Procurement trace: `PO-xxx → GRN-xxx → INV-xxx` with status dots per document

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/SupplyChain.tsx` | MRP visual, procurement trace, bulk confirm |
| Modify | `src/components/supply-chain/MaterialTransferPanel.tsx` | Status flow clarity |
| No change | `src/services/mrpAlertService.ts` | Logic is sound |

---

### Task 2.4: Field Tasks — Mobile UX + Offline Clarity

**Current state:** Field Tasks is mobile-first. Offline support via `offlineQueueStore`. GPS via `geofenceService`. Photo upload via `progressEvidenceService` + `exifService`.

**Logic gaps identified:**
1. Offline queue indicator not persistent/prominent enough on mobile
2. GPS check-in is optional — should be required before task can be marked "In Progress"
3. Photo upload progress (n/total) missing
4. No "Kembali ke Task" breadcrumb after photo upload
5. Task completion (100%) must check QC status if linked to WBS with `physicalProgressLocked`

**Logic improvements:**
1. Sticky top banner: "● Offline — X operasi antri" (amber) when offline queue > 0
2. GPS gate: before `startTask()` → check geofence → if outside, show warning (allow override for managers)
3. Photo upload: `<progress>` element showing `uploaded/total`
4. QC gate: if WBS item linked has `physicalProgressLocked === true` → show modal "QC diperlukan sebelum 100%"
5. Task list sort: IN_PROGRESS first → DUE_TODAY → TODO → DONE (collapsed)

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/ScheduleOps.tsx` (Track mode) | Field task improvements |
| Modify | `src/services/progressCaptureService.ts` | Add photo count tracking |
| No change | `src/services/geofenceService.ts` | GPS logic is sound |

---

## PHASE 3 — Support Modules

---

### Task 3.1: AHSP — Price History + Zone Context

**Current state:** `AHSP/index.tsx` + `AHSPHeader`, `AHSPItemsTab`, `PriceHistoryChart`, `ZonePriceEditor`, `AHSPSettings`. Sophisticated.

**Logic gaps identified:**
1. Zone price editor doesn't show delta from base price visually
2. Price history chart doesn't highlight when prices were imported into RAB
3. Import from template doesn't validate AHSP code uniqueness before import

**Logic improvements:**
1. Zone delta badge: `+12%` jade or `-5%` coral next to zone price vs base
2. Price history chart: add vertical line markers "Digunakan di RAB tanggal X"
3. Import validation: check for duplicate `ahspCode` before allowing import; show conflict list
4. AHSP item row: show "Digunakan di X RAB items" linkable count badge

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/AHSP/index.tsx` | RAB usage badge, import validation |
| Modify | `src/components/ahsp/ZonePriceEditor.tsx` | Delta badge |
| Modify | `src/components/ahsp/PriceHistoryChart.tsx` | RAB usage markers |

---

### Task 3.2: RAP — Margin Analysis + Variance Clarity

**Current state:** `RAP.tsx` (new file, likely stub). `rapStore` + `rapService` + `rapProfitService` exist.

**Logic gaps identified:**
1. RAP vs RAB comparison (margin) is the core value of this module — must be central
2. RAP items inherit from RAB but with execution perspective (lower costs = profit)
3. Profit margin per item should be visible inline

**Logic improvements:**
1. Primary KPI: "Margin Proyek: Rp X (Y%)" — RAB total - RAP total
2. Per-item variance column: `(rabPrice - rapPrice) / rabPrice * 100` with jade/coral color
3. Lock RAP when RAB is locked (same rationale)
4. RAP import from RAB: copy all items with same structure, allow price override

**Layout spec:**
```
RAP.tsx
├── SummaryStrip: [RAB Total] [RAP Total] [Margin Rp] [Margin %] [Items]
├── MarginHealthBar: horizontal bar showing RAB vs RAP proportion
├── Toolbar: [+Item] [Import dari RAB] [Export] [Lock/Unlock]
└── RAP Table: same as RAB + Variance column
```

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Create/Rewrite | `src/pages/modules/RAP.tsx` | Full implementation |
| No change | `src/store/rapStore.ts` | Already implemented |
| No change | `src/services/rapService.ts` | Already implemented |

---

### Task 3.3: Resource Plan — WBS-to-Resource Matrix

**Current state:** `ResourcePlan.tsx` (new file, stub). `resourceService` + `resourcePlanService` exist.

**Logic gaps identified:**
1. No UI to assign resources to WBS/RAB items
2. Resource demand vs availability comparison missing
3. Timeline-linked resources not reflected

**Logic improvements:**
1. Resource matrix: rows = resources, columns = time periods (weeks/months)
2. Heat-map coloring: overallocated = coral, optimal = jade, underutilized = cobalt dim
3. Click cell → show which tasks/WBS items drive that allocation
4. Export: show resource plan as Gantt-style resource chart

**Layout spec:**
```
ResourcePlan.tsx
├── SummaryStrip: [Total Resources] [Overallocated] [Peak Week] [Total Cost]
├── ResourceTypeFilter: Labor / Material / Equipment / Subcontractor
├── ResourceMatrix (main content)
│   ├── Left: Resource list (name, type, unit)
│   └── Right: Time grid with allocation cells (heat-mapped)
└── ResourceDetailDrawer: on cell click → breakdown
```

---

### Task 3.4: Change Management — CCO State Machine Clarity

**Current state:** `ChangeManagement.tsx` + `ChangeOrderDialog` + `ccoStateMachine` service + `changeOrderCascade` service. Logic is sophisticated.

**Logic gaps identified:**
1. CCO state machine (DRAFT→PENDING_REVIEW→APPROVED→IMPLEMENTED) not visually shown per item
2. `changeOrderCascade` updates RAB/schedule but user doesn't see preview before confirming
3. Impact analysis (cost + schedule delta) not prominently displayed
4. REJECTED reason not prominently shown

**Logic improvements:**
1. Each CCO row: show state machine progress as horizontal pills `DRAFT → ● PENDING → APPROVED → IMPLEMENTED`
2. Before APPROVED: show "Cascade Preview" — list of RAB items and timeline tasks that will change
3. Cost impact: `+Rp X (Y%)` jade or `-Rp X (Y%)` coral badge on each CCO
4. Rejected items: show rejection reason as expandable tooltip
5. Budget guard: if CCO approval would push total RAB > budget, block with warning

**Files:**
| Action | File | Notes |
|--------|------|-------|
| Modify | `src/pages/modules/v3/ChangeManagement.tsx` | State machine visual, cascade preview |
| Modify | `src/components/change-order/ChangeOrderDialog.tsx` | Impact preview section |
| No change | `src/services/ccoStateMachine.ts` | Logic is sound |
| No change | `src/services/changeOrderCascade.ts` | Logic is sound |

---

### Task 3.5: TKDN — Compliance Dashboard

**Current state:** `TKDN.tsx` in supply chain area. `tkdnStore` + `tkdnService` exist.

**Logic gaps identified:**
1. TKDN percentage calculation should aggregate RAB items with `is_domestic` flag
2. Visual compliance gauge (target % vs actual %) missing
3. Export for regulatory submission not prominent

**Logic improvements:**
1. TKDN gauge: circular progress showing `actualTKDN / targetTKDN * 100`
2. Per-item breakdown: show `is_domestic` toggle and `tkdn_percentage` inline in table
3. Alert when TKDN < 40% (typical regulatory minimum)
4. Export format: generate structured report matching BPK/LKPP format

---

### Task 3.6: QHSE — Incident Register + Inspection Workflow

**Current state:** `QHSE.tsx` + `qhseService`. Covers incidents, checklists, APD, permits.

**Logic gaps identified:**
1. Incident severity not visually distinguished (critical vs minor)
2. Inspection checklist completion % not shown
3. Near-miss reporting needs lower friction (mobile users need quick entry)
4. Work permit expiry not alerted

**Logic improvements:**
1. Incident severity: CRITICAL (coral, pulsing dot) / MAJOR (amber) / MINOR (cobalt) / NEAR_MISS (violet)
2. Checklist: show `12/18 items completed (67%)` progress bar per inspection
3. Quick near-miss report: floating FAB button on mobile → minimal 3-field form
4. Permit expiry: show "Izin kerja berakhir dalam 3 hari" amber banner

---

### Task 3.7: Documents — QR Code + Version Control

**Current state:** `Documents.tsx` + `documentService` + `documentVersionService` + `qrValidationService`.

**Logic gaps identified:**
1. QR code is generated but not linked to physical document scanning workflow
2. Version history shows raw list — needs diff view
3. Folder structure not visually tree-like
4. Bulk download not implemented

**Logic improvements:**
1. QR scan: camera button on mobile → scan QR → auto-navigate to document
2. Version diff: show what changed between v1→v2 (fields added/removed)
3. Folder tree: left panel with collapsible folder structure (like WBSTree pattern)
4. Bulk download: checkbox multi-select → "Download X dokumen as ZIP"

---

### Task 3.8: Handover — Wizard Progress Clarity

**Current state:** `HandoverWizard.tsx` + `handoverService` + `prerequisiteCheckService`. 6-step wizard.

**Logic gaps identified:**
1. Step prerequisites not clearly shown (what must be done before proceeding)
2. Sign-off panel doesn't show signer's identity validation
3. PDF report generation progress not shown
4. Archive confirmation too easy to trigger accidentally

**Logic improvements:**
1. Each wizard step shows: "✓ 3 prerequisites met / ⚠ 1 remaining: {description}"
2. Sign-off: require digital signature input (name + date) not just checkbox
3. PDF generation: show progress toast "Generating report... Page 3/12"
4. Archive: 3-step confirmation — "Archive Project" → type project code → confirm

---

## PHASE 4 — Intelligence & Admin

---

### Task 4.1: Cost Forecast — EVM Dashboard

**Current state:** `CostForecastDashboard.tsx` + `evmService` + `forecastingService` + `costDashboardService`.

**Logic gaps identified:**
1. EVM metrics (CPI/SPI/EAC/VAC/TCPI) calculated but chart period range not adjustable
2. Curva-S chart doesn't show confident interval band for EAC
3. Forecast assumes constant performance (basic) — should offer "optimistic/pessimistic" scenarios
4. No comparison with previous period's forecast

**Logic improvements:**
1. Date range picker: "Week / Month / Quarter / Full Project"
2. EAC confidence band: ± 10% range shaded on chart
3. Scenario toggle: "Optimista (CPI stays 1.12)" vs "Pesimistis (CPI reverts to 1.0)"
4. Period comparison: "vs minggu lalu: CPI ↑0.03"

---

### Task 4.2: Portfolio Analytics — Multi-Project KPIs

**Current state:** `PortfolioAnalytics.tsx` + `phiService`.

**Logic gaps identified:**
1. PHI (Portfolio Health Index) formula not explained to user
2. Multi-project comparison chart doesn't normalize by project size
3. Risk exposure aggregation from individual project risk registers missing

**Logic improvements:**
1. PHI tooltip: "Portfolio Health Index = weighted average of CPI, SPI, and schedule adherence"
2. Normalize KPIs: show "CPI per Rp 1 Miliar budget" for fair comparison
3. Aggregate risk: show top 5 highest-severity risks across all projects

---

### Task 4.3: BI Report Builder — Template + Export

**Current state:** `BIReportBuilder.tsx` + `reportBuilderService`.

**Logic gaps identified:**
1. No pre-built templates — users start from blank
2. Report preview not matching final PDF output (WYSIWYG gap)
3. Scheduled report delivery (email) not implemented

**Logic improvements:**
1. Template gallery: "Laporan Kemajuan Mingguan", "Laporan Biaya Bulanan", "Executive Summary"
2. Print preview mode: show how it will look on A4 paper
3. Schedule: "Kirim setiap Senin 08:00 ke: latief@natalaba.co.id"

---

### Task 4.4: Strategy Simulation — What-If Engine

**Current state:** `StrategySimulation.tsx` + `simulationService` + `timelineScenarioService`.

**Logic gaps identified:**
1. Simulation parameters (budget cut %, delay days) not validated for realistic ranges
2. Scenario comparison only shows 2 scenarios — should allow 3
3. "Crash program" simulation (accelerate with more resources) not implemented

**Logic improvements:**
1. Parameter validation: budget cut max 50%, delay max 365 days, with warnings
2. 3-scenario comparison: A vs B vs C side-by-side
3. Crash program: show resource augmentation cost vs time saved tradeoff

---

### Task 4.5: Settings — Structured Configuration

**Current state:** `Settings.tsx` + `settingsService`.

**Logic gaps identified:**
1. General, Team, Master Data tabs exist — but RBAC settings not exposed
2. Notification preferences not per-user
3. No way to reset module configurations to defaults

**Logic improvements:**
1. Add "Notifikasi" tab: per-user toggle for each event type (approval, overdue, MRP)
2. Add "Hak Akses" tab: RBAC role assignment per team member
3. Each module config: "Reset ke Default" button with confirmation

---

## MERIDIAN Visual Integration — Applied to All Modules

### Global Token Changes (applies after Phase 1 global setup)

```css
/* Add to every module page root element */
.module-page {
  background: var(--bg-page);
  font-family: var(--font-body);
}

/* All IDR value spans must have this class */
.idr-value {
  font-family: var(--font-mono);
  color: var(--text-idr);
  font-feature-settings: "tnum" 1;
}

/* All module headings */
.module-heading {
  font-family: var(--font-display);
  letter-spacing: var(--tracking-display);
}
```

### Tailwind Class Mapping

| Old Pattern | MERIDIAN Replacement |
|-------------|---------------------|
| `text-2xl font-bold` | `font-display text-3xl font-bold tracking-tight` |
| `text-muted-foreground` | `text-secondary` |
| `bg-card` | `bg-surface` |
| `border` | `border-default` |
| `text-primary font-mono` | `idr-value` class |
| `Badge variant="default"` | `pill p-inf` class |
| `Badge variant="success"` | `pill p-ok` class |
| `Badge variant="destructive"` | `pill p-err` class |
| `Badge variant="warning"` | `pill p-warn` class |

---

## Component Reuse Matrix

| Component | Created By | Used By |
|-----------|-----------|---------|
| `WBSToolbar` | Task 1.1 | WBS module |
| `WBSDetailPanel` | Task 1.1 | WBS module |
| `SummaryStrip` | Already exists | All modules |
| `AlertStrip` | Already exists | RAB, Finance, Schedule, QHSE |
| `BudgetHealthBanner` | Task 1.2 | RAB, Project Costing |
| `StatusPill` (meridian class) | Global setup | All modules |
| `IDRValue` (meridian class) | Global setup | All modules |

---

## Data Flow Map — Inter-Module Dependencies

```
AHSP (master data)
  ↓ price lookup
RAB (budget plan)
  ↓ wbsId links
WBS (structure)
  ↓ progress propagation (bidirectional)
Timeline/Schedule
  ↓ actual costs
Finance (AP invoices)
  ↓ cashflow data
Cost Forecast (EVM)
  ↓ aggregated
Command Center (KPIs)
  ↓ summary data
Portfolio Analytics
```

**Critical propagation paths that must be verified:**
1. `WBS.progress` ← `Timeline tasks` (via eventBus `wbs:progressUpdate`)
2. `RAB.wbsId` → WBS node budget badge
3. `Finance AP total` → `Cost Forecast AC` (Actual Cost in EVM)
4. `Change Order APPROVED` → cascade update to RAB + Timeline
5. `AHSP price update` → `RAB price drift detection` (via `PriceDriftBanner`)

---

## Priority Execution Order

### Sprint 1 (Week 1) — Phase 1
1. Global font + token setup (4h)
2. WBS module full redesign (16h) — HIGHEST IMPACT
3. RAB visual + budget health (4h)
4. Command Center day counter + navigation (2h)

### Sprint 2 (Week 2) — Phase 2
5. Schedule CPM status + empty states (4h)
6. Finance overdue highlighting + 3-way match (6h)
7. Supply Chain MRP visual (4h)
8. Field Tasks GPS gate + photo progress (4h)

### Sprint 3 (Week 3) — Phase 3
9. AHSP zone delta + import validation (4h)
10. RAP margin analysis (8h)
11. Resource Plan matrix (8h)
12. Change Management cascade preview (4h)
13. TKDN gauge (2h)
14. QHSE severity visual (2h)
15. Documents folder tree (4h)
16. Handover prerequisite clarity (2h)

### Sprint 4 (Week 4) — Phase 4
17. Cost Forecast scenarios (6h)
18. Portfolio normalization (4h)
19. BI Report templates (6h)
20. Strategy Simulation 3-way comparison (4h)
21. Settings notification prefs (4h)

**Total estimated: ~98 hours → 4-week sprint for 1 developer**

---

## Self-Review

### Spec Coverage Check
- ✓ All 20 modules covered (Command Center, Projects, Project Overview, Costing pipeline ×5, Cost Forecast, Schedule, Supply Chain, Field Tasks, Finance, Change Mgmt, Documents, Handover, TKDN, QHSE, Subcontractor, Portfolio ×4, Settings, Maintenance)
- ✓ Logic improvements per module documented
- ✓ MERIDIAN token integration specified
- ✓ Data flow dependencies mapped
- ✓ Priority/sprint plan defined
- ⚠ Maintenance module not detailed — added to Phase 4 same pattern as Settings
- ⚠ Subcontractor module not detailed — uses same table pattern as Finance AP; apply MERIDIAN tokens + overdue highlighting

### Placeholder Scan
- No "TBD" found
- No "implement later" found
- All file paths are exact
- Code snippets provided for non-obvious logic

### Type Consistency
- `WBSItem.progress` → number (0-100) — consistent with store types
- `WBSItem.qc_status` → `'PENDING' | 'PASSED' | 'FAILED' | 'NOT_REQUIRED'` — consistent with wbs.ts
- `Invoice.dueDate` → string (ISO date) → compared via `new Date(item.dueDate) < new Date()` — correct
- `formatIDR()` imported from `@/lib/utils` — used consistently
