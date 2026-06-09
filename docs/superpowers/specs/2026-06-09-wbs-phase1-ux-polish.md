# WBS Phase 1 — UX Polish & Interaction Design

**Goal:** Improve the WBS module's visual polish, keyboard productivity, cross-module navigation CTAs, and KPI filter feedback — 7 independent improvements, no new data models required.

**Architecture:** All changes are UI-only within existing components. No store changes, no new routes, no new DB queries. Estimated ~1 working day.

**Tech Stack:** React, Tailwind CSS, MERIDIAN design tokens, `@tanstack/react-virtual`

---

## Items in Scope

### A — Hint Text: "Ctrl+Z" → Icon Tooltip

**File:** `src/components/wbs/WBSVirtualTree.tsx`

**Current:** A `<div>` with text "Ctrl+Z untuk undo pindah/hapus" renders above the virtual list at 7px, always visible, taking ~14px of row space.

**New behaviour:** Replace with a small keyboard icon `⌨` in the top-right corner of the tree container (absolute positioned). On hover, show a tooltip "Ctrl+Z: undo pindah/hapus". No layout space consumed.

**Spec:**
- Element: `<span>` absolute top-1 right-2, `opacity-40 hover:opacity-100 transition-opacity`
- Content: `⌨ ↩` at `fontSize: 9` style, `color: var(--text-muted)`
- Tooltip: native `title` attribute is sufficient — no custom tooltip component needed
- Remove the existing `<div className="text-[7px] px-2 py-0.5 ...">` block entirely

---

### C — Setup Checklist Panel (sparse-state onboarding)

**File:** `src/components/wbs/WBSVirtualTree.tsx` (new conditional block above the virtual list)

**Trigger condition:** Show when ALL of these are true:
1. `rows.length > 0` (items exist, not true empty state)
2. Every row has `rabCount === 0` (no RAB linked anywhere)
3. Every row has `weightedProgress === 0` (no progress anywhere)

**New behaviour:** A dismissable panel just below the toolbar/hint area, showing a vertical checklist of setup steps:

| Step | Done when | Action |
|------|-----------|--------|
| ✓ Item WBS dibuat | `rows.length > 0` | — |
| ○ Generate kode WBS | any item has non-empty `code` | Call `onGenerateCodes()` button |
| ○ Hubungkan RAB | any `rabCount > 0` | Navigate label (no navigation needed, just informational) |
| ○ Isi progress pertama | any `weightedProgress > 0` | Informational |

**Spec:**
- Panel: `mx-2 mb-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-2`
- Title: `"Setup WBS Proyek"` at `text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]`
- Each step row: `flex items-center gap-2 py-1` with icon (jade ✓ / amber !) and label
- Dismiss button: `×` top-right, stores dismissed state in local component state (`useState<boolean>`)
- New prop needed: `onGenerateCodes?: () => void` passed from `WBS.tsx` (already available in parent)

---

### D — CTA "Buka RAB" & "Buka Timeline" in Overview Tab

**File:** `src/components/wbs/WBSDetailPanel.tsx` — inside `OverviewTab`

**Trigger:** CTA buttons appear only when the respective count is 0.

**New behaviour in `OverviewTab`:**

```
Budget RAB Terhubung section:
  if budgetLinked === 0:
    → show "Belum ada RAB terhubung" (existing)
    → NEW: <button> "⚡ Buka RAB — link item ini" 
      calls onNavigateToRab prop (if provided)

Timeline Tasks section:
  if timelineDisplay === 0:
    → show "Tidak ada" (existing)
    → NEW: <button> "📅 Buka Timeline"
      calls onNavigateToTimeline prop (if provided)
```

**New props on `WBSDetailPanelProps`:**
```ts
onNavigateToRab?: (wbsId: string) => void
onNavigateToTimeline?: (wbsId: string) => void
```

**Styling:**
- RAB CTA: `border border-[hsl(var(--amber-500)/0.4)] bg-[hsl(var(--amber-500)/0.06)] text-[hsl(var(--amber-500))] text-[8px] font-bold px-2 py-1.5 rounded-md w-full flex items-center gap-2 mt-2`
- Timeline CTA: same pattern but cobalt color tokens
- Both buttons: only render when the respective prop is provided (prop-gated so embedded vs standalone behave the same if props not wired)

**Wire-up in `WBS.tsx`:** Both props call `router.push` or tab switch. The exact navigation depends on how the costing pipeline tab switching works. For now, use `toast.info("Buka tab RAB untuk menghubungkan item ini")` as a fallback if routing not wired.

---

### E — Detail Panel Header: Clean Level Indicator

**File:** `src/components/wbs/WBSDetailPanel.tsx` — header section in main component (lines ~520–545)

**Current:** `<GitBranch size={10} /> {item.code || '—'}` + `"Level {item.level ?? 1}"`

**New behaviour:** Remove `GitBranch` icon. Separate into two clean badges:
- Level badge: `L{level}` — small cobalt pill, e.g. `L1`, `L2`, `L3`
- Code badge: WBS code string — same cobalt mono badge style

**Spec:**
```tsx
<div className="mb-1 flex items-center gap-1.5">
  {/* Level pill */}
  <span style={{
    background: 'hsl(var(--cobalt-400) / 0.12)',
    color: 'hsl(var(--cobalt-400))',
    fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
  }}>
    L{item.level ?? 1}
  </span>
  {/* Code badge */}
  <span className="font-mono" style={{
    background: 'hsl(var(--cobalt-400) / 0.12)',
    color: 'hsl(var(--cobalt-400))',
    fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
  }}>
    {item.code || '—'}
  </span>
</div>
```

Remove the `GitBranch` import if no longer used elsewhere in the file.

---

### F — Minimap: Adaptive Bar Height for Sparse Item Sets

**File:** `src/components/wbs/WBSMiniMap.tsx`

**Current constants:**
```ts
const BAR_HEIGHT = 4
const MIN_BAR_HEIGHT = 6
```

**New behaviour:** When `total <= 10`, increase bar height and gap so the minimap doesn't look empty:

```ts
const isSparse = total <= 10
const BAR_H = isSparse ? 7 : 4
const BAR_GAP = isSparse ? 2 : 1
const MIN_H = isSparse ? 8 : MIN_BAR_HEIGHT
```

**Viewport indicator:** Add `minHeight: '15%'` to the viewport indicator div's `style` so it never collapses to a hairline with few items.

**No-items state:** When `allRows.length === 0`, render a centered muted text "—" inside the bars area instead of the empty div.

---

### G — Keyboard Navigation in Tree

**File:** `src/components/wbs/WBSVirtualTree.tsx`

**Current state:** The tree container already has `tabIndex={0}`. The only keyboard handler is Ctrl+Z for undo. 

**New keydown bindings** (added to the existing `keydown` handler):

| Key | Action |
|-----|--------|
| `ArrowDown` | Select next visible row (wraps at bottom) |
| `ArrowUp` | Select previous visible row (wraps at top) |
| `ArrowRight` | If collapsed + hasChildren → expand; else move to first child |
| `ArrowLeft` | If expanded → collapse; else move to parent |
| `Enter` | Call `onSelect(item)` for focused row |
| `n` (no modifier) | Call `onAddChild(focusedItem.id)` |
| `e` (no modifier) | Call `onEdit(focusedItem)` |
| `Delete` / `Backspace` | Call `onDelete(focusedItem)` |

**New state:** `const [focusedIndex, setFocusedIndex] = useState<number | null>(null)`

**Behaviour:**
- `focusedIndex` tracks the keyboard-focused row (separate from `selectedId` which is click-selected)
- When `focusedIndex` changes, call `virtualizer.scrollToIndex(focusedIndex)` to ensure the row is visible
- Focused row gets a subtle ring: `ring-1 ring-[hsl(var(--cobalt-400)/0.4)]` (different from the amber selected ring)
- `focusedIndex` initializes to the index of `selectedId` when selection changes via click

**New props needed:** None — uses existing `onSelect`, `onToggleExpand`, `onAddChild`, `onEdit`, `onDelete`.

---

### H — KPI Filter: Dim Non-Matching Rows in Tree

**File:** `src/components/wbs/WBSVirtualTree.tsx`

**Current behaviour:** `flattenVisibleRows()` filters rows based on `activeFilter` — non-matching rows are excluded from the flat list entirely.

**New behaviour:** Non-matching rows remain in the list but are visually dimmed. This gives context of where matching items sit in the tree hierarchy.

**Implementation approach:**

Option: Change `flattenVisibleRows` to return ALL visible rows (ignoring filter), and let the tree apply `opacity-30` to non-matching rows. The filter prop `activeFilter` is passed to the tree.

New props on `WBSVirtualTreeProps`:
```ts
activeFilter: KPIFilter                      // new — imported from '../../types/wbs'
rabCountByWbs: Map<string, number>           // already exists
timelineCountByWbs: Map<string, number>      // new — needed for 'timeline-linked' filter match
```

Row matching logic (inline in render):
```ts
function rowMatchesFilter(row: WBSFlatRow, filter: KPIFilter, rabCount: number): boolean {
  if (!filter) return true
  switch (filter) {
    case 'rab-unlinked': return rabCount === 0
    case 'qc-passed': return row.item.qc_status === 'PASSED'
    case 'low-progress': return row.weightedProgress < 30
    case 'timeline-linked': return (timelineCountByWbs.get(row.item.id) ?? 0) > 0
    default: return true
  }
}
```

Row div: add `opacity-30` class when `activeFilter && !rowMatchesFilter(...)`.

**Note:** `flattenVisibleRows` in `wbsCalculations.ts` still needs to return all rows (remove filter exclusion logic), not dim — the dimming is purely visual in the tree renderer. The KPI strip still shows correct counts from the full item list.

**WBS.tsx:** Pass `activeFilter` to `WBSVirtualTree`. Update `flatRows` derivation to NOT filter by `activeFilter` (pass `null` instead of `activeFilter` to `flattenVisibleRows`).

---

## Out of Scope (Phase 2)

- **B** — Inline progress edit (click % badge → number input in row)
- **I** — Multi-select / bulk operations (shift+click, bulk delete/progress/move)

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/components/wbs/WBSVirtualTree.tsx` | A (hint icon), C (setup checklist), G (keyboard nav), H (dim filter) |
| `src/components/wbs/WBSDetailPanel.tsx` | D (RAB/Timeline CTAs), E (header cleanup) |
| `src/components/wbs/WBSMiniMap.tsx` | F (adaptive bar height) |
| `src/pages/modules/WBS.tsx` | C (wire onGenerateCodes), D (wire nav props), H (pass activeFilter + timelineCountByWbs, update flatRows) |
| `src/lib/wbsCalculations.ts` | H (remove filter from flattenVisibleRows, or add new variant) |
