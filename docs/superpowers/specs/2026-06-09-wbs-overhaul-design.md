# WBS Overhaul Design Spec

**Goal:** Eliminate bottlenecks in the WBS module for 200+ item projects by replacing recursive rendering with a virtualized flat-list tree, adding weighted progress rollup, an in-module mini-map navigator, and a bulk creation flow — while tightening the link between WBS nodes and RAB/Timeline data.

**Date:** 2026-06-09

---

## 1. Problem Statement

The current WBS module has three categories of bottlenecks that interact:

**Workflow bottleneck:** No bulk item creation. Building a 200-item WBS node by node is prohibitively slow. Users must create each item individually then restructure via drag-drop.

**Data flow bottleneck:** Budget rollup only maps direct `wbsId` from RAB items — parent nodes do not aggregate children. Progress uses simple average (`Σ progress / n`) rather than budget-weighted rollup, producing misleading metrics.

**Performance bottleneck:** `WBSTree.tsx` uses recursive component rendering (`WBSTreeItem` calls itself). With 200+ items this produces hundreds of DOM nodes simultaneously. The HTML5 drag-drop indicator appears at the bottom of the entire list rather than at the target row — a known unfixed bug.

---

## 2. Scope

### In scope
- Virtualized flat-list renderer (replaces recursive WBSTreeItem)
- Mini-map navigator panel (60–68px, inside WBS workspace)
- Weighted progress rollup (`Σ(progress × budget) / Σbudget`)
- Recursive budget aggregation to parent nodes
- Corrected drag-drop with 3 distinct visual modes
- Undo for move/delete operations (1 level, Ctrl+Z)
- Bulk paste creation (textarea, Tab = indent, Enter = new item, preview before import)
- KPI strip with clickable filter cells
- Table View toggle (for fast review mode)
- Tabbed detail panel (Overview / RAB / Timeline / +Child)
- Toolbar redesign: 2 groups (nav-left, actions-right)

### Out of scope
- Multi-level undo (> 1 step)
- Gantt / timeline visualization within WBS
- AI-assisted WBS generation
- Export to external formats
- Real-time multi-user collaboration

---

## 3. Layout

### App shell context

The App Sidebar (navigation: Command Center, Projects, Cost Control, etc.) is **not modified**. It remains fixed at the left edge of the application across all modules. The WBS workspace occupies the main content area to the right of the App Sidebar.

```
┌──────────────┬────────────────────────────────────────────────────────┐
│  App Sidebar │  Project header bar                                     │
│   (200px)    ├────────────────────────────────────────────────────────┤
│  UNCHANGED   │  Module tabs: Dashboard · Pipeline · AHSP · WBS · ...   │
│              ├────────────────────────────────────────────────────────┤
│              │  Budget summary strip (project-level)                   │
│              ├────────────────────────────────────────────────────────┤
│              │  ┌ WBS KPI strip (6 clickable cells) ──────────────┐   │
│              │  ├ WBS Toolbar (2-group) ──────────────────────────┤   │
│              │  │                                                  │   │
│              │  │  MiniMap │  Virtualized Tree  │  Detail Panel   │   │
│              │  │  60–68px │     flex: 1        │    200px        │   │
│              │  │          │                    │                 │   │
│              │  └──────────────────────────────────────────────────┘   │
└──────────────┴────────────────────────────────────────────────────────┘
```

### WBS workspace panels (left to right)

| Panel | Width | Purpose |
|---|---|---|
| Mini-map | 60–68px | Structural overview + viewport indicator |
| Virtualized tree | flex: 1 | Main interaction surface |
| Detail panel | 200px | Selected node editing + RAB/Timeline links |

---

## 4. Component Breakdown

### 4.1 KPI Strip

Six clickable cells rendered above the toolbar. Each cell acts as a toggle filter on the tree when clicked: active state shows an orange bottom border (2px) and a filled indicator dot (●). Clicking active cell clears the filter.

| Cell | Value | Token |
|---|---|---|
| Total Item | count | `var(--cobalt-400)` (#60A5FA) |
| Budget RAB ↕ | recursive sum | `var(--text-idr)` (#FBBF24 dark / #CA8A04 light) |
| Progress | weighted % with subtitle "Σ(p×b)/Σb" | `var(--wbs-progress-mid)` (#2DD4BF) |
| QC Passed | `passed / total` | `var(--wbs-progress-high)` (#22C55E) |
| RAB Unlinked | count of nodes with no RAB link | `var(--wbs-progress-low)` (#FB923C) |
| Timeline Linked | count of nodes with ≥1 timeline task | `var(--text-secondary)` |

### 4.2 Toolbar

Two flex groups separated by `flex: 1` spacer:

**Nav-left group:** Search input (150px) · Level filter dropdown · Expand All button · Collapse All button

**Actions-right group:** ⚙ Tools ▾ dropdown (bulk delete, import, export) · `+ Root Item` (orange/primary) · Tree ↔ Table toggle (segmented control)

### 4.3 Mini-map

- 60–68px wide, fixed left inside workspace
- Renders one 2px horizontal bar per WBS node, colored by node status:
  - Jade: progress ≥ 80%
  - Cyan: progress 30–79%
  - Amber: progress < 30% and has budget
  - Orange: root node (level 1)
  - Slate: no budget linked
- Viewport indicator: translucent amber-bordered rectangle showing which portion of the tree is currently visible
- Click anywhere on mini-map → tree scrolls to that position
- No label text in mini-map; pure structural visualization

### 4.4 Virtualized Flat-List Tree

Replaces recursive `WBSTreeItem` component. Approach: maintain a sorted flat array of visible rows derived from the tree state. Only rows within `scrollTop ± overscan` are rendered into the DOM.

**Row height:** 28px fixed (required for virtualization offset math)

**Row anatomy (left to right):**
- Indent spacer: `level × 16px` padding-left
- Expand/collapse arrow (▶/▼) for parent nodes; `—` placeholder for leaves
- WBS code badge: `font-mono`, Cobalt background tint
- Item name: truncated, flex-1
- Budget rollup value (Gold, monospace, `↕` suffix for nodes that aggregate children)
- Progress bar: 28px wide, 2px tall, colored Jade/Cyan/Amber by threshold
- Progress % badge

**Selection:** Single click selects row and opens detail panel. Ctrl+click multi-select (for bulk delete).

**Drag-drop — 3 modes:**

| Mode | Trigger | Visual |
|---|---|---|
| Before | Drop target = top 25% of row | Cobalt (60A5FA) 2px horizontal line above row |
| After | Drop target = bottom 25% of row | Cobalt 2px line below row |
| Inside (child) | Drop target = middle 50% of row | Amber (FB923C) dashed 1px border around entire row |

Only one mode is active at a time. Mode is determined by `dragY` position relative to target row bounds.

### 4.5 Undo (Core, Not Enhancement)

Undo is required for move and delete operations.

- Minimum 1-level undo via Ctrl+Z
- Scope: move operations (drag-drop reorder/reparent) and node delete
- Implementation: before each mutation, snapshot the affected subtree to a `lastAction` ref in the store
- `Ctrl+Z` handler in the tree container restores the snapshot
- Visual feedback: brief amber flash on restored node(s)
- No undo for edit (name/description changes) in v1

### 4.6 Tabbed Detail Panel

Sticky header showing WBS code + node name. Four tabs:

**Overview tab:**
- Progress input (0–100 slider + number field)
- Budget RAB display (read-only, summed from linked RAB items)
- Notes / description textarea
- QC status toggle

**RAB tab:**
- List of directly linked RAB items (name, budget amount)
- Unlink action per item
- `+ Hubungkan RAB item...` search-link input

**Timeline tab:**
- List of linked Gantt/schedule tasks
- `+ Link task...` input

**+Child tab:**
- Quick name input to append a child node without leaving the panel
- Submits on Enter

### 4.7 Bulk Paste Creation (Core, Not Enhancement)

Entry point: **⚙ Tools ▾ → Buat Massal** or keyboard shortcut `Shift+N`.

Opens a floating overlay panel containing:
- Textarea with placeholder:
  ```
  Ketik nama item, tekan Enter untuk baris baru.
  Tab = satu level lebih dalam.
  Shift+Tab = naik satu level.
  ```
- Live preview: as user types, a mini tree preview renders below the textarea showing the parsed hierarchy
- **Import** button: parses textarea into WBS nodes and appends them to the tree (under selected parent, or as root if nothing selected)
- **Cancel** button

Parsing rules:
- Each line = one node
- Leading tabs determine level (0 tabs = level relative to insertion point)
- Empty lines are ignored
- Duplicate names at the same level are allowed (no guard — codes are auto-generated)

Auto-generated codes: sequential within parent, e.g. if parent is `2.3`, new children are `2.3.1`, `2.3.2`, etc.

### 4.8 Table View Toggle

When active, replaces the 3-panel layout (mini-map + tree + detail) with a flat indented table:

| Column | Content |
|---|---|
| WBS | Code badge + indented name |
| Budget | Gold, recursive rollup |
| Progress | Mini bar + % |
| QC | Pass/fail badge |
| RAB | Count of linked items |
| Timeline | Count of linked tasks |

Table is read-only for reviewing and reporting. Clicking a row in table mode does not open the detail panel — use Tree mode for editing.

---

## 5. Data Layer

### 5.1 Weighted Progress Rollup

Replace `avgProgress = Σprogress / n` in `WBS.tsx` with:

```
weightedProgress(node) =
  if node has no children:
    return node.progress
  else:
    Σ(childBudget × weightedProgress(child)) / Σ(childBudget)
    where childBudget = recursiveBudget(child)
    fallback: if Σ(childBudget) === 0, use simple average
```

Computed in `wbsStore.ts` as a derived selector, not recalculated per render.

### 5.2 Recursive Budget Aggregation

Current: `budgetByWbs` maps only direct `wbsId` from RAB items. Replace with recursive accumulation:

```
recursiveBudget(node) =
  Σ(direct RAB items where wbsId === node.id)
  + Σ(recursiveBudget(child) for each child)
```

The `↕` symbol in the tree and KPI strip indicates a budget value that includes aggregated children.

### 5.3 Store Changes (`wbsStore.ts`)

- Add `lastAction: WBSSnapshot | null` to store state (for undo)
- Add `undoLastAction()` action
- Add `flattenedVisibleRows: WBSFlatRow[]` derived state (for virtualized renderer)
- Add `activeFilter: KPIFilter | null` state (for KPI strip clicks)
- Expose `recursiveBudget(nodeId)` and `weightedProgress(nodeId)` as selectors

No new external dependencies. No migration required.

---

## 6. Color Token Reference (MERIDIAN v1.1 — Zinc Surface)

All WBS components use CSS variables from `src/styles/design-tokens-meridian.css`. **No hardcoded hex in component code.**

| CSS Variable | Dark value | Light value | Use in WBS |
|---|---|---|---|
| `var(--bg-page)` | `#0C0C0E` | `#F8FAFC` | Page / tree container background |
| `var(--bg-surface)` | `#121215` | `#ffffff` | Cards, panels, detail panel |
| `var(--border-default)` | `#222225` | `#E2E8F0` | Row borders, dividers |
| `var(--text-primary)` | `#E2EAF5` | `#0F172A` | Item names (depth 0), labels |
| `var(--text-secondary)` | `#94A3B8` | `#475569` | Item names (depth 1+), metadata |
| `var(--text-idr)` | `#FBBF24` | `#CA8A04` | All IDR budget values, budget column, budget badges |
| `hsl(var(--amber-500))` | `#F97316` | same | Root nodes (mini-map), primary action button, active indicator |
| `hsl(var(--cobalt-400))` | `#60A5FA` | → cobalt-700 | WBS code badge, links, drag-drop before/after line |
| `var(--wbs-progress-high)` / jade-500 | `#22C55E` | `#16A34A` | Progress ≥ 80%, QC passed, mini-map complete bar |
| `var(--wbs-progress-mid)` / teal-300 | `#2DD4BF` | same | Progress 30–79%, mini-map active bar |
| `var(--wbs-progress-low)` / amber-400 | `#FB923C` | `#B45309` | Progress < 30%, unlinked RAB warning, drag-drop inside-border |
| `var(--status-danger-fg)` | `#FB7185` | `#DC2626` | Errors, critical alerts (not used in WBS v1) |
| `var(--status-ai-fg)` | — | — | AI/analytics only (not used in WBS v1) |

**Do not use:** emerald (`#10b981`), indigo, red, or raw Tailwind color classes that are not in the MERIDIAN token set. Do not hardcode hex values in component JSX — always reference the CSS variable.

**Surface note:** Dark surfaces now use zinc-neutral (obsidian scale v1.1). The visual output: `#0C0C0E` page bg, `#121215` surface, `#222225` borders — removing the previous blue-navy cast for a cleaner enterprise look.

---

## 7. Constraints and Non-Goals

- No new npm dependencies. Use existing Recharts (already installed), Zustand, and Radix UI primitives.
- No changes to the App Sidebar, module tab system, or project header bar.
- No changes to the RAB or AHSP modules.
- Table View is read-only in v1.
- Undo depth is 1 level minimum (not full undo stack).
- Mini-map does not support expand/collapse interactions — click only navigates.
- Bulk paste does not support RAB or Timeline linking at creation time (link after creation).

---

## 8. Success Criteria

1. A tree with 200+ items renders without visible jank during scroll (target: <16ms frame time)
2. Weighted progress rollup values visibly differ from the simple average in projects with uneven budget distribution
3. Parent nodes display aggregate budget (Gold, `↕` suffix) that sums to the project total
4. Drag-drop indicator appears adjacent to the target row, not at the bottom of the list
5. Ctrl+Z restores the tree to its state before the last move or delete
6. Bulk paste of 20 items (3 levels deep) completes in under 2 seconds and produces correct codes
7. KPI strip filter click visibly narrows the tree to only matching nodes
8. No TypeScript compilation errors introduced
