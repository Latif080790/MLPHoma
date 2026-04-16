# MLPHoma Module-by-Module Application Guide v1.0

## 1. Tujuan
Dokumen ini menerjemahkan Design System Rules, Component Specification, dan Design Token Rules ke penerapan nyata per modul agar seluruh tim memiliki acuan implementasi yang seragam.

Dokumen ini menjawab:
- modul ini harus memakai layout apa
- komponen apa yang wajib ada
- default view per persona bagaimana
- data surface dominan yang tepat apa
- action hierarchy yang tepat seperti apa
- bagaimana perilaku desktop, tablet, dan mobile
- kesalahan desain apa yang harus dihindari

Dokumen ini melengkapi:
- MLPHoma Design System Rules v1.0
- MLPHoma Component Specification v1.0
- MLPHoma Design Token Rules v1.0

---

## 2. Cara Membaca Dokumen Ini

Untuk setiap modul, panduan akan selalu memakai struktur berikut:
- tujuan modul
- persona utama
- page anatomy
- komponen wajib
- default view per persona
- action hierarchy
- data surface utama
- responsive behavior
- do / don’t
- acceptance checklist

---

## 3. App Shell dan Navigation

## 3.1 Tujuan
Menjadi kerangka global yang menyatukan seluruh pengalaman lintas modul.

## 3.2 Persona utama
- semua pengguna

## 3.3 Page Anatomy
- App Header
- Global Context Bar
- Primary Navigation
- Workspace Area
- Right Inspector / Contextual Drawer bila relevan

## 3.4 Komponen Wajib
- product identity yang konsisten
- project switcher
- search / quick action trigger
- notifications
- user menu
- collapsible sidebar pada desktop
- drawer navigation pada tablet
- bottom-sheet or compact nav strategy pada mobile bila diperlukan

## 3.5 Default View per Persona
- PM: masuk ke Command Center atau Project Overview
- Site Engineer: masuk ke Field Tasks / Site Progress
- Owner: masuk ke Executive Summary / Project Overview ringkas
- Admin Ops: masuk ke modul terakhir yang aktif atau modul kerja utama per domain

## 3.6 Action Hierarchy
Primary di shell hanya untuk:
- search / quick action
- project switching

Jangan taruh action modul spesifik di app header.

## 3.7 Responsive Behavior
- desktop: full sidebar + sticky header
- tablet: sidebar jadi drawer
- mobile: navigation dipadatkan, context bisnis tetap singkat

## 3.8 Do
- pertahankan pola shell yang sama di semua modul
- sediakan quick action universal

## 3.9 Don’t
- jangan ubah struktur shell drastis per modul
- jangan biarkan mobile kehilangan akses ke search/quick actions

## 3.10 Acceptance Checklist
- shell konsisten lintas modul
- project context selalu terbaca
- search selalu bisa diakses
- active nav jelas

---

## 4. Command Center

## 4.1 Tujuan Modul
Memberikan control surface tingkat eksekutif dan operasional untuk memantau kesehatan proyek atau portofolio, exception, approvals, blockers, dan trend utama.

## 4.2 Persona Utama
- Project Manager
- Project Director
- Owner/Klien
- PMO

## 4.3 Layout Rekomendasi
Gunakan dua mode utama:
- Executive Mode
- Operations Mode

### Executive Mode
Page anatomy:
- Global Context Bar
- Mode Switch: Executive / Operations
- Compact Summary Strip
- Alert Strip
- Curated Widget Grid
- Quick Launch Section

### Operations Mode
Page anatomy:
- Global Context Bar
- Mode Switch
- Summary Strip
- Exception Queue
- Activity Stream
- Approvals Panel
- Risk / Delay / Finance / Supply blockers widgets

## 4.4 Komponen Wajib
- mode switch
- summary strip
- alert strip
- exception widgets
- approvals widget
- activity feed
- quick launch cards

## 4.5 Default View per Persona
- PM: Operations Mode
- Owner/Klien: Executive Mode
- PMO/Director: Executive Mode dengan access ke Operations Mode

## 4.6 Data Surface Dominan
- summary widgets + exception panels
Bukan dense grid.

## 4.7 Action Hierarchy
Primary:
- Review Approvals
- Open Critical Blockers

Secondary:
- Compare trend
- Export summary
- Open detailed report

Utility:
- date range
- filters
- density bila perlu

## 4.8 Responsive Behavior
- desktop: widget grid 2–4 kolom
- tablet: widget grid 1–2 kolom
- mobile: stack cards, prioritaskan top exceptions dan approvals

## 4.9 Do
- tampilkan 3–5 hal yang benar-benar perlu perhatian
- prioritaskan exception-first

## 4.10 Don’t
- jangan jadikan command center sebagai dump semua data
- jangan tampilkan visual bergaya HUD berlebihan

## 4.11 Acceptance Checklist
- mode executive dan operations terpisah jelas
- top blockers terlihat di fold pertama
- approvals mudah ditemukan
- quick launch ke modul detail tersedia

---

## 5. Project Overview

## 5.1 Tujuan Modul
Menjadi halaman ringkasan proyek yang menyeimbangkan status finansial, progres, timeline, risiko, tim, dan aktivitas terbaru.

## 5.2 Persona Utama
- Project Manager
- Owner/Klien
- PMO

## 5.3 Page Anatomy
- Global Context Bar
- Workspace Header
- Exception Summary Strip
- KPI Summary Strip
- Timeline and Milestone Section
- Risk Section
- Team Section
- Recent Activity Section

## 5.4 Komponen Wajib
- KPI summary
- blockers summary
- milestone/timeline view
- risks list
- team members block
- recent activity feed
- quick links ke schedule, finance, documents, change management

## 5.5 Default View per Persona
- PM: full overview
- Owner: owner summary mode
- PMO: full overview + governance highlights

## 5.6 Data Surface Dominan
- curated summary + lists
- bukan grid data berat

## 5.7 Action Hierarchy
Primary:
- Review Critical Risks
- Open Full Schedule

Secondary:
- View Change Requests
- Open Financial Summary
- Open Documents for Review

## 5.8 Responsive Behavior
- desktop: 2-column or 3-column sectional layout
- tablet: stacked sections with timeline/risk at top
- mobile: cards, top 3 blockers, top milestones, top risks only

## 5.9 Do
- jadikan halaman ini tenang, jelas, dan mudah dipindai

## 5.10 Don’t
- jangan menyamakan Project Overview dengan Command Center

## 5.11 Acceptance Checklist
- blockers terlihat lebih dulu daripada data sekunder
- KPI tidak berlebihan
- risk dan milestone mudah dipahami
- owner mode tersedia

---

## 6. Project Costing

## 6.1 Tujuan Modul
Mengelola pipeline costing dari AHSP hingga Resource Plan sebagai satu alur dependency-based yang konsisten.

## 6.2 Persona Utama
- QS
- Estimator
- Cost Control
- Project Manager

## 6.3 Page Anatomy Global
- Global Context Bar
- Costing Workflow Stepper
- Workspace Header
- Compact Summary Strip
- Smart Toolbar
- Main Work Surface
- Right Inspector Drawer

## 6.4 Komponen Wajib
- workflow stepper
- summary strip
- smart toolbar
- inspector drawer
- saved views
- compare/version awareness
- unsaved changes bar bila edit-heavy

## 6.5 Default View per Persona
- PM: RAB Summary atau RAP
- QS/Estimator: step terakhir yang dikerjakan atau AHSP/RAB
- Owner: summary review mode בלבד

## 6.6 Action Hierarchy
Primary:
- Add / Import / Save / Publish sesuai step

Secondary:
- Compare Version
- Generate from WBS
- Apply Scenario

Utility:
- Export
- Density
- Columns
- More

## 6.7 Responsive Behavior
- desktop: full grid/tree + inspector
- tablet: stepper horizontal scroll + slide-over inspector
- mobile: review mode, approval mode, item detail, bukan full editing

## 6.8 Do
- perlakukan costing sebagai satu pipeline
- gunakan stepper, bukan tab biasa

## 6.9 Don’t
- jangan penuhi layar dengan card besar dan action overload

## 6.10 Acceptance Checklist
- stepper jelas statusnya
- summary ringkas
- toolbar rapi
- main work surface dominan
- inspector drawer tersedia

---

## 7. AHSP

## 7.1 Tujuan Modul
Mengelola katalog analisa harga satuan dan breakdown resource.

## 7.2 Persona Utama
- QS
- Estimator
- Cost Engineer

## 7.3 Page Anatomy
- Workspace Header
- Compact Summary Strip
- Smart Toolbar
- Data Grid AHSP
- Inspector Drawer

## 7.4 Komponen Wajib
- dense table
- row expand atau quick detail
- filters by category/source/link status
- saved views
- inspector breakdown

## 7.5 Data Surface Dominan
- data grid

## 7.6 Default View
- dense data mode
- unlinked/missing price saved views tersedia

## 7.7 Do
- prioritaskan pencarian, audit, dan linking

## 7.8 Don’t
- jangan jadikan AHSP sebagai dashboard card-heavy

## 7.9 Acceptance Checklist
- tabel dominan
- search dan filter cepat
- breakdown resource bisa diakses cepat
- row actions jelas

---

## 8. WBS

## 8.1 Tujuan Modul
Membangun struktur breakdown proyek dan menghubungkannya ke item biaya, quantity, dan paket kerja.

## 8.2 Persona Utama
- PM
- Planner
- QS

## 8.3 Page Anatomy
- Workspace Header
- Summary Strip
- Mode Switch: Build / Link / Review
- 3-Panel Layout
  - Left: Tree Navigator
  - Center: Node Workspace
  - Right: Inspector Drawer

## 8.4 Komponen Wajib
- tree navigator
- node badges/counts/totals
- node summary
- linked items list
- contextual node actions
- inspector

## 8.5 Data Surface Dominan
- tree + node workspace

## 8.6 Default View
- Build mode untuk planner/QS
- Review mode untuk PM

## 8.7 Do
- perlakukan WBS sebagai struktur hidup
- tampilkan total cost per node

## 8.8 Don’t
- jangan buat tree terlalu sempit
- jangan campur WBS dan RAB tanpa batas konteks yang jelas

## 8.9 Acceptance Checklist
- tree terbaca jelas
- node path jelas
- totals terlihat
- link actions mudah diakses

---

## 9. RAB

## 9.1 Tujuan Modul
Menyusun, mengedit, membandingkan, dan mengunci baseline budget.

## 9.2 Persona Utama
- QS
- Estimator
- PM
- Cost Control

## 9.3 Page Anatomy
- Workspace Header
- Command Strip
- Status / Alert Strip
- Segmented Switch: Direct Cost / Overhead / Summary / Comparison
- Smart Toolbar
- Dense Editable Grid
- Inspector Drawer

## 9.4 Komponen Wajib
- command strip ringkas
- lock status bar
- comparison mode
- dense grid dengan grouping
- subtotal/footer
- inspector details

## 9.5 Data Surface Dominan
- editable grid

## 9.6 Default View
- QS/Estimator: Direct Cost
- PM: Summary atau Comparison
- Owner: review summary mode

## 9.7 Do
- fokus pada budget builder workspace
- pisahkan state indicator dari action buttons

## 9.8 Don’t
- jangan tampilkan semua tombol selevel
- jangan pakai banner besar untuk locked state kecuali critical

## 9.9 Acceptance Checklist
- grid dominan
- comparison tersedia
- lock state jelas
- toolbar tidak overload

---

## 10. RAP

## 10.1 Tujuan Modul
Mengontrol biaya pelaksanaan dan margin melalui committed, actual, remaining, dan forecast views.

## 10.2 Persona Utama
- PM
- Cost Control
- Project Director

## 10.3 Page Anatomy
- Workspace Header
- RAP Health Strip
- Exception Strip
- Margin Simulation Bar
- Smart Toolbar
- Cost Control Grid
- Inspector Drawer

## 10.4 Komponen Wajib
- exception-first panels
- budget control grid
- margin simulation control
- status classification per item
- forecast view

## 10.5 Data Surface Dominan
- cost control grid

## 10.6 Default View
- PM: exception-first
- Cost Control: full grid
- Owner: margin/exposure summary only

## 10.7 Do
- prioritaskan item overrun, watchlist, dan missing commitment

## 10.8 Don’t
- jangan buat RAP terasa hanya seperti card summary tambahan

## 10.9 Acceptance Checklist
- exceptions terlihat di atas
- grid memperlihatkan committed/actual/remaining
- margin simulation tidak mendominasi layar

---

## 11. Resource Plan

## 11.1 Tujuan Modul
Mengelola kebutuhan resource, distribusi waktu, shortage risk, dan keterkaitan dengan procurement/logistics.

## 11.2 Persona Utama
- PM
- Planner
- Procurement Coordination
- Site Coordination

## 11.3 Page Anatomy
- Workspace Header
- Summary Strip
- Mode Switch: Planning / Ledger / Compare
- Alert Strip
- Chart / Timeline Surface
- Ledger Table
- Inspector Drawer

## 11.4 Komponen Wajib
- planning mode
- ledger mode
- chart drill-down
- resource risk strip
- linked status ke procurement/WBS/RAP

## 11.5 Data Surface Dominan
- planning chart + ledger table

## 11.6 Default View
- PM: Planning
- Procurement: Ledger
- Site Coordination: Planning with date filters

## 11.7 Do
- jadikan chart sebagai alat analisis, bukan dekorasi

## 11.8 Don’t
- jangan biarkan chart terlalu besar tanpa tindakan lanjutan

## 11.9 Acceptance Checklist
- chart bisa drill-down
- shortages terlihat
- ledger mudah difilter
- linked statuses jelas

---

## 12. Schedule & Operations

## 12.1 Tujuan Modul
Menggabungkan perencanaan, pelacakan, dan analisis jadwal/progres dalam satu workspace operasional.

## 12.2 Persona Utama
- PM
- Planner
- Site Engineer

## 12.3 Page Anatomy
- Global Context Bar
- Mode Grouping: Plan / Track / Analyze
- Summary Strip
- Smart Toolbar
- Main Surface sesuai mode
  - Plan: WBS + Timeline/Gantt
  - Track: Daily Progress / Curva-S / Resource Usage
  - Analyze: Risk & Issues / What-If
- Inspector Drawer

## 12.4 Komponen Wajib
- mode grouping
- schedule health strip
- timeline/gantt
- daily progress surface
- risk/issues list
- scenario tools

## 12.5 Default View per Persona
- PM: Track
- Planner: Plan
- Site Engineer: Track
- Owner: Analyze summary mode

## 12.6 Do
- kelompokkan fitur ke Plan / Track / Analyze

## 12.7 Don’t
- jangan jadikan semua sub-fiturnya tab sejajar datar

## 12.8 Acceptance Checklist
- mode grouping jelas
- schedule health terlihat
- cross-filter tersedia
- main task planner tidak tenggelam oleh secondary tools

---

## 13. Supply Chain

## 13.1 Tujuan Modul
Mengelola pengadaan, inventory, transfer, dan logistics exceptions secara terstruktur.

## 13.2 Persona Utama
- Procurement
- Warehouse
- PM
- Site Coordination

## 13.3 Page Anatomy
- Global Context Bar
- Workspace Split by Mode: Procurement / Warehouse / Exceptions
- Summary Strip
- Smart Toolbar
- Data Grid / Lists
- Trace Inspector Drawer

## 13.4 Komponen Wajib
- exception strip
- procurement vs warehouse mode
- saved views
- trace chain panel
- row status cues

## 13.5 Data Surface Dominan
- dense grid/list

## 13.6 Default View per Persona
- Procurement: Procurement mode
- Warehouse: Warehouse mode
- PM: Exceptions mode

## 13.7 Do
- prioritaskan urgent requests, late deliveries, low stock, mismatch

## 13.8 Don’t
- jangan satukan semua domain sebagai surface setara tanpa mode kerja

## 13.9 Acceptance Checklist
- exceptions mudah dibaca
- trace chain tersedia
- mode procurement dan warehouse terpisah
- PM summary tidak terlalu operasional

---

## 14. Finance

## 14.1 Tujuan Modul
Mengelola exposure, AP, AR, matching, aging, dan cash flow dengan start state berbeda per role.

## 14.2 Persona Utama
- Finance/Admin Ops
- PM
- Owner/Klien

## 14.3 Page Anatomy
- Global Context Bar
- Role-Aware Mode Switch or Default View
- Summary Strip
- Alert / Overdue Strip
- Segmented Views: Overview / AP / AR / Aging / Match / Cash Flow / Overhead
- Main Grid or Chart Surface
- Inspector Drawer

## 14.4 Komponen Wajib
- summary strip
- overdue/exposure indicators
- dense AP/AR grids
- matching surface
- cash flow chart with drill-down
- inspector drawer

## 14.5 Data Surface Dominan
- overview summary for PM/Owner
- dense grids for Finance Ops

## 14.6 Default View per Persona
- PM: Overview
- Owner: Financial Summary
- Finance Ops: AP or matching workspace

## 14.7 Do
- bedakan overview dan ops mode dengan jelas

## 14.8 Don’t
- jangan jadikan layar pertama finance terlalu berat untuk PM/Owner

## 14.9 Acceptance Checklist
- default view role-aware
- AP/AR/match tidak mencemari overview
- overdue and exposure terlihat cepat
- charts bisa drill-down

---

## 15. Documents

## 15.1 Tujuan Modul
Menyediakan repository, control, dan review dokumen proyek dengan governance yang jelas.

## 15.2 Persona Utama
- Document Controller
- PM
- Site Engineer
- Owner/Klien

## 15.3 Page Anatomy
- Global Context Bar
- Mode Switch: Repository / Control / Review
- Summary Strip
- Smart Toolbar
- Document List/Grid
- Preview / Inspector Drawer

## 15.4 Komponen Wajib
- search kuat
- category/status filters
- mode separation
- preview panel
- version/status metadata
- review actions

## 15.5 Data Surface Dominan
- repository list/grid
- preview panel

## 15.6 Default View per Persona
- Document Controller: Control
- PM: Repository
- Owner: Review
- Site Engineer: Repository filtered by field relevance

## 15.7 Do
- bedakan browse mode dan control mode
- tampilkan version/status jelas

## 15.8 Don’t
- jangan jadikan dokumen hanya list file tanpa governance layer

## 15.9 Acceptance Checklist
- repository/control/review terpisah
- preview mudah diakses
- versioning terlihat
- approvals/rejections terdokumentasi

---

## 16. Change Management

## 16.1 Tujuan Modul
Mengelola perubahan scope/time/cost dan approval story secara jelas.

## 16.2 Persona Utama
- PM
- Project Director
- Owner/Klien
- Cost Control

## 16.3 Page Anatomy
- Global Context Bar
- Workspace Header
- Pipeline Status Strip
- Impact Summary Strip
- Change Log Grid
- Impact Analysis Panel
- Inspector Drawer

## 16.4 Komponen Wajib
- pipeline counters
- impact summary
- before vs after comparison
- approval ladder
- linked affected objects

## 16.5 Data Surface Dominan
- change log + impact analysis

## 16.6 Default View per Persona
- PM: change log + approvals
- Owner: impact review mode
- Cost Control: impact analysis mode

## 16.7 Do
- tampilkan delta cost/time/scope secara jelas

## 16.8 Don’t
- jangan jadikan change order hanya list status tanpa konteks dampak

## 16.9 Acceptance Checklist
- impact story jelas
- approval state terlihat
- related objects bisa ditelusuri
- owner review mode ringkas

---

## 17. Field Tasks

## 17.1 Tujuan Modul
Menjadi operating surface mobile-first untuk update progres lapangan, evidence capture, dan issue escalation.

## 17.2 Persona Utama
- Site Engineer
- Pelaksana
- Supervisor Lapangan

## 17.3 Page Anatomy
- Top Context Strip
- Summary Chips
- Task Feed
- Sticky Primary CTA
- Bottom Sheet Update Flow

## 17.4 Komponen Wajib
- task cards
- evidence-first update flow
- GPS/status cue
- photo upload/capture
- offline/outbox indicator
- issue escalation shortcut

## 17.5 Data Surface Dominan
- card feed, bukan grid

## 17.6 Default View
- To Do / Today as default
- completed as secondary tab

## 17.7 Do
- prioritaskan one-hand usage
- utamakan action “Update” daripada eksplorasi menu

## 17.8 Don’t
- jangan paksakan layout desktop ke mobile
- jangan buat update flow terlalu form-heavy

## 17.9 Acceptance Checklist
- task feed mudah dipindai
- update flow singkat
- evidence capture jelas
- offline state terlihat
- escalation mudah diakses

---

## 18. Portfolio / Executive Modules

## 18.1 Tujuan Modul
Memberikan gambaran lintas proyek untuk monitoring strategis, prioritization, dan escalation.

## 18.2 Persona Utama
- Director
- PMO
- Owner tingkat portofolio

## 18.3 Page Anatomy
- Global Context Bar
- Summary Strip
- Portfolio Filters
- Portfolio Cards/Grid
- Risk/Delay/Cost Exposure Panels
- Quick Launch to Project Level

## 18.4 Komponen Wajib
- cross-project filters
- risk ranking
- milestone health
- budget exposure summaries
- drill-down to project

## 18.5 Data Surface Dominan
- cards + ranked lists + strategic tables

## 18.6 Do
- prioritaskan ranking, trend, exception

## 18.7 Don’t
- jangan tampilkan terlalu banyak detail transaksional lintas proyek

## 18.8 Acceptance Checklist
- top risky projects terlihat cepat
- filters kuat
- drill-down jelas
- executive readability tinggi

---

## 19. Owner / Client Review Mode

## 19.1 Tujuan
Menyediakan pengalaman ringkas, aman, dan mudah dipercaya untuk stakeholder eksternal.

## 19.2 Modul yang Wajib Punya Owner Mode
- Project Overview
- Command Center
- Cost Summary
- Finance Summary
- Change Management
- Documents Review

## 19.3 Aturan Owner Mode
- sembunyikan tools teknis yang tidak relevan
- prioritaskan milestone, exposure, approvals, progress, high risks
- gunakan bahasa yang lebih ringkas
- read-only by default kecuali approval/comment workflow

## 19.4 Acceptance Checklist
- owner tidak dibebani tools admin/ops
- approval paths jelas
- transparency tinggi
- visual lebih calm

---

## 20. QA Cross-Module Application Checklist

Sebelum modul dianggap sesuai standar, cek:
- apakah modul memakai page anatomy yang benar
- apakah work surface utamanya jelas
- apakah summary terlalu besar atau sudah ringkas
- apakah primary dan utility actions terpisah
- apakah status semantic konsisten
- apakah responsive behavior sesuai konteks penggunaan
- apakah ada default view per persona
- apakah inspector drawer atau detail pattern setara tersedia
- apakah empty state actionable tersedia
- apakah filters dan saved views cukup untuk kerja harian

---

## 21. Penutup
Module-by-Module Application Guide ini memastikan bahwa setiap modul MLPHoma tidak berkembang sebagai halaman terpisah yang punya gaya masing-masing, tetapi sebagai bagian dari satu sistem enterprise yang konsisten. Dengan panduan ini, tim desain, frontend, produk, dan QA dapat menerapkan standar yang sama sambil tetap menghormati kebutuhan unik tiap domain modul.

