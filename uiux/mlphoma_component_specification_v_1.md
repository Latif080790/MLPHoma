# MLPHoma Component Specification v1.0

## 1. Tujuan
Dokumen ini mendefinisikan spesifikasi komponen UI inti yang dipakai lintas modul MLPHoma agar implementasi design system konsisten di level produk, desain, dan frontend engineering.

Dokumen ini melengkapi:
- MLPHoma Design System Rules v1.0

Fokus dokumen ini:
- fungsi komponen
- kapan komponen dipakai
- struktur internal
- aturan hierarchy
- interaction behavior
- responsive behavior
- states
- do / don’t

---

## 2. Prinsip Spesifikasi Komponen

### 2.1 Komponen Harus Punya Tugas Jelas
Setiap komponen wajib menjawab satu tugas utama:
- memberi konteks
- menunjukkan status
- memberi aksi
- memfilter data
- menampilkan data
- membuka detail

### 2.2 Hindari Komponen Serbaguna yang Kabur
Komponen tidak boleh dipaksa melakukan terlalu banyak fungsi sekaligus.
Contoh yang harus dihindari:
- card summary yang sekaligus jadi toolbar
- tab yang sekaligus jadi status indicator dan action container
- modal yang dipakai untuk review record panjang

### 2.3 Komponen Wajib Konsisten Lintas Modul
Nama, struktur, perilaku, dan state komponen harus sama di seluruh produk.

---

## 3. Komponen Layout Utama

## 3.1 App Header
### Fungsi
Navigasi global aplikasi.

### Isi wajib
- logo / product identity
- breadcrumb atau route context
- global search / command access
- notifications
- user menu

### Behavior
- sticky di atas
- tinggi stabil
- tidak berubah drastis antar modul
- search/quick action tetap tersedia di layar kecil dalam bentuk compact trigger

### Do
- gunakan sebagai navigasi global saja
- pertahankan struktur konsisten

### Don’t
- jangan jadikan tempat semua tombol modul
- jangan tampilkan context bisnis terlalu detail di sini

---

## 3.2 Global Context Bar
### Fungsi
Menampilkan konteks kerja aktif pada modul.

### Isi wajib
- project / portfolio / package aktif
- version / draft / baseline
- sync status
- health indicator
- compare/publish bila relevan

### Behavior
- sticky di bawah app header
- selalu terlihat saat user scroll area kerja
- teks singkat dan padat

### States
- default
- warning
- read-only
- sync failed
- draft changed

### Do
- gunakan di seluruh modul enterprise yang context-heavy

### Don’t
- jangan ulangi informasi yang sudah tampil jelas di workspace header

---

## 3.3 Workflow Stepper
### Fungsi
Menampilkan tahapan proses dependency-based.

### Pakai untuk
- AHSP → WBS → RAB → RAP → Resource
- approval stages
- phase-based workflows

### Struktur
- icon
- title
- count
- status badge
- optional dependency indicator

### States
- inactive
- active
- complete
- warning
- blocked
- locked

### Behavior
- clickable antar step
- tooltip saat hover
- step aktif harus jelas secara visual
- step warning menunjukkan penyebab singkat

### Do
- gunakan untuk alur progresif nyata

### Don’t
- jangan pakai jika view hanya sekadar tab setara

---

## 3.4 Segmented Switch
### Fungsi
Mengganti mode tampilan yang setara.

### Pakai untuk
- Direct Cost / Overhead / Summary / Comparison
- Planning / Ledger / Compare
- Repository / Control / Review

### Aturan
- maksimal 4–5 opsi terlihat
- label singkat
- active state kontras jelas

---

## 3.5 Workspace Header
### Fungsi
Menjelaskan area kerja aktif.

### Isi
- title
- subtitle 1 kalimat
- primary CTA
- maksimal 2–3 secondary actions terlihat
- sisanya masuk overflow

### Behavior
- non-sticky atau semi-sticky tergantung modul
- selalu dekat dengan area kerja yang relevan

### Do
- jadikan titik orientasi utama user

### Don’t
- jangan terlalu tinggi
- jangan memuat terlalu banyak tombol

---

## 4. Komponen Informasi dan Status

## 4.1 Summary Strip
### Fungsi
Menampilkan metrik inti secara ringkas.

### Struktur
- 4–6 metrics maksimal
- label kecil
- angka dominan
- optional delta / badge status

### Variants
- mini cards
- inline metric strip
- chip metrics

### Pakai untuk
- total items
- budget totals
- margin
- pending approvals
- completion health

### Do
- tampilkan hanya metrik yang langsung relevan

### Don’t
- jangan jadikan summary strip sebagai dashboard penuh

---

## 4.2 Status Badge
### Fungsi
Menandai state record, step, atau modul.

### Vocabulary resmi
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

### Variants
- soft badge
- solid badge
- outline badge

### Do
- gunakan label yang konsisten

### Don’t
- jangan bikin sinonim status per modul

---

## 4.3 Alert Strip
### Fungsi
Menampilkan state penting di level halaman atau section.

### Pakai untuk
- locked baseline
- sync failed
- validation issue
- pending approvals
- stale data

### Struktur
- severity icon
- short message
- optional CTA

### Behavior
- tampil horizontal, tidak terlalu tinggi
- dismissible bila non-critical

### Do
- gunakan untuk exception penting

### Don’t
- jangan jadikan alert strip sebagai pengganti header atau summary

---

## 4.4 Empty State
### Fungsi
Menangani kondisi kosong secara actionable.

### Struktur
- headline singkat
- deskripsi 1 kalimat
- primary CTA
- optional secondary CTA

### Contoh
- Belum ada item pada node ini
- Belum ada dokumen tervalidasi
- Belum ada actual cost masuk

---

## 5. Komponen Tooling

## 5.1 Smart Toolbar
### Fungsi
Menjadi pusat search, filter, views, dan utility tools.

### Struktur standar
Kiri:
- search
- quick filters
- advanced filters
- saved views

Kanan:
- density
- columns
- group by
- utility actions

### Behavior
- sticky bila tabel panjang
- berubah menjadi bulk action bar saat selection aktif

### Do
- posisikan tepat di atas work surface

### Don’t
- jangan pisahkan search jauh dari filter utama

---

## 5.2 Search Input
### Fungsi
Entry point tercepat untuk menemukan record.

### Behavior
- selalu visible di toolbar
- placeholder menjelaskan scope
- debounce search bila data besar
- dapat clear cepat

---

## 5.3 Filter Chip / Filter Dropdown
### Fungsi
Menyaring data aktif.

### Aturan
- quick filter untuk hal paling sering dipakai
- advanced filter masuk panel/dropdown
- filter aktif harus terlihat jelas
- jumlah filter aktif bisa dilihat cepat

---

## 5.4 Saved Views
### Fungsi
Menyimpan kombinasi filter, sort, columns, density, grouping.

### Behavior
- per user
- per modul
- dapat rename, duplicate, delete

### Pakai untuk
- overdue only
- high variance
- my approvals
- missing links

---

## 5.5 Bulk Action Bar
### Fungsi
Menampilkan aksi saat multi-selection aktif.

### Struktur
- selected count
- primary bulk actions
- clear selection

### Behavior
- menggantikan toolbar biasa saat selection aktif
- hanya tampil saat ada selection

---

## 6. Komponen Data Surface

## 6.1 Data Grid
### Fungsi
Surface utama untuk modul data-heavy.

### Fitur wajib
- sticky header
- sortable columns
- multi-select
- row hover actions
- column show/hide
- density switch
- inline edit bila relevan
- loading/skeleton state
- empty state

### Fitur opsional
- pinned columns
- row grouping
- subtotal/footer
- row expand
- virtualized rendering

### Kolom standar interaction
- select
- primary identifier
- key business fields
- status
- actions

### Do
- jadikan pusat kerja utama untuk modul operasional

### Don’t
- jangan terlalu renggang jika user scan-heavy

---

## 6.2 Tree Navigator
### Fungsi
Menampilkan struktur hierarkis.

### Fitur wajib
- indentation jelas
- expand/collapse
- search node
- hover actions
- counts/totals badges

### Fitur opsional
- drag-and-drop
- breadcrumb path
- node type icons

### Pakai untuk
- WBS
- folder structures
- package breakdown

---

## 6.3 Board / Kanban
### Fungsi
Mengelola status workflow dan workload.

### Fitur wajib
- lane titles
- card summary
- status cue
- assignee info
- quick action

### Do
- gunakan bila alur benar-benar status-driven

### Don’t
- jangan pakai untuk data numerik yang lebih cocok di grid

---

## 6.4 Timeline / Gantt Surface
### Fungsi
Menampilkan hubungan waktu, durasi, dependency, progress.

### Fitur wajib
- time scale control
- zoom
- dependency visibility
- progress cue
- task detail access

### Fitur opsional
- split view dengan task table kiri
- what-if scenario overlay

---

## 6.5 Chart Surface
### Fungsi
Menjawab pertanyaan bisnis dengan visual cepat.

### Aturan
- satu chart untuk satu pertanyaan utama
- ada legend
- ada period control
- klik chart harus dapat drill ke records terkait

### Pakai untuk
- cash flow
- progress curve
- resource demand
- variance distribution

### Don’t
- jangan gunakan chart hanya untuk dekorasi

---

## 7. Komponen Detail dan Contextual Review

## 7.1 Inspector Drawer
### Fungsi
Menampilkan detail record tanpa meninggalkan context work surface.

### Struktur standar
- header item
- metadata utama
- tabs: Details / Links / History / Notes
- contextual actions
- status + owner
- audit trail

### Behavior
- terbuka dari klik row/node/card
- dapat ditutup tanpa reset context
- selected row tetap aktif
- versi tablet menjadi slide-over

### Do
- gunakan untuk detail panjang, relasi, audit, dan compare

### Don’t
- jangan ganti dengan modal besar untuk review panjang

---

## 7.2 Modal
### Fungsi
Dipakai untuk create, confirm, atau destructive action singkat.

### Pakai untuk
- create item baru
- confirm delete
- request unlock
- upload document
- approve/reject with note

### Don’t
- jangan pakai untuk review detail record yang panjang

---

## 7.3 Side Sheet / Slide-over
### Fungsi
Alternatif inspector pada tablet/mobile atau saat flow butuh ruang lebih besar.

### Pakai untuk
- advanced filters
- detail item di tablet
- multi-step short form

---

## 8. Komponen Form dan Input

## 8.1 Form Section
### Struktur
- title section
- helper text opsional
- fields related grouped together
- inline validation

### Aturan
- label di atas field
- helper text singkat
- required state jelas

---

## 8.2 Input Text
### Pakai untuk
- nama item
- kode
- catatan singkat
- pencarian

### States
- default
- focus
- filled
- error
- disabled

---

## 8.3 Numeric Input
### Pakai untuk
- quantity
- volume
- unit price
- markup
- tax

### Aturan
- alignment kanan disarankan dalam konteks tabel
- format angka konsisten
- inline validation untuk range/format

---

## 8.4 Select / Combobox
### Pakai untuk
- categories
- statuses
- WBS link
- assignee
- scenario

### Aturan
- search-enabled jika opsi banyak
- tampilkan selected state jelas

---

## 8.5 Date Input
### Pakai untuk
- due date
- planned date
- need-by date
- reporting period

### Aturan
- format tanggal konsisten lintas produk
- quick presets opsional untuk range date

---

## 8.6 Toggle / Switch
### Pakai untuk
- enable/disable mode
- use baseline / use draft
- auto sync / manual sync

### Don’t
- jangan gunakan switch untuk pilihan multi-state

---

## 8.7 Tabs dalam Form / Detail
### Pakai untuk
- Details
- History
- Comments
- Links

### Aturan
- maksimal 4–5 tab terlihat
- tab pertama harus paling umum dibuka

---

## 9. Feedback & System States

## 9.1 Loading State
### Variants
- skeleton rows
- skeleton cards
- inline spinner
- button loading

### Aturan
- gunakan skeleton untuk area konten utama
- gunakan spinner kecil untuk aksi singkat

---

## 9.2 Success Feedback
### Pakai untuk
- save successful
- publish complete
- import complete
- sync complete

### Bentuk
- toast
- inline confirmation
- success badge update

---

## 9.3 Error Feedback
### Pakai untuk
- validation failed
- sync failed
- permission denied
- import parse error

### Aturan
- error harus spesifik
- jika mungkin, sertakan tindakan perbaikan

---

## 9.4 Unsaved Changes Bar
### Fungsi
Muncul saat ada perubahan belum disimpan.

### Isi
- status message
- Save Draft
- Discard
- Compare Changes

---

## 10. Responsive Specifications

## 10.1 Desktop
- full toolbar
- right inspector
- split panels allowed
- dense grid allowed
- pinned columns allowed

## 10.2 Tablet
- sidebar menjadi drawer
- inspector menjadi slide-over
- toolbar boleh 2 baris
- summary berubah jadi chips horizontal
- columns dikurangi

## 10.3 Mobile
- card-first layout
- bottom sheet detail
- action prioritization ketat
- hindari dense grid editing
- hindari tree editing kompleks

---

## 11. Component Usage by Module Type

## 11.1 Summary Modules
Gunakan:
- global context bar
- summary strip
- alert strip
- curated widgets
- quick launch cards

## 11.2 Operational Grid Modules
Gunakan:
- workspace header
- compact summary
- smart toolbar
- data grid
- inspector drawer
- bulk action bar

## 11.3 Hierarchical Modules
Gunakan:
- tree navigator
- node workspace
- inspector drawer
- contextual actions

## 11.4 Planning Modules
Gunakan:
- summary strip
- alert strip
- chart/timeline
- ledger/grid below
- drill-down interaction

## 11.5 Field/Mobile Modules
Gunakan:
- cards
- sticky CTA
- evidence-first actions
- bottom sheets
- offline/outbox indicators

---

## 12. Do / Don’t Umum

### Do
- prioritaskan satu work surface utama
- gunakan summary ringkas
- pisahkan action hierarchy
- gunakan inspector untuk detail
- pertahankan vocabulary status konsisten
- sediakan saved views dan filter persistence di modul operasional

### Don’t
- jangan tumpuk terlalu banyak header dan card besar
- jangan jadikan semua tombol selevel visual
- jangan gunakan modal untuk review panjang
- jangan pakai chart tanpa drill-down atau tujuan jelas
- jangan gunakan label aksi berbeda untuk fungsi yang sama

---

## 13. Handoff Rules untuk Frontend

Setiap komponen reusable minimal harus memiliki:
- purpose
- props utama
- states
- variants
- responsive rules
- accessibility notes
- do/don’t examples

Untuk implementasi frontend, semua komponen inti di atas harus dibangun sebagai reusable primitives atau composites, bukan dibuat ulang per modul.

---

## 14. Penutup
Component Specification v1.0 ini menjadi jembatan antara Design System Rules dan implementasi modul. Dengan spesifikasi ini, tim desain dan frontend dapat membangun seluruh modul MLPHoma dengan bahasa antarmuka yang konsisten, scalable, dan enterprise-grade.

