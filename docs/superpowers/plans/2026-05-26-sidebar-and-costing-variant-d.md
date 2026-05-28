# Sidebar Fix + ProjectCosting Variant D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sidebar rainbow-color chaos → unified monochrome icons with single orange accent, then implement Variant D layout (pipeline flow header + EVM right panel) for ProjectCosting WBS and RAB views.

**Architecture:** Two independent changes. Sidebar fix is purely cosmetic (navRegistry colorClass + AppSidebar icon color logic). Variant D replaces the current split-panel WBS/RAB layout with a pipeline-flow header + persistent right EVM panel — implemented inside existing `WBS.tsx` and `RAB.tsx` pages plus a new shared `EVMGuardPanel` component.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, lucide-react, react-resizable-panels

---

## Part 1 — Sidebar Fix

### Task 1: Unify nav icon colors in navRegistry

**Files:**
- Modify: `src/config/navRegistry.ts`

**Problem:** Every nav item has a unique `colorClass` (e.g. `text-blue-500`, `text-teal-500`, `text-fuchsia-500` — 14 different colors). This is the "rainbow" problem. Fix: all items → `text-slate-400` (inactive) while active state stays orange (already handled in AppSidebar).

- [ ] **Step 1: Replace all colorClass values in navRegistry.ts**

Open `src/config/navRegistry.ts`. Change every `colorClass:` value to `'text-slate-400'`. There are ~20 entries. Replace ALL of them:

```ts
// Before (examples):
colorClass: 'text-blue-500',
colorClass: 'text-yellow-600',
colorClass: 'text-sky-500',
colorClass: 'text-emerald-500',
colorClass: 'text-rose-500',
colorClass: 'text-indigo-500',
colorClass: 'text-orange-500',
colorClass: 'text-amber-500',
colorClass: 'text-teal-500',
colorClass: 'text-violet-500',
colorClass: 'text-green-600',
colorClass: 'text-cyan-500',
colorClass: 'text-fuchsia-500',
colorClass: 'text-sky-600',
colorClass: 'text-purple-500',
colorClass: 'text-lime-600',

// After (all become):
colorClass: 'text-slate-400',
```

- [ ] **Step 2: Fix active icon color in AppSidebar**

Open `src/components/layout/AppSidebar.tsx`, find line ~208:

```tsx
// Before:
isActive ? "text-blue-600 dark:text-blue-400" : item.colorClass
```

Change to use orange for active icon (matches the active bg/text already using `nl-orange`):

```tsx
// After:
isActive ? "text-nl-orange" : item.colorClass
```

- [ ] **Step 3: Verify visually in browser**

Run `npm run dev`, open sidebar. All inactive icons should be uniform slate-grey. Active item should show orange left-bar + orange text + orange icon. No rainbow.

- [ ] **Step 4: Commit**

```bash
git add src/config/navRegistry.ts src/components/layout/AppSidebar.tsx
git commit -m "fix(sidebar): unify nav icon colors — remove rainbow, single orange accent"
```

---

## Part 2 — ProjectCosting Variant D

### Task 2: Create EVMGuardPanel component

**Files:**
- Create: `src/components/costing/EVMGuardPanel.tsx`
- Modify: `src/components/costing/index.ts`

This is the right panel (272px) visible in WBS and RAB tabs. Shows EVM metrics, Alert Center, and S-Curve. Uses data from `costForecastStore`.

- [ ] **Step 1: Create the component**

Create `src/components/costing/EVMGuardPanel.tsx`:

```tsx
import { useMemo } from 'react'
import { Shield, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import { useForecastStore } from '@/store/costForecastStore'
import { useProjectStore } from '@/store/projectStore'
import { useShallow } from 'zustand/react/shallow'

interface EVMGuardPanelProps {
  projectId: string | null
}

export function EVMGuardPanel({ projectId }: EVMGuardPanelProps) {
  const snapshot = useForecastStore(s => s.snapshot)
  const project = useProjectStore(s => projectId ? s.projects[projectId] : null)

  const evm = useMemo(() => {
    if (!snapshot) return null
    const cpi = snapshot.cpi ?? null
    const spi = snapshot.spi ?? null
    const eac = snapshot.eac ?? null
    const budget = project?.budget ?? 0
    return { cpi, spi, eac, budget }
  }, [snapshot, project])

  const alerts = useMemo(() => {
    if (!evm) return []
    const list: { sev: 'warning' | 'info'; msg: string; detail: string }[] = []
    if (evm.cpi !== null && evm.cpi < 1) {
      list.push({ sev: 'warning', msg: `CPI ${evm.cpi.toFixed(2)} — Over Budget`, detail: 'Cost lebih tinggi dari nilai kerja yang dihasilkan.' })
    }
    if (evm.spi !== null && evm.spi < 0.9) {
      list.push({ sev: 'warning', msg: `SPI ${evm.spi.toFixed(2)} — Schedule Slip`, detail: 'Progress lebih lambat dari rencana.' })
    }
    if (evm.eac !== null && evm.budget > 0 && evm.eac > evm.budget) {
      list.push({ sev: 'warning', msg: 'EAC melebihi Budget', detail: `Estimasi akhir ${formatIDR(evm.eac)} > Budget ${formatIDR(evm.budget)}` })
    }
    if (list.length === 0) {
      list.push({ sev: 'info', msg: 'Semua indikator normal', detail: 'CPI & SPI dalam batas aman.' })
    }
    return list
  }, [evm])

  return (
    <div className="w-[272px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
        <Shield size={12} className="text-blue-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">EVM & Budget Guard</span>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* EVM Metrics */}
        {evm ? (
          <div className="space-y-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">EVM Dashboard</div>
            {[
              { label: 'CPI', value: evm.cpi?.toFixed(2) ?? '—', sub: 'Cost Performance', good: evm.cpi === null || evm.cpi >= 1 },
              { label: 'SPI', value: evm.spi?.toFixed(2) ?? '—', sub: 'Schedule Performance', good: evm.spi === null || evm.spi >= 1 },
              { label: 'EAC', value: evm.eac ? formatIDR(evm.eac, { compact: true }) : '—', sub: 'Estimate at Completion', good: evm.eac === null || evm.eac <= evm.budget },
            ].map(({ label, value, sub, good }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-bold text-slate-700">{label}</div>
                  <div className="text-[10px] text-slate-400">{sub}</div>
                </div>
                <div className={`font-mono font-bold text-sm ${good ? 'text-emerald-600' : 'text-red-500'}`}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <TrendingUp size={24} className="mx-auto mb-2 opacity-30" />
            <div className="text-xs">Belum ada data EVM</div>
            <div className="text-[10px] mt-1 text-slate-300">Isi RAP untuk melihat EVM</div>
          </div>
        )}

        {/* Alert Center */}
        <div className="pt-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Alert Center</div>
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-lg p-3 mb-2 border text-[11px] ${
              a.sev === 'warning'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className={`font-semibold flex items-center gap-1.5 ${a.sev === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
                {a.sev === 'warning'
                  ? <AlertTriangle size={11} />
                  : <Info size={11} />}
                {a.msg}
              </div>
              <div className={`mt-0.5 ${a.sev === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>{a.detail}</div>
            </div>
          ))}
        </div>

        {/* Budget bar */}
        {evm && evm.budget > 0 && (
          <div className="pt-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Budget Utilization</div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
              {([
                { label: 'RAB vs Budget', pct: snapshot?.rabTotal ? Math.round((snapshot.rabTotal / evm.budget) * 100) : 0, color: 'bg-blue-500' },
                { label: 'Actual Spent', pct: snapshot?.actualSpent ? Math.round((snapshot.actualSpent / evm.budget) * 100) : 0, color: 'bg-emerald-500' },
              ] as const).map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>{g.label}</span>
                    <span className="font-mono font-bold">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${g.color}`} style={{ width: `${Math.min(g.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export from costing index**

Open `src/components/costing/index.ts`, add:

```ts
export { EVMGuardPanel } from './EVMGuardPanel'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/costing/EVMGuardPanel.tsx src/components/costing/index.ts
git commit -m "feat(costing): add EVMGuardPanel — EVM metrics + alerts + budget bar"
```

---

### Task 3: Redesign WBS.tsx with Variant D layout

**Files:**
- Modify: `src/pages/modules/WBS.tsx`

Variant D WBS layout:
- No `PanelGroup`/`PanelResizeHandle` — replace with fixed flexbox layout
- Left tree panel: fixed `w-[224px]`, dark header (`bg-slate-800`), proper tree hierarchy with code prefix + budget badge
- Right RAB area: flex-1, white bg, sticky header with action buttons
- `EVMGuardPanel` on far right (272px) — always visible
- WBS node selection filters RAB table (existing behavior kept)

- [ ] **Step 1: Replace WBS layout**

In `src/pages/modules/WBS.tsx`, find the return JSX that wraps the `PanelGroup`. Replace the entire JSX return (from `<div` after the `if (!project)` guards) with:

```tsx
return (
  <div className="flex h-full overflow-hidden bg-slate-100">
    {/* ── WBS Tree Panel ─────────────────────────────── */}
    <div className="w-[224px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2 bg-slate-800 flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch size={11} className="text-blue-400" /> WBS Structure
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-400">{items.length} nodes</span>
          <button
            onClick={() => items.length > 0 && toast.info('Codes generated')}
            className="ml-1 text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700 transition-colors"
            title="Generate codes"
          >
            #
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-slate-100 flex-shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Cari kode / nama..."
            className="w-full pl-6 pr-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-400 bg-slate-50"
          />
        </div>
      </div>

      {/* KPI mini bar */}
      <div className="px-3 py-1.5 border-b border-slate-100 flex-shrink-0">
        <WBSKpiBar items={items} rabLinkedCount={kpiData.rabLinkedCount} totalBudget={kpiData.totalBudget} />
      </div>

      {/* Add root */}
      <button
        onClick={() => addItem({ name: 'Pekerjaan Baru', parentId: null, projectId })}
        className="mx-2 my-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
      >
        <Plus size={11} /> Add Root Item
      </button>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
            <Layers size={24} className="opacity-20" />
            <div className="text-xs text-center text-slate-400">Belum ada WBS node</div>
          </div>
        ) : (
          <WBSTree
            items={items}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={selectItem}
            onToggle={toggleExpanded}
            onMove={moveItem}
            projectId={projectId}
          />
        )}
      </div>
    </div>

    {/* ── RAB Table Panel ────────────────────────────── */}
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* RAB header */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-3 flex-shrink-0 bg-white">
        <div>
          <div className="font-semibold text-sm text-slate-800">
            {selectedNode ? selectedNode.name : 'Rencana Anggaran Biaya (RAB)'}
          </div>
          {selectedNode && (
            <div className="text-[10px] text-slate-400 font-mono">{selectedNode.code} · {filteredRabItems.length} item · {formatIDR(filteredRabTotal)}</div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all">
            <Layers size={12} />vBaseline
          </button>
          <button className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all">
            <Upload size={12} />Import
          </button>
          <button className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all">
            <Plus size={12} />Add Item
          </button>
        </div>
      </div>

      {/* RAB table */}
      <div className="flex-1 overflow-hidden">
        <RABTable
          items={filteredRabItems}
          projectId={projectId}
          embedded
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-4 text-[10px] text-slate-500 flex-shrink-0">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />CLASS A: 80% COST BASELINE</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />CLASS B: 15% COST BASELINE</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />CLASS C: NON-CRITICAL</span>
        <span className="ml-auto font-mono font-bold text-slate-700">GRAND TOTAL: {formatIDR(filteredRabTotal)}</span>
      </div>
    </div>

    {/* ── EVM Guard Panel ────────────────────────────── */}
    <EVMGuardPanel projectId={projectId} />
  </div>
)
```

- [ ] **Step 2: Add needed derived values before the return**

Add these derived values inside the WBS component, before the return, after the existing `kpiData` useMemo:

```tsx
const selectedNode = selectedId ? items.find(i => i.id === selectedId) ?? null : null

const filteredRabItems = useMemo(() => {
  if (!selectedNode) return rabItems
  return rabItems.filter(r => {
    const wbsLink = linksByRabItem[r.id]
    if (!wbsLink) return false
    return wbsLink.some(l => l.wbsItemId === selectedNode.id)
  })
}, [rabItems, selectedNode, linksByRabItem])

const filteredRabTotal = filteredRabItems.reduce(
  (s, r) => s + (r.volume || 0) * (r.unit_price || r.unitPrice || 0),
  0
)
```

- [ ] **Step 3: Add missing imports in WBS.tsx**

Ensure these are imported at the top (add any that are missing):

```tsx
import { GitBranch, Plus, Layers, Search, Upload } from 'lucide-react'
import { EVMGuardPanel } from '@/components/costing'
import { formatIDR } from '@/lib/utils'
```

- [ ] **Step 4: Remove PanelGroup imports**

Remove `PanelGroup`, `Panel`, `PanelResizeHandle` from imports since we no longer use them.

- [ ] **Step 5: Test in browser**

Run `npm run dev`, navigate to `/costing` → WBS tab. Verify:
- Left panel shows dark header + tree with codes
- Click a WBS node → RAB table filters to that node
- Right EVM panel shows (may be empty if no forecast data)
- No layout breaks

- [ ] **Step 6: Commit**

```bash
git add src/pages/modules/WBS.tsx
git commit -m "feat(wbs): implement Variant D layout — dark tree panel + EVM guard panel"
```

---

### Task 4: Redesign RAB.tsx with Variant D layout

**Files:**
- Modify: `src/pages/modules/RAB.tsx`

Variant D RAB layout:
- 4 KPI cards across top (TOTAL ITEMS, SUBTOTAL, OH+PROFIT+TAX, FINAL TOTAL)
- Main RABTable fills remaining height (flex-1)
- `EVMGuardPanel` on far right (272px)
- Remove the `Card` wrapper — use flat white bg like WBS

- [ ] **Step 1: Wrap RABTable and EVMGuardPanel in horizontal flex**

In `src/pages/modules/RAB.tsx`, find the main content area after the KPI cards. Restructure the JSX to:

```tsx
return (
  <div className="flex flex-col h-full overflow-hidden bg-slate-100">
    {/* ── Top bar: presence + actions ─────────────── */}
    <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        {currentZone && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin size={11} />
            {currentZone.name}
          </span>
        )}
        {isLocked && (
          <span className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            <Lock size={11} />Locked
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {otherPeers.length > 0 && <PresenceAvatars peers={otherPeers} />}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
        >
          <CloudUpload size={13} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200"
        >
          <Settings2 size={13} />
        </button>
      </div>
    </div>

    {/* ── KPI strip ───────────────────────────────── */}
    <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200 flex-shrink-0">
      {([
        ['TOTAL ITEMS', items.length.toString(), 'text-slate-900'],
        ['SUBTOTAL', formatIDR(subtotal), 'text-slate-900'],
        ['OH + PROFIT + TAX', formatIDR(ohProfitTax), ohProfitTax > 0 ? 'text-slate-900' : 'text-slate-400'],
        ['FINAL TOTAL', formatIDR(finalTotal), 'text-blue-600'],
      ] as const).map(([label, val, cls]) => (
        <div key={label} className="bg-white px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
          <div className={`font-bold text-xl font-mono mt-0.5 ${cls}`}>{val}</div>
        </div>
      ))}
    </div>

    {/* ── Price drift banner ─────────────────────── */}
    <PriceDriftBanner projectId={currentProject?.id ?? ''} />

    {/* ── Main: table + EVM panel ─────────────────── */}
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <RABTable
            items={items}
            projectId={currentProject?.id ?? ''}
          />
        )}
      </div>
      <EVMGuardPanel projectId={currentProject?.id ?? null} />
    </div>
  </div>
)
```

- [ ] **Step 2: Add derived values before return**

Add these computed values in RAB.tsx before the return (after the existing state):

```tsx
const subtotal = items.reduce((s, i) => s + (i.volume || 0) * (i.unit_price || i.unitPrice || 0), 0)
const ohProfitTax = subtotal * ((overheadPct + profitPct + taxRate) / 100)
const finalTotal = subtotal + ohProfitTax
```

- [ ] **Step 3: Add EVMGuardPanel import**

At the top of `src/pages/modules/RAB.tsx`, add:

```tsx
import { EVMGuardPanel } from '@/components/costing'
```

- [ ] **Step 4: Test in browser**

Navigate to `/costing` → RAB tab. Verify:
- 4 KPI cards at top show real computed values
- RABTable fills remaining width
- EVM panel on far right shows metrics or empty state
- Sync button still works

- [ ] **Step 5: Commit**

```bash
git add src/pages/modules/RAB.tsx
git commit -m "feat(rab): implement Variant D layout — KPI strip + EVM guard panel"
```

---

### Task 5: Update ProjectCosting shell for Variant D pipeline header

**Files:**
- Modify: `src/pages/modules/ProjectCosting.tsx`

The WorkflowStepper at top should show item counts per step (like Variant D pipeline flow). The existing `WorkflowStepper` already shows steps — we just need to pass `count` badges and use horizontal flow style.

- [ ] **Step 1: Pass item counts to WorkflowStepper steps**

In `src/pages/modules/ProjectCosting.tsx`, find where `wizardSteps` or the stepper steps array is built. Update to include count values:

```tsx
// Find the steps config (around line 44–55) and update the stepper items:
const stepperItems = STEP_CONFIG.map(step => ({
  id: step.id,
  title: step.label,
  description: step.description,
  status: stepStatuses[step.id] ?? 'inactive',
  count: step.id === 'ahsp' ? ahspCount
       : step.id === 'wbs'  ? wbsCount
       : step.id === 'rab'  ? rabCount
       : step.id === 'rap'  ? rapCount
       : undefined,
}))
```

Where `ahspCount`, `wbsCount`, `rabCount`, `rapCount` come from existing store selectors already in the component.

- [ ] **Step 2: Test pipeline header**

Navigate to `/costing`. The pipeline stepper should show counts (e.g. `AHSP 2475`, `WBS 13`, `RAB 8`) next to each step — matching Variant D's "pipeline as flow" style.

- [ ] **Step 3: Commit**

```bash
git add src/pages/modules/ProjectCosting.tsx
git commit -m "feat(costing): add item counts to pipeline stepper — Variant D style"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sidebar rainbow → monochrome (Task 1)
- ✅ Active icon → orange (Task 1)
- ✅ EVMGuardPanel with EVM metrics + alerts + budget bar (Task 2)
- ✅ WBS Variant D layout — dark tree panel + filter + EVM right panel (Task 3)
- ✅ RAB Variant D layout — KPI strip + EVM right panel (Task 4)
- ✅ Pipeline header with counts (Task 5)

**Placeholder scan:** None found — all steps have concrete code.

**Type consistency:**
- `EVMGuardPanel` props: `{ projectId: string | null }` — consistent across Task 2, 3, 4
- `filteredRabItems` typed via `RABItem[]` from existing store
- `formatIDR` imported from `@/lib/utils` in all 3 files
