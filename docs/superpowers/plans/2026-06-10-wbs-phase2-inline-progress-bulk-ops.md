# WBS Phase 2 — Inline Progress Edit & Bulk Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline progress editing (hover pencil → type in row) and multi-select bulk operations (Shift/Ctrl+click → floating bar → Set % or Delete) to the WBS tree.

**Architecture:** All changes are confined to two existing files: `WBSVirtualTree.tsx` (state, render, event handlers) and `WBS.tsx` (three new callbacks wired to the store). No new files, no new store actions, no changes to types or calculation utilities.

**Tech Stack:** React 18, TypeScript (strict), Tailwind CSS, @tanstack/react-virtual, Vite, Vitest

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/wbs/WBSVirtualTree.tsx` | New props, new state, `confirmProgressEdit`, `handleRowClick`, `confirmBulkProgress`, row render (hover/edit/bulk-highlight), bulk bar + popover JSX |
| `src/pages/modules/WBS.tsx` | `handleUpdateProgress`, `handleBulkUpdateProgress`, `handleBulkDelete` callbacks + wire to `<WBSVirtualTree>` |

---

## Task 1: Add new props to WBSVirtualTreeProps

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx:22-39`

- [ ] **Step 1: Add three optional props to the interface**

Open `src/components/wbs/WBSVirtualTree.tsx`. The `WBSVirtualTreeProps` interface ends around line 39. Add these three props **before** the closing `}`:

```ts
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
  rabCountByWbs: Map<string, number>
  onGenerateCodes?: () => void
  activeFilter: KPIFilter
  timelineCountByWbs: Map<string, number>
  showSetupChecklist?: boolean
  onUpdateProgress?: (id: string, progress: number) => void
  onBulkUpdateProgress?: (ids: string[], progress: number) => void
  onBulkDelete?: (ids: string[]) => void
}
```

- [ ] **Step 2: Destructure the three new props in the function signature**

The function signature starts at line ~70. The destructuring currently ends with `showSetupChecklist = false`. Add the three new props:

```ts
{ rows, selectedId, flashId, onSelect, onToggleExpand, onAddChild, onEdit, onDelete,
  onMoveItem, onVisibleRangeChange, onUndo, rabCountByWbs, onGenerateCodes,
  activeFilter, timelineCountByWbs, showSetupChecklist = false,
  onUpdateProgress, onBulkUpdateProgress, onBulkDelete },
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (new optional props have no callers yet — that's fine).

- [ ] **Step 4: Commit**

```bash
git add src/components/wbs/WBSVirtualTree.tsx
git commit -m "feat(wbs): add onUpdateProgress, onBulkUpdateProgress, onBulkDelete props"
```

---

## Task 2: Feature B — hover/edit state + inline progress input

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx:74-100` (state block)
- Modify: `src/components/wbs/WBSVirtualTree.tsx:346-543` (row render)

- [ ] **Step 1: Add two new state variables after `focusedIndex`**

Find the line `const [focusedIndex, setFocusedIndex] = useState<number | null>(null)` (~line 80). Add immediately below it:

```ts
const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
```

- [ ] **Step 2: Add `confirmProgressEdit` helper after the state block**

Place this **after** the three `useEffect` ref-sync calls (~line 90) and **before** the `useVirtualizer` call (~line 101):

```ts
const confirmProgressEdit = (input: HTMLInputElement) => {
  if (!editingProgressId) return
  const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
  onUpdateProgress?.(editingProgressId, val)
  setEditingProgressId(null)
}
```

- [ ] **Step 3: Add `onMouseEnter` / `onMouseLeave` to the row div**

The row `<div ... onClick={() => onSelect(item)}>` is inside the `virtualItems.map` (~line 361). Add two new event handlers to that div:

```tsx
onMouseEnter={() => setHoveredRowId(item.id)}
onMouseLeave={() => setHoveredRowId(null)}
```

The row div opening tag should now look like:

```tsx
<div
  key={item.id}
  data-index={vItem.index}
  ref={virtualizer.measureElement}
  style={{ ... }}
  className={[ ... ].filter(Boolean).join(' ')}
  draggable
  onDragStart={(e) => handleDragStart(e, item.id)}
  onDragEnd={handleDragEnd}
  onDragOver={(e) => handleDragOver(e, row)}
  onDrop={(e) => handleDrop(e, row)}
  onClick={() => onSelect(item)}
  onMouseEnter={() => setHoveredRowId(item.id)}
  onMouseLeave={() => setHoveredRowId(null)}
>
```

- [ ] **Step 4: Replace the progress bar + badge area with the inline-edit version**

Find this block (~lines 466–482):

```tsx
{/* Progress bar + badge — always shown; muted when 0% */}
<div className="shrink-0 w-9 h-[3px] rounded overflow-hidden bg-[var(--border-default)]">
  {progress > 0 && (
    <div
      className="h-full rounded"
      style={{ width: `${Math.min(100, progress)}%`, background: progressColor(progress) }}
    />
  )}
</div>
<span
  className="shrink-0 font-mono font-bold"
  style={{
    fontSize: 7,
    color: progress > 0 ? progressColor(progress) : 'var(--text-muted)',
  }}
>
  {progress}%
</span>
```

Replace it with:

```tsx
{/* Progress bar */}
<div className="shrink-0 w-9 h-[3px] rounded overflow-hidden bg-[var(--border-default)]">
  {progress > 0 && (
    <div
      className="h-full rounded"
      style={{ width: `${Math.min(100, progress)}%`, background: progressColor(progress) }}
    />
  )}
</div>

{/* Progress badge — swaps to inline input when editingProgressId matches */}
{editingProgressId === item.id ? (
  <span className="flex items-center gap-0.5 shrink-0">
    <input
      type="number"
      min={0}
      max={100}
      defaultValue={item.progress ?? 0}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmProgressEdit(e.currentTarget)
        if (e.key === 'Escape') setEditingProgressId(null)
      }}
      onBlur={(e) => confirmProgressEdit(e.currentTarget)}
      onClick={(e) => e.stopPropagation()}
      className="w-9 rounded border text-right text-[10px] font-mono px-1 py-px"
      style={{
        background: 'hsl(var(--bg-surface))',
        borderColor: 'hsl(var(--cobalt-400))',
        color: 'hsl(var(--cobalt-400))',
      }}
    />
    <span className="text-[9px]" style={{ color: 'hsl(var(--text-muted))' }}>%</span>
  </span>
) : (
  <span className="flex items-center gap-1 shrink-0">
    <span
      className="font-mono font-bold"
      style={{
        fontSize: 7,
        color: progress > 0 ? progressColor(progress) : 'var(--text-muted)',
      }}
    >
      {progress}%
    </span>
    {hoveredRowId === item.id && (
      <button
        onClick={(e) => { e.stopPropagation(); setEditingProgressId(item.id) }}
        className="border-0 bg-transparent p-0 leading-none"
        style={{ color: 'hsl(var(--amber-500))', fontSize: 11, opacity: 0.75 }}
        tabIndex={-1}
        aria-label="Edit progress"
      >
        ✎
      </button>
    )}
  </span>
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`, open WBS, hover a row — pencil icon ✎ should appear in amber. Click it — number input appears. Type 75, press Enter — badge updates to 75%. Press Esc — reverts. Blur without Enter — saves.

- [ ] **Step 7: Commit**

```bash
git add src/components/wbs/WBSVirtualTree.tsx
git commit -m "feat(wbs): inline progress edit — hover pencil, in-place input, Enter/Esc/blur"
```

---

## Task 3: Feature I — bulk selection state + handleRowClick + row highlight

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx:74-100` (state/ref block)
- Modify: `src/components/wbs/WBSVirtualTree.tsx:270-390` (before virtualItems.map, row onClick)

- [ ] **Step 1: Add bulk selection state and anchor ref**

Find the two lines added in Task 2 (editingProgressId, hoveredRowId). Add directly below them:

```ts
const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
const anchorIdxRef = useRef<number | null>(null)
```

- [ ] **Step 2: Add `handleRowClick` function before the `virtualItems` map**

Find `const virtualItems = virtualizer.getVirtualItems()` (~line 270). Add the following **immediately before** that line:

```ts
const handleRowClick = (e: React.MouseEvent, row: WBSFlatRow, idx: number) => {
  if (editingProgressId !== null) return
  if (e.shiftKey && anchorIdxRef.current !== null) {
    const lo = Math.min(anchorIdxRef.current, idx)
    const hi = Math.max(anchorIdxRef.current, idx)
    setBulkSelectedIds(new Set(rows.slice(lo, hi + 1).map((r) => r.item.id)))
    return
  }
  if (e.ctrlKey || e.metaKey) {
    anchorIdxRef.current = idx
    setBulkSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(row.item.id) ? next.delete(row.item.id) : next.add(row.item.id)
      return next
    })
    return
  }
  anchorIdxRef.current = idx
  setBulkSelectedIds(new Set())
  cbRef.current.onSelect(row.item)
}
```

- [ ] **Step 3: Replace row `onClick` with `handleRowClick`**

Find `onClick={() => onSelect(item)}` on the row div. Replace with:

```tsx
onClick={(e) => handleRowClick(e, row, vItem.index)}
```

- [ ] **Step 4: Add `isBulkSelected` highlight to the row className array**

Find the `className={[ ... ].filter(Boolean).join(' ')}` on the row div (~line 375). The array currently has: `'group flex ...'`, `isDimmed ? 'opacity-30' : ''`, `isSelected ? ... : vItem.index === focusedIndex ? ... : 'hover:...'`, `isFlashing ? 'animate-pulse' : ''`.

Add `isBulkSelected` variable and its class to the array:

```ts
const isBulkSelected = bulkSelectedIds.has(item.id)
```

Add to the className array (before `.filter(Boolean).join(' ')`):

```ts
isBulkSelected && !isSelected
  ? 'ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.35)] bg-[hsl(var(--cobalt-400)/0.10)]'
  : '',
```

Full className array after the change:

```tsx
className={[
  'group flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
  isDimmed ? 'opacity-30' : '',
  isSelected
    ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
    : isBulkSelected
      ? 'ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.35)] bg-[hsl(var(--cobalt-400)/0.10)]'
      : vItem.index === focusedIndex
        ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.4)]'
        : 'hover:bg-[var(--bg-surface-hover)]',
  isFlashing ? 'animate-pulse' : '',
].filter(Boolean).join(' ')}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`, open WBS. Click a row (normal select — panel opens). Ctrl+click another row — both rows turn cobalt-tinted, panel still shows first. Shift+click a third row — range highlights. Plain click anywhere — selection clears.

- [ ] **Step 7: Commit**

```bash
git add src/components/wbs/WBSVirtualTree.tsx
git commit -m "feat(wbs): multi-select — Shift+click range, Ctrl+click toggle, cobalt highlight"
```

---

## Task 4: Feature I — bulk action bar + progress popover

**Files:**
- Modify: `src/components/wbs/WBSVirtualTree.tsx:74-105` (state/ref block, one more state + ref)
- Modify: `src/components/wbs/WBSVirtualTree.tsx:272-275` (return statement — restructure outer div)

- [ ] **Step 1: Add `showProgressPopover` state and `popoverInputRef`**

Add after `anchorIdxRef` (from Task 3):

```ts
const [showProgressPopover, setShowProgressPopover] = useState(false)
const popoverInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Add `confirmBulkProgress` helper**

Add immediately below `confirmProgressEdit` (from Task 2):

```ts
const confirmBulkProgress = (input: HTMLInputElement) => {
  const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
  onBulkUpdateProgress?.(Array.from(bulkSelectedIds), val)
  setBulkSelectedIds(new Set())
  setShowProgressPopover(false)
}
```

- [ ] **Step 3: Restructure the return JSX — separate scroll container from bulk bar**

The current `return` opens a single `<div ref={parentRef} className="w-full h-full overflow-auto outline-none relative" tabIndex={0}>`. Because `parentRef` is the virtualizer's scroll element, the bulk bar inside it would scroll away on long lists.

**Fix:** Wrap in a flex-column outer shell. `parentRef` stays on the inner scroll div. Bulk bar lives outside the scroll area.

Replace the current outer div opening tag:

```tsx
// BEFORE (single div):
return (
  <div
    ref={parentRef}
    className="w-full h-full overflow-auto outline-none relative"
    tabIndex={0}
  >
    <span ...>⌨ ↩</span>
    {!checklistDismissed && showSetupChecklist && ( ... )}
    <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
      {virtualItems.map(...)}
    </div>
  </div>
)
```

With this new structure:

```tsx
// AFTER (flex-column shell + inner scroll div):
return (
  <div className="w-full h-full flex flex-col outline-none" tabIndex={0}>
    <div
      ref={parentRef}
      className="flex-1 min-h-0 overflow-auto relative"
    >
      <span ...>⌨ ↩</span>
      {!checklistDismissed && showSetupChecklist && ( ... )}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualItems.map(...)}
      </div>
    </div>

    {/* Bulk bar goes here — outside the scroll container */}
    {bulkSelectedIds.size > 0 && (
      ... bulk bar JSX ...
    )}
  </div>
)
```

In practice this means:
1. Change the opening `<div ref={parentRef} className="w-full h-full overflow-auto outline-none relative" tabIndex={0}>` to two divs:
   ```tsx
   <div className="w-full h-full flex flex-col outline-none" tabIndex={0}>
     <div ref={parentRef} className="flex-1 min-h-0 overflow-auto relative">
   ```
2. Close the inner `</div>` before the bulk bar.
3. Close the outer `</div>` at the very end.

- [ ] **Step 4: Add the bulk bar + popover JSX after the inner scroll div's closing tag**

After the inner scroll div closing tag and before the outer div closing tag, add:

```tsx
{bulkSelectedIds.size > 0 && (
  <div className="relative">
    {showProgressPopover && (
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20
                   flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg"
        style={{
          background: 'hsl(var(--bg-surface))',
          borderColor: 'hsl(var(--cobalt-400) / 0.4)',
        }}
      >
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-muted))' }}>
          Set {bulkSelectedIds.size} item →
        </span>
        <input
          ref={popoverInputRef}
          type="number"
          min={0}
          max={100}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmBulkProgress(e.currentTarget)
            if (e.key === 'Escape') setShowProgressPopover(false)
          }}
          className="w-10 rounded border text-right text-[11px] font-mono px-1 py-px"
          style={{
            background: 'hsl(var(--bg-base))',
            borderColor: 'hsl(var(--cobalt-400))',
            color: 'hsl(var(--cobalt-400))',
          }}
        />
        <span className="text-[9px]" style={{ color: 'hsl(var(--text-muted))' }}>%</span>
        <button
          onClick={() => popoverInputRef.current && confirmBulkProgress(popoverInputRef.current)}
          className="rounded px-2 py-px text-[9px] text-white"
          style={{ background: 'hsl(var(--cobalt-400))' }}
        >
          ✓
        </button>
      </div>
    )}

    <div
      className="flex items-center gap-2 border-t px-3 py-1.5"
      style={{
        background: 'hsl(var(--bg-surface))',
        borderColor: 'hsl(var(--cobalt-400) / 0.25)',
      }}
    >
      <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--cobalt-400))' }}>
        {bulkSelectedIds.size} dipilih
      </span>
      <span className="flex-1" />
      <button
        onClick={() => setShowProgressPopover((p) => !p)}
        className="rounded px-2 py-0.5 text-[10px]"
        style={{
          background: 'hsl(var(--cobalt-400) / 0.15)',
          color: 'hsl(var(--cobalt-400))',
        }}
      >
        Set %
      </button>
      <button
        onClick={() => {
          onBulkDelete?.(Array.from(bulkSelectedIds))
          setBulkSelectedIds(new Set())
          setShowProgressPopover(false)
        }}
        className="rounded px-2 py-0.5 text-[10px]"
        style={{ background: 'hsl(0 70% 55% / 0.15)', color: 'hsl(0 70% 65%)' }}
      >
        Hapus
      </button>
      <button
        onClick={() => {
          setBulkSelectedIds(new Set())
          setShowProgressPopover(false)
        }}
        className="border-0 bg-transparent text-[12px] leading-none"
        style={{ color: 'hsl(var(--text-muted))' }}
      >
        ✕
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run `npm run dev`. Ctrl+click two rows → bulk bar appears at bottom of tree (does NOT scroll away when you scroll the list). Click "Set %" → popover opens, type 50, Enter → both items set to 50%. Select two rows again → click "Hapus" → rows deleted. ✕ clears selection without deleting.

- [ ] **Step 6: Commit**

```bash
git add src/components/wbs/WBSVirtualTree.tsx
git commit -m "feat(wbs): bulk action bar — Set % popover and bulk delete"
```

---

## Task 5: WBS.tsx — wire three handlers

**Files:**
- Modify: `src/pages/modules/WBS.tsx:318-341` (after handleUndo, before handleBulkPasteImport)
- Modify: `src/pages/modules/WBS.tsx:405-425` (WBSVirtualTree JSX props)

- [ ] **Step 1: Add `handleUpdateProgress` after `handleUndo`**

Find `handleUndo` (~line 318). After its closing `}, [activeProjectId, undoLastAction])`, add:

```ts
const handleUpdateProgress = useCallback(
  (id: string, progress: number) => {
    if (!activeProjectId) return
    updateItem(activeProjectId, id, { progress })
  },
  [activeProjectId, updateItem],
)
```

- [ ] **Step 2: Add `handleBulkUpdateProgress` immediately after**

```ts
const handleBulkUpdateProgress = useCallback(
  (ids: string[], progress: number) => {
    if (!activeProjectId) return
    ids.forEach((id) => updateItem(activeProjectId, id, { progress }))
  },
  [activeProjectId, updateItem],
)
```

- [ ] **Step 3: Add `handleBulkDelete` immediately after**

```ts
const handleBulkDelete = useCallback(
  (ids: string[]) => {
    if (!activeProjectId) return
    // Delete deepest items first to avoid cascading double-delete
    const sorted = [...ids].sort((a, b) => {
      const la = items.find((i) => i.id === a)?.level ?? 0
      const lb = items.find((i) => i.id === b)?.level ?? 0
      return lb - la
    })
    sorted.forEach((id) => deleteItem(activeProjectId, id))
  },
  [activeProjectId, items, deleteItem],
)
```

- [ ] **Step 4: Wire the three props to `<WBSVirtualTree>`**

Find the `<WBSVirtualTree ... />` JSX in the `treePanel` block (~line 405). It currently ends with `showSetupChecklist={showSetupChecklist}`. Add three lines after it:

```tsx
<WBSVirtualTree
  ref={virtualTreeRef}
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
  rabCountByWbs={rabCountByWbs}
  onGenerateCodes={handleGenerateCodes}
  activeFilter={activeFilter}
  timelineCountByWbs={timelineCountByWbs}
  showSetupChecklist={showSetupChecklist}
  onUpdateProgress={handleUpdateProgress}
  onBulkUpdateProgress={handleBulkUpdateProgress}
  onBulkDelete={handleBulkDelete}
/>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Full manual test**

Run `npm run dev`. Verify end-to-end:

1. **Inline progress edit:** Hover row → ✎ appears → click → type 60 → Enter → badge shows 60%. Repeat with Esc → no change. Tab to next field → saves.
2. **Multi-select:** Ctrl+click 3 rows → bar shows "3 dipilih". Shift+click row below → extends range. Plain click → clears.
3. **Bulk Set %:** Select 2 rows → "Set %" → type 80 → Enter → both rows show 80%.
4. **Bulk Delete:** Select 2 rows → "Hapus" → rows removed, bar disappears.
5. **No interference:** While inline edit is open, Ctrl+click another row does nothing.

- [ ] **Step 7: Commit**

```bash
git add src/pages/modules/WBS.tsx
git commit -m "feat(wbs): wire handleUpdateProgress, handleBulkUpdateProgress, handleBulkDelete"
```

---

## Final verification

- [ ] **Run type-check one last time**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Run lint**

```bash
npm run lint
```

Expected: warnings ≤ 493 (existing baseline — must not increase).
