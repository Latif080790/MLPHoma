# UIUX SYSTEM SPECIFICATION
## MLPHoma — Construction Project Management Application
### Dokumen Referensi untuk Desain UI/UX

> **Versi**: 1.0 | **Tanggal**: Juni 2026 | **Status**: Aktif  
> Dokumen ini menjelaskan sistem aplikasi MLPHoma secara menyeluruh sebagai referensi lengkap untuk desain UI/UX baru maupun pengembangan tampilan yang sudah ada.

---

## DAFTAR ISI

1. [Gambaran Umum Aplikasi](#1-gambaran-umum-aplikasi)
2. [Arsitektur & Teknologi](#2-arsitektur--teknologi)
3. [Sistem Autentikasi & Peran Pengguna](#3-sistem-autentikasi--peran-pengguna)
4. [Struktur Navigasi & Layout](#4-struktur-navigasi--layout)
5. [Design System yang Digunakan](#5-design-system-yang-digunakan)
6. [Modul-Modul Utama (Fitur Lengkap)](#6-modul-modul-utama-fitur-lengkap)
7. [Model Data Kunci](#7-model-data-kunci)
8. [Pola Interaksi Umum](#8-pola-interaksi-umum)
9. [Fitur Offline & Realtime](#9-fitur-offline--realtime)
10. [Aksesibilitas & Responsivitas](#10-aksesibilitas--responsivitas)
11. [Alur Kerja Bisnis (Business Flows)](#11-alur-kerja-bisnis-business-flows)
12. [Komponen UI Reusable](#12-komponen-ui-reusable)
13. [Referensi Terminologi Konstruksi](#13-referensi-terminologi-konstruksi)

---

## 1. GAMBARAN UMUM APLIKASI

### 1.1 Identitas Produk

**MLPHoma** adalah platform manajemen proyek konstruksi berbasis web (PWA) yang dirancang khusus untuk industri konstruksi Indonesia. Aplikasi ini memungkinkan tim proyek — dari manajer proyek hingga pengawas lapangan — untuk mengelola seluruh siklus hidup proyek konstruksi dari perencanaan hingga serah terima.

### 1.2 Target Pengguna

| Peran | Tanggung Jawab Utama | Modul Paling Sering Digunakan |
|-------|----------------------|-------------------------------|
| **Project Manager** | Pengawasan keseluruhan proyek, keputusan strategis | Command Center, Portfolio Analytics, Cost Forecast |
| **Site Manager / Pengawas** | Kontrol harian lapangan, progress tracking | Schedule & Ops, Field Tasks, Supply Chain |
| **Quantity Surveyor (QS)** | Estimasi biaya, RAB/RAP | Project Costing, Finance |
| **Finance / Akuntan** | Pembayaran, invoice, cashflow | Finance, Change Management |
| **Admin Pengadaan** | Pembelian material, vendor | Supply Chain |
| **QHSE Officer** | Keselamatan, kualitas | QHSE, Documents |
| **Direksi / Owner** | Monitoring multi-proyek | Portfolio KPIs, BI Report Builder |

### 1.3 Konteks Bisnis

- Proyek bisa bersifat **satu proyek aktif** (mode project-level) atau **multi-proyek** (mode portfolio)
- Nilai proyek umumnya dalam **Rupiah Indonesia (IDR)**
- Standar industri yang dipakai: **SNI** (Standar Nasional Indonesia) untuk AHSP
- Regulasi lokal: **TKDN** (Tingkat Komponen Dalam Negeri) untuk kandungan lokal
- Format tanggal: ID locale, format Indonesia

---

## 2. ARSITEKTUR & TEKNOLOGI

### 2.1 Stack Teknologi

```
Frontend         : React 18.3.1 + TypeScript (strict mode)
Build Tool       : Vite (dengan PWA plugin)
Routing          : React Router v7 (HashRouter, SPA)
State Management : Zustand v5
Styling          : Tailwind CSS + Radix UI + shadcn/ui
Backend          : Supabase (PostgreSQL + Auth + Realtime + Storage)
Offline          : Dexie (IndexedDB) + Service Worker
Charts           : Recharts
Tables           : TanStack Table v8 (dengan virtualisasi)
Forms            : React Hook Form + Zod
Export           : xlsx, jsPDF, html2canvas
QR Code          : html5-qrcode
```

### 2.2 Pola Arsitektur Layering

```
┌─────────────────────────────────────────────┐
│                  Pages/Modules               │  ← UI Layer (tiap fitur)
├─────────────────────────────────────────────┤
│              Components (shared)             │  ← Reusable UI
├─────────────────────────────────────────────┤
│         Hooks + Stores (Zustand)             │  ← State Layer
├─────────────────────────────────────────────┤
│              Services Layer                  │  ← Business Logic (60+ service)
├─────────────────────────────────────────────┤
│         Supabase Client / IndexedDB          │  ← Data Layer
└─────────────────────────────────────────────┘
```

### 2.3 Pembagian Layout Lapis

Setiap halaman modul mengikuti struktur layer yang konsisten:

```
L1 — GlobalContextBar    : Konteks proyek aktif + status global (fix di atas)
L2 — ModeSwitch          : Switching mode tampilan (Plan/Track/Analyze, dsb.)
L3 — WorkspaceHeader     : Judul halaman + aksi utama (tombol tambah, export)
L4 — SummaryStrip        : Ringkasan angka kunci (count, total nilai, dsb.)
L5 — AlertStrip          : Peringatan/notifikasi kontekstual
L6 — Content Area        : Konten utama (tabel, chart, form, tab)
```

---

## 3. SISTEM AUTENTIKASI & PERAN PENGGUNA

### 3.1 Halaman Autentikasi

| Halaman | Path | Deskripsi |
|---------|------|-----------|
| Login | `/login` | Email + Password, tombol lupa password |
| Register | `/register` | Pendaftaran akun baru |
| Forgot Password | `/forgot-password` | Kirim link reset via email |
| Reset Password | `/reset-password` | Form baru setelah klik link email |

### 3.2 Sistem RBAC (Role-Based Access Control)

Aplikasi menggunakan RBAC berbasis Supabase Row Level Security (RLS). Hak akses dikontrol via:
- `usePermissions()` hook → cek izin per aksi
- `useRoles()` hook → cek peran aktif pengguna
- `PermissionGuard` component → render kondisional berdasar izin
- Proteksi route via `ProtectedRoute` component

**Peran yang Ada:**
- `admin` — akses penuh ke semua modul dan pengaturan
- `project_manager` — akses manajemen proyek
- `site_manager` — fokus operasional lapangan
- `finance` — akses modul keuangan
- `viewer` — read-only

### 3.3 Alur Proteksi Route

```
Akses URL
   ↓
ProtectedRoute (cek auth session)
   ↓ (tidak login)         ↓ (sudah login)
Redirect /login        AppShell (layout utama)
                           ↓
                      Page Component
```

---

## 4. STRUKTUR NAVIGASI & LAYOUT

### 4.1 Layout Utama (AppShell)

Setelah login, semua halaman dibungkus `AppShell` yang terdiri dari:

```
┌──────────────────────────────────────────────────────────┐
│                     AppHeader (top bar)                   │
│  Logo | Nama Proyek Aktif | Search | Notifikasi | Avatar  │
├───────────────┬──────────────────────────────────────────┤
│               │                                           │
│  AppSidebar   │          Main Content Area                │
│  (kiri)       │  (GlobalContextBar + halaman aktif)       │
│               │                                           │
│  Nav Groups:  │                                           │
│  - Overview   │                                           │
│  - Cost Ctrl  │                                           │
│  - Schedule   │                                           │
│  - Operations │                                           │
│  - Portfolio  │                                           │
│  - System     │                                           │
└───────────────┴──────────────────────────────────────────┘
```

### 4.2 Struktur Navigasi Lengkap

#### Grup: Overview
| Menu | Path | Deskripsi |
|------|------|-----------|
| Command Center | `/` | Dashboard utama, telemetri & KPI proyek |
| Projects | `/projects` | Daftar & manajemen semua proyek |
| Project Overview | `/project-overview` | Dashboard satu proyek spesifik |

#### Grup: Cost Control
| Menu | Path | Deskripsi |
|------|------|-----------|
| Project Costing | `/costing` | Pipeline biaya: AHSP → WBS → RAB → RAP → Resource |
| Cost Forecast | `/cost-forecast` | EVM, CPI, SPI, proyeksi biaya hingga selesai |

#### Grup: Schedule
| Menu | Path | Deskripsi |
|------|------|-----------|
| Schedule & Operations | `/schedule` | Timeline, Gantt, WBS, progress lapangan, analisis risiko |

#### Grup: Operations
| Menu | Path | Deskripsi |
|------|------|-----------|
| Supply Chain | `/supply-chain` | Pengadaan material, PO, inventory, GRN |
| Field Tasks | `/field-tasks` | Pencatatan tugas harian lapangan (mobile-first) |
| Finance | `/finance` | Invoice, AP/AR, cashflow, 3-way match |
| Change Management | `/change-management` | Variation order, persetujuan perubahan |
| Documents | `/documents` | Repositori dokumen & QR code |
| Handover | `/handover` | Proses serah terima proyek (wizard) |
| TKDN | `/tkdn` | Kompliasi kandungan lokal |
| QHSE | `/qhse` | Keselamatan, kesehatan, lingkungan, kualitas |
| Subcontractor | `/subcontractors` | Manajemen subkontraktor |

#### Grup: Portfolio
| Menu | Path | Deskripsi |
|------|------|-----------|
| Resource Heatmap | `/portfolio-resources` | Alokasi sumber daya lintas proyek |
| Portfolio KPIs | `/portfolio-analytics` | CPI/SPI/PHI agregat semua proyek |
| BI Report Builder | `/bi-reports` | Builder laporan kustom |
| Strategy Simulation | `/strategy-sim` | Simulasi skenario strategis |

#### Grup: System
| Menu | Path | Deskripsi |
|------|------|-----------|
| Settings | `/settings` | Pengaturan proyek, tim, master data |

### 4.3 Command Palette

Aplikasi memiliki **command palette** yang dapat dicari oleh pengguna untuk berpindah halaman secara cepat tanpa klik menu. Setiap item navigasi memiliki `keywords` untuk mendukung pencarian.

---

## 5. DESIGN SYSTEM YANG DIGUNAKAN

### 5.1 Library & Komponen Dasar

- **shadcn/ui** (berbasis Radix UI primitives) — komponen aksesibel: Dialog, Tabs, Select, Checkbox, Badge, Card, Table, dll.
- **Tailwind CSS** — utility-first, class-based dark mode
- **Lucide React** — icon set konsisten
- **Sonner** — toast notifikasi

### 5.2 Token Warna (CSS Variables / HSL)

Sistem warna berbasis CSS variable dengan tema terang & gelap:

| Token | Fungsi |
|-------|--------|
| `background` / `foreground` | Latar & teks utama |
| `card` / `card-foreground` | Kartu & kontennya |
| `primary` / `primary-foreground` | Aksi utama (tombol, highlight) |
| `secondary` / `secondary-foreground` | Elemen sekunder |
| `muted` / `muted-foreground` | Teks dimmer, placeholder |
| `accent` / `accent-foreground` | Hover state, emphasis |
| `destructive` / `destructive-foreground` | Aksi berbahaya (hapus, tolak) |
| `border` | Garis pembatas |
| `ring` | Focus indicator |

### 5.3 Typography

- Font utama mengikuti system font stack
- Skala tipografi sesuai Tailwind defaults (text-xs → text-4xl)
- Heading modul: `text-xl font-semibold`
- Label tabel: `text-xs text-muted-foreground uppercase`
- Nilai keuangan: monospace, rata kanan

### 5.4 Pola Visual Komponen Enterprise

Setiap modul menggunakan 6 komponen pattern wajib:

```
GlobalContextBar   → Pita atas: nama proyek, status, tombol switch proyek
ModeSwitch         → Toggle mode (misal: Plan | Track | Analyze)
WorkspaceHeader    → Judul + subtitle + aksi (tombol Tambah, Export)
SummaryStrip       → Card horizontal berisi KPI ringkas
AlertStrip         → Banner peringatan kontekstual
PageShell          → Wrapper layout + breadcrumb
```

### 5.5 Dark Mode

Aplikasi mendukung dark mode berbasis class Tailwind (`dark:`). Semua komponen harus konsisten pada kedua tema.

---

## 6. MODUL-MODUL UTAMA (FITUR LENGKAP)

---

### 6.1 COMMAND CENTER (`/`)

**Fungsi**: Dashboard utama berisi telemetri & ringkasan kinerja proyek.

**Mode**: 
- `Project Mode` — tampilkan data proyek aktif
- `Portfolio Mode` — tampilkan agregat semua proyek

**Konten Utama:**

| Widget | Deskripsi |
|--------|-----------|
| **TelemetryHUD** | KPI utama: Biaya Aktual, % Progress, Sisa Anggaran, Estimasi Selesai |
| **PerformanceKPIs** | CPI (Cost Performance Index), SPI (Schedule Performance Index), PHI |
| **OperationalAlerts** | Peringatan tugas terlambat, PO pending, invoice overdue |
| **ActivityLogStream** | Aliran aktivitas terbaru dari seluruh modul |
| **ApprovalInbox** | Daftar item menunggu persetujuan user aktif |
| **ApprovalQueueWidget** | Antrian approval dengan SLA indicator |
| **CriticalPathWarningPanel** | Peringatan jalur kritis dari CPM calculation |
| **MRPAlertPanel** | Alert Material Requirement Planning |
| **AnomalyWidget** | Deteksi anomali biaya otomatis |
| **AuditLogViewer** | Log audit aktivitas |
| **Cashflow Chart** | Grafik aliran kas proyek |

**Informasi Khusus:**
- Day Counter: "Hari ke-X dari Y hari proyek" 
- Realtime: auto-refresh saat ada perubahan pada `timeline_tasks` via Supabase Realtime
- Overdue approvals badge: jumlah approval terlambat dan yang sudah di-eskalasi

---

### 6.2 PROJECTS (`/projects`)

**Fungsi**: Manajemen daftar semua proyek dalam sistem.

**Fitur:**
- Daftar proyek dengan status: `Active`, `Planning`, `Completed`, `ARCHIVED`
- Buat proyek baru (form: nama, lokasi, tanggal mulai/selesai, anggaran)
- Switch proyek aktif
- Akses cepat ke detail proyek

**Data Proyek:**
- ID proyek, nama, anggaran (IDR), status, tanggal mulai/selesai, lokasi

---

### 6.3 PROJECT OVERVIEW (`/project-overview`)

**Fungsi**: Dashboard ringkasan satu proyek yang dipilih.

**Konten:**
- Info umum proyek (nama, kontrak, lokasi, owner)
- Status keuangan: budget vs aktual
- Progress fisik vs keuangan
- Timeline ringkasan
- Laporan ringkas per modul

---

### 6.4 PROJECT COSTING (`/costing`)

**Fungsi**: Pipeline penetapan biaya proyek secara hierarkis 5 langkah.

**Pipeline (WorkflowStepper — 5 Langkah):**

```
Step 1: AHSP (Analisis Harga Satuan Pekerjaan)
   ↓
Step 2: WBS (Work Breakdown Structure)  
   ↓
Step 3: RAB (Rencana Anggaran Biaya / Budget)
   ↓
Step 4: RAP (Rencana Anggaran Pelaksanaan / Cost Plan)
   ↓
Step 5: Resource Planning
```

**Detail Tiap Step:**

#### Step 1 — AHSP (Analisis Harga Satuan Pekerjaan)
Master database harga satuan pekerjaan sesuai standar SNI.
- **Resource**: material, tenaga kerja (labor), alat (equipment), subkontraktor
- Setiap AHSP item berisi komponen (bahan + koefisien)
- Kalkulasi: Base Price, Overhead %, Profit % → **Final Price**
- Formula: `unit_price = base_price / (1 - (OH% + Profit%))`
- Import dari template (JSON/Excel)
- Kategori AHSP (pekerjaan tanah, beton, baja, dll.)

#### Step 2 — WBS (Work Breakdown Structure)
Struktur hierarki pekerjaan proyek.
- Tree/hierarki: Level 1 (Divisi) → Level 2 (Sub-divisi) → Level 3 (Item)
- Setiap node WBS bisa di-link ke item RAB

#### Step 3 — RAB (Rencana Anggaran Biaya)
Budget rencana proyek (BOQ — Bill of Quantities).
- Tabel item pekerjaan: kode, nama, satuan, volume, harga satuan, total
- **Pemecahan biaya**: material, tenaga, alat, subkontraktor
- Link ke AHSP: `ahsp_item_id` / `ahsp_id`
- Link ke WBS: `wbsId`
- TKDN flag per item (`is_domestic`, `tkdn_percentage`)
- Markup: `markup_source`, `profit_basis`
- BudgetHealthPanel: Budget / RAB / RAP Planned / Aktual / CPI
- Import/export Excel
- Versi RAB (version history)

#### Step 4 — RAP (Rencana Anggaran Pelaksanaan)
Biaya pelaksanaan aktual yang direncanakan (lebih detail dari RAB).
- Data mirip RAB tapi merupakan perspektif biaya pelaksana
- Selisih RAB vs RAP = margin proyek

#### Step 5 — Resource Planning
Rencana kebutuhan sumber daya berdasarkan RAB/RAP.
- Kebutuhan material, labor, equipment per periode
- Link ke timeline tasks

**Komponen Pendukung:**
- `BudgetHealthPanel` — panel kesehatan anggaran
- `AlertStrip` — peringatan step kosong
- `WorkflowStepper` — progress indicator 5 langkah
- Guided onboarding saat pipeline kosong

---

### 6.5 COST FORECAST (`/cost-forecast`)

**Fungsi**: Proyeksi biaya dan analisis Earned Value Management (EVM).

**Metrik EVM:**
| Metrik | Keterangan |
|--------|-----------|
| **PV** | Planned Value — biaya yang seharusnya terpakai |
| **EV** | Earned Value — nilai pekerjaan yang selesai |
| **AC** | Actual Cost — biaya aktual yang dikeluarkan |
| **CPI** | Cost Performance Index = EV/AC (> 1 = efisien) |
| **SPI** | Schedule Performance Index = EV/PV (> 1 = lebih cepat) |
| **EAC** | Estimate at Completion — proyeksi biaya total |
| **VAC** | Variance at Completion — selisih budget vs EAC |
| **TCPI** | To-Complete Performance Index |

**Chart:** Grafik EVM (PV, EV, AC over time), Curva-S

---

### 6.6 SCHEDULE & OPERATIONS (`/schedule`)

**Fungsi**: Manajemen jadwal proyek terintegrasi dengan operasi lapangan.

**3 Mode:**
| Mode | Konten |
|------|--------|
| **Plan** | Gantt Chart, WBS editor |
| **Track** | Daily Progress Board, Resource Usage |
| **Analyze** | Curva-S, Risk Register, Scenario/What-If |

**Sub-fitur:**

#### Mode Plan
- **Gantt Chart** — visualisasi jadwal timeline, drag-drop tasks, dependencies
- **WBS** — hierarki pekerjaan terhubung dengan tasks
- CPM (Critical Path Method) via Web Worker — jalur kritis dihitung otomatis

#### Mode Track
- **Daily Progress Board** — pencatatan kemajuan harian per task
- **Resource Usage Dialog** — penggunaan tenaga/alat per hari
- Progress evidence upload (foto lapangan dengan metadata EXIF)
- Presence avatars (kolaborasi realtime — siapa yang sedang edit)

#### Mode Analyze
- **Curva-S Chart** — kurva kemajuan fisik vs rencana
- **Risk Register** — daftar risiko + severity + mitigation plan
- **Timeline Scenario Panel** — simulasi what-if: bagaimana jika terlambat X hari?
- **CPMWorkerStatus** — indikator perhitungan critical path background worker

**Data Task:**
- Nama, tanggal mulai/selesai, durasi, predecessor (dependency)
- % progress, status: `not_started`, `in_progress`, `completed`, `delayed`
- Sumber daya yang ditugaskan
- Link ke WBS node

---

### 6.7 SUPPLY CHAIN (`/supply-chain`)

**Fungsi**: Manajemen pengadaan material dan inventory dari permintaan hingga penerimaan.

**Alur Dokumen Pengadaan:**
```
Material Request (MR)  →  Purchase Order (PO)  →  GRN (Goods Receipt Note)
                                                        ↓
                                              Update Inventory Stock
```

**Tab/Sub-modul:**
| Tab | Konten |
|-----|--------|
| **Material Requests** | Permintaan material dari lapangan (MR) |
| **Purchase Orders** | Order pembelian ke vendor (PO) |
| **Inventory** | Stok material di gudang |
| **GRN** | Bukti penerimaan barang |
| **Material Transfer** | Mutasi material antar lokasi/proyek |
| **Subcontractor** | Panel subkontraktor |
| **MRP Alerts** | Alert kebutuhan material dari MRP engine |

**Status PO:** `PENDING` → `APPROVED` → `REJECTED` → `ORDERED` → `RECEIVED`

**Fitur Lanjutan:**
- **Procurement Trace Panel** — trace dokumen dari MR → PO → GRN → Invoice
- **TraceChain** — visual chain keterhubungan dokumen
- **MTR Panel** — Material Transfer Request dengan approval
- **MRP Alert Panel** — peringatan material yang akan habis
- Bulk action (approve/reject multiple sekaligus)
- Import via Excel
- Virtualisasi tabel besar (TanStack Virtual)

---

### 6.8 FIELD TASKS (`/field-tasks`)

**Fungsi**: Pencatatan tugas harian lapangan — dioptimalkan untuk mobile.

**Fitur:**
- Daftar tugas harian per worker/tim
- Checklist progress
- Upload foto bukti pekerjaan
- GPS/lokasi (via browser)
- Status: `todo`, `in_progress`, `done`
- Offline support (sync saat kembali online)

---

### 6.9 FINANCE (`/finance`)

**Fungsi**: Manajemen keuangan proyek — invoice, piutang, utang, dan cashflow.

**Tab Utama:**

| Tab | Konten |
|-----|--------|
| **AP (Accounts Payable)** | Invoice ke vendor/subkon yang harus dibayar |
| **AR (Accounts Receivable)** | Klaim/invoice ke klien |
| **Cashflow** | Proyeksi arus kas |
| **Opname** | Opname fisik progress untuk klaim |
| **3-Way Match** | Pencocokan PO + GRN + Invoice |

**Status Invoice AP:** `DRAFT` → `ISSUED` → `PENDING_PAYMENT` → `OVERDUE` → `PAID`

**Status Klaim AR:** `DRAFT` → `SUBMITTED` → `APPROVED` → `PAID`

**Fitur:**
- **InvoiceDialog** — form buat/edit invoice
- **ClaimDialog** — form buat/edit klaim klien
- **AgingReport** — laporan umur piutang/utang
- **ThreeWayMatch** — verifikasi 3 dokumen sekaligus
- **OpnameBoard** — board opname progress
- **CashflowForecastWidget** — grafik proyeksi cashflow
- **InvoiceMatchDialog** — matching invoice dengan PO/GRN
- **AnomalyWidget** — deteksi anomali keuangan
- **Progress Billing** — penagihan bertahap berdasarkan progress
- Bulk action, export, approval workflow

---

### 6.10 CHANGE MANAGEMENT (`/change-management`)

**Fungsi**: Manajemen perubahan kontrak — Variation Order / CCO (Contract Change Order).

**Tab:**
| Tab | Konten |
|-----|--------|
| **Log** | Daftar semua change order |
| **Impact Analysis** | Analisis dampak perubahan (biaya, jadwal, scope) |

**Status CCO (State Machine):**
```
DRAFT → PENDING_REVIEW → APPROVED → IMPLEMENTED
                       ↘ REJECTED
```

**Fitur:**
- **ChangeOrderDialog** — form buat/edit change order
- **ImpactAnalysisPanel** — analisis dampak terhadap biaya dan jadwal
- **Cascade Preview** — preview dampak berantai sebelum approve
- Confirm/reject dengan alasan
- Virtualisasi tabel

---

### 6.11 DOCUMENTS (`/documents`)

**Fungsi**: Repositori dokumen proyek dengan fitur QR code.

**Fitur:**
- Upload & manajemen dokumen (gambar, PDF, laporan)
- Kategorisasi dokumen
- QR code generator per dokumen untuk identifikasi fisik
- Pencarian & filter
- Kontrol akses per dokumen

---

### 6.12 HANDOVER WIZARD (`/handover`)

**Fungsi**: Wizard proses serah terima proyek step-by-step.

**Langkah-Langkah Wizard:**

```
Step 1: Prerequisite Check    → Cek kesiapan semua modul
Step 2: Summary Review        → Ringkasan proyek (inventory, outstanding issues)
Step 3: Outstanding Issues    → Daftar masalah yang belum terselesaikan
Step 4: Sign-Off              → Tanda tangan digital stakeholder
Step 5: Generate Report       → Buat laporan serah terima (PDF)
Step 6: Archive Project       → Arsipkan proyek
```

**Komponen:**
- **HandoverReadiness** — cek readiness dari setiap modul
- **SignOffPanel** — panel tanda tangan stakeholder dengan notes
- **OutstandingIssue** — daftar issue yang perlu diselesaikan
- Download laporan serah terima
- Konfirmasi arsip dengan AlertDialog

---

### 6.13 TKDN (`/tkdn`)

**Fungsi**: Manajemen dan pelaporan Tingkat Komponen Dalam Negeri (TKDN) sesuai regulasi Indonesia.

**Fitur:**
- Pelabelan item `is_domestic` pada material/pekerjaan
- Kalkulasi persentase TKDN per proyek
- Laporan kepatuhan TKDN
- Export laporan untuk keperluan regulasi

---

### 6.14 QHSE (`/qhse`)

**Fungsi**: Quality, Health, Safety, Environment management.

**Fitur:**
- Laporan insiden & near-miss
- Checklist inspeksi keselamatan
- Daftar APD (Alat Pelindung Diri) yang diperlukan
- Izin kerja (work permit)
- Catatan kualitas pekerjaan
- Laporan lingkungan

---

### 6.15 SUBCONTRACTOR MANAGEMENT (`/subcontractors`)

**Fungsi**: Manajemen kontrak dan kinerja subkontraktor.

**Fitur:**
- Daftar subkontraktor dengan info kontak
- Kontrak per subkontraktor (nilai, scope, periode)
- Work orders untuk subkontraktor
- Tracking progress pekerjaan subkon
- Evaluasi kinerja subkontraktor
- Pembayaran subkontraktor

---

### 6.16 PORTFOLIO RESOURCES (`/portfolio-resources`)

**Fungsi**: Visualisasi alokasi sumber daya lintas semua proyek aktif.

**Fitur:**
- **Resource Heatmap** — peta panas ketersediaan & alokasi sumber daya
- Identifikasi overallocation & underutilization
- View per tipe resource (labor, alat, dll.)
- Timeline view alokasi

---

### 6.17 PORTFOLIO ANALYTICS (`/portfolio-analytics`)

**Fungsi**: Dashboard KPI agregat semua proyek untuk level direksi.

**Metrik:**
| Metrik | Keterangan |
|--------|-----------|
| **CPI Portoflio** | Rata-rata efisiensi biaya semua proyek |
| **SPI Portfolio** | Rata-rata kinerja jadwal semua proyek |
| **PHI** | Portfolio Health Index |
| **Total Budget vs Aktual** | Perbandingan lintas proyek |
| **Risk Exposure** | Eksposur risiko portfolio |

---

### 6.18 BI REPORT BUILDER (`/bi-reports`)

**Fungsi**: Builder laporan custom dengan drag-drop widget.

**Fitur:**
- Pilih metrik & KPI yang ingin ditampilkan
- Tentukan rentang tanggal
- Export ke PDF / Excel
- Template laporan standar (laporan kemajuan mingguan, bulanan)

---

### 6.19 STRATEGY SIMULATION (`/strategy-sim`)

**Fungsi**: Simulasi skenario strategis untuk pengambilan keputusan.

**Fitur:**
- What-if analysis: "Jika anggaran dipotong X%, apa dampaknya?"
- Simulasi crash program (percepatan jadwal)
- Optimasi resource allocation
- Perbandingan skenario (side-by-side)

---

### 6.20 MAINTENANCE (`/maintenance`)

**Fungsi**: Manajemen pemeliharaan aset/fasilitas proyek.

**Fitur:**
- Jadwal pemeliharaan preventif
- Work orders pemeliharaan
- History pemeliharaan per aset
- Laporan kondisi aset

---

### 6.21 SETTINGS (`/settings`)

**Fungsi**: Konfigurasi proyek aktif, tim, dan master data.

**Tab:**
| Tab | Konten |
|-----|--------|
| **General** | Nama proyek, lokasi, tanggal, anggaran, payment terms |
| **Team** | Manajemen anggota tim (undang, hapus, ubah role) |
| **Master Data** | Link ke AHSP, Vendor, Cost Centers |

---

## 7. MODEL DATA KUNCI

### 7.1 Project

```typescript
interface Project {
  id: string                                          // "P-001"
  name: string                                        // Nama proyek
  budget: number                                      // Total anggaran (IDR)
  status: 'Active' | 'Planning' | 'Completed' | 'ARCHIVED'
  startDate?: string                                  // ISO date
  endDate?: string                                    // ISO date
  location?: string
}
```

### 7.2 AHSP Item

```typescript
interface AHSPItem {
  id: string
  code: string          // "6.3.2.7"
  name: string
  unit: ResourceUnit    // 'm3', 'm2', 'oh', dll.
  category: string
  basePrice: number     // Biaya pokok dari komponen
  overheadPct: number   // % Overhead
  profitPct: number     // % Profit
  finalPrice: number    // base + OH + Profit
  components: AHSPComponent[]  // Daftar material/labor/alat
}
```

### 7.3 RAB Item

```typescript
interface RABItem {
  id: string
  projectId: string
  code?: string
  name?: string
  unit?: string
  volume?: number           // Jumlah/kuantitas
  unit_price?: number       // Harga per satuan
  base_price?: number       // Biaya pokok AHSP
  finalTotal?: number       // volume × unit_price
  cost_material?: number    // Split biaya material
  cost_labor?: number       // Split biaya tenaga
  cost_equipment?: number   // Split biaya alat
  cost_subcon?: number      // Split biaya subkon
  markup_percentage?: number
  is_domestic?: boolean     // Untuk TKDN
  tkdn_percentage?: number
  ahsp_id?: string          // Link ke AHSP
  wbsId?: string            // Link ke WBS
}
```

### 7.4 Resource (Material/Labor/Alat)

```typescript
interface Resource {
  id: string
  code: string          // "M-001", "L-001", "E-001"
  name: string
  type: 'material' | 'labor' | 'equipment' | 'subcontractor'
  unit: ResourceUnit
  unitPrice: number
  supplier?: string
  isActive: boolean
}
```

### 7.5 Timeline Task

```typescript
interface TimelineTask {
  id: string
  projectId: string
  name: string
  startDate: string
  endDate: string
  duration: number        // hari
  progress: number        // 0-100 %
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  predecessors?: string[] // task IDs yang harus selesai dulu
  wbsId?: string
  resourceIds?: string[]
}
```

### 7.6 Purchase Order

```typescript
interface PurchaseOrder {
  id: string
  projectId: string
  materialRequestId?: string
  vendorId: string
  items: POItem[]
  totalAmount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'RECEIVED'
  orderDate: string
  expectedDelivery: string
}
```

### 7.7 Invoice (Finance)

```typescript
interface Invoice {
  id: string
  projectId: string
  type: 'AP' | 'AR'   // Payable atau Receivable
  invoiceNumber: string
  amount: number
  dueDate: string
  status: 'DRAFT' | 'ISSUED' | 'PENDING_PAYMENT' | 'OVERDUE' | 'PAID'
  vendorId?: string
  poId?: string
  grnId?: string
}
```

### 7.8 Change Order

```typescript
interface ChangeOrder {
  id: string
  projectId: string
  number: string      // Nomor CCO
  description: string
  costImpact: number  // + (tambahan biaya) atau - (pengurangan)
  scheduleImpact: number  // hari
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED'
  requestedBy: string
  reviewedBy?: string
}
```

---

## 8. POLA INTERAKSI UMUM

### 8.1 CRUD Pattern

Setiap modul mengikuti pola interaksi yang konsisten:

```
List View (tabel/grid)
  ↓ klik "Tambah"
Dialog/Drawer (form buat baru)
  ↓ simpan
Refresh list + toast sukses

List View
  ↓ klik item / ikon edit
Dialog/Drawer (form edit)
  ↓ simpan
Refresh + toast sukses

List View  
  ↓ klik ikon hapus
AlertDialog konfirmasi
  ↓ konfirmasi
Hapus + refresh + toast
```

### 8.2 Approval Workflow

```
Item dibuat (DRAFT)
  ↓ submit untuk review
PENDING_REVIEW (notifikasi ke approver)
  ↓ approver buka ApprovalInbox
Approve / Reject dengan komentar
  ↓
APPROVED / REJECTED (notifikasi ke creator)
```

### 8.3 Filter & Sort Tabel

Semua tabel utama memiliki:
- Input pencarian teks (`ModuleListToolbar`)
- Dropdown filter status
- Dropdown sort (terbaru, terlama, nilai tertinggi, dll.)
- Bulk action bar (muncul saat ada item tercentang)

### 8.4 Export Data

Tombol Export menggunakan `ExportMenu` yang menawarkan:
- **Excel** (.xlsx via xlsx library)
- **PDF** (.pdf via jsPDF + autotable)
- **Print** (via print dialog browser)

### 8.5 Import Data

- Tombol "Import" membuka `ExcelImportPreviewDialog`
- User upload file Excel
- Preview data sebelum konfirmasi import
- Validasi otomatis sebelum simpan

### 8.6 Toast Notifikasi

Menggunakan **Sonner** toast system:
- ✅ Hijau: operasi berhasil
- ❌ Merah: error
- ⚠️ Kuning: peringatan
- ℹ️ Biru: informasi

### 8.7 Loading States

- **Skeleton** — placeholder konten saat data loading
- **Spinner** (Loader2 dari Lucide) — pada tombol saat aksi sedang berjalan
- `aria-busy="true"` + `aria-label` untuk screen reader

### 8.8 Empty States

Komponen `EmptyState` ditampilkan saat daftar kosong, berisi:
- Ikon kontekstual
- Pesan penjelasan
- Tombol aksi (misal: "Buat Item Pertama")

### 8.9 Error Handling

- **ErrorBoundary** — menangkap crash React, tampil UI fallback
- **ModulePageState** — state kosong/error khusus per modul
- Pesan error yang user-friendly (bukan stack trace)
- Tombol: coba lagi, muat ulang, kembali ke beranda

---

## 9. FITUR OFFLINE & REALTIME

### 9.1 Offline-First Architecture

Aplikasi adalah **PWA (Progressive Web App)** dengan kemampuan offline:

```
Online:  data dari Supabase (PostgreSQL)
Offline: data dari IndexedDB (Dexie) + Service Worker cache

Saat kembali online:
  offlineQueueStore → sync operasi yang belum tersimpan ke server
  Toast notifikasi: "Sinkronisasi berhasil: X operasi diterapkan"
```

**Tabel IndexedDB:**
- `ahsp`, `resources`, `components`, `rabItems`
- `tasks`, `projects`, `auditLogs`

### 9.2 Realtime Updates

Menggunakan Supabase Realtime (PostgreSQL Changes):
- **Command Center** — auto-refresh saat ada perubahan `timeline_tasks`
- **Presence Avatars** (`ScheduleOps`) — lihat siapa yang sedang membuka modul yang sama
- **Approval inbox** — update saat ada approval baru

### 9.3 NetworkProvider

Komponen `NetworkProvider` mendeteksi status koneksi:
- Event: `online` / `offline` dari browser
- Menampilkan banner "Offline Mode" saat tidak ada koneksi
- Auto-sync saat koneksi kembali (delay 3-5 detik)

---

## 10. AKSESIBILITAS & RESPONSIVITAS

### 10.1 Standar Aksesibilitas (WCAG)

Aplikasi mengimplementasikan WCAG (accessibility standard):
- `aria-live` regions untuk update status dinamis (sr-only)
- `aria-label` pada semua tombol ikon
- `aria-busy="true"` pada elemen loading
- Focus management pada dialog dan drawer
- Keyboard navigation (Tab, Enter, Escape)
- Kontras warna memenuhi WCAG AA minimum

### 10.2 Responsivitas

- **Desktop (≥1024px)**: Full layout dengan sidebar + konten
- **Tablet (768-1023px)**: Sidebar collapsible
- **Mobile (<768px)**: Layout stack, sidebar overlay
- Field Tasks dioptimalkan untuk layar ponsel
- Hook `use-breakpoint.ts` untuk responsive logic

### 10.3 Screen Reader Support

- Komponen Radix UI sudah accessible by default
- Setiap perubahan status diumumkan via `aria-live="polite"`
- Tabel dengan proper `scope` attribute pada header

---

## 11. ALUR KERJA BISNIS (BUSINESS FLOWS)

### 11.1 Alur Proyek Baru

```
1. Buat proyek di /projects
   ↓
2. Setup AHSP (master harga satuan) di /costing > Step 1
   ↓
3. Buat WBS (struktur pekerjaan) di /costing > Step 2
   ↓
4. Input RAB (anggaran) di /costing > Step 3
   ↓
5. Input RAP (biaya pelaksanaan) di /costing > Step 4
   ↓
6. Buat jadwal di /schedule > Plan Mode
   ↓
7. Proyek berjalan: input progress harian di /schedule > Track
   ↓
8. Monitor biaya aktual di /finance (AP)
   ↓
9. Klaim ke klien via /finance (AR)
   ↓
10. Serah terima via /handover
```

### 11.2 Alur Pengadaan Material

```
Lapangan butuh material
   ↓
Buat Material Request (MR) di /supply-chain
   ↓
MR disetujui oleh supervisor
   ↓
Admin buat Purchase Order (PO) ke vendor
   ↓
PO disetujui oleh manajemen
   ↓
Material tiba → buat GRN (Goods Receipt Note)
   ↓
Inventory stok bertambah
   ↓
Vendor kirim invoice → masuk ke Finance AP
   ↓
3-Way Match: PO + GRN + Invoice dicocokkan
   ↓
Invoice disetujui → pembayaran
```

### 11.3 Alur Perubahan Kontrak

```
Terjadi perubahan di lapangan
   ↓
Site manager buat Change Order (CCO) di /change-management
   ↓
Isi: deskripsi, dampak biaya, dampak jadwal
   ↓
Submit untuk review → status PENDING_REVIEW
   ↓
Manager review di ApprovalInbox (Command Center)
   ↓
Approve (cascade update ke RAB/jadwal) atau Reject
   ↓
Status CCO → APPROVED/REJECTED
   ↓
Jika approved → implement perubahan → IMPLEMENTED
```

### 11.4 Alur Klaim ke Klien (Progress Billing)

```
Lapangan input progress harian di /schedule
   ↓
QS lakukan opname di /finance > Opname
   ↓
Hitung nilai pekerjaan yang selesai (EV)
   ↓
Buat klaim/invoice AR ke klien di /finance > AR
   ↓
Submit untuk approval internal
   ↓
Setelah approved, kirim ke klien
   ↓
Klien bayar → status PAID → cashflow masuk
```

---

## 12. KOMPONEN UI REUSABLE

### 12.1 Komponen Pattern (Enterprise)

| Komponen | Fungsi | Props Kunci |
|----------|--------|-------------|
| `GlobalContextBar` | Bar konteks proyek di atas setiap halaman | projectName, status, onSwitch |
| `ModeSwitch` | Toggle mode tampilan | modes[], activeMode, onChange |
| `WorkspaceHeader` | Header halaman dengan aksi | title, subtitle, actions[] |
| `SummaryStrip` | Strip KPI ringkas | items[{ label, value, icon }] |
| `AlertStrip` | Banner peringatan | severity, message, action |
| `PageShell` | Wrapper layout + breadcrumb | breadcrumbs[], children |
| `WorkflowStepper` | Indikator langkah bertahap | steps[], currentStep, onStepChange |

### 12.2 Komponen Common

| Komponen | Fungsi |
|----------|--------|
| `ErrorBoundary` | Menangkap error React, tampilkan fallback UI |
| `ModulePageState` | State empty/error/loading per modul |
| `EmptyState` | Tampilan saat daftar kosong |
| `PermissionGuard` | Render kondisional berdasarkan izin |
| `LoadingSkeleton` | Skeleton placeholder loading |
| `AnomalyWidget` | Widget deteksi anomali |
| `BulkActionBar` | Bar aksi untuk item yang dipilih (multi-select) |
| `ExcelImportPreviewDialog` | Preview sebelum import Excel |
| `AuditLogViewer` | Viewer log audit aktivitas |
| `PresenceAvatars` | Avatar pengguna yang sedang online di halaman |
| `TraceChain` / `TraceCountBadge` | Visual keterhubungan dokumen |

### 12.3 Komponen Dashboard

| Komponen | Lokasi | Fungsi |
|----------|--------|--------|
| `TelemetryHUD` | Command Center | KPI utama proyek |
| `PerformanceKPIs` | Command Center | CPI, SPI, PHI |
| `OperationalAlerts` | Command Center | Peringatan operasional |
| `ActivityLogStream` | Command Center | Stream aktivitas |
| `ApprovalInbox` | Command Center | Daftar persetujuan tertunda |
| `CriticalPathWarningPanel` | Command Center | Peringatan jalur kritis |
| `MRPAlertPanel` | Command Center / Supply Chain | Alert material |

### 12.4 Komponen Spesifik Modul

| Komponen | Modul | Fungsi |
|----------|-------|--------|
| `GanttChart` | Schedule | Visualisasi Gantt |
| `CurvaSChart` | Schedule / Cost Forecast | Kurva S progress |
| `CriticalPathGantt` | Schedule | Gantt dengan highlight jalur kritis |
| `RiskRegister` | Schedule > Analyze | Register risiko |
| `DailyProgressBoard` | Schedule > Track | Board progress harian |
| `InvoiceDialog` | Finance | Form invoice AP/AR |
| `ClaimDialog` | Finance | Form klaim klien |
| `AgingReport` | Finance | Laporan umur piutang |
| `ThreeWayMatch` | Finance | Cocok PO + GRN + Invoice |
| `CashflowForecastWidget` | Finance | Widget proyeksi cashflow |
| `MaterialRequestDialog` | Supply Chain | Form material request |
| `PurchaseOrderDialog` | Supply Chain | Form purchase order |
| `GRNDialog` | Supply Chain | Form goods receipt note |
| `MaterialTransferDialog` | Supply Chain | Form transfer material |
| `ChangeOrderDialog` | Change Management | Form change order |
| `ImpactAnalysisPanel` | Change Management | Analisis dampak CCO |
| `SignOffPanel` | Handover | Panel tanda tangan |
| `BudgetHealthPanel` | Project Costing | Panel kesehatan anggaran |

---

## 13. REFERENSI TERMINOLOGI KONSTRUKSI

| Istilah | Kepanjangan | Penjelasan |
|---------|-------------|-----------|
| **AHSP** | Analisis Harga Satuan Pekerjaan | Standar perhitungan harga per satuan pekerjaan (SNI) |
| **RAB** | Rencana Anggaran Biaya | Budget proyek dari perspektif owner/klien (≈ BOQ) |
| **RAP** | Rencana Anggaran Pelaksanaan | Rencana biaya dari perspektif kontraktor pelaksana |
| **BOQ** | Bill of Quantities | Daftar volume pekerjaan dan harga |
| **WBS** | Work Breakdown Structure | Hierarki struktur pekerjaan proyek |
| **CPM** | Critical Path Method | Metode menentukan jalur pekerjaan terpanjang/kritis |
| **EVM** | Earned Value Management | Metode monitor biaya dan jadwal terintegrasi |
| **CPI** | Cost Performance Index | Indeks efisiensi biaya (EV/AC) |
| **SPI** | Schedule Performance Index | Indeks kinerja jadwal (EV/PV) |
| **EAC** | Estimate at Completion | Proyeksi biaya total hingga selesai |
| **VAC** | Variance at Completion | Selisih budget vs EAC |
| **PV** | Planned Value | Nilai rencana pekerjaan pada titik waktu tertentu |
| **EV** | Earned Value | Nilai pekerjaan yang telah diselesaikan |
| **AC** | Actual Cost | Biaya aktual yang sudah dikeluarkan |
| **CCO** | Contract Change Order | Dokumen resmi perubahan kontrak |
| **VO** | Variation Order | Perintah perubahan pekerjaan |
| **PO** | Purchase Order | Surat pemesanan ke vendor |
| **GRN** | Goods Receipt Note | Bukti penerimaan barang |
| **MR** | Material Request | Permintaan material dari lapangan |
| **MRP** | Material Requirement Planning | Perencanaan kebutuhan material |
| **AP** | Accounts Payable | Hutang / invoice yang harus dibayar |
| **AR** | Accounts Receivable | Piutang / klaim yang akan diterima |
| **TKDN** | Tingkat Komponen Dalam Negeri | Persentase penggunaan produk/jasa lokal Indonesia |
| **QHSE** | Quality, Health, Safety, Environment | Manajemen mutu, K3, dan lingkungan |
| **PHI** | Portfolio Health Index | Indeks kesehatan keseluruhan portofolio proyek |
| **Curva-S** | — | Kurva berbentuk S yang menggambarkan kemajuan proyek terhadap waktu |
| **Opname** | — | Pemeriksaan fisik kemajuan pekerjaan untuk dasar pembayaran |
| **OH** | Overhead | Biaya tidak langsung (administrasi, kantor, dsb.) |
| **SNI** | Standar Nasional Indonesia | Standar analisis harga satuan pekerjaan resmi Indonesia |
| **3-Way Match** | — | Pencocokan 3 dokumen: PO + GRN + Invoice sebelum bayar |
| **SLA** | Service Level Agreement | Batas waktu penyelesaian tugas/persetujuan |

---

## CATATAN UNTUK DESAINER

### Prioritas Alur yang Perlu Diperhatikan

1. **Onboarding proyek baru** — alur dari Projects → Settings → Costing Pipeline harus mulus dan terpandu
2. **Pipeline Costing** (AHSP → WBS → RAB → RAP → Resource) — flow 5 langkah ini paling kompleks dan sering digunakan
3. **Approval workflow** — inbox approval di Command Center harus menonjol dan aksesibel
4. **Mobile Field Tasks** — harus bisa digunakan dengan satu tangan di lapangan
5. **Finance 3-Way Match** — visual keterhubungan PO + GRN + Invoice harus jelas

### Data Format Penting

- Nilai uang: `Rp 1.250.000.000` (format IDR dengan pemisah ribuan titik)
- Persentase: `85,3%` (koma sebagai desimal — Indonesia locale)
- Tanggal: `15 Januari 2026` atau `15/01/2026`
- Kode item: alfanumerik terstruktur, misal `AHSP-6.3.2.7`, `M-001`, `PO-2026-001`

### Status & Warna Badge

| Status | Warna Direkomendasikan |
|--------|----------------------|
| Active / Approved / Paid / Completed | Hijau |
| Pending / In Progress / Submitted | Kuning/Amber |
| Draft | Abu-abu |
| Rejected / Overdue / Delayed | Merah |
| Archived | Abu-abu gelap |
| Planning | Biru |

---

*Dokumen ini dibuat sebagai referensi sistem untuk keperluan desain UI/UX MLPHoma. Untuk detail implementasi teknis, lihat ARCHITECTURE.md dan FRONTEND_REFACTOR_MASTERPLAN.md.*
