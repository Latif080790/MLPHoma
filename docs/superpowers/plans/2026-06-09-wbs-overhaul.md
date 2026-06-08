# WBS Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the recursive WBSTree renderer with a virtualized flat-list, add weighted progress rollup, recursive budget aggregation, mini-map navigator, undo, bulk paste creation, KPI strip with filter, table-view toggle, and tabbed detail panel — all in the WBS module without touching any other module.

**Architecture:** Pure calculation functions extracted to `src/lib/wbsCalculations.ts` (testable independently); new UI components created alongside existing ones; `WBS.tsx` wired last to swap old for new. Old `WBSTree.tsx` is gutted but kept as a re-export shell so nothing outside the module breaks.

**Tech Stack:** React 18, Zustand, `@tanstack/react-virtual` (useVirtualizer), `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`, Vitest + @testing-library/react, Tailwind CSS (MERIDIAN token palette).

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Create | `src/lib/wbsCalculations.ts` | Pure functions: recursiveBudget, weightedProgress, flattenVisibleRows, parseBulkPasteText |
| Create | `src/lib/__tests__/wbsCalculations.test.ts` | Unit tests for all 4 pure functions |
| Modify | `src/types/wbs.ts` | Add WBSFlatRow, WBSSnapshot, KPIFilter; extend WBSTreeState + WBSActions |
| Modify | `src/store/wbsStore.ts` | Add lastAction/undo, activeFilter/setActiveFilter; snapshot before move/delete |
| Create | `src/components/wbs/WBSKPIStrip.tsx` | 6-cell clickable KPI strip |
| Modify | `src/components/wbs/WBSToolbar.tsx` | 2-group layout, Tools dropdown, viewMode toggle, onBulkPaste |
| Create | `src/components/wbs/WBSMiniMap.tsx` | 60-68px structural overview with viewport indicator |
| Create | `src/components/wbs/WBSVirtualTree.tsx` | Virtualized flat-list tree (useVirtualizer, 28px rows, 3-mode drag-drop, Ctrl+Z) |
| Create | `src/components/wbs/WBSBulkPaste.tsx` | Floating overlay: textarea → parse → preview → batch import |
| Create | `src/components/wbs/WBSTableView.tsx` | Read-only indented 6-column table |
| Modify | `src/components/wbs/WBSDetailPanel.tsx` | Tabbed: Overview / RAB / Timeline / +Child |
| Modify | `src/pages/modules/WBS.tsx` | Wire all new components, fix avgProgress → weighted, fix budgetByWbs → recursive |

---

## Color Token Reference (MERIDIAN v1.1)

All new WBS components **must use CSS variables** — no hardcoded hex. This enables dual light/dark mode from `src/styles/design-tokens-meridian.css`.

| Purpose | CSS Variable | Dark hex | Tailwind usage |
|---|---|---|---|
| Page background | `var(--bg-page)` | `#0C0C0E` | `bg-[var(--bg-page)]` |
| Surface / cards | `var(--bg-surface)` | `#121215` | `bg-[var(--bg-surface)]` |
| Surface hover | `var(--bg-surface-hover)` | `#1A1A1E` | `bg-[var(--bg-surface-hover)]` |
| Elevated (modals) | `var(--bg-elevated)` | `#1A1A1E` | `bg-[var(--bg-elevated)]` |
| Border default | `var(--border-default)` | `#222225` | `border-[var(--border-default)]` |
| Border subtle | `var(--border-subtle)` | `#1A1A1E` | `border-[var(--border-subtle)]` |
| Text primary | `var(--text-primary)` | `#E2EAF5` | `text-[var(--text-primary)]` |
| Text secondary | `var(--text-secondary)` | `#94A3B8` | `text-[var(--text-secondary)]` |
| Text muted | `var(--text-muted)` | `#475569` | `text-[var(--text-muted)]` |
| IDR / budget values | `var(--text-idr)` | `#FBBF24` | `text-[var(--text-idr)]` |
| Primary action btn | `var(--interactive-bg)` | `#3B82F6` | `bg-[var(--interactive-bg)]` |
| Orange (root/action) | `hsl(var(--amber-500))` | `#F97316` | `bg-[hsl(var(--amber-500))]` |
| Cobalt (badges/links) | `hsl(var(--cobalt-400))` | `#60A5FA` | `text-[hsl(var(--cobalt-400))]` |
| Progress ≥ 80% | `var(--wbs-progress-high)` | `#22C55E` | inline style |
| Progress 30–79% | `var(--wbs-progress-mid)` | `#2DD4BF` | inline style |
| Progress < 30% | `var(--wbs-progress-low)` | `#FB923C` | inline style |
| QC passed | `var(--qc-passed)` | `#22C55E` | inline style |
| QC pending | `var(--qc-pending)` | `#FB923C` | inline style |
| QC failed | `var(--qc-failed)` | `#FB7185` | inline style |
| Drag-drop line | `hsl(var(--cobalt-500))` | `#3B82F6` | inline style |
| Drag-drop inside | `hsl(var(--amber-400))` | `#FB923C` | inline style |

> **Note:** Code samples in task steps below use hardcoded hex as readable references. When writing actual code, replace each hex value with the CSS variable from this table.

---

## Task 1: Pure calculation functions

**Files:**
- Create: `src/lib/wbsCalculations.ts`
- Create: `src/lib/__tests__/wbsCalculations.test.ts`

### Step 1.1 — Write the failing tests first

```typescript
// src/lib/__tests__/wbsCalculations.test.ts
import { describe, it, expect } from 'vitest'
import { recursiveBudget, weightedProgress, flattenVisibleRows, parseBulkPasteText } from '../wbsCalculations'
import type { WBSItem } from '@/types/wbs'
import type { RABItem } from '@/types/rab'

// Minimal WBSItem factory
function wbs(id: string, parentId: string | null, progress = 0, sortOrder = 0): WBSItem {
  return { id, code: id, name: id, level: 1, parentId, sortOrder, projectId: 'p1',
           progress, createdAt: '', updatedAt: '' }
}

// Minimal RABItem factory — only fields used by rabTotal
function rab(wbsId: string, finalTotal: number): Partial<RABItem> & { wbsId?: string; finalTotal?: number } {
  return { wbsId, finalTotal } as RABItem
}

describe('recursiveBudget', () => {
  it('returns 0 when no RAB items linked', () => {
    const items = [wbs('a', null)]
    expect(recursiveBudget('a', items, [])).toBe(0)
  })

  it('sums direct RAB items', () => {
    const items = [wbs('a', null)]
    const rabItems = [rab('a', 1000), rab('a', 500)] as RABItem[]
    expect(recursiveBudget('a', items, rabItems)).toBe(1500)
  })

  it('aggregates children recursively', () => {
    const items = [wbs('root', null), wbs('child1', 'root'), wbs('child2', 'root')]
    const rabItems = [rab('child1', 1000), rab('child2', 2000)] as RABItem[]
    expect(recursiveBudget('root', items, rabItems)).toBe(3000)
  })

  it('includes direct + children budget', () => {
    const items = [wbs('root', null), wbs('child', 'root')]
    const rabItems = [rab('root', 500), rab('child', 1000)] as RABItem[]
    expect(recursiveBudget('root', items, rabItems)).toBe(1500)
  })
})

describe('weightedProgress', () => {
  it('returns leaf node progress directly', () => {
    const items = [wbs('leaf', null, 75)]
    expect(weightedProgress('leaf', items, [])).toBe(75)
  })

  it('returns budget-weighted average of children', () => {
    const items = [wbs('root', null), wbs('c1', 'root', 100), wbs('c2', 'root', 0)]
    // c1 budget=1000 (100%), c2 budget=1000 (0%) → (1000×100 + 1000×0)/2000 = 50
    const rabItems = [rab('c1', 1000), rab('c2', 1000)] as RABItem[]
    expect(weightedProgress('root', items, rabItems)).toBe(50)
  })

  it('falls back to simple average when budget is zero', () => {
    const items = [wbs('root', null), wbs('c1', 'root', 60), wbs('c2', 'root', 40)]
    // no RAB → simple avg: (60+40)/2 = 50
    expect(weightedProgress('root', items, [])).toBe(50)
  })
})

describe('flattenVisibleRows', () => {
  it('returns root items only when none expanded', () => {
    const items = [wbs('root', null, 0, 0), wbs('child', 'root', 0, 0)]
    const rows = flattenVisibleRows(items, new Set(), null, [], new Map())
    expect(rows).toHaveLength(1)
    expect(rows[0].item.id).toBe('root')
  })

  it('includes children when parent is expanded', () => {
    const items = [wbs('root', null, 0, 0), wbs('child', 'root', 0, 0)]
    const rows = flattenVisibleRows(items, new Set(['root']), null, [], new Map())
    expect(rows).toHaveLength(2)
    expect(rows[1].depth).toBe(1)
  })

  it('filters to matching + ancestor nodes when activeFilter set', () => {
    const items = [wbs('root', null, 0, 0), wbs('c1', 'root', 20, 0), wbs('c2', 'root', 80, 0)]
    // filter: low-progress (< 30) — should show root (ancestor) + c1
    const rows = flattenVisibleRows(items, new Set(['root']), 'low-progress', [], new Map())
    const ids = rows.map(r => r.item.id)
    expect(ids).toContain('root')
    expect(ids).toContain('c1')
    expect(ids).not.toContain('c2')
  })
})

describe('parseBulkPasteText', () => {
  it('returns empty array for blank input', () => {
    expect(parseBulkPasteText('', null)).toEqual([])
  })

  it('parses flat lines as depth 0', () => {
    const result = parseBulkPasteText('Alpha\nBeta', null)
    expect(result).toEqual([
      { name: 'Alpha', relativeDepth: 0 },
      { name: 'Beta', relativeDepth: 0 },
    ])
  })

  it('parses tab-indented lines', () => {
    const result = parseBulkPasteText('Parent\n\tChild\n\t\tGrandchild', null)
    expect(result).toEqual([
      { name: 'Parent', relativeDepth: 0 },
      { name: 'Child', relativeDepth: 1 },
      { name: 'Grandchild', relativeDepth: 2 },
    ])
  })

  it('ignores blank lines', () => {
    const result = parseBulkPasteText('A\n\nB', null)
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 1.1:** Write the test file above to `src/lib/__tests__/wbsCalculations.test.ts`.

- [ ] **Step 1.2:** Run tests to verify they fail:

```
npx vitest run src/lib/__tests__/wbsCalculations.test.ts
```
Expected: FAIL — "Cannot find module '../wbsCalculations'"

- [ ] **Step 1.3:** Create the implementation:

```typescript
// src/lib/wbsCalculations.ts
import type { WBSItem, WBSFlatRow, KPIFilter } from '../types/wbs'
import type { RABItem } from '../types/rab'

function rabTotal(r: RABItem): number {
  return (
    r.finalTotal ??
    r.final_total ??
    r.finalPrice ??
    (r.volume ?? 0) * ((r as unknown as { unit_price?: number }).unit_price ?? (r as unknown as { unitPrice?: number }).unitPrice ?? 0)
  )
}

export function recursiveBudget(
  nodeId: string,
  items: WBSItem[],
  rabItems: RABItem[]
): number {
  const direct = rabItems
    .filter(r => r.wbsId === nodeId)
    .reduce((s, r) => s + rabTotal(r), 0)
  const childSum = items
    .filter(i => i.parentId === nodeId)
    .reduce((s, c) => s + recursiveBudget(c.id, items, rabItems), 0)
  return direct + childSum
}

export function weightedProgress(
  nodeId: string,
  items: WBSItem[],
  rabItems: RABItem[]
): number {
  const children = items.filter(i => i.parentId === nodeId)
  if (children.length === 0) {
    return items.find(i => i.id === nodeId)?.progress ?? 0
  }
  let totalBudget = 0
  let weightedSum = 0
  for (const child of children) {
    const b = recursiveBudget(child.id, items, rabItems)
    const p = weightedProgress(child.id, items, rabItems)
    totalBudget += b
    weightedSum += b * p
  }
  if (totalBudget === 0) {
    const sum = children.reduce((s, c) => s + weightedProgress(c.id, items, rabItems), 0)
    return Math.round(sum / children.length)
  }
  return Math.round(weightedSum / totalBudget)
}

function passesFilter(
  item: WBSItem,
  filter: KPIFilter,
  rabItems: RABItem[],
  timelineCountByWbs: Map<string, number>
): boolean {
  if (filter === null) return true
  switch (filter) {
    case 'rab-unlinked': return !rabItems.some(r => r.wbsId === item.id)
    case 'timeline-linked': return (timelineCountByWbs.get(item.id) ?? 0) > 0
    case 'qc-passed': return item.qc_status === 'PASSED'
    case 'low-progress': return (item.progress ?? 0) < 30
  }
}

export function flattenVisibleRows(
  items: WBSItem[],
  expandedIds: Set<string>,
  activeFilter: KPIFilter,
  rabItems: RABItem[],
  timelineCountByWbs: Map<string, number>
): WBSFlatRow[] {
  const rows: WBSFlatRow[] = []
  const itemMap = new Map(items.map(i => [i.id, i]))

  let visibleIds: Set<string> | null = null
  if (activeFilter !== null) {
    const matchingIds = new Set(
      items.filter(i => passesFilter(i, activeFilter, rabItems, timelineCountByWbs)).map(i => i.id)
    )
    visibleIds = new Set(matchingIds)
    matchingIds.forEach(id => {
      let cur = itemMap.get(id)?.parentId ?? null
      while (cur) {
        visibleIds!.add(cur)
        cur = itemMap.get(cur)?.parentId ?? null
      }
    })
  }

  function walk(parentId: string | null, depth: number) {
    items
      .filter(i => i.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(item => {
        if (visibleIds && !visibleIds.has(item.id)) return
        const hasChildren = items.some(i => i.parentId === item.id)
        const isExpanded = expandedIds.has(item.id)
        rows.push({
          item,
          depth,
          isExpanded,
          hasChildren,
          recursiveBudget: recursiveBudget(item.id, items, rabItems),
          weightedProgress: weightedProgress(item.id, items, rabItems),
        })
        if (isExpanded) walk(item.id, depth + 1)
      })
  }

  walk(null, 0)
  return rows
}

export function parseBulkPasteText(
  text: string,
  _parentCode: string | null
): Array<{ name: string; relativeDepth: number }> {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const match = line.match(/^(\t*)(.+)$/)
      return {
        name: (match?.[2] ?? line).trim(),
        relativeDepth: match?.[1]?.length ?? 0,
      }
    })
}
```

- [ ] **Step 1.4:** Run tests — expect all 11 to pass:

```
npx vitest run src/lib/__tests__/wbsCalculations.test.ts
```
Expected: PASS (11 tests)

- [ ] **Step 1.5:** Commit:

```bash
git add src/lib/wbsCalculations.ts src/lib/__tests__/wbsCalculations.test.ts
git commit -m "feat(wbs): add pure calculation functions — recursiveBudget, weightedProgress, flattenVisibleRows, parseBulkPasteText"
```

---

## Task 2: Types — WBSFlatRow, WBSSnapshot, KPIFilter

**Files:**
- Modify: `src/types/wbs.ts`

- [ ] **Step 2.1:** Add these three types to the END of `src/types/wbs.ts`, before the closing of the file:

```typescript
/** Filter mode for KPI strip. null = show all. */
export type KPIFilter =
  | 'rab-unlinked'
  | 'timeline-linked'
  | 'qc-passed'
  | 'low-progress'
  | null

/** One visible row in the virtualized flat-list tree */
export interface WBSFlatRow {
  item: WBSItem
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  recursiveBudget: number
  weightedProgress: number
}

/** Undo snapshot — taken before a move or delete mutation */
export interface WBSSnapshot {
  items: WBSItem[]
  action: 'move' | 'delete'
  timestamp: number
}
```

- [ ] **Step 2.2:** Extend `WBSTreeState` in `src/types/wbs.ts` — add two lines inside the interface:

```typescript
// Add inside WBSTreeState after `pendingDeleteConfirmation`:
lastAction: WBSSnapshot | null
activeFilter: KPIFilter
```

- [ ] **Step 2.3:** Extend `WBSActions` in `src/types/wbs.ts` — add two lines inside the interface:

```typescript
// Add inside WBSActions after cancelDelete:
undoLastAction: (projectId: string) => void
setActiveFilter: (filter: KPIFilter) => void
```

- [ ] **Step 2.4:** TypeScript check — must pass with 0 new errors in `src/types/wbs.ts`:

```
npx tsc --noEmit 2>&1 | grep "wbs.ts"
```
Expected: no output (no errors in wbs.ts)

- [ ] **Step 2.5:** Commit:

```bash
git add src/types/wbs.ts
git commit -m "feat(wbs): add WBSFlatRow, WBSSnapshot, KPIFilter types + extend store interface"
```

---

## Task 3: Store — undo + filter state + new actions

**Files:**
- Modify: `src/store/wbsStore.ts`

- [ ] **Step 3.1:** In `src/store/wbsStore.ts`, add two fields to the initial state block (lines 80-87, right after `pendingDeleteConfirmation: null`):

```typescript
lastAction: null as WBSSnapshot | null,
activeFilter: null as KPIFilter,
```

Add the import for the new types at the top of the file (alongside the existing `WBSStore, WBSItem` import):

```typescript
import type { WBSStore, WBSItem, WBSSnapshot, KPIFilter } from '../types/wbs'
```

- [ ] **Step 3.2:** Add `undoLastAction` and `setActiveFilter` actions to the store — insert after `cancelDelete`:

```typescript
undoLastAction: (projectId: string) => {
  const { lastAction } = get()
  if (!lastAction) return
  set((state) => ({
    itemsByProject: { ...state.itemsByProject, [projectId]: lastAction.items },
    lastAction: null,
  }))
  const restored = get().itemsByProject[projectId] || []
  wbsService.syncItems(restored, projectId)
  toast.success('Undo berhasil')
},

setActiveFilter: (filter: KPIFilter) => {
  set((state) => ({ activeFilter: state.activeFilter === filter ? null : filter }))
},
```

- [ ] **Step 3.3:** Snapshot before `moveItem`. In the `moveItem` action, insert this BEFORE the `set((state) => {` call that does the move:

```typescript
// Snapshot for undo
const snapshotBeforeMove: WBSSnapshot = {
  items: (get().itemsByProject[projectId] || []).map(i => ({ ...i })),
  action: 'move',
  timestamp: Date.now(),
}
set({ lastAction: snapshotBeforeMove })
```

- [ ] **Step 3.4:** Snapshot before delete. In `executeDelete`, insert BEFORE the `set((state) => {` call:

```typescript
// Snapshot for undo
const snapshotBeforeDelete: WBSSnapshot = {
  items: (get().itemsByProject[projectId] || []).map(i => ({ ...i })),
  action: 'delete',
  timestamp: Date.now(),
}
set({ lastAction: snapshotBeforeDelete })
```

- [ ] **Step 3.5:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep -E "wbsStore|wbs\.ts"
```
Expected: no errors in these files

- [ ] **Step 3.6:** Run existing wbsStore tests to confirm no regression:

```
npx vitest run src/store/__tests__/wbsStore.test.ts
```
Expected: same pass count as before (all green)

- [ ] **Step 3.7:** Commit:

```bash
git add src/store/wbsStore.ts
git commit -m "feat(wbs): add undo snapshot, lastAction state, activeFilter + undoLastAction/setActiveFilter actions"
```

---

## Task 4: WBSKPIStrip component

**Files:**
- Create: `src/components/wbs/WBSKPIStrip.tsx`

- [ ] **Step 4.1:** Create the component:

```tsx
// src/components/wbs/WBSKPIStrip.tsx
import { formatIDR } from '../../lib/utils'
import type { KPIFilter } from '../../types/wbs'

export interface WBSKPIStripProps {
  totalItems: number
  totalBudget: number
  projectWeightedProgress: number
  qcPassed: number
  rabUnlinked: number
  timelineLinked: number
  activeFilter: KPIFilter
  onFilterChange: (filter: KPIFilter) => void
}

interface Cell {
  id: KPIFilter
  label: string
  value: string | number
  valueColor: string
  subtitle?: string
}

export function WBSKPIStrip({
  totalItems,
  totalBudget,
  projectWeightedProgress,
  qcPassed,
  rabUnlinked,
  timelineLinked,
  activeFilter,
  onFilterChange,
}: WBSKPIStripProps) {
  const cells: Cell[] = [
    { id: null, label: 'Total Item', value: totalItems, valueColor: '#60A5FA' },
    { id: null, label: 'Budget RAB ↕', value: formatIDR(totalBudget), valueColor: '#FBBF24' },
    {
      id: null,
      label: 'Progress',
      value: `${projectWeightedProgress}%`,
      valueColor: '#22D3EE',
      subtitle: 'Σ(p×b)/Σb',
    },
    { id: 'qc-passed', label: 'QC Passed', value: qcPassed, valueColor: '#4ADE80' },
    { id: 'rab-unlinked', label: 'RAB Unlinked', value: rabUnlinked, valueColor: '#FB923C' },
    { id: 'timeline-linked', label: 'Timeline Linked', value: timelineLinked, valueColor: 'var(--foreground)' },
  ]

  return (
    <div className="flex shrink-0 border-b border-[#1a2438] bg-[#070c18]">
      {cells.map((cell, i) => {
        const isFilterable = cell.id !== null
        const isActive = isFilterable && activeFilter === cell.id
        return (
          <button
            key={i}
            onClick={() => isFilterable && onFilterChange(cell.id)}
            disabled={!isFilterable}
            className={[
              'flex-1 px-2.5 py-1.5 text-left border-r border-[#1a2438] last:border-r-0 transition-colors',
              isFilterable ? 'cursor-pointer hover:bg-[#141d2e]' : 'cursor-default',
              isActive ? 'bg-[#141d2e] border-b-2 border-b-[#f97316]' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-1 mb-0.5">
              {isActive && (
                <span className="text-[#f97316] text-[7px] leading-none">●</span>
              )}
              <span className="text-[7px] font-bold uppercase tracking-wider text-[#223044]">
                {cell.label}
              </span>
            </div>
            <div
              className="text-[11px] font-bold font-mono leading-none"
              style={{ color: cell.valueColor }}
            >
              {cell.value}
            </div>
            {cell.subtitle && (
              <div className="text-[6px] text-[#1a2438] mt-0.5">{cell.subtitle}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSKPIStrip"
```
Expected: no output

- [ ] **Step 4.3:** Commit:

```bash
git add src/components/wbs/WBSKPIStrip.tsx
git commit -m "feat(wbs): add WBSKPIStrip component with 6 clickable filter cells"
```

---

## Task 5: WBSToolbar redesign

**Files:**
- Modify: `src/components/wbs/WBSToolbar.tsx`

The toolbar gains two new props (`onBulkPaste`, `viewMode`, `onViewModeChange`) and moves Import/Export/GenerateCodes into a Tools ▾ dropdown.

- [ ] **Step 5.1:** Replace `src/components/wbs/WBSToolbar.tsx` entirely:

```tsx
// src/components/wbs/WBSToolbar.tsx
import { Search, ChevronsDownUp, ChevronsUpDown, Plus, Lock, Wrench, List } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export type WBSLevelFilter = null | 1 | 2 | 3

export interface WBSToolbarProps {
  filterText: string
  onFilterChange: (value: string) => void
  levelFilter: WBSLevelFilter
  onLevelChange: (level: WBSLevelFilter) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onImport: () => void
  onExport: () => void
  onGenerateCodes: () => void
  onAddRoot: () => void
  onBulkPaste: () => void
  viewMode: 'tree' | 'table'
  onViewModeChange: (mode: 'tree' | 'table') => void
  locked?: boolean
  compact?: boolean
}

const LEVELS: { label: string; value: WBSLevelFilter }[] = [
  { label: 'Semua Level', value: null },
  { label: 'Level 1', value: 1 },
  { label: 'Level 1–2', value: 2 },
  { label: 'Level 1–3', value: 3 },
]

function Sep() {
  return <div className="h-5 w-px shrink-0 bg-slate-200 dark:bg-white/[0.07]" aria-hidden />
}

export function WBSToolbar({
  filterText,
  onFilterChange,
  levelFilter,
  onLevelChange,
  onExpandAll,
  onCollapseAll,
  onImport,
  onExport,
  onGenerateCodes,
  onAddRoot,
  onBulkPaste,
  viewMode,
  onViewModeChange,
  locked = false,
  compact = false,
}: WBSToolbarProps) {
  const btnH = compact ? 'h-7' : 'h-8'
  const iconBtn = `${btnH} gap-1.5 text-xs px-2.5`

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm px-2.5 py-2 dark:border-[#1e253c] dark:bg-[#131c2e] dark:shadow-none ${compact ? '' : 'sm:px-3'}`}>
      {/* ── Nav-left group ── */}
      <div className="relative min-w-[130px] sm:w-44">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Cari item WBS…"
          className={`${btnH} pl-8 text-xs`}
          aria-label="Cari item WBS"
        />
      </div>

      <select
        value={levelFilter === null ? 'all' : String(levelFilter)}
        onChange={(e) => onLevelChange(e.target.value === 'all' ? null : (Number(e.target.value) as WBSLevelFilter))}
        aria-label="Filter level WBS"
        className={`${btnH} rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 dark:border-[#1e253c] dark:bg-[#0e1523] dark:text-[#7a90ab] focus:outline-none`}
      >
        {LEVELS.map((l) => (
          <option key={l.label} value={l.value === null ? 'all' : String(l.value)}>
            {l.label}
          </option>
        ))}
      </select>

      <Button variant="outline" size="sm" className={iconBtn} onClick={onExpandAll}>
        <ChevronsUpDown size={13} />
        <span className="hidden md:inline">Expand</span>
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={onCollapseAll}>
        <ChevronsDownUp size={13} />
        <span className="hidden md:inline">Collapse</span>
      </Button>

      {/* ── Actions-right group ── */}
      <div className="ml-auto flex items-center gap-2">
        <Sep />

        {/* Tools dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${iconBtn}`} disabled={locked}>
              <Wrench size={13} />
              <span className="hidden sm:inline">Tools</span>
              <span className="text-[10px]">▾</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onBulkPaste} disabled={locked}>
              Buat Massal…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport} disabled={locked}>
              Import JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGenerateCodes} disabled={locked}>
              Generate Kode
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary action */}
        <Button
          size="sm"
          className={`${btnH} gap-1.5 text-xs px-3 bg-[#f97316] hover:bg-[#ea6c0a] border-0 text-white`}
          onClick={onAddRoot}
          disabled={locked}
        >
          {locked ? <Lock size={13} /> : <Plus size={13} />}
          <span className="hidden sm:inline">Root Item</span>
        </Button>

        <Sep />

        {/* Tree / Table toggle */}
        <div className="flex rounded-md border border-slate-200 dark:border-[#1e253c] overflow-hidden">
          <button
            onClick={() => onViewModeChange('tree')}
            className={`${btnH} px-2.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'tree'
                ? 'bg-[#1a2438] text-[#e2e8f0]'
                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            🌳 Tree
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`${btnH} px-2.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'table'
                ? 'bg-[#1a2438] text-[#e2e8f0]'
                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <List size={12} /> Tabel
          </button>
        </div>
      </div>
    </div>
  )
}

export default WBSToolbar
```

- [ ] **Step 5.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSToolbar"
```
Expected: errors about `onBulkPaste` and `viewMode` missing in WBS.tsx (that's OK — fixed in Task 12)

- [ ] **Step 5.3:** Commit:

```bash
git add src/components/wbs/WBSToolbar.tsx
git commit -m "feat(wbs): redesign WBSToolbar — 2-group layout, Tools dropdown, Tree/Table toggle"
```

---

## Task 6: WBSMiniMap component

**Files:**
- Create: `src/components/wbs/WBSMiniMap.tsx`

- [ ] **Step 6.1:** Create the component:

```tsx
// src/components/wbs/WBSMiniMap.tsx
import { useRef, useCallback } from 'react'
import type { WBSFlatRow } from '../../types/wbs'

export interface WBSMiniMapProps {
  /** All rows in the tree (including collapsed — i.e. all items flattened with depth) */
  allRows: WBSFlatRow[]
  /** Index of the first row currently visible in the virtual window */
  visibleStartIndex: number
  /** Index of the last row currently visible in the virtual window */
  visibleEndIndex: number
  /** Called when user clicks minimap — tree should scroll to this row index */
  onNavigate: (rowIndex: number) => void
}

function rowColor(row: WBSFlatRow): string {
  if (row.depth === 0) return '#f97316'       // orange — root
  if (row.weightedProgress >= 80) return '#4ADE80'  // jade — complete
  if (row.weightedProgress >= 30) return '#22D3EE'  // cyan — active
  if (row.recursiveBudget > 0) return '#FB923C'     // amber — low progress with budget
  return '#223044'                                   // slate — no data
}

export function WBSMiniMap({
  allRows,
  visibleStartIndex,
  visibleEndIndex,
  onNavigate,
}: WBSMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const total = allRows.length
  const BAR_HEIGHT = 3 // px per row
  const MIN_INDENT = 4
  const MAX_WIDTH = 44 // px max bar width

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || total === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const fraction = y / rect.height
    const rowIndex = Math.floor(fraction * total)
    onNavigate(Math.max(0, Math.min(total - 1, rowIndex)))
  }, [total, onNavigate])

  const vpTop = total > 0 ? (visibleStartIndex / total) * 100 : 0
  const vpHeight = total > 0 ? ((visibleEndIndex - visibleStartIndex + 1) / total) * 100 : 100

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="w-[64px] shrink-0 border-r border-[#1a2438] bg-[#070c18] cursor-pointer overflow-hidden relative select-none"
      title="Mini-map — klik untuk navigasi"
    >
      <div className="px-[3px] py-[5px] flex flex-col gap-[1px]">
        {allRows.map((row, i) => {
          const indentFraction = Math.min(row.depth, 4) / 4
          const width = MAX_WIDTH - indentFraction * (MAX_WIDTH - MIN_INDENT)
          const marginLeft = indentFraction * MIN_INDENT
          return (
            <div
              key={i}
              style={{
                height: BAR_HEIGHT,
                width,
                marginLeft,
                background: rowColor(row),
                borderRadius: 1,
                opacity: 0.7,
              }}
            />
          )
        })}
      </div>

      {/* Viewport indicator */}
      <div
        className="pointer-events-none absolute left-[3px] right-[3px]"
        style={{
          top: `${vpTop}%`,
          height: `${Math.max(vpHeight, 3)}%`,
          border: '1px solid rgba(251,146,60,0.6)',
          background: 'rgba(249,115,22,0.04)',
          borderRadius: 2,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 6.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSMiniMap"
```
Expected: no output

- [ ] **Step 6.3:** Commit:

```bash
git add src/components/wbs/WBSMiniMap.tsx
git commit -m "feat(wbs): add WBSMiniMap — 64px structural overview with viewport indicator"
```

---

## Task 7: WBSVirtualTree — virtualized flat-list renderer

**Files:**
- Create: `src/components/wbs/WBSVirtualTree.tsx`

This is the most complex task. It replaces the recursive `WBSTreeItem` component.

- [ ] **Step 7.0:** Update `WBSVirtualTree` to expose `scrollToIndex` via `forwardRef` + `useImperativeHandle` (needed by mini-map navigation in WBS.tsx).

Add this to the top of WBSVirtualTree.tsx after the imports:

```tsx
import { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
```

Wrap the component export with `forwardRef`:

```tsx
export interface WBSVirtualTreeHandle {
  scrollToIndex: (index: number) => void
}

export const WBSVirtualTree = forwardRef<WBSVirtualTreeHandle, WBSVirtualTreeProps>(function WBSVirtualTree(props, ref) {
  // ... component body unchanged ...
  
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => virtualizer.scrollToIndex(index, { align: 'start' }),
  }))
  
  // rest of return
})
```

In WBS.tsx (Task 11.8), pass the ref:

```tsx
<WBSVirtualTree
  ref={virtualTreeRef}
  ...
/>
```

And the mini-map onNavigate callback:

```tsx
onNavigate={(idx) => virtualTreeRef.current?.scrollToIndex(idx)}
```

- [ ] **Step 7.1:** Create the component:

```tsx
// src/components/wbs/WBSVirtualTree.tsx
import { useRef, useCallback, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, MoreHorizontal } from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSFlatRow, WBSItem } from '../../types/wbs'

const ROW_HEIGHT = 28

/** Progress bar color by value */
function progressColor(p: number): string {
  if (p >= 80) return '#4ADE80'
  if (p >= 30) return '#22D3EE'
  return '#FB923C'
}

type DropMode = 'before' | 'after' | 'inside'
interface DropTarget { id: string; mode: DropMode }

export interface WBSVirtualTreeProps {
  rows: WBSFlatRow[]
  selectedId: string | null
  flashId: string | null
  onSelect: (item: WBSItem) => void
  onToggleExpand: (id: string) => void
  onAddChild: (parentId: string | null) => void
  onEdit: (item: WBSItem) => void
  onDelete: (item: WBSItem) => void
  onMoveItem: (itemId: string, newParentId: string | null, index: number) => void
  onVisibleRangeChange: (start: number, end: number) => void
  onUndo: () => void
}

function DropLine({ mode, id, dropTarget }: { mode: DropMode; id: string; dropTarget: DropTarget | null }) {
  if (!dropTarget || dropTarget.id !== id) return null
  if (mode === 'before' && dropTarget.mode === 'before') {
    return <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#60A5FA] z-10 rounded" />
  }
  if (mode === 'after' && dropTarget.mode === 'after') {
    return <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#60A5FA] z-10 rounded" />
  }
  return null
}

export function WBSVirtualTree({
  rows,
  selectedId,
  flashId,
  onSelect,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
  onMoveItem,
  onVisibleRangeChange,
  onUndo,
}: WBSVirtualTreeProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    onChange: (instance) => {
      const vItems = instance.getVirtualItems()
      if (vItems.length > 0) {
        onVisibleRangeChange(vItems[0].index, vItems[vItems.length - 1].index)
      }
    },
  })

  // Ctrl+Z — undo
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        onUndo()
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [onUndo])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  const handleDragStart = useCallback((e: React.DragEvent, rowId: string) => {
    e.dataTransfer.setData('text/plain', rowId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedId(rowId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, row: WBSFlatRow) => {
    e.preventDefault()
    if (!draggedId || draggedId === row.item.id) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    let mode: DropMode = 'inside'
    if (y < height * 0.25) mode = 'before'
    else if (y > height * 0.75) mode = 'after'
    setDropTarget({ id: row.item.id, mode })
  }, [draggedId])

  const handleDrop = useCallback((e: React.DragEvent, row: WBSFlatRow, allRows: WBSFlatRow[]) => {
    e.preventDefault()
    if (!draggedId || !dropTarget || draggedId === row.item.id) {
      setDraggedId(null)
      setDropTarget(null)
      return
    }
    const { mode } = dropTarget
    let newParentId: string | null
    let newIndex: number

    if (mode === 'inside') {
      newParentId = row.item.id
      newIndex = 0
    } else {
      newParentId = row.item.parentId
      const siblings = allRows.filter(r => r.item.parentId === newParentId)
      const targetIdx = siblings.findIndex(r => r.item.id === row.item.id)
      newIndex = mode === 'before' ? targetIdx : targetIdx + 1
    }
    onMoveItem(draggedId, newParentId, newIndex)
    setDraggedId(null)
    setDropTarget(null)
  }, [draggedId, dropTarget, onMoveItem])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
        <p className="text-sm text-slate-400">Belum ada item WBS.</p>
        <button
          onClick={() => onAddChild(null)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ea6c0a] transition-colors"
        >
          <Plus size={13} />
          Buat Item WBS Pertama
        </button>
      </div>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="w-full h-full overflow-auto outline-none"
      tabIndex={0}
    >
      {/* Undo hint */}
      <div className="text-[7px] text-[#1a2438] px-2 py-0.5 select-none">
        Ctrl+Z untuk undo pindah/hapus
      </div>

      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualItems.map((vItem) => {
          const row = rows[vItem.index]
          const item = row.item
          const isSelected = item.id === selectedId
          const isFlashing = item.id === flashId
          const isDragOver = dropTarget?.id === item.id && dropTarget.mode === 'inside'
          const progress = row.weightedProgress

          return (
            <div
              key={item.id}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: vItem.start,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                paddingLeft: row.depth * 16 + 8,
              }}
              className={[
                'flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
                isSelected ? 'bg-[rgba(249,115,22,0.1)] ring-1 ring-inset ring-[rgba(249,115,22,0.25)]' : 'hover:bg-[#141d2e]',
                isDragOver ? 'ring-1 ring-dashed ring-[#FB923C]' : '',
                isFlashing ? 'animate-pulse bg-[rgba(251,146,60,0.2)]' : '',
              ].join(' ')}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
              onDragOver={(e) => handleDragOver(e, row)}
              onDrop={(e) => handleDrop(e, row, rows)}
              onClick={() => onSelect(item)}
            >
              <DropLine mode="before" id={item.id} dropTarget={dropTarget} />
              <DropLine mode="after" id={item.id} dropTarget={dropTarget} />

              {/* Expand/collapse */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id) }}
                className="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-[#1a2438]"
              >
                {row.hasChildren
                  ? (row.isExpanded ? <ChevronDown size={11} className="text-[#334155]" /> : <ChevronRight size={11} className="text-[#334155]" />)
                  : <span className="text-[10px] text-[#1a2438]">—</span>}
              </button>

              {/* WBS code badge */}
              <span className="shrink-0 font-mono text-[7px] font-bold text-[#60A5FA] bg-[rgba(59,130,246,0.08)] px-1 rounded leading-none py-0.5">
                {item.code}
              </span>

              {/* Name */}
              <span className={`flex-1 min-w-0 truncate ${row.depth === 0 ? 'text-[9px] font-bold text-[#e2e8f0]' : 'text-[8.5px] text-[#94a3b8]'}`}>
                {item.name}
              </span>

              {/* Budget */}
              {row.recursiveBudget > 0 && (
                <span className="shrink-0 font-mono text-[7px] font-bold text-[#FBBF24]">
                  {formatIDR(row.recursiveBudget)}{row.hasChildren ? ' ↕' : ''}
                </span>
              )}

              {/* Progress bar + badge */}
              {progress > 0 && (
                <>
                  <div className="shrink-0 w-7 h-[2px] bg-[#1a2438] rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min(100, progress)}%`, background: progressColor(progress) }}
                    />
                  </div>
                  <span className="shrink-0 text-[7px] font-mono font-bold" style={{ color: progressColor(progress) }}>
                    {progress}%
                  </span>
                </>
              )}

              {/* Context menu */}
              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#1a2438] text-[#334155] hover:text-[#94a3b8]"
                >
                  <MoreHorizontal size={12} />
                </button>
                {openMenuId === item.id && (
                  <div className="absolute right-0 top-full mt-0.5 w-36 rounded-md border border-[#1a2438] bg-[#0e1523] shadow-lg z-50">
                    <button onClick={() => { onAddChild(item.id); setOpenMenuId(null) }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-[#141d2e] text-[#64748b] hover:text-[#94a3b8]">
                      <Plus size={11} />Tambah Child
                    </button>
                    <button onClick={() => { onEdit(item); setOpenMenuId(null) }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-[#141d2e] text-[#64748b] hover:text-[#94a3b8]">
                      <Edit2 size={11} />Edit
                    </button>
                    <button onClick={() => { onDelete(item); setOpenMenuId(null) }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-red-900/20 text-red-500">
                      <Trash2 size={11} />Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSVirtualTree"
```
Expected: no output

- [ ] **Step 7.3:** Commit:

```bash
git add src/components/wbs/WBSVirtualTree.tsx
git commit -m "feat(wbs): add WBSVirtualTree — useVirtualizer flat-list, 3-mode drag-drop, Ctrl+Z undo"
```

---

## Task 8: WBSBulkPaste overlay

**Files:**
- Create: `src/components/wbs/WBSBulkPaste.tsx`

- [ ] **Step 8.1:** Create the component:

```tsx
// src/components/wbs/WBSBulkPaste.tsx
import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { parseBulkPasteText } from '../../lib/wbsCalculations'
import { Button } from '../ui/button'

export interface WBSBulkPasteProps {
  open: boolean
  parentCode: string | null
  onClose: () => void
  onImport: (nodes: Array<{ name: string; relativeDepth: number }>) => void
}

export function WBSBulkPaste({ open, parentCode, onClose, onImport }: WBSBulkPasteProps) {
  const [text, setText] = useState('')

  const parsed = parseBulkPasteText(text, parentCode)

  const handleImport = useCallback(() => {
    if (parsed.length === 0) return
    onImport(parsed)
    setText('')
    onClose()
  }, [parsed, onImport, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { onClose(); return }
    // Allow Tab to insert literal tab (for indentation)
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newText = text.substring(0, start) + '\t' + text.substring(end)
      setText(newText)
      setTimeout(() => target.setSelectionRange(start + 1, start + 1), 0)
    }
  }, [text, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1a2438] bg-[#0e1523] shadow-2xl p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#e2e8f0]">Buat Massal</h3>
            <p className="text-[9px] text-[#334155] mt-0.5">
              {parentCode ? `Di bawah ${parentCode}` : 'Root level'} · Tab = indent, Enter = item baru
            </p>
          </div>
          <button onClick={onClose} className="text-[#334155] hover:text-[#64748b] p-1 rounded">
            <X size={14} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'Ketik nama item, tekan Enter untuk baris baru.\nTab = satu level lebih dalam.\nShift+Tab = naik satu level.'}
          className="w-full h-40 rounded-lg border border-[#1a2438] bg-[#070c18] text-[#94a3b8] text-xs px-3 py-2.5 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[#f97316] placeholder:text-[#223044]"
        />

        {/* Live preview */}
        {parsed.length > 0 && (
          <div className="rounded-lg border border-[#1a2438] bg-[#070c18] p-3 max-h-36 overflow-y-auto">
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#223044] mb-2">
              Preview — {parsed.length} item
            </div>
            {parsed.slice(0, 30).map((node, i) => (
              <div
                key={i}
                className="text-[8.5px] text-[#64748b] leading-relaxed"
                style={{ paddingLeft: node.relativeDepth * 14 }}
              >
                <span className="text-[#334155] mr-1">—</span>
                {node.name}
              </div>
            ))}
            {parsed.length > 30 && (
              <div className="text-[7px] text-[#223044] mt-1">…dan {parsed.length - 30} item lainnya</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={parsed.length === 0}
            className="text-xs h-8 bg-[#f97316] hover:bg-[#ea6c0a] border-0 text-white"
          >
            Import {parsed.length > 0 ? `(${parsed.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSBulkPaste"
```
Expected: no output

- [ ] **Step 8.3:** Commit:

```bash
git add src/components/wbs/WBSBulkPaste.tsx
git commit -m "feat(wbs): add WBSBulkPaste — textarea with Tab-indent, live preview, batch import"
```

---

## Task 9: WBSTableView (read-only)

**Files:**
- Create: `src/components/wbs/WBSTableView.tsx`

- [ ] **Step 9.1:** Create the component:

```tsx
// src/components/wbs/WBSTableView.tsx
import type { WBSFlatRow } from '../../types/wbs'
import { formatIDR } from '../../lib/utils'
import { CheckCircle2 } from 'lucide-react'

export interface WBSTableViewProps {
  rows: WBSFlatRow[]
  timelineCountByWbs: Map<string, number>
  rabCountByWbs: Map<string, number>
}

function progressColor(p: number): string {
  if (p >= 80) return '#4ADE80'
  if (p >= 30) return '#22D3EE'
  return '#FB923C'
}

export function WBSTableView({ rows, timelineCountByWbs, rabCountByWbs }: WBSTableViewProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Belum ada data WBS.
      </div>
    )
  }

  return (
    <div className="overflow-auto w-full h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-[#0e1523] z-10">
          <tr>
            <th className="text-left py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438] w-[40%]">WBS</th>
            <th className="text-right py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438]">Budget</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438] w-[80px]">Progress</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438]">QC</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438]">RAB</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[#223044] border-b border-[#1a2438]">Timeline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const item = row.item
            const p = row.weightedProgress
            const qcPassed = item.qc_status === 'PASSED'
            return (
              <tr key={item.id} className="border-b border-[#0d1420] hover:bg-[#141d2e] transition-colors">
                {/* WBS name */}
                <td className="py-1.5 px-3" style={{ paddingLeft: row.depth * 14 + 12 }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 font-mono text-[7px] font-bold text-[#60A5FA] bg-[rgba(59,130,246,0.08)] px-1 rounded py-0.5">
                      {item.code}
                    </span>
                    <span className={`truncate ${row.depth === 0 ? 'font-bold text-[#e2e8f0]' : 'text-[#64748b]'}`}>
                      {item.name}
                    </span>
                  </div>
                </td>
                {/* Budget */}
                <td className="py-1.5 px-3 text-right font-mono text-[#FBBF24] whitespace-nowrap">
                  {row.recursiveBudget > 0 ? formatIDR(row.recursiveBudget) : <span className="text-[#223044]">—</span>}
                  {row.hasChildren && row.recursiveBudget > 0 && <span className="text-[#1a2438] ml-0.5">↕</span>}
                </td>
                {/* Progress */}
                <td className="py-1.5 px-3">
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="w-16 h-[3px] bg-[#1a2438] rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(100, p)}%`, background: progressColor(p) }}
                      />
                    </div>
                    <span className="font-mono text-[8px]" style={{ color: progressColor(p) }}>
                      {p}%
                    </span>
                  </div>
                </td>
                {/* QC */}
                <td className="py-1.5 px-3 text-center">
                  {qcPassed
                    ? <CheckCircle2 size={11} className="mx-auto text-[#4ADE80]" />
                    : <span className="text-[#223044]">—</span>}
                </td>
                {/* RAB count */}
                <td className="py-1.5 px-3 text-center font-mono text-[#64748b]">
                  {rabCountByWbs.get(item.id) ?? 0}
                </td>
                {/* Timeline count */}
                <td className="py-1.5 px-3 text-center font-mono text-[#64748b]">
                  {timelineCountByWbs.get(item.id) ?? 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 9.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSTableView"
```
Expected: no output

- [ ] **Step 9.3:** Commit:

```bash
git add src/components/wbs/WBSTableView.tsx
git commit -m "feat(wbs): add WBSTableView — read-only 6-column indented table"
```

---

## Task 10: WBSDetailPanel — tabbed redesign

**Files:**
- Modify: `src/components/wbs/WBSDetailPanel.tsx`

Replace the existing file with a tabbed version using `@radix-ui/react-tabs`.

- [ ] **Step 10.1:** Replace `src/components/wbs/WBSDetailPanel.tsx`:

```tsx
// src/components/wbs/WBSDetailPanel.tsx
import { useState } from 'react'
import { GitBranch, Edit2, Trash2, Clock, Lock, CheckCircle2, AlertCircle, XCircle, ListTree, X, Plus } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'
import type { RABItem } from '../../types/rab'

export interface WBSDetailPanelProps {
  item: WBSItem | null
  budgetLinked?: number
  timelineTaskCount?: number
  rabItems?: RABItem[]
  timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
  onEdit: (item: WBSItem) => void
  onDelete: (item: WBSItem) => void
  onAddChild?: (parentId: string) => void
  onClose?: () => void
}

function qcTone(status: WBSItem['qc_status']): string {
  switch (status) {
    case 'PASSED': return 'text-[#4ADE80]'
    case 'PENDING': return 'text-[#FB923C]'
    case 'FAILED': return 'text-red-400'
    default: return 'text-[#334155]'
  }
}

function QCIcon({ status }: { status: WBSItem['qc_status'] }) {
  switch (status) {
    case 'PASSED': return <CheckCircle2 size={11} className="text-[#4ADE80]" />
    case 'PENDING': return <AlertCircle size={11} className="text-[#FB923C]" />
    case 'FAILED': return <XCircle size={11} className="text-red-400" />
    default: return null
  }
}

function rabTotal(r: RABItem): number {
  return (
    r.finalTotal ??
    r.final_total ??
    r.finalPrice ??
    (r.volume ?? 0) * ((r as unknown as { unit_price?: number }).unit_price ?? (r as unknown as { unitPrice?: number }).unitPrice ?? 0)
  )
}

export function WBSDetailPanel({
  item,
  budgetLinked = 0,
  timelineTaskCount = 0,
  rabItems = [],
  timelineTasks = [],
  onEdit,
  onDelete,
  onAddChild,
  onClose,
}: WBSDetailPanelProps) {
  const [childName, setChildName] = useState('')

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.08)] text-[#60A5FA]">
          <ListTree size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#e2e8f0]">Pilih item WBS</p>
          <p className="mt-0.5 text-xs text-[#334155]">Klik salah satu item pada struktur.</p>
        </div>
      </div>
    )
  }

  const progress = item.progress ?? 0
  const directRabItems = rabItems.filter(r => r.wbsId === item.id)
  const linkedTimeline = timelineTasks.filter(t => t.wbsId === item.id)

  function progressColor(p: number) {
    if (p >= 80) return '#4ADE80'
    if (p >= 30) return '#22D3EE'
    return '#FB923C'
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <div className="shrink-0 flex items-start gap-2 border-b border-[#1a2438] px-3 py-2.5 bg-[#141d2e]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 rounded bg-[rgba(59,130,246,0.1)] px-1.5 py-0.5 font-mono text-[7px] font-bold text-[#60A5FA]">
              <GitBranch size={9} />
              {item.code || '—'}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-wider text-[#223044]">
              Level {item.level ?? 1}
            </span>
          </div>
          <h3 className="truncate text-xs font-bold leading-tight text-[#e2e8f0]">{item.name}</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded p-1 text-[#334155] hover:bg-[#1a2438] lg:hidden">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="overview" className="flex flex-col flex-1 min-h-0">
        <Tabs.List className="flex shrink-0 border-b border-[#1a2438] bg-[#0e1523]">
          {['overview', 'rab', 'timeline', 'child'].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className="flex-1 h-[28px] text-[8px] font-bold text-[#223044] data-[state=active]:text-[#e2e8f0] data-[state=active]:border-b-2 data-[state=active]:border-[#f97316] data-[state=active]:bg-[#141d2e] transition-colors uppercase tracking-wider"
            >
              {tab === 'child' ? '+Child' : tab === 'overview' ? 'Overview' : tab === 'rab' ? 'RAB' : 'Timeline'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Overview tab */}
        <Tabs.Content value="overview" className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] font-bold uppercase tracking-wider text-[#223044]">Progress Fisik</span>
              <span className="font-mono text-[10px] font-bold" style={{ color: progressColor(progress) }}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#1a2438] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: progressColor(progress) }}
              />
            </div>
          </div>
          {/* Budget */}
          <div>
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#223044] mb-1">Budget RAB Terhubung</div>
            {budgetLinked > 0 ? (
              <div className="font-mono text-sm font-bold text-[#FBBF24]">{formatIDR(budgetLinked)}</div>
            ) : (
              <div className="text-xs text-[#223044]">Belum ada RAB terhubung</div>
            )}
          </div>
          {/* QC */}
          <div>
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#223044] mb-1">Status QC</div>
            <div className={`flex items-center gap-1 text-xs font-semibold ${qcTone(item.qc_status)}`}>
              <QCIcon status={item.qc_status} />
              {item.qc_status ?? 'NOT_REQUIRED'}
            </div>
          </div>
          {/* Progress source */}
          <div>
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#223044] mb-1">Sumber Progress</div>
            <div className="flex items-center gap-1 text-xs text-[#64748b]">
              {item.physicalProgressLocked
                ? <><Lock size={9} className="text-[#FB923C]" /><span className="text-[#FB923C]">Dikunci</span></>
                : item.progressSource === 'timeline'
                  ? <><Clock size={9} className="text-[#22D3EE]" /><span className="text-[#22D3EE]">Otomatis dari Timeline</span></>
                  : <span>Manual</span>}
            </div>
          </div>
          {item.description && (
            <div>
              <div className="text-[7px] font-bold uppercase tracking-wider text-[#223044] mb-1">Deskripsi</div>
              <p className="text-xs text-[#475569]">{item.description}</p>
            </div>
          )}
        </Tabs.Content>

        {/* RAB tab */}
        <Tabs.Content value="rab" className="flex-1 overflow-y-auto px-3 py-3">
          {directRabItems.length === 0 ? (
            <p className="text-xs text-[#223044]">Belum ada RAB terhubung ke node ini.</p>
          ) : (
            <div className="space-y-1">
              {directRabItems.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded px-2 py-1.5 bg-[#0e1523]">
                  <span className="text-[8px] text-[#475569] flex-1 min-w-0 truncate">{r.name || r.description || r.id}</span>
                  <span className="text-[8px] font-mono font-bold text-[#FBBF24] ml-2 shrink-0">{formatIDR(rabTotal(r))}</span>
                </div>
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* Timeline tab */}
        <Tabs.Content value="timeline" className="flex-1 overflow-y-auto px-3 py-3">
          {timelineTaskCount === 0 ? (
            <p className="text-xs text-[#223044]">Tidak ada timeline task terhubung.</p>
          ) : (
            <div className="space-y-1">
              {linkedTimeline.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 rounded px-2 py-1.5 bg-[#0e1523]">
                  <Clock size={9} className="text-[#22D3EE] shrink-0" />
                  <span className="text-[8px] text-[#475569] truncate">{t.name}</span>
                </div>
              ))}
              {linkedTimeline.length === 0 && timelineTaskCount > 0 && (
                <p className="text-xs text-[#223044]">{timelineTaskCount} task terhubung.</p>
              )}
            </div>
          )}
        </Tabs.Content>

        {/* +Child tab */}
        <Tabs.Content value="child" className="flex-1 px-3 py-3 flex flex-col gap-2">
          <p className="text-[8px] text-[#334155]">Tambah child di bawah <strong className="text-[#60A5FA]">{item.code}</strong></p>
          <input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && childName.trim() && onAddChild) {
                onAddChild(item.id)
                setChildName('')
              }
            }}
            placeholder="Nama item…"
            className="w-full rounded-lg border border-[#1a2438] bg-[#070c18] text-xs text-[#94a3b8] px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
          <button
            onClick={() => { if (childName.trim() && onAddChild) { onAddChild(item.id); setChildName('') } }}
            disabled={!childName.trim()}
            className="flex items-center justify-center gap-1 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={11} />
            Tambah
          </button>
        </Tabs.Content>
      </Tabs.Root>

      {/* Footer actions */}
      <div className="shrink-0 flex gap-2 border-t border-[#1a2438] px-3 py-2">
        <button
          onClick={() => onEdit(item)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#1a2438] px-2 py-1.5 text-[9px] font-semibold text-[#64748b] hover:bg-[#141d2e] hover:text-[#94a3b8] transition-colors"
        >
          <Edit2 size={11} />Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold text-red-500 hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={11} />Hapus
        </button>
      </div>
    </div>
  )
}

export default WBSDetailPanel
```

- [ ] **Step 10.2:** TypeScript check:

```
npx tsc --noEmit 2>&1 | grep "WBSDetailPanel"
```
Expected: no output (or only errors from WBS.tsx about new props — those are fixed in Task 11)

- [ ] **Step 10.3:** Commit:

```bash
git add src/components/wbs/WBSDetailPanel.tsx
git commit -m "feat(wbs): redesign WBSDetailPanel with 4-tab layout (Overview/RAB/Timeline/+Child)"
```

---

## Task 11: WBS.tsx integration — wire all new components

**Files:**
- Modify: `src/pages/modules/WBS.tsx`

This is the integration task. Replace the full embedded and standalone layouts to use all new components.

- [ ] **Step 11.1:** Add imports and state at the top of `WBS.tsx`:

Add to the import block (alongside existing imports):

```tsx
import { WBSKPIStrip } from '../../components/wbs/WBSKPIStrip'
import { WBSMiniMap } from '../../components/wbs/WBSMiniMap'
import { WBSVirtualTree } from '../../components/wbs/WBSVirtualTree'
import { WBSBulkPaste } from '../../components/wbs/WBSBulkPaste'
import { WBSTableView } from '../../components/wbs/WBSTableView'
import { flattenVisibleRows, recursiveBudget, weightedProgress } from '../../lib/wbsCalculations'
import type { KPIFilter } from '../../types/wbs'
```

Add new store selectors after existing ones (after `selectItem`):

```tsx
const undoLastAction = useWBSStore((s) => s.undoLastAction)
const setActiveFilter = useWBSStore((s) => s.setActiveFilter)
const activeFilter = useWBSStore((s) => s.activeFilter)
```

Add new local state after existing `fileInputRef`:

```tsx
const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree')
const [bulkPasteOpen, setBulkPasteOpen] = useState(false)
const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20])
const [flashId, setFlashId] = useState<string | null>(null)
```

- [ ] **Step 11.2:** Replace `budgetByWbs` and `summary` computations in WBS.tsx.

Replace the existing `budgetByWbs` useMemo (lines ~106-116):

```tsx
// Recursive budget per node (aggregates children)
const recursiveBudgetByWbs = useMemo(() => {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item.id, recursiveBudget(item.id, items, rabItems))
  }
  return map
}, [items, rabItems])

// Direct budget only (for detail panel's "Budget Linked" display)
const { budgetByWbs, budgetLinkedTotal } = useMemo(() => {
  const map = new Map<string, number>()
  let total = 0
  for (const r of rabItems) {
    if (!r.wbsId) continue
    const t = rabTotal(r)
    map.set(r.wbsId, (map.get(r.wbsId) ?? 0) + t)
    total += t
  }
  return { budgetByWbs: map, budgetLinkedTotal: total }
}, [rabItems])
```

Replace `summary` useMemo to use weighted progress:

```tsx
const summary = useMemo(() => {
  const n = items.length
  // Project-level weighted progress: weight each root node by its recursive budget
  const rootItems = items.filter(i => !i.parentId)
  let totalBudget = 0
  let weightedSum = 0
  for (const root of rootItems) {
    const b = recursiveBudgetByWbs.get(root.id) ?? 0
    const p = weightedProgress(root.id, items, rabItems)
    totalBudget += b
    weightedSum += b * p
  }
  const projectWeightedProgress = totalBudget > 0
    ? Math.round(weightedSum / totalBudget)
    : (rootItems.length > 0 ? Math.round(rootItems.reduce((s, r) => s + weightedProgress(r.id, items, rabItems), 0) / rootItems.length) : 0)

  const qcPassed = items.filter((i) => i.qc_status === 'PASSED').length
  const rabLinkedIds = new Set(rabItems.filter(r => r.wbsId).map(r => r.wbsId!))
  const rabUnlinked = items.filter(i => !rabLinkedIds.has(i.id)).length
  const idSet = new Set(items.map((i) => i.id))
  let timelineLinked = 0
  timelineCountByWbs.forEach((c, id) => { if (idSet.has(id) && c > 0) timelineLinked++ })

  return { n, projectWeightedProgress, qcPassed, rabUnlinked, timelineLinked }
}, [items, rabItems, recursiveBudgetByWbs, timelineCountByWbs])
```

- [ ] **Step 11.3:** Add flatRows computation:

```tsx
// Flat rows for virtualized tree + mini-map
const flatRows = useMemo(
  () => flattenVisibleRows(
    displayedItems,
    expandedIds,
    activeFilter,
    rabItems,
    timelineCountByWbs
  ),
  [displayedItems, expandedIds, activeFilter, rabItems, timelineCountByWbs]
)

// All rows (for mini-map — includes un-expanded nodes for full structure view)
const allRowsForMiniMap = useMemo(
  () => flattenVisibleRows(items, new Set(items.map(i => i.id)), activeFilter, rabItems, timelineCountByWbs),
  [items, activeFilter, rabItems, timelineCountByWbs]
)

// RAB count per WBS node (for table view)
const rabCountByWbs = useMemo(() => {
  const map = new Map<string, number>()
  for (const r of rabItems) {
    if (r.wbsId) map.set(r.wbsId, (map.get(r.wbsId) ?? 0) + 1)
  }
  return map
}, [rabItems])
```

- [ ] **Step 11.4:** Add undo handler:

```tsx
const handleUndo = useCallback(() => {
  if (!activeProjectId) return
  undoLastAction(activeProjectId)
  // Flash restored nodes — simplified: flash selectedId or do nothing
}, [activeProjectId, undoLastAction])
```

- [ ] **Step 11.5:** Add imports needed for bulk paste and mini-map ref at the top of `WBS.tsx`:

```tsx
import { useRef, useImperativeHandle } from 'react'  // already likely imported — check
import { generateId } from '../../lib/idGenerator'
```

Add a ref for the virtual tree scroll:

```tsx
const virtualTreeRef = useRef<{ scrollToIndex: (idx: number) => void }>(null)
```

Add bulk paste import handler:

```tsx
const handleBulkPasteImport = useCallback(
  (nodes: Array<{ name: string; relativeDepth: number }>) => {
    if (!activeProjectId) return
    const baseParentId = selectedId ?? null
    const baseItem = baseParentId ? items.find(i => i.id === baseParentId) : null
    const baseLevel = baseItem ? (baseItem.level ?? 1) : 0

    // Pre-generate IDs so we can wire parent→child relationships without waiting for store updates
    const generated = nodes.map(() => generateId('wbs'))

    // parentIdAtDepth[d] = the ID of the most-recently created node at depth d
    const parentIdAtDepth: (string | null)[] = [baseParentId]

    nodes.forEach((node, i) => {
      const depth = node.relativeDepth
      // Trim stack back if we went up in depth
      parentIdAtDepth.length = depth + 1
      const parentId = parentIdAtDepth[depth] ?? baseParentId

      addItem(activeProjectId, {
        id: generated[i],  // addItem ignores id — use addItemWithId pattern if available, else let store auto-gen
        code: '',
        name: node.name,
        level: baseLevel + depth + 1,
        parentId,
        sortOrder: 999,
        projectId: activeProjectId,
      } as Parameters<typeof addItem>[1])

      // Record this node's generated ID so deeper nodes can reference it as parent
      parentIdAtDepth[depth + 1] = generated[i]
    })
  },
  [activeProjectId, items, selectedId, addItem]
)
```

- [ ] **Step 11.6:** Update the `toolbar` JSX block to pass the new props:

Replace the existing `const toolbar = (...)` block with:

```tsx
const toolbar = (
  <WBSToolbar
    filterText={filterText}
    onFilterChange={setFilterText}
    levelFilter={levelFilter}
    onLevelChange={setLevelFilter}
    onExpandAll={handleExpandAll}
    onCollapseAll={handleCollapseAll}
    onImport={handleImportClick}
    onExport={handleExport}
    onGenerateCodes={handleGenerateCodes}
    onAddRoot={openAddRoot}
    onBulkPaste={() => setBulkPasteOpen(true)}
    viewMode={viewMode}
    onViewModeChange={setViewMode}
    compact={embedded}
  />
)
```

- [ ] **Step 11.7:** Replace `summaryStrip` with `kpiStrip`:

```tsx
const kpiStrip = (
  <WBSKPIStrip
    totalItems={summary.n}
    totalBudget={budgetLinkedTotal}
    projectWeightedProgress={summary.projectWeightedProgress}
    qcPassed={summary.qcPassed}
    rabUnlinked={summary.rabUnlinked}
    timelineLinked={summary.timelineLinked}
    activeFilter={activeFilter}
    onFilterChange={setActiveFilter}
  />
)
```

- [ ] **Step 11.8:** Replace `tree` and `detailPanel` JSX blocks:

```tsx
const treePanel = (
  <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
    <WBSMiniMap
      allRows={allRowsForMiniMap}
      visibleStartIndex={visibleRange[0]}
      visibleEndIndex={visibleRange[1]}
      onNavigate={(idx) => {
        // Scroll the virtual tree to this index — expose via ref if needed
      }}
    />
    <WBSVirtualTree
      rows={flatRows}
      selectedId={selectedId}
      flashId={flashId}
      onSelect={(item) => selectItem(item.id)}
      onToggleExpand={handleToggleExpand}
      onAddChild={openAddChild}
      onEdit={openEdit}
      onDelete={handleDelete}
      onMoveItem={(itemId, newParentId, index) =>
        moveItem(activeProjectId!, itemId, newParentId, index)
      }
      onVisibleRangeChange={(s, e) => setVisibleRange([s, e])}
      onUndo={handleUndo}
    />
  </div>
)

const detailPanel = (
  <WBSDetailPanel
    item={selectedItem}
    budgetLinked={selectedId ? budgetByWbs.get(selectedId) ?? 0 : 0}
    timelineTaskCount={selectedId ? timelineCountByWbs.get(selectedId) ?? 0 : 0}
    rabItems={rabItems}
    timelineTasks={timelineTasks}
    onEdit={openEdit}
    onDelete={handleDelete}
    onAddChild={(parentId) => openAddChild(parentId)}
    onClose={() => selectItem(null)}
  />
)
```

- [ ] **Step 11.9:** Update the embedded layout block to use new components:

Replace the `if (embedded)` return:

```tsx
if (embedded) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}>
      {kpiStrip}
      {toolbar}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {viewMode === 'tree' ? (
          <>
            {treePanel}
            <aside className="hidden w-[200px] shrink-0 border-l border-[#1a2438] overflow-hidden lg:flex lg:flex-col bg-[#141d2e]">
              {detailPanel}
            </aside>
          </>
        ) : (
          <WBSTableView
            rows={flatRows}
            timelineCountByWbs={timelineCountByWbs}
            rabCountByWbs={rabCountByWbs}
          />
        )}
      </div>
      {dialogs}
      <WBSBulkPaste
        open={bulkPasteOpen}
        parentCode={selectedItem?.code ?? null}
        onClose={() => setBulkPasteOpen(false)}
        onImport={handleBulkPasteImport}
      />
    </div>
  )
}
```

- [ ] **Step 11.10:** Update standalone layout similarly (replace the `return (...)` at the bottom of the file):

```tsx
return (
  <section className="flex flex-col h-full overflow-hidden" aria-label="WBS Workspace">
    <WorkspaceHeader
      title="WBS Structure"
      subtitle={`${activeProjectName ?? 'Proyek'} — ${loading ? 'Memuat…' : `${items.length} item`}`}
    />
    {kpiStrip}
    {toolbar}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[#1e253c] mt-2">
      {viewMode === 'tree' ? (
        <>
          {treePanel}
          <aside className="hidden w-[200px] shrink-0 border-l border-[#1a2438] overflow-hidden lg:flex lg:flex-col bg-[#141d2e]">
            {detailPanel}
          </aside>
        </>
      ) : (
        <WBSTableView
          rows={flatRows}
          timelineCountByWbs={timelineCountByWbs}
          rabCountByWbs={rabCountByWbs}
        />
      )}
    </div>
    {dialogs}
    <WBSBulkPaste
      open={bulkPasteOpen}
      parentCode={selectedItem?.code ?? null}
      onClose={() => setBulkPasteOpen(false)}
      onImport={handleBulkPasteImport}
    />
  </section>
)
```

- [ ] **Step 11.11:** Remove the old `summaryStrip` and `tree` JSX variables (they reference `WBSTree` and `SummaryStrip` which are no longer needed in WBS.tsx). Also remove the `SummaryStrip` import.

- [ ] **Step 11.12:** TypeScript check — must be clean for all WBS files:

```
npx tsc --noEmit 2>&1 | grep -E "wbs|WBS" | grep -v "node_modules"
```
Expected: no errors

- [ ] **Step 11.13:** Run full test suite to confirm no regression:

```
npx vitest run
```
Expected: same pass count as before (all pre-existing tests still pass)

- [ ] **Step 11.14:** Commit:

```bash
git add src/pages/modules/WBS.tsx
git commit -m "feat(wbs): wire all new components in WBS.tsx — weighted progress, virtual tree, mini-map, KPI strip, bulk paste, table view"
```

---

## Task 12: Final validation and cleanup

**Files:**
- Read: `src/components/wbs/WBSTree.tsx` (check if anything outside WBS module imports it)

- [ ] **Step 12.1:** Check if WBSTree is imported anywhere outside the WBS module:

```
npx grep -r "from.*WBSTree" src --include="*.tsx" --include="*.ts" | grep -v "WBS.tsx"
```
Expected: no output (only WBS.tsx uses it)

If output exists, add re-exports to WBSTree.tsx for backward compat.

- [ ] **Step 12.2:** Build to check for bundler errors:

```
npm run build 2>&1 | tail -30
```
Expected: successful build, no TypeScript errors

- [ ] **Step 12.3:** Run all tests one final time:

```
npx vitest run 2>&1 | tail -20
```
Expected: all previously passing tests still pass

- [ ] **Step 12.4:** Final commit:

```bash
git add -A
git commit -m "feat(wbs): overhaul complete — virtualized tree, weighted progress, mini-map, undo, bulk paste, KPI filter, table view"
```

---

## Success Criteria Checklist

After Task 12 completes, verify against the spec:

- [ ] 200+ item tree scrolls without jank (check Chrome DevTools → Performance tab)
- [ ] Weighted progress on a parent visibly differs from simple average when children have unequal budgets
- [ ] Parent nodes show Gold budget value with `↕` suffix summing to project total
- [ ] Drag-drop indicator appears at the target row, not bottom of list (3 modes visible)
- [ ] Ctrl+Z after a drag-drop move restores the tree position
- [ ] Bulk paste of 20 items at 3 levels produces correct `X.Y.Z` codes
- [ ] Clicking "RAB Unlinked" KPI cell filters tree to only unlinked nodes
- [ ] No new TypeScript errors (`npx tsc --noEmit`)
