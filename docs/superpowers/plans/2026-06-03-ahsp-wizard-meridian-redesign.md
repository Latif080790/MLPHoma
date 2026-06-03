# Plan #9 — Redesign Wizard "Buat AHSP Baru" ke MERIDIAN

> Tujuan: menyelaraskan dialog **AHSPItemEditor** (`src/components/ahsp/AHSPItemEditor.tsx`, ~950 baris) dengan design system MERIDIAN (obsidian dark + jade/cobalt/gold + Bricolage/JetBrains Mono) seperti modul lain, tanpa mengubah logika simpan/komponen yang baru diperbaiki.

**Sifat:** murni visual. **WAJIB review render** (pakai `/run` atau screenshot before/after) — jangan merge tanpa melihat hasilnya.

---

## Prinsip (jangan dilanggar)
1. **Nol perubahan logika.** Jangan sentuh `handleSubmit`, `commitDraftComponents`, `addComponent`, `totals`, `validate`, alur step. Hanya className / struktur markup presentational.
2. **Token, bukan warna hardcode.** Ganti `bg-card`/`bg-white`/`text-slate-*`/`bg-blue-*` dengan token MERIDIAN (`src/styles/design-tokens-meridian.css`). Pola badge navy-native: `bg-color-500/10 text-color-400 border border-color-500/20`.
3. **WCAG:** min `text-xs` (lint rule `--max-warnings`), kontras AA. Tidak ada `text-[10px]`.
4. **Angka pakai `font-mono` (JetBrains Mono)** + `formatIDR`. Heading pakai `font-display` (Bricolage).

---

## Peta area yang diubah (per section di file)

| Area | Lokasi sekarang | Target MERIDIAN |
|------|------|------|
| **Header dialog** ("Buat AHSP Baru / MODE SNI") | ikon pensil biru + teks slate | surface `nl-navy-2`, judul `font-display`, badge mode `pill p-inf` |
| **Stepper** (1 Info Dasar / 2 Komponen) | pill biru solid | aktif = cobalt fill, selesai = jade check, idle = navy-3 |
| **Kartu "Pilih dari AHSP SNI"** | gradient `from-blue-50` | surface navy-3, ikon database cobalt, dropdown navy |
| **Form Identifikasi Umum** | input putih border-slate | `bg-surface` input, label `text-secondary uppercase text-xs` |
| **Right rail "Distribusi Biaya / Kalkulasi Akhir"** | kartu putih, angka biru | panel navy-2; angka besar gold (`text-idr`); bar material/labor/equipment pakai jade/cobalt/amber |
| **Tabel komponen** (step 2) | header `bg-muted/30`, baris putih | header navy-3 sticky, baris hover navy-3/40; COEFF cell cobalt tint; sudah `w-full` (fix #11) |
| **Resource Library (bawah)** | card putih + search | surface navy-2, search bar navy-3, chip tipe resource per-warna |
| **Footer** (Batalkan / Komponen / Simpan) | Simpan biru | Simpan = cobalt primary, Batalkan = ghost, sticky bottom navy-2 |

---

## Token mapping (acuan cepat)

```
bg-white / bg-card           → bg-[hsl(var(--nl-navy-2))]  (atau class .bg-surface MERIDIAN)
bg-muted/30                  → bg-[hsl(var(--nl-navy-3))]/40
text-slate-900/800/foreground→ text-[hsl(var(--nl-text-1))]
text-slate-400/muted         → text-[hsl(var(--nl-text-3))]
border-slate-200/border      → border-[hsl(var(--nl-navy-4))]
bg-blue-600 (primary action) → bg-[hsl(var(--nl-cobalt))]
angka Rp                     → font-mono text-[hsl(var(--nl-gold))]
KPI sukses                   → text-[hsl(var(--nl-jade))]
```
(Selaraskan nama variabel dengan yang nyata di `design-tokens-meridian.css`.)

---

## Langkah eksekusi (incremental, commit per langkah, review tiap commit)

- [ ] **L1 — Shell & header.** Bungkus root dialog dengan surface MERIDIAN + grid blueprint halus. Header + stepper. Commit. **Screenshot.**
- [ ] **L2 — Step 1 (Info Dasar).** Kartu SNI selector + form fields + sub-classification ke token navy. Commit. **Screenshot.**
- [ ] **L3 — Right rail kalkulasi.** Panel distribusi biaya: angka gold, bar komposisi jade/cobalt/amber, subtotal. Commit. **Screenshot.**
- [ ] **L4 — Step 2 (tabel komponen).** Header sticky navy, baris, COEFF cell, tombol hapus. Commit. **Screenshot.**
- [ ] **L5 — Resource library + footer.** Search + chip tipe + tombol Simpan/Batalkan. Commit. **Screenshot.**
- [ ] **L6 — Pass kontras & dark/light.** Cek semua teks AA, pastikan mode light masih layak (jika app punya toggle). `npx eslint` (0 error, patuhi max-warnings), `npx tsc`, `npx vite build`. Commit.

---

## Verifikasi
- `npx tsc --noEmit` → tetap 4 error pre-existing, nol baru.
- `npx vite build` → EXIT 0.
- Manual: buka **Buat AHSP Baru**, lewati step 1→2, tambah komponen, lihat right rail terupdate, **Simpan** → tetap berfungsi (logika tak berubah).
- Review visual berdampingan dengan modul MERIDIAN lain (RAB/RAP) untuk konsistensi.

## Di luar scope
- Perubahan logika simpan/komponen (sudah selesai di commit FK fix).
- Redesign katalog AHSP utama (terpisah, sudah sebagian MERIDIAN).
