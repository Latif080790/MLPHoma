# MLPHoma Component Inventory Matrix & Sprint Implementation Roadmap v1.0

## 1. Tujuan Dokumen
Dokumen ini menjadi jembatan antara dokumen strategis dan eksekusi sprint. Tujuannya adalah:
- memetakan komponen yang reusable
- membedakan komponen global, shared pattern, domain composite, dan module-specific
- menentukan prioritas implementasi
- menyusun roadmap sprint yang realistis
- membantu product, design, frontend, dan QA bekerja pada backlog yang sama

Dokumen ini melengkapi:
- MLPHoma Design System Rules v1.0
- MLPHoma Component Specification v1.0
- MLPHoma Design Token Rules v1.0
- MLPHoma Module-by-Module Application Guide v1.0
- MLPHoma Frontend Implementation Guide v1.0
- MLPHoma Strategic Product & UX Transformation Blueprint v1.0

---

## 2. Cara Membaca Matrix
Setiap item komponen dinilai berdasarkan:
- **Layer**: Foundation / Pattern / Layout / Domain Composite / Module-Specific
- **Priority**: P0 / P1 / P2 / P3
- **Reuse Scope**: Global / Multi-domain / Single-domain / Single-module
- **Complexity**: S / M / L / XL
- **Owner**: Design System / Frontend Platform / Domain Squad
- **Target Sprint**: sprint implementasi awal

### Definisi Priority
- **P0**: fondasi wajib. Tanpa ini, transformasi tidak bisa berjalan rapi
- **P1**: komponen berdampak tinggi dan dipakai luas
- **P2**: komponen penting untuk domain tertentu
- **P3**: komponen lanjutan atau refinement

### Definisi Complexity
- **S**: kecil, cepat dibuat, minim dependency
- **M**: sedang, butuh integrasi ringan
- **L**: besar, butuh beberapa state/variant
- **XL**: sangat besar, multi-flow, berdampak lintas modul

---

## 3. Layering Inventory

## 3.1 Foundation Layer
Komponen paling dasar yang menjadi fondasi semua UI.

| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| Button | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | Primary, secondary, ghost, destructive |
| Input | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | Text, search, compact, error states |
| Numeric Input | Foundation | Global | P0 | M | Frontend Platform | Sprint 1 | Currency, quantity, percentage |
| Select / Combobox | Foundation | Global | P0 | M | Frontend Platform | Sprint 1 | Searchable option lists |
| Badge / Status Pill | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | Status semantic standard |
| Tabs / Segmented Switch | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | View and mode switching |
| Drawer | Foundation | Global | P0 | M | Frontend Platform | Sprint 1 | Inspector/drawer basis |
| Dialog | Foundation | Global | P0 | M | Frontend Platform | Sprint 1 | Create and confirm flows |
| Tooltip | Foundation | Global | P1 | S | Frontend Platform | Sprint 1 | Dense enterprise tables |
| Skeleton | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | Table/card/inspector/page states |
| Toast | Foundation | Global | P1 | S | Frontend Platform | Sprint 1 | Success/error feedback |
| Checkbox / Selection | Foundation | Global | P0 | S | Frontend Platform | Sprint 1 | Table selection and forms |
| Switch / Toggle | Foundation | Global | P1 | S | Frontend Platform | Sprint 1 | Mode toggles |
| Date Picker | Foundation | Global | P1 | M | Frontend Platform | Sprint 2 | Need-by, due date, range filters |
| Textarea | Foundation | Global | P1 | S | Frontend Platform | Sprint 1 | Notes, approvals, comments |

---

## 3.2 Pattern Layer
Pola reusable enterprise UI yang dipakai hampir di semua modul.

| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| GlobalContextBar | Pattern | Global | P0 | M | Design System + FE Platform | Sprint 1 | Project/version/health/sync |
| WorkspaceHeader | Pattern | Global | P0 | S | Design System + FE Platform | Sprint 1 | Title, subtitle, CTA hierarchy |
| SummaryStrip | Pattern | Global | P0 | M | Design System + FE Platform | Sprint 1 | Metrics/chips/mini cards |
| SmartToolbar | Pattern | Global | P0 | L | FE Platform | Sprint 1-2 | Search, filters, views, density |
| AlertStrip | Pattern | Global | P0 | S | FE Platform | Sprint 1 | Locked, sync failed, warnings |
| EmptyState | Pattern | Global | P0 | S | FE Platform | Sprint 1 | No data, no results, restricted |
| InspectorDrawer | Pattern | Global | P0 | L | FE Platform | Sprint 2 | Details, links, history, notes |
| BulkActionBar | Pattern | Global | P1 | M | FE Platform | Sprint 2 | Selection-driven actions |
| SavedViewSwitcher | Pattern | Global | P1 | M | FE Platform | Sprint 2 | Persisted table views |
| StatusLegendStrip | Pattern | Multi-domain | P2 | S | Design System | Sprint 4 | Optional for complex modules |
| ModeSwitch | Pattern | Multi-domain | P0 | S | FE Platform | Sprint 1 | Executive/Operations, Plan/Track/Analyze |
| WorkflowStepper | Pattern | Multi-domain | P1 | M | FE Platform | Sprint 2 | Costing and approval flows |
| StickySaveBar | Pattern | Multi-domain | P1 | M | FE Platform | Sprint 2 | Dirty state modules |
| FilterSheet | Pattern | Multi-domain | P1 | M | FE Platform | Sprint 3 | Tablet/mobile advanced filters |
| ComparePanel | Pattern | Multi-domain | P2 | M | FE Platform | Sprint 5 | Baseline vs draft comparisons |

---

## 3.3 Layout Layer
Skeleton tata letak yang dipakai ulang lintas domain.

| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| AppShell | Layout | Global | P0 | XL | FE Platform | Sprint 1-2 | Sidebar, header, context slots |
| PageShell | Layout | Global | P0 | L | FE Platform | Sprint 1 | Standard page anatomy wrapper |
| SplitLayout | Layout | Multi-domain | P1 | M | FE Platform | Sprint 2 | List + detail, chart + ledger |
| ThreePanelLayout | Layout | Multi-domain | P1 | L | FE Platform | Sprint 2 | WBS, documents, control workflows |
| ReviewLayout | Layout | Multi-domain | P1 | M | FE Platform | Sprint 3 | Owner mode / approval mode |
| ChartLedgerLayout | Layout | Multi-domain | P2 | M | FE Platform | Sprint 4 | Resource, cashflow, analytics |
| MobileOpsLayout | Layout | Field modules | P1 | M | FE Platform | Sprint 5 | Task feed + sticky CTA |

---

## 3.4 Data Surface Layer
Reusable engines untuk work surface berat.

| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| TableShell | Shared Data Surface | Global | P0 | L | FE Platform | Sprint 2 | Generic data grid shell |
| TableSelectionEngine | Shared Data Surface | Global | P0 | M | FE Platform | Sprint 2 | Bulk select logic |
| TableDensityEngine | Shared Data Surface | Global | P0 | S | FE Platform | Sprint 2 | Compact/default/comfortable |
| TableColumnVisibility | Shared Data Surface | Global | P1 | M | FE Platform | Sprint 2 | Show/hide columns |
| TableGroupingEngine | Shared Data Surface | Multi-domain | P1 | L | FE Platform | Sprint 3 | Group by WBS/class/category |
| VirtualizedTableAdapter | Shared Data Surface | Multi-domain | P1 | L | FE Platform | Sprint 3 | Large dataset optimization |
| TreeNavigatorShell | Shared Data Surface | Multi-domain | P1 | L | FE Platform | Sprint 3 | Hierarchy display |
| ChartShell | Shared Data Surface | Multi-domain | P1 | M | FE Platform | Sprint 3 | Consistent chart wrappers |
| TimelineShell | Shared Data Surface | Multi-domain | P2 | XL | Domain Squad + FE Platform | Sprint 6 | Schedule-heavy modules |
| BoardShell | Shared Data Surface | Multi-domain | P2 | L | FE Platform | Sprint 6 | Workflow modules |

---

## 3.5 Domain Composite Layer
Reusable component domain-level yang dipakai lintas submodul dalam satu domain.

### Costing Domain
| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| CostingContextBar | Domain Composite | Costing suite | P0 | M | Costing Squad | Sprint 3 | Specialization of GlobalContextBar |
| CostingWorkflowStepper | Domain Composite | Costing suite | P0 | M | Costing Squad | Sprint 3 | AHSP → WBS → RAB → RAP → Resource |
| CostingSummaryStrip | Domain Composite | Costing suite | P0 | M | Costing Squad | Sprint 3 | Shared costing metrics |
| AHSPTable | Domain Composite | Costing suite | P1 | L | Costing Squad | Sprint 4 | Catalog grid |
| WBSTreeWorkspace | Domain Composite | Costing suite | P1 | XL | Costing Squad | Sprint 4-5 | Tree + node workspace + inspector |
| RABCommandStrip | Domain Composite | Costing suite | P1 | M | Costing Squad | Sprint 4 | Budget builder header |
| RABGrid | Domain Composite | Costing suite | P1 | XL | Costing Squad | Sprint 4-5 | Dense editable cost grid |
| RAPHealthStrip | Domain Composite | Costing suite | P2 | M | Costing Squad | Sprint 5 | Budget control indicators |
| RAPControlGrid | Domain Composite | Costing suite | P2 | XL | Costing Squad | Sprint 5-6 | Committed/actual/remaining |
| ResourcePlanningChart | Domain Composite | Costing suite | P2 | L | Costing Squad | Sprint 6 | Demand/supply planning |
| ResourceLedgerTable | Domain Composite | Costing suite | P2 | L | Costing Squad | Sprint 6 | Resource ledger |

### Finance Domain
| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| FinanceExposureStrip | Domain Composite | Finance | P1 | M | Finance Squad | Sprint 6 | Exposure / overdue / cashflow |
| FinanceModeSwitch | Domain Composite | Finance | P1 | S | Finance Squad | Sprint 6 | PM / Owner / Ops start states |
| APTable | Domain Composite | Finance | P1 | L | Finance Squad | Sprint 7 | Accounts payable |
| ARTable | Domain Composite | Finance | P1 | L | Finance Squad | Sprint 7 | Accounts receivable |
| MatchingTable | Domain Composite | Finance | P2 | XL | Finance Squad | Sprint 8 | 3-way match |
| CashflowChart | Domain Composite | Finance | P1 | M | Finance Squad | Sprint 7 | Drill-down capable |

### Supply Chain Domain
| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| SupplySummaryStrip | Domain Composite | Supply | P1 | M | Supply Squad | Sprint 7 | Requests/PO/stock health |
| SupplyModeSwitch | Domain Composite | Supply | P1 | S | Supply Squad | Sprint 7 | Procurement / Warehouse / Exceptions |
| MRTable | Domain Composite | Supply | P1 | L | Supply Squad | Sprint 8 | Material requests |
| POTable | Domain Composite | Supply | P1 | L | Supply Squad | Sprint 8 | Purchase orders |
| InventoryTable | Domain Composite | Supply | P2 | L | Supply Squad | Sprint 9 | Stock/warehouse |
| TraceDrawer | Domain Composite | Supply | P1 | L | Supply Squad | Sprint 8 | PO → GRN → status trace |
| SupplyExceptionsStrip | Domain Composite | Supply | P1 | M | Supply Squad | Sprint 8 | Late, low stock, blocked |

### Documents Domain
| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| DocumentsModeSwitch | Domain Composite | Documents | P1 | S | Documents Squad | Sprint 8 | Repository / Control / Review |
| DocumentsToolbar | Domain Composite | Documents | P1 | M | Documents Squad | Sprint 8 | Search, filters, category, status |
| DocumentList | Domain Composite | Documents | P1 | L | Documents Squad | Sprint 8 | List/grid data surface |
| DocumentPreviewPanel | Domain Composite | Documents | P1 | L | Documents Squad | Sprint 9 | Preview area |
| DocumentInspector | Domain Composite | Documents | P2 | L | Documents Squad | Sprint 9 | Metadata, version, notes |
| ReviewActionBar | Domain Composite | Documents | P2 | M | Documents Squad | Sprint 9 | Approve/reject/review |

### Field / Mobile Domain
| Component | Layer | Reuse Scope | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---:|---|---|---|
| MobileContextStrip | Domain Composite | Field | P2 | S | Field Squad | Sprint 9 | Project + sync + task status |
| TaskCard | Domain Composite | Field | P2 | M | Field Squad | Sprint 9 | Feed-first surface |
| EvidenceCaptureSheet | Domain Composite | Field | P2 | L | Field Squad | Sprint 10 | Photo/GPS/progress flow |
| OfflineQueueIndicator | Domain Composite | Field | P2 | M | Field Squad | Sprint 10 | Outbox and retry state |
| QuickProgressSelector | Domain Composite | Field | P2 | S | Field Squad | Sprint 10 | 10/25/50/75/100 shortcuts |
| IssueEscalationAction | Domain Composite | Field | P2 | M | Field Squad | Sprint 10 | Escalate blockers quickly |

---

## 3.6 Module-Specific Layer
Komponen yang hanya hidup di satu modul dan tidak perlu dipaksa reusable dulu.

| Component | Module | Priority | Complexity | Owner | Target Sprint | Notes |
|---|---|---:|---:|---|---|---|
| CommandCenterExecutiveWidgets | Command Center | P1 | L | Command Center Squad | Sprint 4 | Curated executive cards |
| CommandCenterOperationsQueue | Command Center | P1 | L | Command Center Squad | Sprint 4 | Exception queue |
| ProjectOverviewMilestonePanel | Project Overview | P1 | M | Overview Squad | Sprint 4 | Milestones and blockers |
| ProjectOverviewRiskPanel | Project Overview | P1 | M | Overview Squad | Sprint 4 | Risk summary |
| ChangeImpactStoryPanel | Change Management | P2 | L | Governance Squad | Sprint 9 | Before/after impact story |
| PortfolioRiskRanking | Portfolio | P2 | M | Portfolio Squad | Sprint 10 | Strategic ranking |
| OwnerApprovalDigest | Owner Mode | P2 | M | Governance Squad | Sprint 10 | Review-centric panel |

---

## 4. Component Reuse Map

## 4.1 Reuse Tier A — Dipakai hampir di semua modul
- GlobalContextBar
n- WorkspaceHeader
- SummaryStrip
- SmartToolbar
- AlertStrip
- EmptyState
- InspectorDrawer
- PageShell
- ModeSwitch
- Badge / Status Pill
- Button / Input / Select / Drawer / Dialog / Skeleton

## 4.2 Reuse Tier B — Dipakai lintas beberapa domain
- WorkflowStepper
- BulkActionBar
- SavedViewSwitcher
- SplitLayout
- ThreePanelLayout
- ReviewLayout
- TableShell
- TreeNavigatorShell
- ChartShell

## 4.3 Reuse Tier C — Dipakai dalam satu domain suite
- CostingContextBar
- RABGrid
- APTable
- POTable
- DocumentPreviewPanel
- EvidenceCaptureSheet

## 4.4 Reuse Tier D — Module-specific
- CommandCenterExecutiveWidgets
- ProjectOverviewRiskPanel
- ChangeImpactStoryPanel

Prinsip penting:
Komponen Tier D tidak boleh langsung dibuat reusable tanpa bukti penggunaan lintas modul. Sebaliknya, komponen Tier A dan B harus dibangun lebih dulu dan dijaga kualitasnya paling ketat.

---

## 5. Sprint Strategy Overview

### Sprint Philosophy
Roadmap ini memakai prinsip:
1. build foundation first
2. unlock highest-visibility modules early
3. avoid big-bang refactor
4. land reusable patterns before domain depth
5. transform user-facing flagship flows lebih dulu

### Sprint Duration Assumption
- 1 sprint = 2 minggu
- team structure minimal:
  - 1 FE Platform lead
  - 1–2 frontend engineers platform/shared
  - 1 product designer / design system owner
  - 1 QA representative
  - domain engineers per squad sesuai kapasitas

---

## 6. Sprint Implementation Roadmap

## Sprint 1 — Foundation Setup
### Objectives
- finalisasi token foundation
- bangun primitives inti
- siapkan page anatomy dasar

### Scope
**Design System / FE Platform**
- token implementation base
- Button
- Input
- Numeric Input
- Select / Combobox
- Badge / Status Pill
- Tabs / Segmented Switch
- Skeleton
- Checkbox
- Textarea
- AppShell cleanup direction
- PageShell v1
- WorkspaceHeader v1
- SummaryStrip v1
- AlertStrip v1

### Deliverables
- foundation tokens usable in code
- shared primitives library v1
- page shell basic standard

### Exit Criteria
- primitives dipakai di playground/story/demo
- tokens tidak lagi hardcoded di komponen fondasi
- shell skeleton siap dipakai modul tier-1

---

## Sprint 2 — Core Shared Patterns
### Objectives
- membangun pattern global yang mengunci consistency
- menyiapkan data-heavy behavior standar

### Scope
**FE Platform**
- GlobalContextBar
- SmartToolbar v1
- Drawer foundation
- InspectorDrawer v1
- BulkActionBar v1
- StickySaveBar v1
- TableShell v1
- TableSelectionEngine
- TableDensityEngine
- Column visibility controls
- SplitLayout
- ThreePanelLayout
- WorkflowStepper v1

### Deliverables
- shared patterns siap dipakai module squads
- table architecture v1 siap implementasi

### Exit Criteria
- minimal 1 demo page dengan context bar + toolbar + table + inspector berjalan
- selection dan density state berjalan
- workflow stepper reusable selesai

---

## Sprint 3 — Shell Consolidation + Costing Base
### Objectives
- refactor shell global
- mulai transform domain paling strategis: Project Costing

### Scope
**Platform**
- AppShell v2
- responsive navigation behavior
- SavedViewSwitcher v1
- TreeNavigatorShell v1
- ChartShell v1
- ReviewLayout

**Costing Squad**
- CostingContextBar
- CostingWorkflowStepper
- CostingSummaryStrip
- Costing toolbar composition

### Deliverables
- AppShell enterprise-ready v2
- Costing base pattern siap dipakai submodule

### Exit Criteria
- shell baru stabil desktop/tablet
- costing entry page bisa memakai context bar + stepper + summary + toolbar

---

## Sprint 4 — High-Impact Experience Release A
### Objectives
- merilis transformasi visual dan structural pada modul paling terlihat

### Scope
**Command Center Squad**
- Executive widgets
- Operations queue
- dual mode structure

**Overview Squad**
- Project Overview milestone panel
- blockers/risk/activity structure

**Costing Squad**
- AHSPTable v1
- RABCommandStrip
- RABGrid v1

### Deliverables
- Command Center v1 redesign
- Project Overview v1 redesign
- Costing AHSP + RAB v1

### Exit Criteria
- 3 modul flagship sudah menunjukkan bahasa UI baru
- inspector flow berjalan di setidaknya 2 modul

---

## Sprint 5 — High-Impact Experience Release B
### Objectives
- menyelesaikan inti costing dan memperkuat planning experiences

### Scope
**Costing Squad**
- WBSTreeWorkspace
- RAPHealthStrip
- RAPControlGrid v1
- ComparePanel v1

**Platform**
- FilterSheet
- improved virtualization adapter
- chart-ledger layout base

### Deliverables
- WBS redesign v1
- RAP redesign v1
- compare flow untuk costing

### Exit Criteria
- AHSP/WBS/RAB/RAP terasa satu pipeline
- user dapat review, edit, compare tanpa friction besar

---

## Sprint 6 — Planning & Finance Foundation
### Objectives
- mulai transform Schedule/Planning dan Finance secara terstruktur

### Scope
**Finance Squad**
- FinanceExposureStrip
- FinanceModeSwitch
- CashflowChart v1

**Platform + Schedule Squad**
- TimelineShell exploration
- Plan / Track / Analyze shell grouping
- ChartLedgerLayout

**Costing Squad**
- ResourcePlanningChart
- ResourceLedgerTable

### Deliverables
- Resource Plan v1
- Finance overview foundation
- Schedule shell grouping prototype

### Exit Criteria
- Finance dan Schedule sudah punya arah pattern yang sama dengan costing

---

## Sprint 7 — Finance Deepening + Supply Foundation
### Objectives
- mengubah finance menjadi role-aware
- memulai supply transformation

### Scope
**Finance Squad**
- APTable
- ARTable
- Finance overview role-based defaults

**Supply Squad**
- SupplySummaryStrip
- SupplyModeSwitch
- SupplyExceptionsStrip

### Deliverables
- Finance v1 role-aware
- Supply base v1

### Exit Criteria
- PM dan Owner tidak lagi melihat finance ops view sebagai default
- supply punya mode kerja yang lebih jelas

---

## Sprint 8 — Supply + Documents Base
### Objectives
- memperdalam supply
- mulai documents governance pattern

### Scope
**Supply Squad**
- MRTable
- POTable
- TraceDrawer

**Documents Squad**
- DocumentsModeSwitch
- DocumentsToolbar
- DocumentList

### Deliverables
- Supply procurement flow v1
- Documents repository/control foundation

### Exit Criteria
- supply trace flow berjalan
- documents sudah bukan sekadar file list mentah

---

## Sprint 9 — Documents Deepening + Governance Layer
### Objectives
- memperkuat governance features
- menyiapkan owner/review oriented experiences

### Scope
**Documents Squad**
- DocumentPreviewPanel
- DocumentInspector
- ReviewActionBar

**Governance Squad**
- ChangeImpactStoryPanel
- owner review patterns

**Field Squad**
- MobileContextStrip
- TaskCard base

### Deliverables
- Documents review-ready v1
- Change Management impact story v1
- Field module foundation v1

### Exit Criteria
- dokumen dapat direview dengan jelas
- change management terasa lebih decision-ready

---

## Sprint 10 — Field Operations + Portfolio Extensions
### Objectives
- menutup gap mobile lapangan
- memperluas ke portfolio dan owner digest

### Scope
**Field Squad**
- EvidenceCaptureSheet
- OfflineQueueIndicator
- QuickProgressSelector
- IssueEscalationAction

**Portfolio/Governance Squad**
- PortfolioRiskRanking
- OwnerApprovalDigest

### Deliverables
- Field Tasks mobile-first v1
- Portfolio/Owner supporting views v1

### Exit Criteria
- mobile field flow usable untuk pilot
- owner digest tersedia untuk stakeholder view

---

## 7. Priority Backlog by Business Value

## 7.1 Highest Business Value
1. AppShell v2
2. GlobalContextBar
3. SmartToolbar
4. InspectorDrawer
5. CostingWorkflowStepper
6. RABGrid
7. Command Center dual mode
8. Project Overview refined
9. WBS workspace
10. RAP control grid

## 7.2 Highest Reuse Value
1. Button / Input / Select / Badge
2. SummaryStrip
3. WorkspaceHeader
4. PageShell
5. SmartToolbar
6. TableShell
7. InspectorDrawer
8. ModeSwitch
9. WorkflowStepper
10. EmptyState / AlertStrip

## 7.3 Highest Adoption Value
1. Project Costing redesign
2. Project Overview redesign
3. Command Center redesign
4. Finance role-aware overview
5. Field Tasks mobile-first

---

## 8. Owner Matrix

| Workstream | Primary Owner | Supporting Owner |
|---|---|---|
| Design Tokens | Design System Owner | FE Platform Lead |
| UI Primitives | FE Platform Lead | Design System Owner |
| Shared Patterns | FE Platform Lead | Product Design Lead |
| App Shell | FE Platform Lead | Product Design Lead |
| Costing Suite | Costing Squad Lead | FE Platform Lead |
| Command Center | Product Design Lead | Domain Squad |
| Project Overview | Product Design Lead | Overview Squad |
| Finance | Finance Squad Lead | FE Platform Lead |
| Supply Chain | Supply Squad Lead | FE Platform Lead |
| Documents | Documents Squad Lead | FE Platform Lead |
| Field Tasks | Field Squad Lead | Product Design Lead |
| QA Governance | QA Lead | Product Ops |

---

## 9. Delivery Risks and Mitigation

### Risk 1 — Shared Pattern Belum Stabil tapi Domain Sudah Jalan
**Mitigasi:**
- sprint 1–2 fokus foundation dan pattern lock
- domain squad tidak membangun custom workaround sebelum pattern tersedia

### Risk 2 — Costing Menyerap Semua Kapasitas
**Mitigasi:**
- prioritaskan only high-value strips and grids first
- tunda advanced compare atau analytics jika mengganggu velocity

### Risk 3 — Documents dan Supply Kembali Menggunakan Pola Lama
**Mitigasi:**
- wajib pakai SmartToolbar, SummaryStrip, InspectorDrawer, ModeSwitch sebelum deeper work

### Risk 4 — Mobile Field Tertunda
**Mitigasi:**
- alokasikan foundation field components sejak sprint 9 paling lambat
- jangan tunggu seluruh desktop selesai sempurna

### Risk 5 — QA Tidak Punya Standar Operasional
**Mitigasi:**
- QA pakai checklist dari Design System Rules + Frontend Guide + matrix ini

---

## 10. Definition of Ready untuk Masuk Sprint
Sebuah komponen atau modul hanya boleh masuk sprint jika:
- owner jelas
- layer-nya jelas
- reuse scope jelas
- acceptance criteria jelas
- dependency terhadap token/pattern sudah diketahui
- breakpoint behavior sudah didefinisikan
- apakah ini reusable atau module-specific sudah diputuskan

---

## 11. Definition of Done untuk Komponen
Sebuah komponen dianggap selesai jika:
- sudah memakai token system
- state utama lengkap
- responsive behavior jelas
- accessibility baseline terpenuhi
- example usage tersedia
- tidak ada style hardcoded yang melanggar standar
- QA visual dasar lulus
- prop API cukup jelas dan tidak ambigu

---

## 12. Definition of Done untuk Modul
Sebuah modul dianggap selesai jika:
- memakai page anatomy standar
- work surface dominan jelas
- action hierarchy benar
- summary strip ringkas
- inspector/detail pattern tersedia
- desktop/tablet/mobile behavior sesuai
- loading/error/empty states lengkap
- lulus QA lintas persona

---

## 13. Recommended Ceremonies

### Weekly Platform Review
Fokus:
- status primitives/patterns
- dependency blockers
- review prop API reusable components

### Weekly Domain Review
Fokus:
- apakah modul mengikuti pattern resmi
- apakah ada custom workaround berlebihan
- apakah action hierarchy sudah benar

### Biweekly UX Consistency Audit
Fokus:
- hierarchy
- status semantics
- density
- toolbar behavior
- inspector behavior

### End-of-Sprint Demo
Wajib menunjukkan:
- desktop state
- tablet state
- mobile state bila relevan
- loading/empty/error state

---

## 14. Recommended Immediate Execution Sequence
Urutan paling tepat setelah dokumen ini jadi:
1. freeze shared naming dan token decisions
2. build Sprint 1 foundation backlog di task tracker
3. pecah P0 components menjadi tickets kecil
4. assign owners per workstream
5. lakukan pilot pada AppShell + Project Costing flow
6. evaluasi pattern reuse setelah Sprint 2

---

## 15. Penutup
Component Inventory Matrix dan Sprint Implementation Roadmap ini disusun agar transformasi MLPHoma dapat diterjemahkan menjadi backlog nyata, bukan berhenti di level prinsip. Dengan matrix ini, tim dapat melihat dengan jelas apa yang harus dibangun lebih dulu, apa yang harus reusable, siapa owner-nya, dan kapan komponen atau modul sebaiknya masuk sprint.

