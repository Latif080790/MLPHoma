# Project Costing Priority Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 prioritised bugs and deficiencies found in the Project Costing module evaluation (scored 6.4/10), covering service layer, stores, and components.

**Architecture:** React 18 + TypeScript + Tailwind + Zustand stores + Supabase. All costing data flows through `costForecastStore` (snapshot + history) which reads from `costDashboardService` and `forecastingService`. RAP items live in `rapStore` → `rapService`. Each fix is isolated to 1-2 files.

**Tech Stack:** React, TypeScript, Zustand, Supabase JS client, Recharts, sonner (toast), Lucide icons, Tailwind CSS

**Working directory:** `d:\2. NATA_PROJECTAPP\PM_LABHA\MLPHoma`

---

### Task 1: rapStore — updateItem error handling with toast + optimistic rollback

**Files:**
- Modify: `src/store/rapStore.ts` (lines 85-107)

Current code (lines 85-107):
```ts
updateItem: async (item: Partial<RapItem>) => {
  // Optimistic update
  set((state) => ({
    items: state.items.map((i) => (i.id === item.id ? { ...i, ...item } : i))
  }))
  if (!item.id) return
  const { id, total_budget, remaining_budget, ahsp_items, wbs_items, rab_items, ...patch } = item
  if (Object.keys(patch).length === 0) return
  try {
    const client = (await import('../lib/supabaseClient')).assertSupabase()
    const { error } = await client
      .from('rap_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('[rapStore] updateItem patch error:', error.message)
  } catch (err) {
    console.error('[rapStore] updateItem error:', err)
  }
},
```

**Problem:** On PATCH failure, the optimistic update stays (store ≠ DB), user is never told, and no rollback happens.

**Required changes:**
1. Capture the original item from `get().items` BEFORE the optimistic update
2. On PATCH error: revert `items` to original (replace the modified item back), then show `toast.error`
3. `toast` is already imported at top of file: `import { toast } from 'sonner'`

Expected final behaviour:
- Success: optimistic update stays (no change to current happy path)
- Failure: revert the item, show `toast.error('Gagal menyimpan perubahan: ' + errorMessage)`

- [ ] Read `src/store/rapStore.ts` to get exact current code
- [ ] Apply changes to `updateItem` function
- [ ] Verify TypeScript compiles (`npx tsc --noEmit 2>&1 | grep -v test`)
- [ ] Commit: `fix(rap): rollback optimistic update and show toast on patch failure`

---

### Task 2: forecastingService — fix eacConservative denominator lower bound

**Files:**
- Modify: `src/services/forecastingService.ts` (line 91)

Current code:
```ts
const eacConservative = ac + (bac - ev) / (cpi * spi > 0 ? cpi * spi : 1)
```

**Problem:** Guard `> 0` is insufficient. If `cpi = 0.05` and `spi = 0.05`, denominator = 0.0025 → EAC blows up to ×400 remaining work. Correct minimum denominator is 0.1 (implies project is running at 10% efficiency — worst realistic case).

**Required change:**
```ts
const eacConservative = ac + (bac - ev) / Math.max(cpi * spi, 0.1)
```

Simple one-liner change. No other code affected.

- [ ] Read `src/services/forecastingService.ts` lines 88-95
- [ ] Apply the change
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(forecasting): clamp eacConservative denominator to 0.1 minimum`

---

### Task 3: rapService — add pagination to getByProject

**Files:**
- Modify: `src/services/rapService.ts` (lines 44-61)

Current code:
```ts
async getByProject(projectId: string) {
    const client = assertSupabase()
    const { data, error } = await client
        .from('rap_items')
        .select(`*, wbs_items ( name, code ), ahsp_items ( name, unit ), rab_items ( name )`)
        .eq('project_id', projectId)
    if (error) { console.warn(...); return [] }
    return data || []
},
```

**Problem:** PostgREST silently caps at 1000 rows. Large construction projects (>1000 RAP items) will get truncated data with no error.

**Required change:** Add a paginated loop with BATCH=1000, same pattern already used in the `initFromRab` method in the same file:

```ts
async getByProject(projectId: string) {
    const client = assertSupabase()
    const all: Record<string, unknown>[] = []
    const BATCH = 1000
    for (let offset = 0; ; offset += BATCH) {
        const { data, error } = await client
            .from('rap_items')
            .select(`*, wbs_items ( name, code ), ahsp_items ( name, unit ), rab_items ( name )`)
            .eq('project_id', projectId)
            .range(offset, offset + BATCH - 1)
        if (error) { console.warn('[rap] getByProject error:', error.message); break }
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < BATCH) break
    }
    return all
},
```

- [ ] Read `src/services/rapService.ts` lines 40-90 for full context
- [ ] Replace `getByProject` with paginated version
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(rap-service): paginate getByProject to handle >1000 items`

---

### Task 4: EVMGuardPanel — fix budget bar denominator + stale tooltip text

**Files:**
- Modify: `src/components/costing/EVMGuardPanel.tsx`

**Problem A (line ~182):** "Actual Spent" bar uses `snapshot.actualCost / evm.budget` (project.budget denominator) while `CostKPIStrip` shows `burnRatePercent` using `rapPlanned`. Two adjacent visualizations show different numbers for "burn %".

Current code in Budget Utilization section:
```ts
{
  label: 'Actual Spent',
  pct: Math.round((snapshot.actualCost / evm.budget) * 100),
  color: 'bg-emerald-500',
},
```

Fix: use `snapshot.burnRatePercent` directly:
```ts
{
  label: 'Actual Spent',
  pct: Math.round(snapshot.burnRatePercent),
  color: 'bg-emerald-500',
},
```

**Problem B (line ~79, in tooltip):** Tooltip says `"CPI ≥ 1.00 = on-budget"` but alert threshold is 0.95. Update to:
```
"CPI ≥ 0.95 = on-budget (5% tolerance). SPI ≥ 0.95 = on-schedule."
```

- [ ] Read `src/components/costing/EVMGuardPanel.tsx` fully
- [ ] Fix the Actual Spent bar to use `snapshot.burnRatePercent`
- [ ] Fix tooltip text
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(evm-guard): use burnRatePercent for actual-spent bar, update tooltip threshold`

---

### Task 5: BurnRateSparkline — unique SVG gradient IDs

**Files:**
- Modify: `src/components/costing/BurnRateSparkline.tsx`

**Problem:** SVG linearGradient IDs `sparkAC` and `sparkEV` are page-global. If this component renders in two places simultaneously (it's used in CostDashboardView AND CostForecastDashboard in ScheduleOps), both instances share the same gradients and one will render incorrectly (wrong colors/transparency).

**Fix:** Generate unique IDs per instance using `useId()` hook (React 18):

```tsx
import React, { useId } from 'react'
// ...
export function BurnRateSparkline({ history, limit = 12 }: BurnRateSparklineProps) {
  const uid = useId().replace(/:/g, '')  // useId returns :r0: format, strip colons for SVG ID safety
  const acId = `sparkAC-${uid}`
  const evId = `sparkEV-${uid}`
  // ...
  // Replace all "sparkAC" → {acId} and "sparkEV" → {evId} in JSX
```

- [ ] Read `src/components/costing/BurnRateSparkline.tsx` fully
- [ ] Add `useId` import, generate unique ids, replace hardcoded gradient IDs with dynamic ones
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(sparkline): use unique SVG gradient IDs to prevent multi-instance collision`

---

### Task 6: CostTypeBreakdownChart — add center label to donut

**Files:**
- Modify: `src/components/costing/CostTypeBreakdownChart.tsx`

**Problem:** Donut chart has no center text. Standard UX for donut charts is to show the total value in the center.

**Fix:** Add a custom center label using Recharts `<Label>` inside `<Pie>`. Show total formatted with `formatIDR`:

In the `<Pie>` element, add a label prop:
```tsx
<Pie
  data={slices}
  dataKey="value"
  nameKey="name"
  innerRadius={52}
  outerRadius={78}
  paddingAngle={2}
>
  <Label
    value={formatIDR(total)}
    position="center"
    style={{ fontSize: '11px', fontWeight: 700, fill: '#1e293b', fontFamily: 'monospace' }}
  />
  {slices.map(...)
```

Note: `Label` must be imported from `recharts` (already imported in this file).
`total` is already computed: `const total = slices.reduce((s, x) => s + x.value, 0) || 1`

- [ ] Read `src/components/costing/CostTypeBreakdownChart.tsx` fully
- [ ] Add `Label` to recharts import
- [ ] Add `<Label>` inside `<Pie>` showing `formatIDR(total)` at center
- [ ] Verify TypeScript compiles
- [ ] Commit: `feat(cost-breakdown): add total value label in donut chart center`

---

### Task 7: RAP — fix EFISIENSI label + add timer useEffect cleanup

**Files:**
- Modify: `src/pages/modules/RAP.tsx`

**Problem A:** Label "EFISIENSI" appears in two places in RAP.tsx — the non-embedded KPI cards and the embedded KPI strip. The formula is:
```ts
efficiency = (totalBudget - totalActual) / totalBudget * 100  // line ~91
```
This is "remaining budget %" not true efficiency. Label should be "SISA BUDGET" and sub-label "Anggaran Tersisa".

Locations to change:
1. Embedded strip (line ~431): `label: 'EFISIENSI'` → `label: 'SISA BUDGET'`
2. Non-embedded KPI card (somewhere near line ~558-570): `label="Efisiensi"` → `label="Sisa Budget"`

Also update the color logic comment if any: the green/red coloring logic already makes sense for "remaining budget" — keep the thresholds (>= 90% remaining = green, >= 75% = amber, else red).

**Problem B:** The `editTimers` ref (added earlier for debounce) is never cleared on component unmount. If the component unmounts while a timer is pending (user switches project), the timer fires on a dead component causing potential setState-on-unmounted-component warnings.

Add a `useEffect` cleanup:
```ts
useEffect(() => {
  const timers = editTimers.current
  return () => {
    timers.forEach(t => clearTimeout(t))
    timers.clear()
  }
}, [])  // runs once, cleanup on unmount
```

- [ ] Read `src/pages/modules/RAP.tsx` relevant sections (search for EFISIENSI, editTimers)
- [ ] Change both EFISIENSI label occurrences to SISA BUDGET
- [ ] Add useEffect cleanup for editTimers
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(rap): rename EFISIENSI to SISA BUDGET, add debounce timer cleanup on unmount`

---

### Task 8: CostDashboardView — remove double fetch + add snapshot generation button

**Files:**
- Modify: `src/components/costing/CostDashboardView.tsx`

**Problem A — double fetch:** `ProjectCosting.tsx` already calls `fetchSnapshot(projectId)` and `fetchHistory(projectId)` when project changes (line ~89). `CostDashboardView` also calls them in its own `useEffect` (lines 36-40). This causes 2 concurrent identical requests on every dashboard open.

**Fix:** Remove the `useEffect` in `CostDashboardView` entirely. The parent `ProjectCosting` already handles data fetching.

BUT: `CostDashboardView` is also used inside `ScheduleOps` (v3 module), so removing the useEffect completely would break that embedding. Instead, add a prop `skipAutoFetch?: boolean` and only skip when `true`. Wait — actually looking at the code, the `ScheduleOps` module uses `CostForecastDashboard` (separate component), not `CostDashboardView`. So `CostDashboardView` is only used in `ProjectCosting`. Safe to remove the useEffect.

Confirm by grepping: look for all usages of `CostDashboardView` in the codebase.

**Problem B — no snapshot generation trigger:** When `latestCpi === null` (no EVM data yet), users see `—` with no way to generate data. Add a "Generate Snapshot" button that calls `generateSnapshot()` from the store, visible when `latestCpi === null` or as a small button in the header.

The store already has `generateSnapshot: async () => void` in `costForecastStore.ts`.

Add to the `useShallow` selector: `generateSnapshot: s.generateSnapshot`

Add a button — place it in the header row next to "EVM Performance — PV / EV / AC":
```tsx
<button
  onClick={() => generateSnapshot().then(() => fetchHistory(activeProjectId!))}
  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
  title="Generate EVM snapshot"
>
  <RefreshCw size={10} />
  Snapshot
</button>
```

Import `RefreshCw` from `lucide-react`.

Also: when `history.length < 2` and `latestCpi === null`, show a helper text in the empty chart area:
```
"Klik 'Snapshot' untuk generate data EVM pertama kali"
```

- [ ] Read `src/components/costing/CostDashboardView.tsx` fully
- [ ] Grep for CostDashboardView usages to confirm it's only in ProjectCosting
- [ ] Remove the useEffect that calls fetchSnapshot/fetchHistory
- [ ] Add `generateSnapshot` to the useShallow selector
- [ ] Add RefreshCw import
- [ ] Add Snapshot button in the EVM chart header
- [ ] Add helper text in empty chart area when no EVM data
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(cost-dashboard): remove double fetch, add generate-snapshot button`

---

### Task 9: ProjectCosting — fix rabPct warn threshold

**Files:**
- Modify: `src/pages/modules/ProjectCosting.tsx` (line ~163)

Current code:
```ts
warn: rabPct !== null && rabPct > 105,
```

**Problem:** RAB exceeding project budget (>100%) IS a warning condition. The 5% grace period (>105%) is unjustified — if RAB > budget, the contract is already over-budget.

**Fix:**
```ts
warn: rabPct !== null && rabPct > 100,
```

Simple one-line change.

- [ ] Read `src/pages/modules/ProjectCosting.tsx` lines 148-180
- [ ] Change `> 105` to `> 100`
- [ ] Verify TypeScript compiles
- [ ] Commit: `fix(project-costing): warn when RAB exceeds project budget (>100%)`

---

### Task 10: Dead code removal — evmService + resourcePlanService

**Files:**
- Modify: `src/services/evmService.ts`
- Modify: `src/services/resourcePlanService.ts`

**evmService.ts — unused exported functions:**
The following functions at the bottom of `evmService.ts` are exported but have NO callers in the codebase (verified by search):
- `computeTCPI` (lines ~312-325)
- `computeAdvancedEAC` (lines ~335-345)
- `computeConfidenceInterval` (lines ~354-367)
- `analyzeProductivity` (lines ~270-302) — uses hardcoded 0.7% standard, never called from UI

Before removing, grep for each function name across `src/` to confirm no usages. If any usage found, skip that specific function.

**resourcePlanService.ts — dead RAB-based function:**
`computeResourceNeeds` (lines ~40-95) — the original RAB-based version. This was replaced by `computeResourceNeedsFromRAP`. Verify no callers remain in `src/`, then remove it along with its associated `computeResourceStats` function (lines ~101-129) which also uses `RABItem[]`.

Keep: `computeResourceNeedsFromRAP`, `computeResourceStatsFromRAP`, `computeResourceNeedsFromRAPWithTrace`, `computeArrivalScheduleWithTrace`, all type definitions.

- [ ] Grep `computeTCPI|computeAdvancedEAC|computeConfidenceInterval|analyzeProductivity` across `src/` — note callers
- [ ] Grep `computeResourceNeeds\b|computeResourceStats\b` across `src/` — note callers
- [ ] Remove unused functions (skip any that have callers)
- [ ] Verify TypeScript compiles after removal
- [ ] Commit: `refactor: remove dead code from evmService and resourcePlanService`
