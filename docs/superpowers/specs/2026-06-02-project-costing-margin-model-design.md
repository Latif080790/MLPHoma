# Project Costing — Margin Model Correction (Fase A) — Design Spec

**Date:** 2026-06-02
**Status:** Draft for review
**Scope:** Fase A only. Fase B (RAPP approval workflow + bonus distribution) is a separate spec.

---

## 1. Problem

The costing chain AHSP → RAB → RAP currently has inconsistent and incorrect margin logic:

1. **RAB margin is applied at the aggregate level, not per item.** `RAB.tsx` computes
   `subtotal = Σ(volume × unit_price)` then adds OH/Profit/PPN as separate aggregate lines.
   So per-item `final_total` carries **no margin** (it equals the base cost). A bid submitted to
   an owner must not expose a separate "Profit + Overhead" line — unit prices must be fixed,
   margin-inclusive.

2. **Two conflicting margin conventions coexist.** The RAB summary uses *markup-on-cost*
   (`subtotal × profit%`), while `rabStore` baked-in mode uses *margin-on-revenue*
   (`base_price / (1 − (oh+profit)/100)`). For "20%" these differ (×1.20 vs ×1.25). The business
   convention is **margin-on-revenue**: `selling = base / (1 − margin%)`.

3. **RAP margin is computed base-vs-base.** Because RAB `final_total` = base and RAP
   `total_budget` = AHSP base, "RAB − RAP" ≈ 0. The real margin (the markup) is invisible.

4. **The business model has three budget tiers, not two.** Only `rab_items` and `rap_items`
   exist; the PM's execution plan (RAPP) and the two derived metrics (Kontribusi, Bonus) are
   not modeled.

---

## 2. Business Model (authoritative)

Three budget tiers form a waterfall. Real figures from project CMPLNG VILLAGE (margin 35%):

| Tier | Value (example) | Definition |
|------|-----------------|------------|
| **RAB** (penawaran ke owner, ex-PPN) | Rp 7.640.881.000 | Harga jual fix per item = `base / (1 − margin%)`. Margin baked-in. |
| **RAP Kontribusi** (plafon proyek) | Rp 4.966.572.640 | = biaya dasar AHSP murni (`Σ qty × base_price`). |
| → **Kontribusi ke Kantor** | Rp 2.674.308.360 | `RAB − RAP` = jatah perusahaan (= margin%). |
| **RAPP** (rencana PM) | ≤ 4.966.572.640 | Anggaran pelaksanaan yang PM tekan lebih rendah. |
| → **Bonus Project** | `RAP − RAPP` | Penghematan PM, dibagi ke tim (distribusi = Fase B). |
| **Actual** | realisasi | Bila `> RAPP` → ditanggung PM (enforcement = Fase B). |

**Margin convention:** margin-on-revenue. `selling = base / (1 − m)`, syarat `0 ≤ m < 1`.
PPN is added on top of the RAB selling price for the owner invoice and is **excluded** from
Kontribusi and Bonus (it is a pass-through tax, not contractor margin).

---

## 3. AHSP — single source, two views

AHSP master data stays **pure cost** (no margin stored). Because AHSP is attached to the owner
bid as justification, the same margin% produces a margin-inclusive bid view derived on the fly:

| View | Formula | Used by |
|------|---------|---------|
| **AHSP Dasar** | `base_price` (Σ resource coef × resource cost) | RAP Kontribusi, all cost modules |
| **AHSP Penawaran** | `base_price / (1 − margin%)` | Owner bid attachment, RAB unit price |

Because the RAB unit price is inherited from AHSP, applying margin at the AHSP level propagates
to RAB automatically — margin is calculated once. RAP Kontribusi strips it back to `base_price`.

---

## 4. Toggles

**Toggle 1 — Margin Mode** (RAB)
- `fixed`: one project-level `defaultMarginPct` applied to all items.
- `per_item`: editable `margin_pct` column per RAB item (supports unbalanced bidding).
- Stored in `project.meta.marginMode` + `project.meta.defaultMarginPct`.

**Toggle 2 — Cost Basis** (which figure feeds downstream cost modules)
- `rap`: use RAP Kontribusi (plafon = AHSP base). **Default** (conservative).
- `rapp`: use RAPP (PM plan).
- Stored in `project.meta.costBasis`. Read by Resource Plan and EVM.

---

## 5. Lock Kontribusi

Reuse the **existing RAB baseline lock** (`rabStore.isLocked` / snapshotPrice). On lock:
- `margin_pct`, `base_price`, and RAB selling price freeze → Kontribusi ke Kantor is fixed.
- RAPP remains editable (PM can keep reducing); Bonus is computed against the locked RAP.
- Rationale (user): "selama kontribusi sudah dikunci, harga dasar yang lain tidak lari ke mana-mana."

No new lock entity is introduced.

---

## 6. Data Model Changes

| Field | Status | Role |
|-------|--------|------|
| `rab_items.base_price` | exists | pure AHSP cost |
| `rab_items.margin_pct` | **new** | per-item margin (used in `per_item` mode) |
| `rab_items.unit_price` | becomes derived | `base_price / (1 − margin%)` (baked-in) |
| `rab_items.markup_source` | exists → set `'baked_in'` | discriminator |
| `project.meta.marginMode` | **new** | `'fixed' \| 'per_item'` |
| `project.meta.defaultMarginPct` | **new** | project default margin |
| `project.meta.costBasis` | **new** | `'rap' \| 'rapp'` |
| `rap_items.total_budget` | exists | = RAPP (PM execution plan) |
| RAP Kontribusi | derived | `Σ(qty × base_price)`; snapshot on lock |

No DB migration is strictly required if `margin_pct` is carried in the existing item JSON/meta;
if a real column is preferred, a Supabase migration adds `rab_items.margin_pct numeric default 0`.
(Decision deferred to the implementation plan.)

**Migration of existing projects.** Projects currently store `project.meta.rabRates` using the old
*markup-on-cost* convention (e.g. Profit 20%). To avoid silently changing displayed totals, there is
**no automatic conversion**: on first edit under the new model the user sets `defaultMarginPct`
explicitly (margin-on-revenue). For reference, the equivalent is `m = p / (1 + p)` — markup 20% ≈
margin 16.67%. Until migrated, a project keeps its current RAB display; the new fields are additive.

---

## 7. Calculations — pure, unit-tested

Extend `src/lib/costingMargin.ts`:

```ts
/** Margin-on-revenue selling price. Throws/clamps when m ∉ [0,1). */
sellingFromBase(base: number, marginPct: number): number   // base / (1 − m/100)

/** Inverse — strip margin back to base. */
baseFromSelling(selling: number, marginPct: number): number // selling × (1 − m/100)

/** Kontribusi ke Kantor = RAB selling (ex-PPN) − RAP Kontribusi. */
kontribusi(rabSelling: number, rapKontribusi: number): number

/** Bonus = RAP Kontribusi − RAPP. Negative ⇒ overrun (flagged, enforced in Fase B). */
bonus(rapKontribusi: number, rapp: number): number
```

Guards: `marginPct` clamped to `[0, 99.99]`; division-by-zero impossible. Existing
`rabContractExTax` / `grossMargin` remain for backward compatibility but the UI migrates to the
margin-on-revenue helpers.

---

## 8. UI Changes

**AHSP module**
- Audit & guarantee master prices are pure cost (no margin leakage).
- Add a "Harga Penawaran" derived view/column (`base / (1 − margin%)`) for the bid attachment and
  export. Master rows unchanged.

**RAB module**
- Margin Mode toggle (`fixed` / `per_item`).
- `Margin %` column (per-item mode) or single project margin field (fixed mode).
- Unit price displays the **selling (baked-in)** price; summary uses margin-on-revenue
  (replaces the markup-on-cost path). PPN applied on top of selling.
- View toggle: "Biaya Dasar ↔ Harga Jual".

**RAP module**
- Replace the interim "Margin vs RAB" column with two clear metrics: **Kontribusi ke Kantor**
  (RAB − RAP) and **Bonus** (RAP − RAPP).
- Waterfall summary in the header (RAB → RAP → RAPP with the two deltas).
- Cost Basis toggle (`rap` / `rapp`).

**Resource Plan / EVM**
- Read `project.meta.costBasis` to choose RAP Kontribusi (base) vs RAPP as the cost basis.

---

## 9. Edge Cases

- `margin% ≥ 100` rejected (clamped to 99.99) — avoids divide-by-zero / negative price.
- `margin% = 0` → selling = base → Kontribusi 0 (valid).
- RAB item without AHSP link: no base → fall back to manual unit price; flag the item; margin still
  applies on the entered price.
- `RAPP > RAP` (overrun): Bonus negative → coral flag in Fase A; hard enforcement in Fase B.
- Locked baseline: margin/base/selling read-only; RAPP still editable.
- PPN excluded from Kontribusi and Bonus everywhere.

---

## 10. Testing

- Unit tests for all helpers in `src/lib/__tests__/costingMargin.test.ts`, including a CMPLNG
  VILLAGE fixture: base 4.966.572.640, margin 35% → selling 7.640.881.000, kontribusi 2.674.308.360.
- Assert `baseFromSelling(sellingFromBase(b, m), m) ≈ b` (round-trip).
- Assert margin clamp behavior and zero/100 boundaries.
- A RAP-level reconciliation test: `kontribusi + rapp + bonus_consumed == rab_selling` invariants.

---

## 11. Out of Scope (→ Fase B)

- RAPP approval workflow (PM submits → office approves).
- Hard enforcement: overrun above RAP borne by PM.
- Persisted bonus pool and distribution to the project team.
- Per-team bonus splitting rules.

---

## 12. Components & Boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `costingMargin.ts` | pure margin/waterfall math | none |
| RAB module | margin input + baked-in selling display | costingMargin, rabStore, project.meta |
| AHSP module | pure cost + derived bid view | costingMargin |
| RAP module | Kontribusi + Bonus metrics, cost-basis toggle | costingMargin, rapStore, rabStore |
| Resource Plan / EVM | honor cost-basis toggle | project.meta.costBasis |

Each unit is independently testable; the math core has no UI/store dependency.
