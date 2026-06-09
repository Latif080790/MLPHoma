# WBS Phase 1 — UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 independent UX polish items for the WBS module: hint icon tooltip, setup checklist, cross-module CTAs, header cleanup, adaptive minimap, keyboard navigation, and KPI filter visual dimming.

**Architecture:** All changes are UI-only within existing components. No store changes, no new routes, no new DB queries. Each task is a self-contained git commit.

**Tech Stack:** React, Tailwind CSS, MERIDIAN design tokens (`--cobalt-400`, `--amber-500`, `--wbs-progress-*`), `@tanstack/react-virtual`, `@radix-ui/react-tabs`

---

## File Map

| File | Tasks |
|------|-------|
| `src/components/wbs/WBSMiniMap.tsx` | F |
| `src/components/wbs/WBSDetailPanel.tsx` | E, D |
| `src/components/wbs/WBSVirtualTree.tsx` | A, C, G, H |
| `src/pages/modules/WBS.tsx` | D, C, H |
| `src/lib/wbsCalculations.ts` | H (no code change — just noting behavior: pass `null` filter from caller) |

**Task order:** F → E → A → D → C → G → H  
Each task has one commit. No file should conflict with a prior task's changes.

---

## Task 1: F — Minimap Adaptive Bar Height

**Files:**
- Modify: `src/components/wbs/WBSMiniMap.tsx`

- [ ] **Step 1: Replace constant bar height with adaptive values**

  Current (lines 15–16):
  ```ts
  const BAR_HEIGHT = 4
  const MIN_BAR_HEIGHT = 6
  ```

  Keep those constants unchanged. Add adaptive computation **inside the component** (after `const total = allRows.length`):

  ```ts
  const isSparse = total <= 10
  const BAR_H = isSparse ? 7 : BAR_HEIGHT
  const BAR_GAP = isSparse ? 2 : 1
  const MIN_H = isSparse ? 8 : MIN_BAR_HEIGHT
  ```

- [ ] **Step 2: Apply adaptive gap and bar height in render**

  At line 66, change the flex column class from `gap-[1px]` to an inline style:
  ```tsx
  // Before:
  <div className="px-[3px] flex flex-col gap-[1px] pt-[2px]">

  // After:
  <div className="px-[3px] flex flex-col pt-[2px]" style={{ gap: BAR_GAP }}>
  ```

  At line 71, change the height computation:
  ```tsx
  // Before:
  const h = Math.max(BAR_HEIGHT, MIN_BAR_HEIGHT - row.depth)

  // After:
  const h = Math.max(BAR_H, MIN_H - row.depth)
  ```

- [ ] **Step 3: Add minHeight to viewport indicator**

  Find the viewport indicator div (the `pointer-events-none absolute` div, around line 89). Add `minHeight: '15%'` to its style:
  ```tsx
  // Before:
  style={{
    top: `${vpTop}%`,
    height: `${Math.max(vpHeight, 3)}%`,
    border: '1px solid hsl(var(--amber-500) / 0.7)',
    background: 'hsl(var(--amber-500) / 0.06)',
    borderRadius: 2,
  }}

  // After:
  style={{
    top: `${vpTop}%`,
    height: `${Math.max(vpHeight, 3)}%`,
    minHeight: '15%',
    border: '1px solid hsl(var(--amber-500) / 0.7)',
    background: 'hsl(var(--amber-500) / 0.06)',
    borderRadius: 2,
  }}
  ```

- [ ] **Step 4: Add empty-state placeholder when no rows**

  Immediately inside the bars area `<div className="relative flex-1 overflow-hidden">`, before the `<div className="px-[3px] ...">`, add:
  ```tsx
  {total === 0 && (
    <div
      className="flex h-full items-center justify-center"
      style={{ color: 'var(--text-muted)', fontSize: 10 }}
    >
      —
    </div>
  )}
  ```

- [ ] **Step 5: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/wbs/WBSMiniMap.tsx
  git commit -m "feat(wbs): minimap adaptive bar height for sparse item sets"
  ```

---

## Task 2: E — Detail Panel Header Cleanup

**Files:**
- Modify: `src/components/wbs/WBSDetailPanel.tsx`

- [ ] **Step 1: Replace the header code+level block**

  Find the header section (around line 599–617). The current markup is:
  ```tsx
  <div className="mb-1 flex items-center gap-2">
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
      style={{
        background: 'color-mix(in srgb, hsl(var(--cobalt-400)) 15%, transparent)',
        color: 'hsl(var(--cobalt-400))',
      }}
    >
      <GitBranch size={10} />
      {item.code || '—'}
    </span>
    <span
      className="text-xs font-bold uppercase tracking-wider"
      style={{ color: 'var(--text-secondary)' }}
    >
      Level {item.level ?? 1}
    </span>
  </div>
  ```

  Replace with two separate cobalt badges — level first, then code:
  ```tsx
  <div className="mb-1 flex items-center gap-1.5">
    <span
      style={{
        background: 'hsl(var(--cobalt-400) / 0.12)',
        color: 'hsl(var(--cobalt-400))',
        fontSize: 7,
        fontWeight: 800,
        padding: '1px 5px',
        borderRadius: 3,
      }}
    >
      L{item.level ?? 1}
    </span>
    <span
      className="font-mono"
      style={{
        background: 'hsl(var(--cobalt-400) / 0.12)',
        color: 'hsl(var(--cobalt-400))',
        fontSize: 8,
        fontWeight: 800,
        padding: '1px 5px',
        borderRadius: 3,
      }}
    >
      {item.code || '—'}
    </span>
  </div>
  ```

- [ ] **Step 2: Remove GitBranch from imports**

  `GitBranch` is now unused. Remove it from the `lucide-react` import at line 9–24:
  ```ts
  // Before:
  import {
    GitBranch,
    Edit2,
    ...
  } from 'lucide-react'

  // After (remove GitBranch line):
  import {
    Edit2,
    ...
  } from 'lucide-react'
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/wbs/WBSDetailPanel.tsx
  git commit -m "fix(wbs): detail panel header — separate L{n} level pill and code badge"
  ```

---

## Task 3: A — Hint Text → Icon Tooltip

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx`

- [ ] **Step 1: Add `relative` class to scroll container**

  The root `<div ref={parentRef} ...>` (line ~162) currently has:
  ```tsx
  className="w-full h-full overflow-auto outline-none"
  ```

  Change to:
  ```tsx
  className="w-full h-full overflow-auto outline-none relative"
  ```

- [ ] **Step 2: Replace the hint div with an absolute icon span**

  Remove lines 167–169:
  ```tsx
  // REMOVE this block:
  <div className="text-[7px] px-2 py-0.5 select-none text-[var(--text-muted)]">
    Ctrl+Z untuk undo pindah/hapus
  </div>
  ```

  Add the following immediately after the opening `<div ref={parentRef} ...>` tag (before the virtual list `<div>`):
  ```tsx
  <span
    className="absolute top-1 right-2 select-none opacity-40 hover:opacity-100 transition-opacity z-10"
    style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'default' }}
    title="Ctrl+Z: undo pindah/hapus"
  >
    ⌨ ↩
  </span>
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/wbs/WBSVirtualTree.tsx
  git commit -m "fix(wbs): replace hint text with absolute keyboard icon tooltip"
  ```

---

## Task 4: D — CTA "Buka RAB" & "Buka Timeline" in Overview Tab

**Files:**
- Modify: `src/components/wbs/WBSDetailPanel.tsx`
- Modify: `src/pages/modules/WBS.tsx`

- [ ] **Step 1: Add new props to WBSDetailPanelProps interface**

  In `WBSDetailPanelProps` (lines 31–50), add after `onClose?`:
  ```ts
  /** Called when user wants to navigate to the RAB module for this item */
  onNavigateToRab?: (wbsId: string) => void
  /** Called when user wants to navigate to the Timeline module for this item */
  onNavigateToTimeline?: (wbsId: string) => void
  ```

- [ ] **Step 2: Add new props to OverviewTab function signature**

  `OverviewTab` is defined around line 147. Change its inline props type:
  ```ts
  // Before:
  function OverviewTab({ item, budgetLinked = 0, timelineTaskCount = 0, rabItems = [], timelineTasks = [] }: {
    item: WBSItem
    budgetLinked?: number
    timelineTaskCount?: number
    rabItems?: RABItem[]
    timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
  }) {

  // After:
  function OverviewTab({ item, budgetLinked = 0, timelineTaskCount = 0, rabItems = [], timelineTasks = [], onNavigateToRab, onNavigateToTimeline }: {
    item: WBSItem
    budgetLinked?: number
    timelineTaskCount?: number
    rabItems?: RABItem[]
    timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
    onNavigateToRab?: (wbsId: string) => void
    onNavigateToTimeline?: (wbsId: string) => void
  }) {
  ```

- [ ] **Step 3: Add RAB CTA button**

  Find the "Belum ada RAB terhubung" span (around line 258, inside the `budgetLinked === 0` branch):
  ```tsx
  ) : (
    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada RAB terhubung</span>
  )}
  ```

  Change to:
  ```tsx
  ) : (
    <>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada RAB terhubung</span>
      {onNavigateToRab && (
        <button
          onClick={() => onNavigateToRab(item.id)}
          className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[8px] font-bold"
          style={{
            border: '1px solid hsl(var(--amber-500) / 0.4)',
            background: 'hsl(var(--amber-500) / 0.06)',
            color: 'hsl(var(--amber-500))',
          }}
        >
          <ReceiptText size={10} />
          Buka RAB — link item ini
        </button>
      )}
    </>
  )}
  ```

- [ ] **Step 4: Add Timeline CTA button**

  Find the `timelineDisplay === 0` branch. The current "Tidak ada" span is:
  ```tsx
  ) : (
    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tidak ada</span>
  )}
  ```

  Change to:
  ```tsx
  ) : (
    <>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tidak ada</span>
      {onNavigateToTimeline && (
        <button
          onClick={() => onNavigateToTimeline(item.id)}
          className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[8px] font-bold"
          style={{
            border: '1px solid hsl(var(--cobalt-400) / 0.4)',
            background: 'hsl(var(--cobalt-400) / 0.06)',
            color: 'hsl(var(--cobalt-400))',
          }}
        >
          <CalendarDays size={10} />
          Buka Timeline
        </button>
      )}
    </>
  )}
  ```

- [ ] **Step 5: Pass new props through the main WBSDetailPanel component**

  In the main `WBSDetailPanel` function (line ~545), add the new props to destructuring:
  ```ts
  // Before:
  export function WBSDetailPanel({
    item, budgetLinked = 0, timelineTaskCount = 0, rabItems = [],
    timelineTasks = [], onEdit, onDelete, onAddChild, onClose,
  }: WBSDetailPanelProps) {

  // After:
  export function WBSDetailPanel({
    item, budgetLinked = 0, timelineTaskCount = 0, rabItems = [],
    timelineTasks = [], onEdit, onDelete, onAddChild, onClose,
    onNavigateToRab, onNavigateToTimeline,
  }: WBSDetailPanelProps) {
  ```

  And pass them to `OverviewTab` (around line 674):
  ```tsx
  // Before:
  <OverviewTab
    item={item}
    budgetLinked={budgetLinked}
    timelineTaskCount={timelineTaskCount}
    rabItems={rabItems}
    timelineTasks={timelineTasks}
  />

  // After:
  <OverviewTab
    item={item}
    budgetLinked={budgetLinked}
    timelineTaskCount={timelineTaskCount}
    rabItems={rabItems}
    timelineTasks={timelineTasks}
    onNavigateToRab={onNavigateToRab}
    onNavigateToTimeline={onNavigateToTimeline}
  />
  ```

- [ ] **Step 6: Wire handlers in WBS.tsx**

  In `WBS.tsx`, the `detailPanel` JSX (around line 416). Add the two new props to `<WBSDetailPanel ...>`:
  ```tsx
  // Add after existing props:
  onNavigateToRab={(wbsId) => toast.info(`Buka tab RAB untuk menghubungkan item ${wbsId}`)}
  onNavigateToTimeline={(wbsId) => toast.info(`Buka tab Timeline untuk menghubungkan item ${wbsId}`)}
  ```

  Note: `toast` is already imported from `'sonner'` in WBS.tsx. These are informational toasts until real tab-navigation is wired.

- [ ] **Step 7: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/wbs/WBSDetailPanel.tsx src/pages/modules/WBS.tsx
  git commit -m "feat(wbs): add CTA buttons to navigate to RAB and Timeline from Overview tab"
  ```

---

## Task 5: C — Setup Checklist Panel

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx`
- Modify: `src/pages/modules/WBS.tsx`

- [ ] **Step 1: Add `onGenerateCodes` prop to WBSVirtualTreeProps**

  In the `WBSVirtualTreeProps` interface (around line 22), add after `rabCountByWbs`:
  ```ts
  onGenerateCodes?: () => void
  ```

- [ ] **Step 2: Destructure the new prop in the component**

  In the component function signature (around line 50), add `onGenerateCodes` to the destructured props:
  ```ts
  { rows, selectedId, flashId, onSelect, onToggleExpand, onAddChild, onEdit, onDelete,
    onMoveItem, onVisibleRangeChange, onUndo, rabCountByWbs, onGenerateCodes }
  ```

- [ ] **Step 3: Add checklist state and condition**

  Inside the component body, after the existing `useState` calls (after `setOpenMenuId`), add:
  ```tsx
  const [checklistDismissed, setChecklistDismissed] = useState(false)

  const showChecklist =
    !checklistDismissed &&
    rows.length > 0 &&
    rows.every((r) => (rabCountByWbs.get(r.item.id) ?? 0) === 0) &&
    rows.every((r) => r.weightedProgress === 0)

  const anyCodeSet = rows.some((r) => !!r.item.code)
  ```

- [ ] **Step 4: Add the checklist JSX**

  In the non-empty return (after the hint icon span and before the virtual list `<div style={{ height: ... }}`), add:
  ```tsx
  {showChecklist && (
    <div
      className="mx-2 mb-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-2 relative"
    >
      <button
        onClick={() => setChecklistDismissed(true)}
        className="absolute top-1 right-1.5 leading-none text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        style={{ fontSize: 12 }}
        title="Tutup"
      >
        ×
      </button>
      <div
        className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-muted)' }}
      >
        Setup WBS Proyek
      </div>
      {[
        { done: true,       label: 'Item WBS dibuat',        action: null },
        { done: anyCodeSet, label: 'Generate kode WBS',      action: onGenerateCodes ?? null },
        { done: false,      label: 'Hubungkan RAB ke item',  action: null },
        { done: false,      label: 'Isi progress pertama',   action: null },
      ].map((step, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span style={{
            fontSize: 9,
            color: step.done ? 'var(--wbs-progress-high)' : 'var(--wbs-progress-low)',
          }}>
            {step.done ? '✓' : '○'}
          </span>
          <span
            className="flex-1 text-[8px]"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: step.done ? 'line-through' : 'none',
              opacity: step.done ? 0.5 : 1,
            }}
          >
            {step.label}
          </span>
          {step.action && (
            <button
              onClick={step.action}
              className="text-[7px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'hsl(var(--cobalt-400) / 0.15)',
                color: 'hsl(var(--cobalt-400))',
              }}
            >
              Jalankan
            </button>
          )}
        </div>
      ))}
    </div>
  )}
  ```

- [ ] **Step 5: Wire `onGenerateCodes` in WBS.tsx**

  In `WBS.tsx`, the `<WBSVirtualTree ...>` JSX (around line 395). Add the prop:
  ```tsx
  onGenerateCodes={handleGenerateCodes}
  ```

  `handleGenerateCodes` is already defined at line ~258.

- [ ] **Step 6: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/wbs/WBSVirtualTree.tsx src/pages/modules/WBS.tsx
  git commit -m "feat(wbs): add setup checklist panel for new/empty projects"
  ```

---

## Task 6: G — Keyboard Navigation in Tree

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx`

- [ ] **Step 1: Add focused index state and refs**

  After the existing state declarations (after `const [openMenuId, ...]`), add:
  ```tsx
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Refs used inside the keydown handler to avoid stale closures
  const focusedIdxRef = useRef<number | null>(null)
  const rowsRef = useRef(rows)
  const selectedIdRef = useRef<string | null>(selectedId)
  const cbRef = useRef({ onUndo, onSelect, onToggleExpand, onAddChild, onEdit, onDelete })
  ```

- [ ] **Step 2: Keep refs current on every render**

  Add these four effects immediately after the ref declarations (before the `useVirtualizer` call):
  ```tsx
  useEffect(() => { rowsRef.current = rows })
  useEffect(() => { selectedIdRef.current = selectedId })
  useEffect(() => { cbRef.current = { onUndo, onSelect, onToggleExpand, onAddChild, onEdit, onDelete } })
  useEffect(() => {
    if (selectedId) {
      const idx = rows.findIndex((r) => r.item.id === selectedId)
      if (idx >= 0) {
        focusedIdxRef.current = idx
        setFocusedIndex(idx)
      }
    }
  }, [selectedId, rows])
  ```

- [ ] **Step 3: Replace the existing keydown useEffect with a unified handler**

  Remove the current `useEffect` that handles Ctrl+Z (lines ~75–86):
  ```tsx
  // REMOVE:
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
  ```

  Replace with a unified handler (no deps needed — everything accessed via refs):
  ```tsx
  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    const handler = (e: KeyboardEvent) => {
      const { onUndo: undo, onSelect: select, onToggleExpand: toggleExp,
              onAddChild: addChild, onEdit: edit, onDelete: del } = cbRef.current
      const allRows = rowsRef.current

      // Ctrl+Z undo (unchanged behaviour)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      // Ignore all other modified-key combos
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (allRows.length === 0) return

      const curIdx = focusedIdxRef.current !== null
        ? focusedIdxRef.current
        : allRows.findIndex((r) => r.item.id === selectedIdRef.current)
      const safeIdx = Math.max(0, Math.min(allRows.length - 1, curIdx >= 0 ? curIdx : 0))
      const row = allRows[safeIdx]

      const moveTo = (idx: number) => {
        const clamped = Math.max(0, Math.min(allRows.length - 1, idx))
        focusedIdxRef.current = clamped
        setFocusedIndex(clamped)
        virtualizer.scrollToIndex(clamped)
      }

      const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as Element).tagName,
      )

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveTo(safeIdx + 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveTo(safeIdx - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (row.hasChildren && !row.isExpanded) toggleExp(row.item.id)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (row.hasChildren && row.isExpanded) {
            toggleExp(row.item.id)
          } else if (row.item.parentId) {
            const pi = allRows.findIndex((r) => r.item.id === row.item.parentId)
            if (pi >= 0) moveTo(pi)
          }
          break
        case 'Enter':
          e.preventDefault()
          select(row.item)
          break
        case 'n':
          if (!isEditable) { e.preventDefault(); addChild(row.item.id) }
          break
        case 'e':
          if (!isEditable) { e.preventDefault(); edit(row.item) }
          break
        case 'Delete':
        case 'Backspace':
          if (!isEditable) { e.preventDefault(); del(row.item) }
          break
      }
    }

    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // Empty: all values accessed via stable refs
  ```

- [ ] **Step 4: Apply focused ring to rows**

  In the row `className` array (around line 198), add a focused ring style distinct from the selected amber ring:
  ```tsx
  // Before:
  className={[
    'group flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
    isSelected
      ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
      : 'hover:bg-[var(--bg-surface-hover)]',
    isFlashing ? 'animate-pulse' : '',
  ].join(' ')}

  // After:
  className={[
    'group flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
    isSelected
      ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
      : vItem.index === focusedIndex
        ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.4)]'
        : 'hover:bg-[var(--bg-surface-hover)]',
    isFlashing ? 'animate-pulse' : '',
  ].join(' ')}
  ```

- [ ] **Step 5: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/wbs/WBSVirtualTree.tsx
  git commit -m "feat(wbs): keyboard navigation — arrow keys, n/e/Delete, focused ring"
  ```

---

## Task 7: H — KPI Filter: Dim Non-Matching Rows

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx`
- Modify: `src/pages/modules/WBS.tsx`

### Part A — WBSVirtualTree: add filter dim logic

- [ ] **Step 1: Import KPIFilter type**

  At line 5, change:
  ```ts
  import type { WBSFlatRow, WBSItem } from '../../types/wbs'
  ```
  To:
  ```ts
  import type { WBSFlatRow, WBSItem, KPIFilter } from '../../types/wbs'
  ```

- [ ] **Step 2: Add new props to WBSVirtualTreeProps**

  In `WBSVirtualTreeProps` (after `rabCountByWbs`), add:
  ```ts
  activeFilter: KPIFilter
  timelineCountByWbs: Map<string, number>
  ```

- [ ] **Step 3: Add a pure row-match helper outside the component**

  Add this function before the `WBSVirtualTree` declaration (e.g., after the `DropLine` component):
  ```ts
  function rowMatchesFilter(
    row: WBSFlatRow,
    filter: KPIFilter,
    rabCount: number,
    timelineCountByWbs: Map<string, number>,
  ): boolean {
    if (!filter) return true
    switch (filter) {
      case 'rab-unlinked':    return rabCount === 0
      case 'qc-passed':       return row.item.qc_status === 'PASSED'
      case 'low-progress':    return row.weightedProgress < 30
      case 'timeline-linked': return (timelineCountByWbs.get(row.item.id) ?? 0) > 0
      default:                return true
    }
  }
  ```

- [ ] **Step 4: Destructure new props in the component function**

  The component destructures props at line ~50. Add `activeFilter` and `timelineCountByWbs` to the destructuring list.

- [ ] **Step 5: Compute `isDimmed` per row and apply opacity**

  In the row render (inside `virtualItems.map`), after computing `rabCount` and before the `return (`:

  Add:
  ```tsx
  const isDimmed =
    activeFilter !== null && !rowMatchesFilter(row, activeFilter, rabCount, timelineCountByWbs)
  ```

  Then in the row's `className` array (currently updated by Task 6), add the dimmed class at the beginning:
  ```tsx
  className={[
    'group flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
    isDimmed ? 'opacity-30' : '',
    isSelected
      ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
      : vItem.index === focusedIndex
        ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.4)]'
        : 'hover:bg-[var(--bg-surface-hover)]',
    isFlashing ? 'animate-pulse' : '',
  ].filter(Boolean).join(' ')}
  ```

### Part B — WBS.tsx: pass null filter, wire new props

- [ ] **Step 6: Change `flatRows` to pass `null` filter**

  Around line 185:
  ```ts
  // Before:
  const flatRows = useMemo(
    () => flattenVisibleRows(displayedItems, expandedIds, activeFilter, rabItems, timelineCountByWbs),
    [displayedItems, expandedIds, activeFilter, rabItems, timelineCountByWbs]
  )

  // After (pass null so all rows are always visible; dimming is done in the tree):
  const flatRows = useMemo(
    () => flattenVisibleRows(displayedItems, expandedIds, null, rabItems, timelineCountByWbs),
    [displayedItems, expandedIds, rabItems, timelineCountByWbs]
  )
  ```

- [ ] **Step 7: Change `allRowsForMiniMap` to pass `null` filter**

  Around line 191:
  ```ts
  // Before:
  const allRowsForMiniMap = useMemo(
    () => flattenVisibleRows(items, new Set(items.map(i => i.id)), activeFilter, rabItems, timelineCountByWbs),
    [items, activeFilter, rabItems, timelineCountByWbs]
  )

  // After:
  const allRowsForMiniMap = useMemo(
    () => flattenVisibleRows(items, new Set(items.map(i => i.id)), null, rabItems, timelineCountByWbs),
    [items, rabItems, timelineCountByWbs]
  )
  ```

- [ ] **Step 8: Pass `activeFilter` and `timelineCountByWbs` to WBSVirtualTree**

  In the `<WBSVirtualTree ...>` JSX (around line 395), add the two new props:
  ```tsx
  activeFilter={activeFilter}
  timelineCountByWbs={timelineCountByWbs}
  ```

- [ ] **Step 9: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 10: Commit**

  ```bash
  git add src/components/wbs/WBSVirtualTree.tsx src/pages/modules/WBS.tsx
  git commit -m "feat(wbs): dim non-matching rows when KPI filter active (instead of hiding)"
  ```

---

## Final Verification

- [ ] **Run full type check**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors

- [ ] **Start dev server and manual test**

  ```
  npm run dev
  ```

  Test checklist:
  1. **F**: Open WBS with ≤10 items — minimap bars should be taller (~7px), viewport indicator at least 15% height
  2. **E**: Select any WBS item — detail panel header shows `L2` + `1.1` pills, no GitBranch icon
  3. **A**: Hover top-right corner of tree — `⌨ ↩` tooltip appears, hint text row is gone
  4. **D**: Select a leaf item with 0 RAB — Overview tab shows amber "Buka RAB" button; select item with 0 timeline — cobalt "Buka Timeline" button appears
  5. **C**: Create a fresh project, add 1 WBS item, trigger no RAB/progress — checklist panel shows; click × to dismiss; clicking "Jalankan" calls generateCodes
  6. **G**: Click a tree row to focus tree; use ArrowDown/Up to navigate; ArrowRight to expand; ArrowLeft to collapse; `n` to add child; `e` to edit; cobalt focus ring visible on keyboard-focused row
  7. **H**: Click a KPI chip (e.g. "RAB Unlinked") — matching items stay full opacity, non-matching items fade to 30% but remain visible; minimap shows full structure unchanged

---

## Out of Scope (Phase 2)

- **B** — Inline progress edit (click `%` badge → number input in row)
- **I** — Multi-select / bulk operations (Shift+click, bulk delete/progress/move)
