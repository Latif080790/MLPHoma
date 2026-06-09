# WBS Phase 2 — Inline Progress Edit & Multi-select Bulk Operations

**Date:** 2026-06-10  
**Status:** Approved  
**Scope:** Two additive UX features for `WBSVirtualTree`. No new files. No changes to `wbsCalculations.ts` or `src/types/wbs.ts`.

---

## Overview

Phase 2 adds two interaction patterns to the WBS tree:

- **B — Inline Progress Edit:** Edit a row's progress percentage directly in the tree row via a hover pencil icon, without opening any dialog.
- **I — Multi-select + Bulk Operations:** Select multiple rows with Shift+click / Ctrl+click, then apply bulk actions (set progress, delete) via a floating bar at the bottom of the tree.

Both features are independent. They share no state and do not interfere with each other.

---

## Feature B: Inline Progress Edit

### Interaction

1. User hovers a row → amber pencil icon ✎ appears to the right of the `%` badge.
2. User clicks ✎ → the `%` badge is replaced by a number input, auto-focused, pre-filled with current progress value.
3. User types a value (0–100):
   - **Enter** or **blur** → clamp value to [0, 100], call `onUpdateProgress(id, value)`, exit edit mode.
   - **Esc** → exit edit mode without saving.
4. Clicking ✎ on another row while one is being edited → the blur on the first input fires first (saves), then the second opens.

### State

```ts
// Inside WBSVirtualTree
const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
```

### Row Render (progress area)

```tsx
const isEditing = editingProgressId === row.item.id
const isHovered = hoveredRowId === row.item.id

{isEditing ? (
  <span className="flex items-center gap-0.5">
    <input
      type="number" min={0} max={100}
      defaultValue={row.item.progress ?? 0}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmProgressEdit(e.currentTarget)
        if (e.key === 'Escape') setEditingProgressId(null)
      }}
      onBlur={(e) => confirmProgressEdit(e.currentTarget)}
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
  <span className="flex items-center gap-1">
    <span className={progressBadgeClass}>{row.item.progress ?? 0}%</span>
    {isHovered && (
      <button
        onClick={(e) => { e.stopPropagation(); setEditingProgressId(row.item.id) }}
        className="border-0 bg-transparent p-0 leading-none"
        style={{ color: 'hsl(var(--amber-500))', fontSize: 11, opacity: 0.75 }}
        tabIndex={-1}
        aria-label="Edit progress"
      >✎</button>
    )}
  </span>
)}
```

### confirmProgressEdit helper

```ts
function confirmProgressEdit(input: HTMLInputElement) {
  const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
  onUpdateProgress?.(editingProgressId!, val)
  setEditingProgressId(null)
}
```

### New prop on WBSVirtualTree

```ts
onUpdateProgress?: (id: string, progress: number) => void
```

### Handler in WBS.tsx

```ts
const handleUpdateProgress = useCallback(
  (id: string, progress: number) => {
    updateWBSItem(id, { progress })
  },
  [updateWBSItem],
)
// Pass to <WBSVirtualTree onUpdateProgress={handleUpdateProgress} />
```

### Edge cases

| Case | Behaviour |
|------|-----------|
| Value < 0 | Clamped to 0 |
| Value > 100 | Clamped to 100 |
| Non-numeric input | Treated as 0 |
| Click ✎ while another row is editing | Blur fires first (saves), then new row opens |
| `onEdit` (full dialog) via `···` menu | Still accessible, no conflict |

---

## Feature I: Multi-select + Bulk Operations

### Interaction

| Gesture | Effect |
|---------|--------|
| Shift+click row | Range-select from `anchorIdx` to clicked row |
| Ctrl+click (or Cmd+click) row | Toggle single row in bulk selection |
| Plain click row | Clear bulk selection, proceed as normal single-select |
| Click ✕ in bulk bar | Clear bulk selection |

When `bulkSelectedIds.size > 0`:
- Rows in the set are highlighted (cobalt tint + ring).
- Floating bulk action bar appears at the bottom of the tree (slide-up animation).
- If bulk bar is visible and user triggers Feature B (✎ click), the pencil edit still works on its target row.

### State

```ts
// Inside WBSVirtualTree
const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
const [showProgressPopover, setShowProgressPopover] = useState(false)
const anchorIdxRef = useRef<number | null>(null)
const popoverInputRef = useRef<HTMLInputElement>(null)
```

### Click handler

```ts
function handleRowClick(e: React.MouseEvent, row: WBSFlatRow, idx: number) {
  // Do not interfere while inline-editing progress
  if (editingProgressId !== null) return

  if (e.shiftKey && anchorIdxRef.current !== null) {
    const lo = Math.min(anchorIdxRef.current, idx)
    const hi = Math.max(anchorIdxRef.current, idx)
    setBulkSelectedIds(new Set(rows.slice(lo, hi + 1).map(r => r.item.id)))
    return
  }
  if (e.ctrlKey || e.metaKey) {
    anchorIdxRef.current = idx
    setBulkSelectedIds(prev => {
      const next = new Set(prev)
      next.has(row.item.id) ? next.delete(row.item.id) : next.add(row.item.id)
      return next
    })
    return
  }
  // Plain click — clear bulk, single select
  anchorIdxRef.current = idx
  setBulkSelectedIds(new Set())
  cbRef.current.onSelect(row.item.id)
}
```

**Note:** The existing keyboard navigation handler (arrow keys, Enter, n/e/Delete from Phase 1) remains unchanged. Arrow key movement does not clear bulk selection — user can still navigate while keeping a selection.

### Row visual highlight

Add to the row's className computation:

```ts
const isBulkSelected = bulkSelectedIds.has(row.item.id)

// in className array:
isBulkSelected && 'ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.35)] bg-[hsl(var(--cobalt-400)/0.10)]'
```

### Bulk Action Bar JSX

Rendered **below** the virtualizer container div, inside the same wrapper:

```tsx
{bulkSelectedIds.size > 0 && (
  <div className="relative">
    {/* Progress Popover */}
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
          type="number" min={0} max={100}
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
          onClick={() => confirmBulkProgress(popoverInputRef.current!)}
          className="rounded px-2 py-px text-[9px] text-white"
          style={{ background: 'hsl(var(--cobalt-400))' }}
        >✓</button>
      </div>
    )}

    {/* Bulk Bar */}
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
        onClick={() => setShowProgressPopover(p => !p)}
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
        onClick={() => { setBulkSelectedIds(new Set()); setShowProgressPopover(false) }}
        className="border-0 bg-transparent text-[12px] leading-none"
        style={{ color: 'hsl(var(--text-muted))' }}
      >✕</button>
    </div>
  </div>
)}
```

### confirmBulkProgress helper

```ts
function confirmBulkProgress(input: HTMLInputElement) {
  const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
  onBulkUpdateProgress?.(Array.from(bulkSelectedIds), val)
  setBulkSelectedIds(new Set())
  setShowProgressPopover(false)
}
```

### New props on WBSVirtualTree

```ts
onBulkUpdateProgress?: (ids: string[], progress: number) => void
onBulkDelete?: (ids: string[]) => void
```

### Handlers in WBS.tsx

```ts
const handleBulkUpdateProgress = useCallback(
  (ids: string[], progress: number) => {
    ids.forEach(id => updateWBSItem(id, { progress }))
  },
  [updateWBSItem],
)

const handleBulkDelete = useCallback(
  (ids: string[]) => {
    ids.forEach(id => deleteWBSItem(id))
  },
  [deleteWBSItem],
)
// Pass to <WBSVirtualTree
//   onBulkUpdateProgress={handleBulkUpdateProgress}
//   onBulkDelete={handleBulkDelete}
// />
```

### Edge cases

| Case | Behaviour |
|------|-----------|
| Shift+click before any anchor set | Treat as plain click, set anchor |
| Ctrl+click deselects last item | `bulkSelectedIds` becomes empty → bar disappears |
| Bulk delete with parent+child both selected | `deleteWBSItem` handles cascading; call for each id top-down (sort by level desc) to avoid double-delete errors |
| Inline progress edit active while bulk visible | Clicking ✎ on a row still works; bulk bar remains |
| `--red-*` token not in MERIDIAN | Use hardcoded `hsl(0 70% 55%)` / `hsl(0 70% 65%)` for delete button |
| Keyboard nav while bulk active | Arrow keys navigate without clearing selection |

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/components/wbs/WBSVirtualTree.tsx` | State: `editingProgressId`, `hoveredRowId`, `bulkSelectedIds`, `showProgressPopover`, `anchorIdxRef`, `popoverInputRef`. Props: `onUpdateProgress`, `onBulkUpdateProgress`, `onBulkDelete`. Row render: pencil icon, inline input, bulk highlight. Bulk bar + popover JSX below virtualizer. |
| `src/pages/modules/WBS.tsx` | Handlers: `handleUpdateProgress`, `handleBulkUpdateProgress`, `handleBulkDelete`. Wire to `<WBSVirtualTree>`. |

---

## Out of Scope

- Ctrl+A (select all) — not in Phase 2
- Bulk move / indent operations — deferred
- Bulk status / QC update — deferred
- Animation on bulk bar appear/disappear — implement if time allows, not required
