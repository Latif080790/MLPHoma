# MLPHoma Frontend Implementation Guide v1.0

## 1. Tujuan
Dokumen ini menerjemahkan seluruh standar UI/UX MLPHoma ke acuan implementasi frontend yang siap dipakai tim engineering.

Dokumen ini melengkapi:
- MLPHoma Design System Rules v1.0
- MLPHoma Component Specification v1.0
- MLPHoma Design Token Rules v1.0
- MLPHoma Module-by-Module Application Guide v1.0

Dokumen ini fokus pada:
- arsitektur frontend
- struktur folder
- reusable UI primitives
- reusable domain composites
- aturan props dan naming
- layout primitives
- state patterns
- data-table architecture
- inspector/drawer architecture
- responsive implementation rules
- form and validation rules
- loading/error/empty state patterns
- accessibility and QA handoff

---

## 2. Prinsip Implementasi Frontend

### 2.1 Build System, Not Screens
Frontend tidak boleh dibangun sebagai kumpulan halaman terpisah. Semua layar harus disusun dari primitives, shared patterns, dan domain composites yang reusable.

### 2.2 Separate Structure from Domain
Pisahkan:
- layout structure
- design system primitives
- shared business composites
- domain-specific modules

### 2.3 One Source of Truth
Semua warna, spacing, radius, typography, density, dan states harus berasal dari design tokens. Jangan hardcode style di komponen produksi.

### 2.4 Predictable Composition
Setiap modul harus disusun dari pola komposisi yang sama agar cepat dikembangkan, direview, dan dipelihara.

---

## 3. Tech Stack Direction

## 3.1 Recommended Core Stack
- React
- TypeScript
- Tailwind CSS
- shadcn/ui sebagai baseline UI primitives
- TanStack Table untuk grid
- TanStack Virtual untuk virtualization bila perlu
- React Hook Form untuk forms
- Zod untuk validation schema
- Zustand atau store domain yang sudah ada untuk state global/domain
- Recharts untuk chart internal yang standard
- Framer Motion secukupnya untuk motion penting

## 3.2 Why This Stack
- cepat untuk membangun enterprise UI
- cukup fleksibel untuk data-heavy modules
- mudah distandardisasi
- cocok untuk pattern sidebar, drawer, table, inspector, toolbar, dan forms

---

## 4. Arsitektur Folder yang Direkomendasikan

## 4.1 High-Level Structure
```text
src/
  app/
  components/
    ui/
    patterns/
    layouts/
    modules/
  features/
  hooks/
  lib/
  stores/
  services/
  types/
  config/
  styles/
```

## 4.2 Detailed Structure
```text
src/
  app/
    routes/
    providers/
    app-shell/

  components/
    ui/
      button/
      input/
      select/
      tabs/
      badge/
      card/
      drawer/
      dialog/
      tooltip/
      table/
      skeleton/
      toast/

    patterns/
      context-bar/
      workspace-header/
      summary-strip/
      smart-toolbar/
      alert-strip/
      empty-state/
      inspector-drawer/
      bulk-action-bar/
      saved-view-switcher/
      status-pill/
      mode-switch/
      stepper/

    layouts/
      page-shell/
      split-layout/
      three-panel-layout/
      chart-ledger-layout/
      review-layout/

    modules/
      costing/
      finance/
      supply/
      documents/
      schedule/
      field/

  features/
    project-costing/
      ahsp/
      wbs/
      rab/
      rap/
      resource-plan/
    finance/
    supply-chain/
    documents/
    change-management/
    field-tasks/
    project-overview/
    command-center/

  hooks/
    use-density.ts
    use-saved-view.ts
    use-breakpoint.ts
    use-inspector.ts
    use-selection.ts
    use-persisted-filters.ts

  lib/
    utils/
    formatters/
    table/
    accessibility/
    tokens/

  stores/
    ui/
    domain/

  services/
    api/
    adapters/

  types/
    ui/
    domain/

  config/
    navigation/
    permissions/
    density/
    columns/

  styles/
    globals.css
    tokens.css
```

---

## 5. Layering Rules

## 5.1 UI Primitives Layer
`components/ui`

Berisi komponen atomik atau semi-atomik yang tidak tahu domain bisnis.
Contoh:
- Button
- Input
- Select
- Badge
- Drawer
- Dialog
- Tabs
- TableShell

## 5.2 Pattern Layer
`components/patterns`

Berisi pola reusable yang sudah punya struktur enterprise UI.
Contoh:
- GlobalContextBar
- WorkspaceHeader
- SummaryStrip
- SmartToolbar
- AlertStrip
- InspectorDrawer
- BulkActionBar
- EmptyState
- Stepper

## 5.3 Layout Layer
`components/layouts`

Berisi skeleton tata letak.
Contoh:
- PageShell
- SplitLayout
- ThreePanelLayout
- ChartLedgerLayout
- ReviewLayout

## 5.4 Domain Composite Layer
`components/modules`

Berisi komponen reusable lintas layar dalam domain tertentu.
Contoh:
- CostingSummaryStrip
- RABCommandStrip
- SupplyExceptionPanel
- FinanceExposureStrip
- DocumentPreviewPanel

## 5.5 Feature Layer
`features/*`

Berisi implementasi halaman/modul yang memakai primitives + patterns + layouts + domain composites.

---

## 6. Naming Convention

## 6.1 Component Naming
Gunakan PascalCase.

Contoh benar:
- GlobalContextBar
- CostingWorkflowStepper
- RABCommandStrip
- ResourceLedgerTable
- InspectorDrawer

## 6.2 Hook Naming
Gunakan `useXxx`.

Contoh:
- useDensity
- useInspector
- useSelection
- useSavedView
- usePersistedFilters

## 6.3 Prop Naming
Gunakan nama eksplisit.

Benar:
- `isReadOnly`
- `isLoading`
- `status`
- `density`
- `selectedIds`
- `onRowClick`
- `onOpenInspector`

Hindari:
- `mode2`
- `flag`
- `dataX`
- `variant2`

## 6.4 Variant Naming
Standard variants:
- `primary`
- `secondary`
- `ghost`
- `destructive`
- `compact`
- `default`
- `comfortable`
- `warning`
- `success`
- `info`
- `locked`

---

## 7. Design Token Implementation Rules

## 7.1 Token Source of Truth
Token harus di-mapping ke:
- CSS variables
- Tailwind theme extension
- component aliases bila perlu

## 7.2 Example Structure
```text
styles/
  tokens.css
lib/
  tokens/
    colors.ts
    spacing.ts
    radius.ts
    motion.ts
```

## 7.3 CSS Variable Direction
Contoh:
```css
:root {
  --color-surface-page: ...;
  --color-surface-panel: ...;
  --color-text-primary: ...;
  --color-status-success-bg: ...;
  --space-4: 16px;
  --radius-lg: 16px;
}
```

## 7.4 Tailwind Mapping
Expose token ke Tailwind config agar class utilities tetap konsisten.

Contoh konsep:
- `bg-surface-panel`
- `text-text-primary`
- `border-border-default`
- `rounded-lg-token`

---

## 8. Layout Primitives yang Wajib Dibangun

## 8.1 PageShell
### Tujuan
Wrapper standar satu halaman modul.

### Props minimum
- `contextBar`
- `header`
- `summary`
- `toolbar`
- `children`
- `inspector`

### Behavior
- menyusun layer secara konsisten
- mendukung sticky region bila diperlukan

## 8.2 SplitLayout
### Tujuan
Dua panel utama.

### Pakai untuk
- chart + ledger
- list + detail
- timeline + inspector summary

## 8.3 ThreePanelLayout
### Tujuan
Tiga panel utama.

### Pakai untuk
- WBS tree + workspace + inspector
- documents list + preview + metadata

## 8.4 ReviewLayout
### Tujuan
Layout tenang untuk summary/review mode atau owner mode.

---

## 9. Shared Pattern Components yang Wajib Dibangun

## 9.1 GlobalContextBar
### Props
- `projectName`
- `packageName`
- `versionLabel`
- `syncStatus`
- `healthItems`
- `actions`

### Rules
- jangan isi terlalu banyak teks
- tetap satu baris di desktop, wrap terkontrol di tablet

## 9.2 WorkspaceHeader
### Props
- `title`
- `subtitle`
- `primaryAction`
- `secondaryActions`
- `overflowActions`

## 9.3 SummaryStrip
### Props
- `items`
- `variant`
- `density`

### Variants
- metrics
- chips
- compact-cards

## 9.4 SmartToolbar
### Props
- `search`
- `filters`
- `savedViews`
- `densityControl`
- `columnControl`
- `groupControl`
- `actions`

### Rules
- toolbar harus bisa collapse dengan baik di tablet
- search dan filter utama selalu di kiri

## 9.5 AlertStrip
### Props
- `severity`
- `message`
- `actions`
- `dismissible`

## 9.6 InspectorDrawer
### Props
- `open`
- `onOpenChange`
- `title`
- `tabs`
- `footerActions`

### Rules
- preserve selected row context
- jangan digunakan untuk flow create panjang

## 9.7 BulkActionBar
### Props
- `selectedCount`
- `actions`
- `onClear`

## 9.8 EmptyState
### Props
- `title`
- `description`
- `primaryAction`
- `secondaryAction`
- `icon`

---

## 10. Table Architecture Standard

## 10.1 Base Table Stack
Gunakan arsitektur bertingkat:
- TableShell
- TableHeader
- TableToolbarHook
- TableSelectionHook
- ColumnDefinitions
- RowActions
- InspectorLinking

## 10.2 Recommended Shared Utilities
- `createColumnHelper`
- `buildStatusColumn`
- `buildCurrencyColumn`
- `buildDateColumn`
- `buildActionsColumn`
- `buildSelectionColumn`

## 10.3 Standard Table Features by Module Type
### Dense Operational Tables
- sorting
- filtering
- saved views
- selection
- bulk actions
- column visibility
- sticky header
- optional virtualization

### Planning / Ledger Tables
- grouping
- subtotal/footer
- compare indicators
- status highlighting

## 10.4 Density Implementation
Densities should map to row height tokens:
- compact
- default
- comfortable

Jangan bikin per table manual tanpa shared density logic.

---

## 11. Inspector Architecture Standard

## 11.1 Inspector State
Gunakan satu pola state baku:
- closed
- open with selected item
- pinned optional
- tab preserved optional

## 11.2 Shared Hook
Buat hook seperti:
- `useInspector<T>()`

Minimal capability:
- selected item id
- selected item data
- open/close
- active tab
- replace selection without close

## 11.3 Inspector Content Composition
```text
InspectorDrawer
  InspectorHeader
  InspectorMeta
  InspectorTabs
    DetailsTab
    LinksTab
    HistoryTab
    NotesTab
  InspectorFooterActions
```

---

## 12. Form Architecture Standard

## 12.1 Form Stack
- React Hook Form
- Zod schema
- shared field wrappers
- consistent error messages

## 12.2 Required Shared Components
- FormSection
- FormFieldWrapper
- InlineErrorMessage
- StickySaveBar
- FormActions

## 12.3 Form Rules
- label di atas
- helper text singkat
- validation inline
- destructive action dipisah
- save state selalu jelas

## 12.4 Unsaved Changes Handling
Gunakan satu mekanisme baku untuk edit-heavy modules:
- track dirty state
- tampilkan StickySaveBar
- confirm before navigation bila perlu

---

## 13. State Management Rules

## 13.1 What Goes to Global UI Store
- sidebar collapse state
- density preference
- active project context bila global
- inspector states yang cross-route jika memang dibutuhkan
- theme/ui preferences

## 13.2 What Stays Local
- simple form state
- local modal state
- temporary filters yang tidak perlu persistence global

## 13.3 What Goes to Domain Store
- selected domain objects
- data fetching cache aliasing bila store-based
- optimistic updates
- sync queue state

## 13.4 Persisted Preferences
Persist per user:
- density
- saved views
- visible columns
- last active mode per module
- last used filters bila relevan

---

## 14. Routing Rules

## 14.1 Route Structure
Gunakan nested route yang sesuai domain.

Contoh:
```text
/project-costing
/project-costing/ahsp
/project-costing/wbs
/project-costing/rab
/project-costing/rap
/project-costing/resource-plan
```

## 14.2 Deep Linking
Halaman penting harus bisa deep-linked ke state penting.
Contoh:
- selected view
- active tab
- filters utama
- compare mode
- item id optional

## 14.3 Route-Level Loading
Gunakan skeleton page, bukan blank screen.

---

## 15. Responsive Implementation Rules

## 15.1 Breakpoint Behavior
- desktop planning dari lg ke atas
- tablet di md
- mobile di bawah md

## 15.2 Sidebar
- desktop: persistent collapsible
- tablet: drawer
- mobile: compact navigation or alternate nav strategy

## 15.3 Inspector
- desktop: right drawer
- tablet: slide-over
- mobile: full-screen sheet atau bottom sheet tergantung kasus

## 15.4 Tables
- desktop: full columns + pinned columns
- tablet: reduced columns + horizontal scroll jika perlu
- mobile: card transformation atau review-only mode

## 15.5 Toolbars
- desktop: single-row ideal
- tablet: two-row acceptable
- mobile: move advanced tools into filter sheet / overflow menu

---

## 16. Accessibility Implementation Rules

## 16.1 Required
- keyboard navigation for interactive elements
- visible focus ring
- semantic HTML where possible
- aria labels untuk icon-only buttons
- status tidak hanya warna
- contrast sesuai standar internal

## 16.2 Table Accessibility
- header associations jelas
- row actions keyboard reachable
- selection state terbaca screen reader bila memungkinkan

## 16.3 Dialog and Drawer Accessibility
- focus trap
- escape to close bila aman
- restore focus on close

---

## 17. Loading, Error, and Empty State Rules

## 17.1 Loading States
Bangun shared states:
- PageSkeleton
- SummaryStripSkeleton
- TableSkeleton
- InspectorSkeleton
- ChartSkeleton

## 17.2 Error States
Bangun shared patterns:
- InlineErrorState
- PageErrorState
- RetryAction
- EmptyDueToFilterState

## 17.3 Empty States
Pisahkan:
- no data yet
- no results from filters
- permission restricted
- disconnected / sync issue

---

## 18. Recommended Implementation per Module

## 18.1 Costing Modules
Shared components:
- CostingContextBar
- CostingWorkflowStepper
- CostingSummaryStrip
- CostingToolbar
- CostingInspector

Submodule composites:
- AHSPTable
- WBSTreeNavigator
- RABGrid
- RAPControlGrid
- ResourcePlanningChart
- ResourceLedgerTable

## 18.2 Finance Modules
Shared components:
- FinanceExposureStrip
- FinanceAlertStrip
- FinanceViewSwitcher
- APTable
- ARTable
- MatchingTable
- CashflowChart

## 18.3 Supply Modules
Shared components:
- SupplySummaryStrip
- SupplyModeSwitcher
- MRTable
- POTable
- InventoryTable
- TraceDrawer
- SupplyExceptionsStrip

## 18.4 Documents Modules
Shared components:
- DocumentsModeSwitch
- DocumentsToolbar
- DocumentList
- DocumentPreviewPanel
- DocumentInspector
- ReviewActionBar

## 18.5 Field Modules
Shared components:
- MobileContextStrip
- TaskCard
- EvidenceCaptureSheet
- OfflineQueueIndicator
- QuickProgressSelector
- IssueEscalationAction

---

## 19. QA and Code Review Checklist for Frontend

### 19.1 Composition
- halaman dibangun dari shared patterns, bukan custom layout liar
- token dipakai konsisten
- komponen reusable tidak diduplikasi tanpa alasan

### 19.2 Interaction
- primary CTA jelas
- utility tidak mendominasi
- selection states bekerja
- inspector preserve context
- unsaved changes state bekerja

### 19.3 Responsive
- desktop/tablet/mobile punya perilaku tepat
- table fallback jelas
- toolbar tidak rusak di breakpoint menengah

### 19.4 Performance
- gunakan virtualization bila rows besar
- hindari render berat pada seluruh halaman saat selection berubah
- split components by responsibility
- memoization secukupnya pada grid/chart berat

### 19.5 Accessibility
- focus states jelas
- button icon-only punya label
- dialogs/drawers aksesibel

---

## 20. Recommended Delivery Sequence

### Phase 1 — Foundation
- token implementation
- ui primitives hardening
- app shell cleanup
- page shell
- global context bar
- workspace header
- summary strip
- smart toolbar
- inspector drawer

### Phase 2 — High-Impact Domains
- project costing suite
- finance overview + ops tables
- supply exceptions + trace flow
- documents repository/control/review patterns

### Phase 3 — Advanced Domain UX
- schedule plan/track/analyze
- change management impact story
- field tasks mobile-first flows
- owner review modes

---

## 21. Definition of Done for Frontend UI Module
Sebuah modul hanya dianggap selesai bila:
- memakai shared layout/pattern yang benar
- token sudah konsisten
- status semantics benar
- desktop/tablet/mobile behavior benar
- loading/error/empty states lengkap
- inspector or detail pattern tersedia
- accessibility baseline terpenuhi
- QA checklist lulus
- tidak ada hardcoded styling yang menyalahi token system

---

## 22. Penutup
Frontend Implementation Guide ini menjadi jembatan terakhir dari sistem desain ke implementasi nyata. Dengan acuan ini, tim frontend dapat membangun MLPHoma sebagai platform enterprise yang konsisten, scalable, dan maintainable, bukan sekadar kumpulan halaman yang terlihat mirip tetapi dibangun dengan pola berbeda-beda.

