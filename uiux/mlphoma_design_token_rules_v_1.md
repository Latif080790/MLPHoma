# MLPHoma Design Token Rules v1.0

## 1. Tujuan
Dokumen ini mendefinisikan design tokens inti untuk MLPHoma agar seluruh modul menggunakan bahasa visual yang konsisten, scalable, mudah diimplementasikan, dan sesuai standar enterprise B2B SaaS untuk Construction Project Management.

Dokumen ini melengkapi:
- MLPHoma Design System Rules v1.0
- MLPHoma Component Specification v1.0

Fokus dokumen ini:
- color tokens
- semantic status tokens
- typography tokens
- spacing tokens
- radius tokens
- border tokens
- shadow tokens
- sizing tokens
- motion tokens
- z-index tokens
- responsive breakpoints
- usage rules

---

## 2. Prinsip Umum Token System

### 2.1 Token Harus Semantik
Gunakan token berdasarkan fungsi, bukan nama warna visual.

Benar:
- color.status.success
- color.surface.panel
- color.text.secondary
- border.default

Salah:
- green-1 untuk semua kebutuhan
- blue-box-shadow-hard
- gray-light-2 untuk konteks acak

### 2.2 Token Harus Reusable
Setiap token harus dapat dipakai lintas modul tanpa tergantung ke satu halaman tertentu.

### 2.3 Token Tidak Boleh Jadi Hardcoded Style
Desainer dan frontend tidak boleh menanamkan nilai langsung pada komponen jika token resmi sudah tersedia.

---

## 3. Color Tokens

## 3.1 Brand Colors
Brand harus terasa profesional, modern, tenang, dan enterprise-ready.

### Primary Brand
- `color.brand.primary.900` = untuk emphasis kuat, active states utama
- `color.brand.primary.700` = default primary brand
- `color.brand.primary.500` = accent standard
- `color.brand.primary.300` = subtle accent / light backgrounds
- `color.brand.primary.100` = tinted surface
- `color.brand.primary.050` = very light background wash

### Secondary Brand
- `color.brand.secondary.700`
- `color.brand.secondary.500`
- `color.brand.secondary.100`

### Accent Support
Dipakai hemat untuk kategori atau supporting UI.
- `color.brand.teal.*`
- `color.brand.indigo.*`
- `color.brand.cyan.*`

Aturan:
- primary untuk active navigation, CTA, links penting, focused indicators
- secondary/accent hanya untuk support, tidak menggantikan status colors

---

## 3.2 Neutral Scale
Neutral scale adalah fondasi seluruh UI.

### Neutral Tokens
- `color.neutral.0` = pure white / base canvas
- `color.neutral.25`
- `color.neutral.50`
- `color.neutral.100`
- `color.neutral.150`
- `color.neutral.200`
- `color.neutral.300`
- `color.neutral.400`
- `color.neutral.500`
- `color.neutral.600`
- `color.neutral.700`
- `color.neutral.800`
- `color.neutral.900`
- `color.neutral.950` = near-black for dark text emphasis

### Penggunaan
- canvas: neutral.25 atau neutral.50
- cards/panels: neutral.0
- dividers/borders: neutral.150–300
- secondary text: neutral.500–600
- primary text: neutral.800–950
- disabled states: neutral.300–400

---

## 3.3 Semantic Surface Tokens
Gunakan surface token, bukan raw neutral.

### Surface
- `color.surface.canvas`
- `color.surface.page`
- `color.surface.panel`
- `color.surface.panel-hover`
- `color.surface.panel-active`
- `color.surface.subtle`
- `color.surface.elevated`
- `color.surface.overlay`
- `color.surface.inverse`

### Usage
- canvas aplikasi = `color.surface.canvas`
- card / table / drawer = `color.surface.panel`
- sticky strips = `color.surface.subtle`
- dropdown / modal = `color.surface.elevated`
- dark header / inverse badge = `color.surface.inverse`

---

## 3.4 Text Tokens
### Text Primary Hierarchy
- `color.text.primary`
- `color.text.secondary`
- `color.text.tertiary`
- `color.text.disabled`
- `color.text.inverse`
- `color.text.link`
- `color.text.link-hover`

### Usage
- titles, strong values = primary
- descriptions, subtitles = secondary
- helper text, metadata = tertiary
- disabled = disabled
- inverse = text di dark surfaces

---

## 3.5 Icon Tokens
- `color.icon.primary`
- `color.icon.secondary`
- `color.icon.tertiary`
- `color.icon.disabled`
- `color.icon.inverse`
- `color.icon.brand`

Icon harus mengikuti hierarchy yang sama dengan teks, bukan selalu diberi warna brand.

---

## 3.6 Border Tokens
- `color.border.default`
- `color.border.subtle`
- `color.border.strong`
- `color.border.focus`
- `color.border.disabled`
- `color.border.inverse`

---

## 3.7 Status Tokens
### Success / Ready
- `color.status.success.fg`
- `color.status.success.bg`
- `color.status.success.border`

### Warning / Watch
- `color.status.warning.fg`
- `color.status.warning.bg`
- `color.status.warning.border`

### Danger / Critical
- `color.status.danger.fg`
- `color.status.danger.bg`
- `color.status.danger.border`

### Info / Draft
- `color.status.info.fg`
- `color.status.info.bg`
- `color.status.info.border`

### Locked / Neutral State
- `color.status.locked.fg`
- `color.status.locked.bg`
- `color.status.locked.border`

### Usage Mapping
- Approved / Ready / Safe / On Track → success
- Watch → warning low
- At Risk / Warning → warning high or amber/orange variant
- Blocked / Overrun / Critical → danger
- Draft / In Progress → info
- Locked / Read-only / Archived → locked/neutral

---

## 3.8 Special Category Tokens
Untuk kategori domain seperti Material, Labor, Equipment, Subcon, gunakan accent category token yang konsisten.

- `color.category.material`
- `color.category.labor`
- `color.category.equipment`
- `color.category.subcon`
- `color.category.document`
- `color.category.finance`
- `color.category.risk`
- `color.category.schedule`

Aturan:
- token kategori tidak boleh dipakai untuk status success/warning/error
- token kategori hanya dipakai untuk legend, category chips, grouped tables, charts, and tags

---

## 4. Typography Tokens

## 4.1 Font Families
- `font.family.base`
- `font.family.mono`

Base dipakai untuk UI utama.
Mono dipakai untuk:
- angka teknis tertentu
- code/reference ID
- compact numeric displays jika diperlukan

---

## 4.2 Font Weights
- `font.weight.regular`
- `font.weight.medium`
- `font.weight.semibold`
- `font.weight.bold`

Aturan:
- body text = regular/medium
- labels penting = medium
- section titles = semibold
- angka summary utama = semibold/bold

---

## 4.3 Font Size Tokens
- `font.size.11`
- `font.size.12`
- `font.size.13`
- `font.size.14`
- `font.size.16`
- `font.size.18`
- `font.size.20`
- `font.size.24`
- `font.size.28`
- `font.size.32`

### Usage
- helper/meta = 11–12
- table/body = 13–14
- section title = 16–18
- module title = 20–24
- page title / key hero value = 24–32

---

## 4.4 Line Heights
- `font.lineHeight.tight`
- `font.lineHeight.snug`
- `font.lineHeight.normal`
- `font.lineHeight.relaxed`

Aturan:
- headings = tight/snug
- body copy = normal
- long helper/descriptions = relaxed

---

## 4.5 Letter Spacing
- `font.letterSpacing.tight`
- `font.letterSpacing.normal`
- `font.letterSpacing.wide`

Usage:
- uppercase labels kecil / overline = wide
- body / headings = normal atau tight secukupnya

---

## 5. Spacing Tokens

## 5.1 Base Scale
Gunakan skala 4 px.

### Spacing Token Set
- `space.0` = 0
- `space.1` = 4
- `space.2` = 8
- `space.3` = 12
- `space.4` = 16
- `space.5` = 20
- `space.6` = 24
- `space.8` = 32
- `space.10` = 40
- `space.12` = 48
- `space.16` = 64
- `space.20` = 80
- `space.24` = 96

### Usage Rules
- antar elemen kecil = 8–12
- antar field/form rows = 12–16
- antar section = 24
- antar major blocks = 32+

---

## 5.2 Padding Tokens
- `padding.xs`
- `padding.sm`
- `padding.md`
- `padding.lg`
- `padding.xl`

### Mapping
- xs = 8
- sm = 12
- md = 16
- lg = 24
- xl = 32

Usage:
- buttons kecil = xs / sm
- cards compact = md
- panels utama = lg
- hero/landing sections = xl

---

## 5.3 Gap Tokens
- `gap.xs`
- `gap.sm`
- `gap.md`
- `gap.lg`
- `gap.xl`

Gunakan untuk layout flex/grid, jangan hardcode gap acak.

---

## 6. Radius Tokens

### Radius Set
- `radius.none` = 0
- `radius.xs` = 4
- `radius.sm` = 8
- `radius.md` = 12
- `radius.lg` = 16
- `radius.xl` = 20
- `radius.full` = pill/circle

### Usage
- badges/chips = full atau sm
- buttons = sm atau md
- cards/panels = lg
- modal/drawer besar = xl
- tables dalam container = lg container + subtle internal rows

Aturan:
- jangan terlalu banyak variasi radius dalam satu layar
- maksimal 2–3 radius dominan per modul

---

## 7. Border Tokens

### Border Width
- `border.width.none`
- `border.width.thin` = 1
- `border.width.medium` = 2
- `border.width.strong` = 3

### Border Radius + Color Kombinasi Semantik
- `border.default`
- `border.subtle`
- `border.emphasis`
- `border.focus`
- `border.status.success`
- `border.status.warning`
- `border.status.danger`

---

## 8. Shadow Tokens

### Shadow Set
- `shadow.none`
- `shadow.xs`
- `shadow.sm`
- `shadow.md`
- `shadow.lg`
- `shadow.xl`

### Usage
- panel default = none/xs
- dropdown / popover = sm
- drawer/modal = md
- highly elevated overlays = lg

Aturan enterprise:
- gunakan shadow dengan restraint
- prioritaskan border + contrast surface, bukan shadow tebal
- shadow tidak boleh terasa dekoratif berlebihan

---

## 9. Opacity Tokens
- `opacity.disabled`
- `opacity.subtle`
- `opacity.overlay`
- `opacity.hover`
- `opacity.focus`

Pakai untuk disabled states, overlays, dan hover intensities.

---

## 10. Sizing Tokens

## 10.1 Icon Size
- `size.icon.xs` = 12
- `size.icon.sm` = 16
- `size.icon.md` = 20
- `size.icon.lg` = 24
- `size.icon.xl` = 32

## 10.2 Control Height
- `size.control.sm` = 32
- `size.control.md` = 40
- `size.control.lg` = 48

Usage:
- dense table controls = sm
- default forms/buttons = md
- mobile important CTA = lg

## 10.3 Row Height
- `size.row.compact`
- `size.row.default`
- `size.row.comfortable`

Mapping:
- compact = 36
- default = 44
- comfortable = 52

## 10.4 Sidebar Width
- `size.sidebar.expanded`
- `size.sidebar.collapsed`

Suggested:
- expanded = 280
- collapsed = 72

## 10.5 Inspector Width
- `size.inspector.default` = 380–420
- `size.inspector.compact` = 320–360

---

## 11. Motion Tokens

## 11.1 Duration
- `motion.duration.fast` = 120ms
- `motion.duration.normal` = 180ms
- `motion.duration.slow` = 240ms
- `motion.duration.emphasis` = 320ms

## 11.2 Easing
- `motion.easing.standard`
- `motion.easing.decelerate`
- `motion.easing.accelerate`
- `motion.easing.emphasis`

### Usage
- hover/focus = fast
- dropdown/drawer open = normal
- page/section transitions = slow বা emphasis secukupnya

Aturan:
- animasi harus mendukung kejelasan, bukan dekorasi
- hindari motion berlebihan di data-heavy UI

---

## 12. Z-Index Tokens
- `z.base`
- `z.sticky`
- `z.dropdown`
- `z.popover`
- `z.drawer`
- `z.modal`
- `z.toast`
- `z.tooltip`

Aturan:
- gunakan sistem bertingkat jelas
- jangan pakai nilai arbitrer per komponen

---

## 13. Responsive Breakpoints

### Breakpoints
- `breakpoint.xs`
- `breakpoint.sm`
- `breakpoint.md`
- `breakpoint.lg`
- `breakpoint.xl`
- `breakpoint.2xl`

Suggested mapping:
- xs = 0
- sm = 640
- md = 768
- lg = 1024
- xl = 1280
- 2xl = 1440+

### Usage Rules
- desktop planning starts at lg
- tablet optimization at md
- mobile-first stack below md
- high-density enterprise layouts optimized for xl and above

---

## 14. Data Visualization Tokens

## 14.1 Chart Palette
Gunakan palette terbatas dan konsisten.

Primary series:
- `chart.series.1`
- `chart.series.2`
- `chart.series.3`
- `chart.series.4`
- `chart.series.5`

Semantic chart colors:
- `chart.success`
- `chart.warning`
- `chart.danger`
- `chart.neutral`

### Usage
- jangan campur warna chart dengan status tanpa alasan
- category palette harus konsisten lintas modul
- gunakan Material/Labor/Equipment/Subcon palette yang stabil di semua chart costing/resource

---

## 15. Table/Row Tokens

### Row Background Tokens
- `table.row.default`
- `table.row.hover`
- `table.row.selected`
- `table.row.active`
- `table.row.warning`
- `table.row.error`
- `table.row.group`

### Table Header Tokens
- `table.header.bg`
- `table.header.text`
- `table.header.border`

### Table Footer Tokens
- `table.footer.bg`
- `table.footer.text`
- `table.footer.border`

---

## 16. Focus and Accessibility Tokens

### Focus Ring
- `focus.ring.color`
- `focus.ring.width`
- `focus.ring.offset`

Aturan:
- focus state wajib terlihat jelas
- jangan gunakan focus yang terlalu samar
- kontras harus cukup di light surfaces dan dark surfaces

### Disabled
- `state.disabled.bg`
- `state.disabled.text`
- `state.disabled.border`
- `state.disabled.opacity`

---

## 17. Token Usage Rules per Komponen

## 17.1 Buttons
- primary button menggunakan brand primary + high contrast text
- secondary button menggunakan neutral surface + default border
- ghost button menggunakan transparent bg + text emphasis
- destructive button menggunakan danger semantic

## 17.2 Cards/Panels
- panel default pakai surface.panel
- jangan semua panel diberi shadow besar
- border subtle lebih disukai untuk enterprise workspaces

## 17.3 Badges
- gunakan semantic status tokens atau category tokens
- ukuran kecil, radius penuh, padding rapat

## 17.4 Inputs
- height menggunakan control height tokens
- focus pakai focus ring token
- error pakai status danger tokens

## 17.5 Navigation
- active nav menggunakan brand primary tinted bg + text/icon emphasis
- hover nav menggunakan subtle surface
- section headers menggunakan tertiary text + uppercase/wide spacing bila perlu

---

## 18. Do / Don’t Design Token

### Do
- gunakan token semantik
- jaga jumlah warna aktif per layar tetap terkendali
- prioritaskan neutral foundation
- gunakan status colors hanya untuk meaning, bukan dekorasi
- gunakan category colors secara konsisten

### Don’t
- jangan hardcode hex/rgb di komponen produksi
- jangan gunakan brand color untuk semua icon dan teks
- jangan gunakan shadow tebal sebagai alat utama hierarchy
- jangan campur status color dan category color tanpa sistem

---

## 19. Handoff Rules untuk Desain dan Frontend

### Untuk UI Designer
- semua komponen di file desain harus memakai token naming, bukan nilai manual
- style library harus mengacu ke token semantik

### Untuk Frontend Engineer
- implement token sebagai source of truth global
- expose via CSS variables / theme object / tailwind config mapping
- hindari override lokal tanpa approval design system

### Untuk QA
- cek konsistensi warna, radius, spacing, typography, dan states terhadap token resmi

---

## 20. Rekomendasi Struktur Implementasi Teknis

Token dapat dipecah menjadi:
- foundation tokens
- semantic tokens
- component alias tokens

### Foundation Tokens
raw scales:
- neutral scale
- spacing scale
- radius scale
- font sizes
- durations

### Semantic Tokens
context-aware:
- text.primary
- status.success.bg
- surface.panel
- border.default

### Component Alias Tokens
khusus komponen:
- button.primary.bg
- table.header.bg
- nav.item.active.bg
- badge.locked.bg

---

## 21. Penutup
MLPHoma membutuhkan design token system yang disiplin agar semua modul terasa sebagai satu produk enterprise yang konsisten. Token rules ini menjadi fondasi visual resmi untuk seluruh UI, sehingga high-fidelity design, frontend implementation, dan QA dapat mengacu pada sistem yang sama.

