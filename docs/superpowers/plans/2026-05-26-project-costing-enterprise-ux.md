# Project Costing — Enterprise UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Project Costing module from 6.8/10 to enterprise-grade quality by fixing dead interactions, adding resizable panels, improving WBS↔RAB visual linkage, upgrading the Dashboard aesthetic, and adding keyboard navigation.

**Architecture:** 9 focused tasks across 7 files. No new npm dependencies — uses `react-resizable-panels` already installed via `src/components/ui/resizable.tsx`. Tasks are independently shippable in order; each commit leaves the app in a working state.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + react-resizable-panels + lucide-react + zustand

---

## File Map

| File | Tasks |
|------|-------|
| `src/pages/modules/ProjectCosting.tsx` | T1 — wire RefreshCw onClick |
| `src/pages/modules/WBS.tsx` | T2 (KpiBar + button placement), T3 (ResizablePanel layout), T5 (visual linkage), T9 (WBS tooltip) |
| `src/pages/modules/RAB.tsx` | T4 (ResizablePanel + border cleanup) |
| `src/components/costing/EVMGuardPanel.tsx` | T3, T4 (remove fixed width, accept className), T9 (EVM tooltip) |
| `src/components/costing/CostDashboardView.tsx` | T6 (flat-panel industrial aesthetic) |
| `src/components/costing/CostKPIStrip.tsx` | T7 (monospace values, delta indicators) |
| `src/components/wbs/WBSTree.tsx` | T8 (keyboard navigation) |

---

### Task 1: Fix Dead RefreshCw Button

**Files:**
- Modify: `src/pages/modules/ProjectCosting.tsx`

The RefreshCw button in the CommandBar (~L272) has no `onClick` handler. It renders and looks clickable but does nothing — a broken interaction in production.

- [ ] **Step 1: Open ProjectCosting.tsx and find the RefreshCw button**

Look for this block (approximately line 272):

```tsx
<button
  type="button"
  className="transition-colors rounded p-0.5"
  style={{ color: 'rgba(255,255,255,0.2)' }}
  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
  aria-label="Refresh"
>
  <RefreshCw size={11} />
</button>
```

- [ ] **Step 2: Add onClick to call fetchSnapshot**

Replace that button with:

```tsx
<button
  type="button"
  onClick={() => {
    if (activeProjectId) {
      fetchSnapshot(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
    }
  }}
  className="transition-colors rounded p-0.5"
  style={{ color: 'rgba(255,255,255,0.2)' }}
  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
  aria-label="Refresh cost data"
  title="Refresh cost data"
>
  <RefreshCw size={11} />
</button>
```

Note: `fetchSnapshot` is already destructured at line 64 via `useForecastStore`. `handleError` is already available from `useErrorHandler()` at line 62. No new imports needed.

- [ ] **Step 3: Verify build**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```powershell
git add src/pages/modules/ProjectCosting.tsx
git commit -m "fix(costing): wire RefreshCw button to fetchSnapshot handler"
```

---

### Task 2: Restore WBSKpiBar in Desktop + Fix "+ WBS Item" Button Placement

**Files:**
- Modify: `src/pages/modules/WBS.tsx`

Two UX bugs in the same file:
1. `WBSKpiBar` (nodes/root/RAB-linked/budget stats) only renders in the mobile layout. The desktop Variant D layout omits it.
2. The "+ WBS Item" add button sits in the RAB panel header — logically wrong. It should be in the WBS tree panel header.

- [ ] **Step 1: Find the desktop WBS tree panel header in WBS.tsx**

Look for this block around line 572 (inside the `hidden md:flex` desktop layout):

```tsx
{/* Clean white header — matches Variant D reference */}
<div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
    <GitBranch size={11} className="text-slate-400" /> WBS Structure
  </span>
  <div className="flex items-center gap-1">
    <span className="text-xs font-mono text-slate-400">{items.length} nodes</span>
    <button onClick={handleExpandAll} ...>
    <button onClick={handleCollapseAll} ...>
  </div>
</div>
```

- [ ] **Step 2: Add "+ Item" CTA button into the WBS panel header**

Replace the `<div className="flex items-center gap-1">` section with:

```tsx
<div className="flex items-center gap-1">
  <button
    onClick={() => handleAddItem(null)}
    className="flex items-center gap-0.5 text-xs bg-blue-600 text-white font-semibold px-2 py-0.5 rounded hover:bg-blue-700 transition-all mr-1"
    title="Add root WBS item"
  >
    <Plus size={10} /> Item
  </button>
  <span className="text-xs font-mono text-slate-400">{items.length}</span>
  <button
    onClick={handleExpandAll}
    disabled={!items.length}
    title="Expand all"
    className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-30"
  >
    <ChevronsUpDown size={11} />
  </button>
  <button
    onClick={handleCollapseAll}
    disabled={!expandedIds.size}
    title="Collapse all"
    className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-30"
  >
    <ChevronsDownUp size={11} />
  </button>
</div>
```

- [ ] **Step 3: Add WBSKpiBar after the search input in the desktop tree panel**

Find the search input block in the desktop panel (approximately line 598):

```tsx
{/* Search — compact single line */}
<div className="px-2 pt-1.5 pb-1 border-b border-slate-100 flex-shrink-0">
  ...
</div>

{/* Tree — fills remaining height */}
<div className="flex-1 overflow-y-auto">
```

Insert the KPI bar between the search div and the tree div:

```tsx
{/* Search — compact single line */}
<div className="px-2 pt-1.5 pb-1 border-b border-slate-100 flex-shrink-0">
  ... (unchanged)
</div>

{/* KPI mini strip — desktop only, shows when nodes exist */}
{items.length > 0 && (
  <div className="px-2 py-1.5 border-b border-slate-100 flex-shrink-0">
    <WBSKpiBar
      items={items}
      rabLinkedCount={kpiData.rabLinkedCount}
      totalBudget={kpiData.totalBudget}
    />
  </div>
)}

{/* Tree — fills remaining height */}
<div className="flex-1 overflow-y-auto">
```

- [ ] **Step 4: Remove the "+ WBS Item" button from the RAB panel header**

Find this block in the RAB panel header (around line 690):

```tsx
<button
  onClick={() => handleAddItem(null)}
  className="flex items-center gap-1 text-xs bg-blue-600 text-white font-semibold px-2.5 py-1 rounded hover:bg-blue-700 transition-all"
>
  <Plus size={11} /> WBS Item
</button>
```

Delete it entirely. The button now lives in the WBS panel header.

- [ ] **Step 5: Verify build**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```powershell
git add src/pages/modules/WBS.tsx
git commit -m "fix(wbs): restore WBSKpiBar in desktop layout, move +WBS Item to correct panel"
```

---

### Task 3: Resizable Panels — WBS Three-Column Layout

**Files:**
- Modify: `src/pages/modules/WBS.tsx`
- Modify: `src/components/costing/EVMGuardPanel.tsx`

The current layout uses fixed widths: WBS = 224px, EVM = 272px, RAB = flex-1. Enterprise users need to drag-resize panels. Replace with `react-resizable-panels`.

- [ ] **Step 1: Update EVMGuardPanel to accept className prop + remove fixed width**

In `src/components/costing/EVMGuardPanel.tsx`, change the interface and the outer div:

```tsx
// Before:
interface EVMGuardPanelProps {
  projectId: string | null
}

export function EVMGuardPanel({ projectId }: EVMGuardPanelProps) {
  // ...
  return (
    <div className="w-[272px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
```

```tsx
// After:
interface EVMGuardPanelProps {
  projectId: string | null
  className?: string
}

export function EVMGuardPanel({ projectId, className }: EVMGuardPanelProps) {
  // ...
  return (
    <div className={`bg-white border-l border-slate-200 flex flex-col overflow-hidden h-full ${className ?? ''}`}>
```

- [ ] **Step 2: Add ResizablePanelGroup import to WBS.tsx**

At the top of `src/pages/modules/WBS.tsx`, add after the existing UI imports:

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
```

- [ ] **Step 3: Replace the fixed-width desktop layout wrapper**

Find the desktop layout container (~line 566):

```tsx
{/* Desktop Variant D Layout — WBS Tree | RAB Table | EVM Guard */}
<div
  className="hidden md:flex rounded-xl border border-slate-200 shadow-sm overflow-hidden"
  style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
>
  {/* ── WBS Tree Panel ─── */}
  <div className="w-[224px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
    ...
  </div>

  {/* ── RAB Table Panel ─── */}
  <div className="flex-1 flex flex-col bg-white overflow-hidden">
    ...
  </div>

  {/* ── EVM Guard Panel ─── */}
  <EVMGuardPanel projectId={projectId || null} />
</div>
```

Replace the **outer wrapper div and all three inner panels** with:

```tsx
{/* Desktop Variant D Layout — WBS Tree | RAB Table | EVM Guard (resizable) */}
<div
  className="hidden md:rounded-xl md:border md:border-slate-200 md:shadow-sm md:overflow-hidden"
  style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
>
  <ResizablePanelGroup direction="horizontal" className="h-full">

    {/* ── WBS Tree Panel ──────────────────── */}
    <ResizablePanel defaultSize={22} minSize={16} maxSize={38}>
      <div className="bg-white flex flex-col h-full border-r border-slate-200">

        {/* Panel header */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <GitBranch size={11} className="text-slate-400" /> WBS
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAddItem(null)}
              className="flex items-center gap-0.5 text-xs bg-blue-600 text-white font-semibold px-2 py-0.5 rounded hover:bg-blue-700 transition-all mr-1"
              title="Add root WBS item"
            >
              <Plus size={10} /> Item
            </button>
            <span className="text-xs font-mono text-slate-400">{items.length}</span>
            <button onClick={handleExpandAll} disabled={!items.length} title="Expand all"
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-30">
              <ChevronsUpDown size={11} />
            </button>
            <button onClick={handleCollapseAll} disabled={!expandedIds.size} title="Collapse all"
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-30">
              <ChevronsDownUp size={11} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-2 pt-1.5 pb-1 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            <input
              type="text"
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Cari kode / nama..."
              className="w-full pl-5 pr-5 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder:text-slate-300"
            />
            {treeSearch && (
              <button onClick={() => setTreeSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* KPI mini strip */}
        {items.length > 0 && (
          <div className="px-2 py-1.5 border-b border-slate-100 flex-shrink-0">
            <WBSKpiBar items={items} rabLinkedCount={kpiData.rabLinkedCount} totalBudget={kpiData.totalBudget} />
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
              <Layers size={24} className="opacity-20" />
              <p className="text-xs text-center text-slate-400">Belum ada WBS node</p>
              <button onClick={() => handleAddItem(null)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={11} /> Add Root Item
              </button>
            </div>
          ) : (
            <WBSTree
              items={items}
              selectedId={selectedId}
              expandedIds={expandedIds}
              loading={loading}
              filterText={treeSearch}
              budgetByWbs={kpiData.budgetByWbs}
              onItemClick={(item) => { selectItem(item.id); setFilterWbsId(item.id) }}
              onToggleExpand={toggleExpanded}
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              maxNestingLevel={8}
            />
          )}
        </div>
      </div>
    </ResizablePanel>

    <ResizableHandle withHandle className="bg-slate-100 hover:bg-orange-100 data-[resize-handle-active]:bg-orange-200 transition-colors" />

    {/* ── RAB Table Panel ──────────────────── */}
    <ResizablePanel defaultSize={56} minSize={35}>
      <div className="flex flex-col bg-white overflow-hidden h-full">

        {/* RAB panel header */}
        <div
          className={`px-3 py-1.5 border-b flex items-center gap-2 flex-shrink-0 transition-colors ${
            filterWbsId ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-semibold text-xs text-slate-700 truncate">
              {selectedNode ? selectedNode.name : 'Rencana Anggaran Biaya (RAB)'}
            </span>
            {selectedNode && (
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{selectedNode.code}</span>
            )}
            {filterWbsId && (
              <button
                onClick={() => { setFilterWbsId(null); selectItem(null) }}
                className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-slate-100 flex-shrink-0"
              >
                <X size={10} /> All
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setShowBoQImport(true)}
              className="flex items-center gap-1 text-xs text-slate-600 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
              <FileUp size={11} /> BoQ
            </button>
            <button onClick={() => document.getElementById('wbs-import-v2')?.click()}
              className="flex items-center gap-1 text-xs text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
              <Upload size={11} />
              <input id="wbs-import-v2" type="file" accept=".json" onChange={handleImport} className="hidden" />
            </button>
            <button onClick={handleExport} disabled={!items.length}
              className="flex items-center gap-1 text-xs text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40">
              <Download size={11} />
            </button>
          </div>
        </div>

        {/* RAB table — subtle tint when filtered by WBS node */}
        <div
          className="flex-1 overflow-auto transition-colors"
          style={filterWbsId ? { background: 'rgba(249,115,22,0.015)' } : {}}
        >
          <RABTable projectId={projectId} filterWbsId={filterWbsId ?? undefined} />
        </div>
      </div>
    </ResizablePanel>

    <ResizableHandle withHandle className="bg-slate-100 hover:bg-orange-100 data-[resize-handle-active]:bg-orange-200 transition-colors" />

    {/* ── EVM Guard Panel ──────────────────── */}
    <ResizablePanel defaultSize={22} minSize={16} maxSize={30}>
      <EVMGuardPanel projectId={projectId || null} />
    </ResizablePanel>

  </ResizablePanelGroup>
</div>
```

- [ ] **Step 4: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```powershell
git add src/pages/modules/WBS.tsx src/components/costing/EVMGuardPanel.tsx
git commit -m "feat(wbs): replace fixed-width columns with ResizablePanelGroup, orange accent on WBS filter"
```

---

### Task 4: Resizable Panels — RAB Embedded + Border Noise Reduction

**Files:**
- Modify: `src/pages/modules/RAB.tsx`

The embedded RAB layout has a fixed 272px EVM panel. Also has too many horizontal divider lines (5 in the viewport). Make EVM resizable and reduce border noise.

- [ ] **Step 1: Add ResizablePanelGroup import**

In `src/pages/modules/RAB.tsx`, add after the existing imports:

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
```

- [ ] **Step 2: Find the embedded main section (~line 344)**

```tsx
{/* ── Main: RABTable + EVM Guard ─────────────────────── */}
<div className="flex flex-1 overflow-hidden">
  <div className="flex-1 flex flex-col bg-white overflow-hidden">
    {loading.ahspItems ? (
      <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
    ) : (
      <>
        {items.length > 0 && summary.subtotal === 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex-shrink-0">
            <span className="font-medium">⚠ {items.length} item belum memiliki unit price — Grand Total = Rp 0.</span>
            <span className="ml-auto text-amber-600">Import dari AHSP untuk mengisi harga satuan otomatis.</span>
          </div>
        )}
        <RABTable projectId={currentProject.id} />
      </>
    )}
  </div>
  <EVMGuardPanel projectId={currentProject.id ?? null} />
</div>
```

- [ ] **Step 3: Replace with ResizablePanelGroup**

```tsx
{/* ── Main: RABTable + EVM Guard (resizable) ─────────── */}
<ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
  <ResizablePanel defaultSize={75} minSize={50}>
    <div className="flex flex-col bg-white overflow-hidden h-full">
      {loading.ahspItems ? (
        <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
      ) : (
        <>
          {items.length > 0 && summary.subtotal === 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-800 flex-shrink-0">
              <span className="font-medium">⚠ {items.length} item belum memiliki unit price.</span>
              <span className="ml-auto text-amber-600">Import dari AHSP untuk mengisi harga otomatis.</span>
            </div>
          )}
          <RABTable projectId={currentProject.id} />
        </>
      )}
    </div>
  </ResizablePanel>
  <ResizableHandle withHandle className="bg-slate-100 hover:bg-orange-100 data-[resize-handle-active]:bg-orange-200 transition-colors" />
  <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
    <EVMGuardPanel projectId={currentProject.id ?? null} />
  </ResizablePanel>
</ResizablePanelGroup>
```

- [ ] **Step 4: Reduce border noise — merge action bar + rates into one surface**

Find the top action bar (~line 255):

```tsx
{/* ── Top action bar ─────────────────────────────────────── */}
<div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
```

Change `border-b border-slate-200` to `border-b border-slate-100` (lighter divider):

```tsx
<div className="px-3 py-1.5 bg-white border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
```

Find the rates config section (~line 297):

```tsx
<div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
```

Change to (use background only, remove border — the top action bar's bottom border is enough):

```tsx
<div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
```

- [ ] **Step 5: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```powershell
git add src/pages/modules/RAB.tsx
git commit -m "feat(rab): resizable EVM panel, reduce horizontal border noise in embedded view"
```

---

### Task 5: WBS ↔ RAB Visual Linkage — Orange Accent on Filter

**Files:**
- Modify: `src/pages/modules/WBS.tsx`

This task adds a visual orange left-border accent to the entire RAB panel container when a WBS node is selected, making the connection unmistakable. The RAB panel header orange tint was already added in Task 3.

- [ ] **Step 1: Locate the RAB panel ResizablePanel in WBS.tsx (from Task 3)**

Find the `<ResizablePanel defaultSize={56}>` that wraps the RAB content. It contains:

```tsx
<div className="flex flex-col bg-white overflow-hidden h-full">
```

- [ ] **Step 2: Add orange left-border when filterWbsId is active**

Change that outer div:

```tsx
<div className={`flex flex-col bg-white overflow-hidden h-full transition-all ${
  filterWbsId ? 'border-l-2 border-l-orange-400' : ''
}`}>
```

This adds a 2px orange left stripe on the entire RAB panel when filtering by a WBS node — a clear visual signal that the two panels are linked.

- [ ] **Step 3: Verify build**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```powershell
git add src/pages/modules/WBS.tsx
git commit -m "feat(wbs): orange left-border accent on RAB panel when WBS node is selected"
```

---

### Task 6: CostDashboardView — Industrial Flat-Panel Aesthetic

**Files:**
- Modify: `src/components/costing/CostDashboardView.tsx`

The Dashboard uses generic shadcn `Card` components with default box-shadows. This clashes with the flat industrial aesthetic of the rest of the module. Replace with flat bordered panels, add `p-4` wrapper, upgrade chart styling (dark tooltip, no axes clutter), and upgrade section headers.

- [ ] **Step 1: Full replacement of CostDashboardView.tsx**

```tsx
/**
 * CostDashboardView.tsx
 * Enterprise Cost Dashboard — Industrial flat-panel aesthetic.
 * Matches the CommandBar visual language: flat borders, mono values, precise labels.
 */

import React, { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

import { formatIDR } from '@/lib/utils'
import { useForecastStore } from '@/store/costForecastStore'
import { useProjectStore } from '@/store/projectStore'
import { CostKPIStrip } from './CostKPIStrip'
import { CostTypeBreakdownChart } from './CostTypeBreakdownChart'
import { BurnRateSparkline } from './BurnRateSparkline'

export function CostDashboardView() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const { snapshot, snapshotLoading, history, projections, fetchSnapshot, fetchHistory } =
    useForecastStore(
      useShallow((s) => ({
        snapshot: s.snapshot,
        snapshotLoading: s.snapshotLoading,
        history: s.history,
        projections: s.projections,
        fetchSnapshot: s.fetchSnapshot,
        fetchHistory: s.fetchHistory,
      }))
    )

  useEffect(() => {
    if (!activeProjectId) return
    fetchSnapshot(activeProjectId)
    fetchHistory(activeProjectId)
  }, [activeProjectId, fetchSnapshot, fetchHistory])

  const evmChartData = useMemo(
    () => (history || []).map((m) => ({
      date: (() => { try { return format(new Date(m.snapshot_date), 'dd/MM') } catch { return '' } })(),
      PV: Number(m.pv),
      EV: Number(m.ev),
      AC: Number(m.ac),
    })),
    [history]
  )

  return (
    <div className="p-4 flex flex-col gap-3">

      {/* Row 1: KPI Strip */}
      <CostKPIStrip snapshot={snapshot} loading={snapshotLoading} />

      {/* Row 2: Breakdown + EVM chart */}
      <div className="grid grid-cols-12 gap-3">

        {/* Cost Type Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden h-full">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Breakdown Biaya</span>
            </div>
            <div className="p-4">
              {!snapshot ? (
                <div className="animate-pulse rounded bg-slate-100 h-40" />
              ) : (
                <CostTypeBreakdownChart breakdown={snapshot.costTypeBreakdown} totalRab={snapshot.rabTotal} />
              )}
            </div>
          </div>
        </div>

        {/* EVM Performance Chart */}
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">EVM Performance — PV / EV / AC</span>
              <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-px" style={{ background: '#f59e0b' }} /> PV
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-px" style={{ background: '#10b981' }} /> EV
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-px border-t border-dashed border-slate-400" /> AC
                </span>
              </div>
            </div>
            <div className="p-4">
              {evmChartData.length < 2 ? (
                <div className="flex items-center justify-center h-40 text-xs text-slate-400">
                  Belum ada data metrik harian
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={evmChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="evmPV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmEV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmAC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.08} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#f8fafc',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      }}
                      formatter={(value: number) => formatIDR(value)}
                    />
                    <Area type="monotone" dataKey="PV" stroke="#f59e0b" strokeWidth={1.5} fill="url(#evmPV)" dot={false} legendType="none" />
                    <Area type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={1.5} fill="url(#evmEV)" dot={false} legendType="none" />
                    <Area type="monotone" dataKey="AC" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#evmAC)" dot={false} legendType="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Burn Rate — 12 bulan terakhir</p>
                <BurnRateSparkline history={history} limit={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: EAC Projections */}
      {projections && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">EAC Projections</span>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'EAC Standard', value: projections.eacStandard, colored: false },
                { label: 'EAC Conservative', value: projections.eacConservative, colored: false },
                { label: 'EAC Aggressive', value: projections.eacAggressive, colored: false },
                { label: 'VAC', value: projections.varianceAtCompletion, colored: true },
              ].map(({ label, value, colored }) => (
                <div key={label}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                  <p className={`text-base font-bold font-mono ${
                    colored ? (value < 0 ? 'text-red-500' : 'text-emerald-600') : 'text-slate-800'
                  }`}>
                    {formatIDR(value)}
                  </p>
                </div>
              ))}
            </div>
            {projections.isRedAlert && projections.alertReason && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {projections.alertReason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```powershell
git add src/components/costing/CostDashboardView.tsx
git commit -m "feat(dashboard): flat-panel industrial aesthetic, dark tooltip, cleaner grid"
```

---

### Task 7: CostKPIStrip — Monospace Values + Performance Delta

**Files:**
- Modify: `src/components/costing/CostKPIStrip.tsx`

Current KPI cards use `text-lg` with generic Card shadows. Upgrade to: flat grid layout matching CostDashboardView, monospace values, inline ▲/▼ delta for CPI/SPI, larger visual contrast.

- [ ] **Step 1: Full replacement of CostKPIStrip.tsx**

```tsx
/**
 * CostKPIStrip.tsx
 * 6-cell KPI grid — Industrial flat border, monospace values, performance delta.
 */

import React from 'react'
import { formatIDR } from '@/lib/utils'
import type { CostDashboardSnapshot } from '@/services/costDashboardService'

interface CostKPIStripProps {
  snapshot: CostDashboardSnapshot | null
  loading: boolean
}

function performanceColor(v: number): string {
  if (v < 0.9) return 'text-red-500'
  if (v < 0.95) return 'text-amber-500'
  return 'text-emerald-600'
}

function Delta({ v }: { v: number }) {
  const d = (v - 1).toFixed(2)
  const pos = v >= 1
  return (
    <span className={`text-xs font-mono font-semibold ${pos ? 'text-emerald-500' : 'text-red-500'}`}>
      {pos ? '▲' : '▼'}{Math.abs(Number(d))}
    </span>
  )
}

export function CostKPIStrip({ snapshot, loading }: CostKPIStripProps) {
  if (loading || snapshot === null) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-6 rounded-lg border border-slate-200 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} role="status"
            className={`animate-pulse bg-slate-50 h-[68px] ${i > 0 ? 'border-l border-slate-200' : ''}`} />
        ))}
      </div>
    )
  }

  const cpi = snapshot.latestCpi ?? 0
  const spi = snapshot.latestSpi ?? 0

  const cells = [
    {
      label: 'RAB Budget',
      value: formatIDR(snapshot.rabTotal),
      sub: 'Nilai Kontrak',
    },
    {
      label: 'RAP Planned',
      value: formatIDR(snapshot.rapPlanned),
      sub: 'Anggaran Pelaksanaan',
    },
    {
      label: 'Actual Cost',
      value: formatIDR(snapshot.actualCost),
      sub: `Burn ${snapshot.burnRatePercent.toFixed(1)}%`,
      warn: snapshot.burnRatePercent > 90,
    },
    {
      label: 'Committed',
      value: formatIDR(snapshot.committedCost),
      sub: 'Belum Terealisasi',
    },
    {
      label: 'CPI',
      value: snapshot.latestCpi !== null ? cpi.toFixed(3) : '—',
      sub: 'Cost Performance',
      colorClass: snapshot.latestCpi !== null ? performanceColor(cpi) : undefined,
      delta: snapshot.latestCpi !== null ? <Delta v={cpi} /> : null,
      testId: 'kpi-cpi-value',
    },
    {
      label: 'SPI',
      value: snapshot.latestSpi !== null ? spi.toFixed(3) : '—',
      sub: 'Schedule Performance',
      colorClass: snapshot.latestSpi !== null ? performanceColor(spi) : undefined,
      delta: snapshot.latestSpi !== null ? <Delta v={spi} /> : null,
      testId: 'kpi-spi-value',
    },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 rounded-lg border border-slate-200 overflow-hidden bg-white">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`px-3 py-3 ${i > 0 ? 'border-l border-slate-200' : ''}`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 leading-none mb-1.5">
            {cell.label}
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p
              className={`text-sm font-bold font-mono leading-tight ${
                cell.colorClass ?? (cell.warn ? 'text-amber-600' : 'text-slate-800')
              }`}
              data-testid={cell.testId}
            >
              {cell.value}
            </p>
            {cell.delta}
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-none">{cell.sub}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```powershell
git add src/components/costing/CostKPIStrip.tsx
git commit -m "feat(kpi): flat grid layout, monospace values, ▲▼ performance delta on CPI/SPI"
```

---

### Task 8: Keyboard Navigation in WBSTree

**Files:**
- Modify: `src/components/wbs/WBSTree.tsx`

WBS tree items are not keyboard-accessible. Enterprise PM users operate heavily with keyboard. Add `tabIndex`, `onKeyDown`, and focus ring to `WBSTreeItem`.

Keys to support:
- `Enter` / `Space` — expand/collapse if has children, otherwise select
- `ArrowRight` — expand node (if collapsed), or move focus to first child (if expanded)
- `ArrowLeft` — collapse node (if expanded)
- `Delete` / `Backspace` — trigger delete handler
- `F2` — trigger edit handler

- [ ] **Step 1: Find the WBSTreeItem inner div (~line 170)**

Look for:

```tsx
<div
  ref={itemRef}
  draggable
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  className={`
    group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors
    ${rowBg}
    ${item.isDragging ? 'opacity-50' : ''}
```

- [ ] **Step 2: Add tabIndex, onKeyDown, and focus ring class**

Replace that div opening:

```tsx
<div
  ref={itemRef}
  draggable
  tabIndex={0}
  onKeyDown={(e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (hasChildren) onToggleExpand(item.id)
        else onSelect(item)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (hasChildren && !isExpanded) onToggleExpand(item.id)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (isExpanded && hasChildren) onToggleExpand(item.id)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        onDelete(item)
        break
      case 'F2':
        e.preventDefault()
        onEdit(item)
        break
    }
  }}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  className={`
    group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-inset
    ${rowBg}
    ${item.isDragging ? 'opacity-50' : ''}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```powershell
git add src/components/wbs/WBSTree.tsx
git commit -m "feat(wbs): keyboard navigation in tree (Enter/Arrow/Delete/F2) + orange focus ring"
```

---

### Task 9: Contextual Help Tooltips on Section Headers

**Files:**
- Modify: `src/pages/modules/WBS.tsx`
- Modify: `src/components/costing/EVMGuardPanel.tsx`

Add `?` help icons beside section headers. PM users and approvers who are not familiar with construction PM terminology need quick inline definitions of WBS, EVM, CPI, SPI.

Uses existing `Tooltip*` components from `@/components/ui/tooltip`.

- [ ] **Step 1: Add imports to WBS.tsx**

At the top of `src/pages/modules/WBS.tsx`, check if `Tooltip*` is already imported. If not, add:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
```

`HelpCircle` should also be added to the lucide-react import line.

- [ ] **Step 2: Wrap WBS panel header label with a tooltip**

Find the `<GitBranch size={11} className="text-slate-400" /> WBS` span in the desktop panel header (added in Task 3). Replace:

```tsx
<span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
  <GitBranch size={11} className="text-slate-400" /> WBS
</span>
```

With:

```tsx
<span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
  <GitBranch size={11} className="text-slate-400" /> WBS
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle size={10} className="text-slate-300 hover:text-slate-500 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[220px] text-xs">
        Work Breakdown Structure — hierarki pekerjaan proyek. Klik node untuk filter RAB di panel kanan.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</span>
```

- [ ] **Step 3: Add imports to EVMGuardPanel.tsx**

At the top of `src/components/costing/EVMGuardPanel.tsx`, add:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
```

- [ ] **Step 4: Add tooltip to EVM Guard header**

Find the panel header div in `EVMGuardPanel.tsx`:

```tsx
<div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
  <Shield size={12} className="text-blue-500" />
  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
    EVM &amp; Budget Guard
  </span>
</div>
```

Replace with:

```tsx
<div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
  <Shield size={12} className="text-blue-500" />
  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
    EVM &amp; Budget Guard
  </span>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle size={10} className="text-slate-300 hover:text-slate-500 cursor-help ml-auto" />
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px] text-xs">
        Earned Value Management: CPI ≥ 1.00 = on-budget, SPI ≥ 1.00 = on-schedule.
        EAC = estimasi biaya akhir proyek berdasarkan performa saat ini.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

- [ ] **Step 5: Verify TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```powershell
git add src/pages/modules/WBS.tsx src/components/costing/EVMGuardPanel.tsx
git commit -m "feat(ux): contextual help tooltips on WBS panel and EVM Guard headers"
```

---

## Self-Review

### Spec Coverage

| Improvement | Task |
|-------------|------|
| RefreshCw dead button | T1 ✅ |
| WBSKpiBar in desktop | T2 ✅ |
| +WBS Item in wrong panel | T2 ✅ |
| Resizable WBS layout | T3 ✅ |
| Resizable RAB layout | T4 ✅ |
| Border noise reduction | T4 ✅ |
| WBS↔RAB visual linkage | T3 (orange header tint) + T5 (left border) ✅ |
| Dashboard aesthetic | T6 ✅ |
| CostKPIStrip upgrade | T7 ✅ |
| Keyboard navigation WBS | T8 ✅ |
| Contextual help tooltips | T9 ✅ |
| EVMGuardPanel fixed width | T3 + T4 (className prop) ✅ |

### Consistency Notes

- `ResizablePanel` / `ResizableHandle` / `ResizablePanelGroup` imported from `@/components/ui/resizable` — same path in both T3 (WBS) and T4 (RAB)
- `EVMGuardPanel` className prop added once in T3 — T4 uses the same updated signature
- `filterWbsId` variable name used consistently across T3 and T5 (same file, WBS.tsx)
- `Delta` component in CostKPIStrip (T7) is a file-local function, not exported — no import needed elsewhere
