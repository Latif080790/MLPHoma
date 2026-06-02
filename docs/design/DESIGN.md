# DESIGN.md — MLPHoma · NATA LABA Construction Suite

## Product Overview

**MLPHoma** is a professional web-based construction project management platform (PWA) built for the Indonesian construction industry. It helps project teams — from project managers to field supervisors — manage the full lifecycle of construction projects: cost planning, scheduling, finance, procurement, and handover.

**Primary users:** Project Manager, Quantity Surveyor (QS), Site Manager, Finance Officer, Procurement Admin, QHSE Officer, Directors.

**Business context:** All monetary values are in Indonesian Rupiah (IDR). The platform follows SNI (Standar Nasional Indonesia) standards for cost analysis (AHSP) and TKDN (local content) regulations.

---

## Design Language

**System name:** MERIDIAN v1.0
**Aesthetic direction:** Obsidian Precision × Indonesian Craft
**Character:** Premium enterprise tool with warmth. Like a Bloomberg terminal designed for Indonesian infrastructure — dark, data-dense, trustworthy, with warm gold accents referencing Indonesian architectural heritage.

**Primary theme:** Dark-first (obsidian dark surfaces with electric cobalt actions and warm gold for all financial data). Light mode uses warm limestone (#F2EFE9) parchment feel.

**Unforgettable element:** Every Indonesian Rupiah value (IDR) is always rendered in warm gold (#FBBF24 dark / #92400E light) using JetBrains Mono — this color rule is never broken, making financial data instantly scannable.

---

## Color Palette

### Dark Mode (primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-page` | `#060910` | Page/body background |
| `bg-surface` | `#0C1220` | Cards, panels |
| `bg-elevated` | `#131C2E` | Modals, drawers |
| `bg-overlay` | `#1A253C` | Dropdowns, popovers |
| `border-subtle` | `#192338` | Subtle dividers |
| `border-default` | `#213047` | Default borders |
| `text-primary` | `#E2EAF5` | Main body text (15.2:1 contrast — AAA) |
| `text-secondary` | `#7A90AB` | Labels, metadata (6.1:1 — AA+) |
| `text-muted` | `#3D5068` | Placeholders, disabled |

### Light Mode (warm limestone)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-page` | `#F2EFE9` | Warm limestone parchment |
| `bg-surface` | `#FDFCF9` | Warm white cards |
| `border-default` | `#CEC8BA` | Warm gray borders |
| `text-primary` | `#1A1814` | Warm near-black |
| `text-secondary` | `#50493E` | Warm gray |

### Accent Colors (adaptive per mode)

| Name | Purpose | Dark | Light |
|------|---------|------|-------|
| **Cobalt Blue** | Primary action, selection, links | `#3B82F6` / `#60A5FA` | `#2563EB` / `#1E40AF` |
| **Warm Gold** | ALL IDR/financial values — mandatory | `#F59E0B` / `#FBBF24` | `#D97706` / `#92400E` |
| **Jade Green** | Success, completed, positive CPI | `#22C55E` / `#4ADE80` | `#16A34A` / `#14532D` |
| **Coral Red** | Danger, error, rejection, overdue | `#F43F5E` / `#FB7185` | `#E11D48` / `#9F1239` |
| **Amber Orange** | Warning, pending, in-progress | `#F97316` / `#FB923C` | `#EA580C` / `#9A3412` |
| **Violet** | Analytics, AI, secondary insight | `#8B5CF6` / `#A78BFA` | `#7C3AED` / `#5B21B6` |
| **Teal** | Realtime, live data, auto-progress | `#14B8A6` / `#2DD4BF` | `#0D9488` / `#134E4A` |

### Background Texture
Page background includes a very subtle blueprint engineering grid:
- Major grid: 80px × 80px at 2.5% opacity
- Minor grid: 16px × 16px at 1% opacity
- Dark mode: cobalt blue lines. Light mode: warm sepia lines.

---

## Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Display/Heading** | Bricolage Grotesque | 600, 700, 800 | Page titles, module headings, KPI labels, navigation |
| **Body/UI** | Nunito Sans | 400, 500, 600, 700 | All body copy, form labels, table content, buttons |
| **Data/Code** | JetBrains Mono | 400, 500, 700 | ALL numbers, IDR values, codes, KPI metrics |

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `text-2xs` | 10px | Micro labels, table headers (uppercase) |
| `text-xs` | 12px | Captions, badges, secondary data |
| `text-sm` | 14px | Body small, sidebar items, form labels |
| `text-base` | 16px | Default body |
| `text-xl` | 20px | Section headings |
| `text-2xl` | 24px | Page headings |
| `text-3xl` | 30px | Module titles |
| `text-4xl–5xl` | 36–48px | KPI numbers, hero values |

### Typography Rules
- All headings ≥24px: Bricolage Grotesque font, letter-spacing -0.025em to -0.038em, variable opsz axis active
- ALL Indonesian Rupiah (IDR) values: JetBrains Mono, tabular figures (tnum), warm gold color — NO EXCEPTIONS
- Table headers: 10px, UPPERCASE, letter-spacing 0.12em, Nunito Sans 800 weight, muted color
- IDR format: `Rp 12.800.000.000` (dot as thousands separator, comma for decimals)
- Percentage: `34,5%` (comma as decimal — Indonesian locale)

---

## Spacing

Base unit: **4px**

| Token | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-12` | 48px |

**Page padding:** 24px horizontal, 16px vertical.
**Card inner padding:** 20px.
**Table cell padding:** 9px vertical × 12px horizontal (default density).

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-xs` | 2px | Progress bars, tiny chips |
| `radius-sm` | 4px | Badges, small buttons |
| `radius-base` | 6px | Inputs, default buttons |
| `radius-md` | 8px | Dropdowns, alerts |
| `radius-lg` | 12px | Cards, panels — **most common** |
| `radius-xl` | 16px | Drawers, side panels |
| `radius-full` | 9999px | Pills, avatars, live badges |

---

## Elevation & Shadows

All shadows use warm-black base in light mode, cold-black in dark mode.

| Level | CSS | Usage |
|-------|-----|-------|
| xs | `0 1px 2px rgba(0,0,0,.5)` | Default cards |
| sm | `0 2px 6px rgba(0,0,0,.4)` | Toolbars |
| md | `0 4px 16px rgba(0,0,0,.5)` | Dropdowns, hover states |
| lg | `0 16px 40px rgba(0,0,0,.6)` | Modals, drawers |

**Glow effects** (contextual, on KPI cards only):
- Cobalt: `0 0 24px rgba(59,130,246,.16)`
- Gold: `0 0 24px rgba(245,158,11,.18)`
- Jade: `0 0 24px rgba(34,197,94,.15)`
- Coral: `0 0 24px rgba(244,63,94,.15)`

---

## Layout Structure

Every page follows this consistent 6-layer hierarchy:

```
L1 — AppHeader (56px)       : Logo | Project name + status | Search | Avatar
L2 — GlobalContextBar (44px): Project code | Pipeline position | Status | Live indicator
L3 — WorkspaceHeader        : Page title (Bricolage Grotesque) | Subtitle | Action buttons (right)
L4 — SummaryStrip           : Horizontal KPI cards (5–6 items) with 1px dividers
L5 — AlertStrip             : Contextual warning banner (conditional)
L6 — ContentArea            : Main content (tree, table, chart, tabs)
```

**Navigation sidebar:** 224px wide, collapsible to 60px. Groups: Overview, Cost Control, Schedule, Operations, Portfolio, System.

---

## Components

### Cards
- Background: surface color
- Border: 1px border-default
- Border-radius: 12px
- **Top accent strip:** 3px solid, colored per card category (mandatory visual signature)
- Hover: `translateY(-2px)` + enhanced shadow
- No rounded corners on table rows — only on card containers

### Status Pills
- Border-radius: full (pill shape)
- Size: 11px Nunito Sans 700 weight
- Always include a 5px colored dot prefix: `●`
- Status → Color mapping:
  - ACTIVE / APPROVED / COMPLETED / PASSED → jade green
  - PENDING / IN PROGRESS → amber orange
  - OVERDUE / REJECTED / FAILED → coral red
  - PLANNING / LINKED → cobalt blue
  - DRAFT / ARCHIVED → muted gray
  - LIVE / AUTO → teal
  - AI / ANALYTICS → violet

### KPI Cards (Command Center)
- 8-card grid (2 rows × 4 columns)
- Each card: surface bg + 3px colored top border + KPI value in JetBrains Mono large + subtitle + trend indicator
- Financial KPI values: always warm gold
- Positive KPI (CPI≥1, SPI≥1): jade green
- Warning KPI (0.85–0.99): amber
- Negative KPI (<0.85): coral
- "LIVE" badge: teal background + pulsing dot

### Data Tables
- Header: 10px uppercase, JetBrains Mono or Nunito Sans 800, muted color, sticky
- Rows: default height 38px, alternating subtle stripe
- All financial cells: right-aligned, JetBrains Mono, gold color
- Row hover: bg-hover background
- Sort indicator: cobalt accent
- Density variants: compact (30px), default (38px), comfortable (50px)

### WBS Tree
- Level 1: code in cobalt pill, name Bricolage Grotesque 700, slightly larger row
- Level 2: code in muted gray pill, name 600 weight
- Level 3: code no background, name smaller 500 weight, muted color
- Children indented by 20px per level with 1.5px border-left connector
- Drag handle: visible on hover only
- Action buttons (Add/Edit/Delete): visible on hover only, right side
- Selected row: cobalt background rgba(8%), cobalt border

### WBS Badges (on tree rows, right side)
- `Auto`: teal — progress auto-propagated from Timeline
- `Locked`: amber — physical progress locked, manual input required
- Budget amount: gold — RAB budget linked
- QC Passed: jade — quality control passed
- QC Pending: amber — quality control in progress

### Toolbar
- Background: elevated surface
- Border: 1px border-default, border-radius 10px
- Shadow: shadow-xs
- Contains: search input | filter dropdowns | separator | action buttons | primary CTA button (rightmost, cobalt)

### Buttons
- **Primary:** cobalt background, white text, border-radius 7px
- **Ghost:** transparent, secondary text color, hover → bg-hover
- **Outline:** transparent + border, hover → bg-hover
- **Destructive:** coral background (only in delete confirmations)
- All buttons: Nunito Sans 700, 12px, padding 6px × 12px

### Form Controls
- Input background: elevated surface
- Border: 1px border-default → cobalt on focus
- Focus ring: `0 0 0 3px rgba(cobalt, 0.15)` + 1.5px cobalt border
- Error state: coral border + coral glow
- Label: 10px uppercase, Nunito Sans 800, muted color

---

## Interaction Patterns

### CRUD Pattern
1. List view (table or tree)
2. Click "Add" → Dialog/Drawer with form
3. Save → Toast notification + list refresh
4. Click item → Select/highlight
5. Edit → Dialog with prefilled form
6. Delete → AlertDialog confirmation (always — no silent deletes)

### Drag & Drop (WBS reorder)
- Dragging item: 40% opacity + scale(1.02) + large shadow
- Drop zone: 2px dashed cobalt border + cobalt bg (5% opacity)
- Valid drop: jade green border variant

### Inline Edit (table cells)
- Hover: subtle bg + 1px border
- Active/editing: cobalt border 1.5px + cobalt glow shadow
- Confirm: small [✓] [✗] buttons appear below

### Delete Confirmation Dialog
- Always an AlertDialog (never auto-delete)
- Shows: item name, count of child items affected
- Shows: related linked records that will be unlinked (Timeline tasks, etc.)
- Amber warning box for cascade effects
- Two buttons: [Batal] outline | [Hapus Semua] coral

### Empty States
- Centered icon in colored box (cobalt bg for default)
- Short Indonesian title (bold)
- Brief description (muted)
- Single primary CTA button

### Loading States
- Skeleton shimmer: gradient from bg-elevated to bg-overlay, 1.6s animation
- Spinner: 18px, cobalt top arc, 0.7s rotation
- Always shown instead of blank space

### Toast Notifications (Sonner)
- Success: jade green ✓
- Error: coral red ✕
- Warning: amber ⚠
- Info: cobalt ℹ
- Position: bottom-right
- Auto-dismiss: 4 seconds

---

## Data & Content Rules

### Indonesian Language
- All UI text in Bahasa Indonesia
- Action buttons: "Tambah", "Simpan", "Batal", "Hapus", "Edit"
- Status labels: "Aktif", "Selesai", "Tertunda", "Ditolak", "Draft"
- Keep technical terms: "WBS", "RAB", "RAP", "AHSP", "CPI", "SPI", "TKDN"

### Real Data (use in designs — not lorem ipsum)
- **Project:** CMPLNG VILLAGE · PRJ-2026-0019
- **Budget:** Rp 12.800.000.000
- **RAB:** Rp 4.966.572.640 (39% dari budget)
- **Actual Spent:** Rp 1.847.293.150 (14,4%)
- **CPI:** 1.12 (efficient — jade green)
- **SPI:** 0.87 (slight delay — amber)
- **Progress:** 34,5% (vs target 38,2%)
- **Timeline:** Hari ke-45 dari 180 hari
- **EAC:** Rp 11.400.000.000 (VAC: +Rp 1.400.000.000)
- **Approval pending:** 7 (3 overdue, 4 dalam SLA)

### WBS Items
```
1  Pekerjaan Persiapan       | Budget: Rp 450.000.000 | QC: PASSED
   1.1  Mobilisasi           | 100% | Auto | QC: PASSED
   1.2  Pembersihan Lahan    | 100% | Auto | QC: PASSED
2  Pekerjaan Sipil           | Budget: Rp 3.800.000.000 | QC: PENDING
   2.1  Pondasi              | 85%  | Auto
     2.1.1  Galian Tanah     | 100% | QC: PASSED
     2.1.2  Pengecoran Beton | 70%  | LOCKED
   2.2  Struktur Atas        | 32%  | Auto | Budget: Rp 2.100.000.000
3  MEP                       | Budget: Rp 716.000.000 | QC: PENDING | 0%
```

---

## Accessibility

- **WCAG target:** AA minimum, AAA for financial data
- All body text: ≥4.5:1 contrast ratio
- IDR values: ≥7:1 contrast ratio (critical data)
- Focus ring: 4px solid cobalt (#3B82F6), 2px offset
- All interactive elements: minimum 44px touch target
- Screen readers: aria-live regions for dynamic updates
- Keyboard navigation: full support (Tab, Enter, Escape, Arrow keys)
- Drag & drop: keyboard alternative always available

---

## Device Priority

| Module | Priority | Optimal Width |
|--------|----------|---------------|
| Command Center | Desktop-first | 1280px |
| Project Costing (WBS, RAB, RAP) | Desktop-first | 1440px |
| Schedule / Gantt | Desktop-first | 1440px+ |
| Finance | Desktop-first | 1280px |
| Supply Chain | Desktop-first | 1280px |
| Field Tasks | **Mobile-first** | 375px |
| QHSE / Documents / Handover | Tablet-friendly | 768px+ |
| Settings | Tablet-friendly | 768px+ |

---

## Pipeline / Workflow

The core workflow is a 5-step costing pipeline (shown as a stepper component):

```
Step 1: AHSP  →  Step 2: WBS  →  Step 3: RAB  →  Step 4: RAP  →  Step 5: Resource
(cost rates)     (hierarchy)     (budget)         (execution)      (planning)
```

Each step builds on the previous. WBS items link to RAB items. RAB items link to AHSP rates. Timeline tasks link to WBS nodes.

---

## Brand Identity

- **Company name:** NATA LABA
- **Product name:** MLPHoma
- **Logo color:** `#F97316` (orange) — appears in sidebar header only
- **Brand tagline:** "CONSTRUCTION SUITE"
- **Project status badge colors:** Active=jade, Planning=cobalt, Completed=jade muted, Archived=gray

---

*DESIGN.md v1.0 — MLPHoma MERIDIAN System — Juni 2026*
*Fonts: Bricolage Grotesque · Nunito Sans · JetBrains Mono*
*Stack: React 18 · TypeScript · Tailwind CSS · shadcn/ui · Supabase*
