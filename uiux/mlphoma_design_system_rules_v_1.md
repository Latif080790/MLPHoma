# MLPHoma Design System Rules v1.0

## 1. Tujuan
Dokumen ini menjadi standar acuan UI/UX lintas modul untuk MLPHoma agar seluruh produk terasa konsisten, enterprise-grade, informatif, efisien, dan nyaman dipakai harian oleh Project Manager, Site Engineer/Pelaksana, Owner/Klien, QS, Cost Control, Procurement, Finance, dan Document Controller.

Dokumen ini mengatur:
- page anatomy
- hierarchy visual
- status system
- pola komponen utama
- pola interaksi
- responsive behavior
- content style
- checklist QA UI

---

## 2. Prinsip Inti Produk

### 2.1 Function First
UI harus terasa sebagai alat kerja operasional, bukan dashboard dekoratif.

Aturan:
- Data dan aksi utama harus lebih dominan daripada ornamen visual.
- Hindari card parade, banner berlebih, dan header tinggi yang tidak menambah keputusan.
- Setiap elemen harus membantu user membaca, memfilter, mengedit, membandingkan, atau menyetujui.

### 2.2 One Screen, One Dominant Work Surface
Setiap halaman hanya boleh punya satu permukaan kerja utama:
- data grid
- tree
- board
- timeline
- chart
- document canvas
- form workspace

Elemen lain hanya pendukung.

### 2.3 Progressive Disclosure
Kompleksitas tidak boleh ditampilkan sekaligus.
Urutan baku:
1. konteks
2. status ringkas
3. tools kerja
4. data utama
5. detail mendalam

### 2.4 Persona-Aware Default
Default state halaman harus menyesuaikan persona:
- Project Manager: exception, summary, approvals, risk, health
- Site Engineer/Pelaksana: task-first, mobile-first, quick input, evidence capture
- Owner/Klien: summary, milestone, exposure, approval-only
- Admin Ops/QS/Finance/Procurement: dense data, filters, inline edit, bulk actions

---

## 3. Standar Anatomi Halaman
Semua modul harus mengikuti susunan berikut.

### 3.1 Layer 1 — Global Context Bar
Sticky bar di bagian atas konten modul.

Isi minimal:
- nama project / portfolio / package aktif
- version / baseline / draft
- sync status
- module health
- compare / publish / export bila relevan

Tujuan:
- mengurangi repetisi header
- menjaga user selalu paham konteks kerja
- menyatukan bahasa visual lintas modul

### 3.2 Layer 2 — Workflow / Mode Navigation
Gunakan salah satu:
- process stepper untuk alur dependency-based
- segmented switch untuk view setara
- mode tabs untuk mode kerja berbeda

Contoh:
- Costing: AHSP → WBS → RAB → RAP → Resource Plan
- Finance: Overview → AP → AR → Aging → Match
- Supply Chain: Requests → PO → Inventory → Transfers
- Documents: Repository → Control → Review

### 3.3 Layer 3 — Workspace Header
Satu header aktif per halaman.

Isi:
- nama modul/submodul
- 1 kalimat penjelasan fungsi
- 1 primary CTA
- 2–3 secondary/utility actions maksimal terlihat
- sisanya masuk overflow

### 3.4 Layer 4 — Compact Summary Strip
Summary wajib kompak, horizontal, dan mudah dipindai.

Aturan:
- maksimum 4–6 metrik utama
- tinggi ringkas
- angka utama besar, label kecil
- jika > 6 metrik, pindahkan ke secondary view

### 3.5 Layer 5 — Smart Toolbar
Diletakkan tepat di atas work surface.

Isi standar:
- search
- 2–4 filter utama
- advanced filters bila perlu
- saved views
- density
- columns / group by
- bulk action state saat selection aktif

### 3.6 Layer 6 — Main Work Surface
Merupakan area paling dominan di layar.

Bentuk utama:
- data grid
- tree
- board
- chart + ledger
- timeline
- document list
- form workspace

### 3.7 Layer 7 — Inspector Drawer
Inspector drawer kanan adalah pola standar lintas modul.

Isi default:
- item summary
- metadata
- linked records
- status
- history / audit
- notes
- contextual actions

---

## 4. Hierarchy Visual

### 4.1 Level Hierarchy

#### Level 1 — Decision Layer
- project/module context
- step/mode aktif
- health utama
- primary CTA

#### Level 2 — Work Layer
- compact summary
- smart toolbar
- data surface
- active filters

#### Level 3 — Utility Layer
- export
- compare
- density
- columns
- settings
- history

#### Level 4 — Metadata Layer
- timestamps
- labels sekunder
- descriptions pendukung
- IDs / references

### 4.2 Action Hierarchy
Setiap action wajib diklasifikasikan.

#### Primary
Aksi utama halaman.
Contoh:
- Add Item
- Upload Document
- Create Change Order
- Save Draft
- Approve

#### Secondary
Aksi penting pendukung.
Contoh:
- Import Excel
- Compare Version
- Generate from WBS
- Assign Owner

#### Utility
Aksi pendukung yang tidak harus dominan.
Contoh:
- Export
- Columns
- Density
- Saved Views
- More

#### State
Bukan tombol aksi, hanya status.
Contoh:
- Locked
- Read-only
- Synced
- Draft
- Approved

---

## 5. Spacing, Density, dan Rhythm

### 5.1 Density Modes
Semua modul operasional wajib mendukung:
- Comfortable
- Compact
- Dense

Default rekomendasi:
- Owner/Klien: Comfortable
- PM: Compact
- Ops/QS/Finance/Procurement: Dense

### 5.2 Spacing Scale
- 24 px antar-layer besar
- 16 px antar-subsection
- 12 px antar-komponen related
- 8 px antar-elemen minor
- 4 px hanya untuk relasi sangat rapat dalam komponen kecil

### 5.3 Card Rules
Card hanya dipakai bila:
- menampilkan metrik ringkas
- menyorot exception
- memisahkan state penting

Jangan membungkus seluruh halaman dengan card tinggi berlapis.

---

## 6. Typography Rules

### 6.1 Ukuran Teks
- page title: 24–28 px
- module title: 20–22 px
- summary value: 18–24 px
- section title: 16–18 px
- body/table text: 13–14 px
- metadata/helper text: 11–12 px

### 6.2 Penggunaan
- Gunakan hierarchy yang stabil antar modul.
- Jangan pakai terlalu banyak ukuran besar dalam satu viewport.
- Angka penting harus lebih dominan dari labelnya.

---

## 7. Status System Lintas Produk

### 7.1 Status Vocabulary
Gunakan vocabulary yang sama di seluruh modul:
- Draft
- Ready
- Watch
- Warning
- At Risk
- Blocked
- Locked
- Approved
- Rejected
- Completed
- Archived

### 7.2 Mapping Warna
- hijau: Ready / Safe / Approved / On Track
- kuning: Watch
- oranye: Warning / At Risk
- merah: Blocked / Overrun / Critical
- biru: Draft / In Progress
- abu gelap: Locked / Read-only
- abu muda: Archived / Inactive

### 7.3 Placement
Status harus konsisten muncul di:
- summary strip
- row level
- inspector
- workflow stepper
- alert strip

Status tidak boleh hanya bergantung pada warna. Harus selalu disertai label atau icon.

---

## 8. Standar Komponen Inti

### 8.1 Data Grid Standard
Gunakan untuk modul operasional dan data-heavy.

Wajib punya:
- sticky header
- sortable columns
- multi-select
- bulk actions
- column show/hide
- density switch
- group by
- row hover quick actions
- inline edit bila relevan
- sticky total/footer bila numerik

### 8.2 Tree Standard
Gunakan hanya untuk struktur hierarkis.

Wajib punya:
- indentation jelas
- expand/collapse
- search node
- hover actions
- badges counts
- aggregate totals
- drag-and-drop jika editable

### 8.3 Board Standard
Gunakan untuk workflow/status.

Wajib punya:
- swimlane jelas
- card density terkontrol
- assignee/status/due date terlihat
- quick action
- filter by owner/status

### 8.4 Chart Standard
Chart hanya dipakai bila membantu keputusan.

Aturan:
- satu chart = satu pertanyaan bisnis
- selalu ada legend
- selalu ada period toggle
- klik chart harus dapat drill-down
- chart tidak boleh lebih dominan dari table bila aksi utama ada di table

### 8.5 Form Standard
Semua form wajib:
- label di atas field
- helper text singkat
- validasi inline
- sectioning jelas
- sticky save bar atau auto-save state
- destructive actions dipisah

---

## 9. Standar Inspector Drawer

### 9.1 Struktur
- Header item
- Key metadata
- Tabs: Details / Links / History / Notes
- Status + owner
- Actions kontekstual
- Audit trail

### 9.2 Perilaku
- terbuka dari klik row/node/card
- dapat di-pin bila perlu
- dapat di-close tanpa reset context tabel
- harus mempertahankan selected state di main surface

### 9.3 Jangan Gunakan Modal Untuk
- review detail record panjang
- audit trail
- linked objects
- comparison detail

Modal hanya untuk create, confirm, atau destructive actions singkat.

---

## 10. Standar Toolbar, Search, dan Filter

### 10.1 Search
Search selalu ditempatkan di kiri toolbar sebagai entry tercepat.

### 10.2 Filter Hierarchy
Filter dibagi menjadi:
- quick filters
- advanced filters
- saved views

### 10.3 Saved Views
Semua modul operasional wajib mendukung saved views.

Contoh:
- overdue only
- my approvals
- unlinked items
- high variance
- late deliveries
- missing documents

### 10.4 Persistence
Filter, sort, density, dan columns harus tersimpan per user per modul.

---

## 11. Standar Summary Strip

Summary strip harus:
- horizontal
- ringkas
- mudah dipindai
- relevan dengan keputusan berikutnya

Format ideal:
- Count
- Total value
- Delta / variance
- Status
- Health

Jika summary butuh lebih dari 6 metrik, pecah menjadi:
- primary strip
- secondary details panel

---

## 12. Standar Alert, Notification, dan State Messaging

### 12.1 Alert Strip
Dipakai untuk state halaman/module-wide:
- locked baseline
- sync failed
- pending approvals
- validation issue
- stale data

### 12.2 Inline Alert
Dipakai untuk:
- field errors
- row warnings
- local validation states

### 12.3 Notification Center
Dipakai untuk lintas modul:
- approval requested
- document rejected
- price drift detected
- late delivery alert

---

## 13. Standar Micro-Interactions

### 13.1 Hover Row Quick Actions
Muncul saat hover:
- edit
- duplicate
- link
- history
- delete

### 13.2 Inline Edit
Dipakai untuk:
- angka
- quantity
- volume
- unit price
- short labels
- due date
- status ringan

### 13.3 Sticky Save Bar
Muncul saat ada perubahan belum disimpan:
- Save Draft
- Discard
- Compare Changes

### 13.4 Bulk Selection State
Saat multi-select aktif:
- toolbar utama diganti bulk action bar

### 13.5 Drill-down Continuity
Klik item → drawer → linked record → pindah modul tetap mempertahankan context

### 13.6 Empty States
Semua modul wajib punya empty states yang actionable.

Contoh:
- Belum ada item pada node ini
- Belum ada dokumen tervalidasi
- Belum ada actual cost masuk
- Belum ada jadwal resource

---

## 14. Responsive Behavior

### 14.1 Desktop
Fokus:
- planning
- review detail
- dense data
- compare
- bulk actions

Pola:
- full toolbar
- multi-column layout
- right inspector
- pinned columns
- split view

### 14.2 Tablet
Fokus:
- review
- semi-edit
- approval
- checklist
- site coordination

Pola:
- sidebar menjadi drawer
- toolbar 2 baris
- summary jadi chips horizontal
- inspector menjadi slide-over
- reduced columns

### 14.3 Mobile
Fokus:
- review cepat
- approval
- note/comment
- field update
- evidence capture

Pola:
- card-first
- bottom sheet detail
- no dense admin grid editing
- no complex tree editing
- CTA utama sticky atau mudah dijangkau ibu jari

---

## 15. Content Style & Naming Rules

### 15.1 Naming Consistency
Gunakan label yang seragam di seluruh produk.

Contoh:
- Add Item
- Compare Version
- Locked Baseline
- Save Draft
- Upload Document

Jangan gunakan sinonim berbeda untuk aksi yang sama di modul berbeda.

### 15.2 Subtitle Style
Subtitle header maksimal 1 kalimat operasional.
Bukan kalimat marketing.

### 15.3 Helper Text
Pendek, fungsional, dan menjelaskan konsekuensi atau tujuan field.

---

## 16. Standard by Module Category

### 16.1 Summary Modules
Contoh:
- Command Center
- Project Overview
- Portfolio KPIs
- Owner Dashboard

Wajib punya:
- summary strip
- alert strip
- curated widgets
- exception-first design
- quick launch ke modul detail

### 16.2 Operational Grid Modules
Contoh:
- AHSP
- RAB
- RAP
- Finance Ops
- Supply Chain
- Documents Control

Wajib punya:
- smart toolbar
- dense grid
- inspector drawer
- inline edit
- bulk actions

### 16.3 Hierarchical Modules
Contoh:
- WBS
- structured folders
- package tree

Wajib punya:
- tree navigator
- node summary
- inspector drawer
- hover actions
- aggregate counts/totals

### 16.4 Planning Modules
Contoh:
- Resource Plan
- Schedule & Operations
- Cash Flow Schedule

Wajib punya:
- compact summary
- alert strip
- chart/timeline
- ledger/table below
- drill-down on chart interaction

### 16.5 Field / Mobile Modules
Contoh:
- Field Tasks
- Inspections
- Daily Progress

Wajib punya:
- card-first layout
- sticky CTA
- photo/evidence-first flow
- offline-aware pattern
- one-hand friendly interactions

---

## 17. Accessibility Rules

Semua modul wajib memenuhi:
- contrast tinggi untuk teks utama
- ukuran body minimum 13 px desktop
- status tidak hanya dengan warna
- icon penting selalu disertai label atau tooltip
- keyboard focus jelas
- target klik minimum 40 px

---

## 18. QA Checklist Sebelum Modul Dianggap Siap

### 18.1 Page Anatomy Checklist
- ada context bar
- ada mode/step navigation yang benar
- ada compact summary
- ada smart toolbar
- ada satu main work surface dominan
- ada inspector drawer atau detail pattern setara

### 18.2 Hierarchy Checklist
- primary CTA jelas
- secondary vs utility actions terpisah
- status indicator tidak bercampur dengan primary actions
- summary tidak terlalu besar
- data surface dominan secara visual

### 18.3 Interaction Checklist
- search bekerja
- filters persisten
- row hover actions ada
- bulk state ada
- empty state actionable ada
- unsaved changes state ada bila perlu

### 18.4 Responsive Checklist
- desktop, tablet, mobile punya perilaku berbeda
- sidebar/drawer sesuai breakpoint
- toolbar tidak pecah berlebihan
- tabel tetap dapat digunakan dengan pinned columns atau reduced set

### 18.5 Consistency Checklist
- vocabulary status konsisten
- warna status konsisten
- label aksi konsisten
- spacing mengikuti scale standar
- typography mengikuti scale standar

---

## 19. Acuan Implementasi per Tim

### 19.1 Untuk UI/UX Designer
Gunakan dokumen ini sebagai acuan wireframe, high-fidelity design, dan review consistency.

### 19.2 Untuk Frontend Engineer
Gunakan dokumen ini untuk menentukan layout skeleton, reusable components, action hierarchy, toolbar behavior, dan responsive rules.

### 19.3 Untuk Product / QA
Gunakan dokumen ini sebagai checklist acceptance UI/UX sebelum modul dinyatakan siap.

---

## 20. Penutup
MLPHoma tidak boleh terlihat seperti kumpulan halaman yang dibuat per modul secara terpisah. Produk harus terasa sebagai satu sistem kerja enterprise yang konsisten.

Standar ini memastikan seluruh modul tunduk pada bahasa visual, pola interaksi, dan struktur kerja yang sama, sehingga:
- lebih cepat dipelajari
- lebih nyaman dipakai harian
- lebih mudah di-scale
- lebih mudah di-maintain
- lebih credible untuk enterprise clients

