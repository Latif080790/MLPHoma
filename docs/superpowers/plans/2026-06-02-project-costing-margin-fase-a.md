# Project Costing — Margin Model (Fase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the AHSP→RAB→RAP margin model — margin-on-revenue convention, RAB margin baked into unit prices, and Kontribusi/Bonus metrics — without a DB migration.

**Architecture:** A pure math core (`costingMargin.ts`) plus a pure settings resolver (`marginSettings.ts`) hold all logic and are fully unit-tested. UI modules (RAB, AHSP, RAP, Resource Plan/EVM) read those helpers and store all config in `project.meta`. No `rab_items`/`rap_items` schema change: per-item margin lives in `project.meta.itemMargins`.

**Tech Stack:** React 18 · TypeScript · Zustand v5 · Vitest · Tailwind · existing `projectStore.updateProject` for `meta` persistence.

**Spec:** `docs/superpowers/specs/2026-06-02-project-costing-margin-model-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/costingMargin.ts` | Pure margin/waterfall math (margin-on-revenue) | Modify (add functions) |
| `src/lib/__tests__/costingMargin.test.ts` | Tests for the math core | Modify (add cases) |
| `src/lib/marginSettings.ts` | Read/resolve margin config from `project.meta` | Create |
| `src/lib/__tests__/marginSettings.test.ts` | Tests for the resolver | Create |
| `src/pages/modules/RAB.tsx` | Margin toggle + per-item margin + baked-in selling + summary | Modify |
| `src/pages/modules/AHSP/index.tsx` | Pure-cost guarantee + "Harga Penawaran" derived view | Modify |
| `src/pages/modules/RAP.tsx` | Kontribusi + Bonus metrics, waterfall, cost-basis toggle | Modify |
| `src/pages/modules/ResourcePlan.tsx` | Honor `costBasis` (RAP vs RAPP) | Modify |

**Money-flow invariant** (all tasks assume this):
```
AHSP base (pure cost)
  → RAB selling (ex-PPN) = base / (1 − margin%)        [Kontribusi ke Kantor = selling − base]
  → RAP Kontribusi       = base                         [plafon proyek]
  → RAPP (rap_items.total_budget)                       [Bonus = base − RAPP]
PPN applied only on RAB selling for the owner invoice; excluded from Kontribusi & Bonus.
```

---

## Task 1: Margin-on-revenue math core

**Files:**
- Modify: `src/lib/costingMargin.ts`
- Test: `src/lib/__tests__/costingMargin.test.ts`

- **Step 1: Write the failing tests** — append to `src/lib/__tests__/costingMargin.test.ts` (inside the top-level `describe('costingMargin', ...)`, before its closing `})`):

```ts
  describe('clampMarginPct', () => {
    it('clamps below 0 to 0', () => {
      expect(clampMarginPct(-5)).toBe(0)
    })
    it('clamps at/above 100 to 99.99 to avoid divide-by-zero', () => {
      expect(clampMarginPct(100)).toBe(99.99)
      expect(clampMarginPct(150)).toBe(99.99)
    })
    it('passes through valid values and non-finite → 0', () => {
      expect(clampMarginPct(35)).toBe(35)
      expect(clampMarginPct(NaN)).toBe(0)
    })
  })

  describe('sellingFromBase (margin-on-revenue)', () => {
    it('reproduces CMPLNG VILLAGE at margin 35%', () => {
      // 4.966.572.640 / (1 − 0.35) = 7.640.880.984.6…
      expect(sellingFromBase(4_966_572_640, 35)).toBeCloseTo(7_640_880_984.6, 1)
    })
    it('returns base when margin 0', () => {
      expect(sellingFromBase(1_000_000, 0)).toBe(1_000_000)
    })
  })

  describe('baseFromSelling (inverse)', () => {
    it('round-trips with sellingFromBase', () => {
      const base = 4_966_572_640
      expect(baseFromSelling(sellingFromBase(base, 35), 35)).toBeCloseTo(base, 0)
    })
  })

  describe('kontribusi & bonus', () => {
    it('kontribusi = RAB selling − RAP Kontribusi', () => {
      const selling = sellingFromBase(4_966_572_640, 35)
      expect(kontribusi(selling, 4_966_572_640)).toBeCloseTo(2_674_308_344.6, 1)
    })
    it('bonus = RAP Kontribusi − RAPP, positive when PM beats the plafon', () => {
      expect(bonus(4_966_572_640, 4_500_000_000)).toBe(466_572_640)
    })
    it('bonus negative on overrun above plafon (flagged in UI, enforced in Fase B)', () => {
      expect(bonus(1_000_000, 1_200_000)).toBe(-200_000)
    })
  })
```

- **Step 2: Add the imports** at the top of the test file (extend the existing import):

```ts
import {
  rabMarkupMultiplier,
  rabContractExTax,
  grossMargin,
  grossMarginPct,
  clampMarginPct,
  sellingFromBase,
  baseFromSelling,
  kontribusi,
  bonus,
} from '../costingMargin'
```

- **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/costingMargin.test.ts`
Expected: FAIL — `clampMarginPct is not a function` (and the other new names).

- **Step 4: Implement the functions** — append to `src/lib/costingMargin.ts`:

```ts
/** Clamp a margin percentage to [0, 99.99] (and coerce non-finite to 0). */
export function clampMarginPct(marginPct: number): number {
  if (!Number.isFinite(marginPct)) return 0
  if (marginPct < 0) return 0
  if (marginPct >= 100) return 99.99
  return marginPct
}

/** Margin-on-revenue selling price: base / (1 − m). The contractor's bid unit price. */
export function sellingFromBase(base: number, marginPct: number): number {
  const m = clampMarginPct(marginPct) / 100
  return base / (1 - m)
}

/** Inverse of sellingFromBase — strip margin back to base cost. */
export function baseFromSelling(selling: number, marginPct: number): number {
  const m = clampMarginPct(marginPct) / 100
  return selling * (1 - m)
}

/** Kontribusi ke Kantor = RAB selling (ex-PPN) − RAP Kontribusi (plafon = base). */
export function kontribusi(rabSellingExTax: number, rapKontribusi: number): number {
  return rabSellingExTax - rapKontribusi
}

/** Bonus Project = RAP Kontribusi − RAPP. Negative ⇒ overrun above plafon. */
export function bonus(rapKontribusi: number, rapp: number): number {
  return rapKontribusi - rapp
}
```

- **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/costingMargin.test.ts`
Expected: PASS — all cases (existing 10 + new).

- **Step 6: Commit**

```bash
git add src/lib/costingMargin.ts src/lib/__tests__/costingMargin.test.ts
git commit -m "feat(costing): add margin-on-revenue helpers (selling/base/kontribusi/bonus)"
```

---

## Task 2: Margin settings resolver (reads project.meta)

**Files:**
- Create: `src/lib/marginSettings.ts`
- Test: `src/lib/__tests__/marginSettings.test.ts`

- **Step 1: Write the failing test** — create `src/lib/__tests__/marginSettings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readMarginSettings, effectiveMarginPct, type MarginSettings } from '../marginSettings'

describe('marginSettings', () => {
  describe('readMarginSettings', () => {
    it('returns safe defaults for empty meta', () => {
      expect(readMarginSettings(undefined)).toEqual<MarginSettings>({
        marginMode: 'fixed',
        defaultMarginPct: 0,
        costBasis: 'rap',
        itemMargins: {},
      })
    })
    it('reads provided values', () => {
      const s = readMarginSettings({
        marginMode: 'per_item',
        defaultMarginPct: 35,
        costBasis: 'rapp',
        itemMargins: { 'rab-1': 40 },
      })
      expect(s.marginMode).toBe('per_item')
      expect(s.defaultMarginPct).toBe(35)
      expect(s.costBasis).toBe('rapp')
      expect(s.itemMargins['rab-1']).toBe(40)
    })
    it('ignores invalid enum values, falling back to defaults', () => {
      const s = readMarginSettings({ marginMode: 'nonsense', costBasis: 'x' })
      expect(s.marginMode).toBe('fixed')
      expect(s.costBasis).toBe('rap')
    })
  })

  describe('effectiveMarginPct', () => {
    it('fixed mode always uses the project default', () => {
      const s = readMarginSettings({ marginMode: 'fixed', defaultMarginPct: 30, itemMargins: { a: 99 } })
      expect(effectiveMarginPct(s, 'a')).toBe(30)
    })
    it('per_item mode uses item override, falling back to default', () => {
      const s = readMarginSettings({ marginMode: 'per_item', defaultMarginPct: 30, itemMargins: { a: 45 } })
      expect(effectiveMarginPct(s, 'a')).toBe(45)
      expect(effectiveMarginPct(s, 'b')).toBe(30)
    })
  })
})
```

- **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/marginSettings.test.ts`
Expected: FAIL — cannot find module `../marginSettings`.

- **Step 3: Implement** — create `src/lib/marginSettings.ts`:

```ts
/**
 * marginSettings.ts
 * Pure resolver for project-level margin configuration stored in `project.meta`.
 * No DB migration: all config lives in meta (mirrors the existing `rabRates` pattern).
 */

export type MarginMode = 'fixed' | 'per_item'
export type CostBasis = 'rap' | 'rapp'

export interface MarginSettings {
  /** 'fixed' = one project margin for all items; 'per_item' = editable per RAB item. */
  marginMode: MarginMode
  /** Project default margin% (margin-on-revenue). */
  defaultMarginPct: number
  /** Which figure feeds downstream cost modules: 'rap' = Kontribusi plafon, 'rapp' = PM plan. */
  costBasis: CostBasis
  /** Per-RAB-item margin overrides, keyed by rab item id (used in per_item mode). */
  itemMargins: Record<string, number>
}

const DEFAULTS: MarginSettings = {
  marginMode: 'fixed',
  defaultMarginPct: 0,
  costBasis: 'rap',
  itemMargins: {},
}

/** Read margin settings from an arbitrary `project.meta` object, with safe defaults. */
export function readMarginSettings(meta: unknown): MarginSettings {
  const m = (meta ?? {}) as Record<string, unknown>
  const marginMode: MarginMode = m.marginMode === 'per_item' ? 'per_item' : 'fixed'
  const costBasis: CostBasis = m.costBasis === 'rapp' ? 'rapp' : 'rap'
  const defaultMarginPct = Number.isFinite(Number(m.defaultMarginPct)) ? Number(m.defaultMarginPct) : 0
  const itemMargins =
    m.itemMargins && typeof m.itemMargins === 'object'
      ? (m.itemMargins as Record<string, number>)
      : {}
  return { marginMode, defaultMarginPct, costBasis, itemMargins }
}

/** Resolve the effective margin% for a given RAB item id. */
export function effectiveMarginPct(settings: MarginSettings, rabItemId: string): number {
  if (settings.marginMode === 'fixed') return settings.defaultMarginPct
  const override = settings.itemMargins[rabItemId]
  return Number.isFinite(override) ? override : settings.defaultMarginPct
}
```

- **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/marginSettings.test.ts`
Expected: PASS — all 5 cases.

- **Step 5: Commit**

```bash
git add src/lib/marginSettings.ts src/lib/__tests__/marginSettings.test.ts
git commit -m "feat(costing): add project margin settings resolver (project.meta)"
```

---

## Task 3: RAP — Kontribusi + Bonus metrics (replace interim margin column)

**Files:**
- Modify: `src/pages/modules/RAP.tsx`

**Context:** RAP currently shows an interim "Margin vs RAB" column using `rabContractById` (markup-on-cost via `rabContractExTax`). Replace the margin computation with the correct waterfall: RAB selling (margin-on-revenue) → RAP Kontribusi (= AHSP base) → RAPP (= `total_budget`), surfacing **Kontribusi ke Kantor** and **Bonus**.

- **Step 1: Swap the imports.** In `src/pages/modules/RAP.tsx`, replace:

```ts
import { rabContractExTax, grossMargin, grossMarginPct } from '@/lib/costingMargin'
```

with:

```ts
import { sellingFromBase, kontribusi, bonus } from '@/lib/costingMargin'
import { readMarginSettings, effectiveMarginPct } from '@/lib/marginSettings'
```

- **Step 2: Replace the margin computation block.** Replace the `rabRates` + `rabContractById` + `margin` memos (the block that begins `// RAB markup rates — same source…` and ends at the close of the `margin` useMemo) with:

```ts
  // Margin settings (mode + default% + per-item overrides) from project.meta.
  const marginSettings = useMemo(() => readMarginSettings(project?.meta), [project?.meta])

  // RAB CONTRACT (selling, ex-PPN) per source RAB item id, margin-on-revenue: base / (1 − m%).
  // The RAB item's base cost is its final_total in the current model (volume × base unit price).
  const rabSellingById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rabItemsForMargin) {
      if (!r.id) continue
      const base = r.finalTotal ?? r.final_total ?? r.finalPrice ?? (r.volume ?? 0) * (r.unit_price ?? r.unitPrice ?? 0)
      m.set(r.id, sellingFromBase(base, effectiveMarginPct(marginSettings, r.id)))
    }
    return m
  }, [rabItemsForMargin, marginSettings])

  // RAP Kontribusi (plafon) per source RAB item id = AHSP base cost = RAB base (pre-margin).
  const rapKontribusiById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rabItemsForMargin) {
      if (!r.id) continue
      const base = r.finalTotal ?? r.final_total ?? r.finalPrice ?? (r.volume ?? 0) * (r.unit_price ?? r.unitPrice ?? 0)
      m.set(r.id, base)
    }
    return m
  }, [rabItemsForMargin])

  // Project waterfall totals.
  const waterfall = useMemo(() => {
    const pItems = items.filter((i) => i.project_id === projectId)
    let rabSelling = 0
    let rapKontribusi = 0
    let rapp = 0
    for (const it of pItems) {
      if (it.rab_item_id) {
        rabSelling += rabSellingById.get(it.rab_item_id) ?? 0
        rapKontribusi += rapKontribusiById.get(it.rab_item_id) ?? 0
      }
      rapp += it.total_budget || 0
    }
    const kontribusiRp = kontribusi(rabSelling, rapKontribusi)
    const bonusRp = bonus(rapKontribusi, rapp)
    return {
      rabSelling,
      rapKontribusi,
      rapp,
      kontribusiRp,
      kontribusiPct: rabSelling > 0 ? (kontribusiRp / rabSelling) * 100 : 0,
      bonusRp,
      bonusPct: rapKontribusi > 0 ? (bonusRp / rapKontribusi) * 100 : 0,
    }
  }, [items, projectId, rabSellingById, rapKontribusiById])
```

- **Step 3: Update the per-row cell computation.** Replace the per-row margin block:

```ts
                // Margin vs RAB: RAB contract (base + OH + Profit) − RAP execution cost
                const rabVal = item.rab_item_id ? rabContractById.get(item.rab_item_id) ?? 0 : 0
                const itemMarginRp = grossMargin(rabVal, totalBudget)
                const itemMarginPct = grossMarginPct(rabVal, totalBudget)
```

with:

```ts
                // Waterfall per item: RAP Kontribusi (plafon = base) − RAPP (total_budget) = Bonus.
                const rapKontribusi = item.rab_item_id ? rapKontribusiById.get(item.rab_item_id) ?? 0 : 0
                const itemBonusRp = bonus(rapKontribusi, totalBudget)
                const itemBonusPct = rapKontribusi > 0 ? (itemBonusRp / rapKontribusi) * 100 : null
```

- **Step 4: Update the per-row table cell JSX.** Replace the `<TableCell>` block that renders `itemMarginPct` (the one with `title={`RAB kontrak …`}`) with:

```tsx
                    <TableCell className="text-right py-2 font-mono text-xs">
                      {itemBonusPct === null ? (
                        <span className="text-slate-300" title="Item belum terhubung ke RAB">—</span>
                      ) : (
                        <div className="flex flex-col items-end leading-tight" title={`Plafon RAP ${Math.round(rapKontribusi).toLocaleString('id-ID')} − RAPP ${Math.round(totalBudget).toLocaleString('id-ID')}`}>
                          <span className={`font-bold ${itemBonusRp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {itemBonusRp >= 0 ? '+' : ''}{itemBonusPct.toFixed(1)}%
                          </span>
                          <span className="text-slate-400">{Math.round(itemBonusRp).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </TableCell>
```

- **Step 5: Update the table header** — rename the "Margin vs RAB" header to "Bonus (RAP−RAPP)":

Replace:
```tsx
              <TableHead className="h-8 w-[130px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300" title="RAB kontrak − RAP biaya pelaksanaan = margin kotor">Margin vs RAB</TableHead>
```
with:
```tsx
              <TableHead className="h-8 w-[130px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300" title="Plafon RAP − RAPP = bonus tim bila PM menekan biaya">Bonus (RAP−RAPP)</TableHead>
```

- **Step 6: Update the footer cell** — replace the footer margin cell (the one referencing `margin.rabContractTotal` / `margin.marginPct`) with:

```tsx
                <TableCell className={`text-right font-bold font-mono text-xs py-2 ${waterfall.bonusRp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} title={`Bonus ${Math.round(waterfall.bonusRp).toLocaleString('id-ID')}`}>
                  {waterfall.rapKontribusi === 0 ? '—' : `${waterfall.bonusRp >= 0 ? '+' : ''}${waterfall.bonusPct.toFixed(1)}%`}
                </TableCell>
```

- **Step 7: Update both KPI strips.** In the embedded strip array, replace the `MARGIN RAB−RAP` entry with:

```ts
            {
              label: 'KONTRIBUSI KANTOR',
              value: waterfall.rabSelling === 0 ? '—' : formatIDR(waterfall.kontribusiRp),
              cls: waterfall.kontribusiRp >= 0 ? 'text-violet-600' : 'text-rose-600',
            },
            {
              label: 'BONUS PROJECT',
              value: waterfall.rapKontribusi === 0 ? '—' : formatIDR(waterfall.bonusRp),
              cls: waterfall.bonusRp >= 0 ? 'text-emerald-600' : 'text-rose-600',
            },
```

Change the embedded strip wrapper `grid-cols-6` → `grid-cols-7`. In the standalone KPI card grid, replace the `Margin (RAB−RAP)` `KPICard` with two cards (Kontribusi + Bonus) and change `lg:grid-cols-6` → `lg:grid-cols-7`:

```tsx
            <KPICard
              label="Kontribusi Kantor"
              value={waterfall.rabSelling === 0 ? '—' : `Rp ${Math.round(waterfall.kontribusiRp).toLocaleString('id-ID')}`}
              colorClass={waterfall.rabSelling === 0 ? 'text-slate-400' : 'text-violet-600 dark:text-violet-400'}
              sub={waterfall.rabSelling === 0 ? 'Belum link RAB' : `${waterfall.kontribusiPct.toFixed(1)}% dari harga jual`}
            />
            <KPICard
              label="Bonus Project"
              value={waterfall.rapKontribusi === 0 ? '—' : `Rp ${Math.round(waterfall.bonusRp).toLocaleString('id-ID')}`}
              colorClass={waterfall.rapKontribusi === 0 ? 'text-slate-400' : waterfall.bonusRp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
              sub={waterfall.rapKontribusi === 0 ? 'Belum ada plafon' : `${waterfall.bonusPct.toFixed(1)}% dari plafon`}
            />
```

- **Step 8: Lint + typecheck**

Run: `npx eslint src/pages/modules/RAP.tsx --ext .ts,.tsx`
Expected: 0 errors (pre-existing `any` warning on `pendingRabItems` is allowed).
Run: `npx tsc --noEmit -p tsconfig.json` — Expected: 4 pre-existing errors, none in RAP.tsx.

- **Step 9: Commit**

```bash
git add src/pages/modules/RAP.tsx
git commit -m "feat(rap): replace interim margin with Kontribusi + Bonus waterfall metrics"
```

---

## Task 4: RAB — margin mode toggle + per-item margin + baked-in selling price

**Files:**
- Modify: `src/pages/modules/RAB.tsx`

**Context:** RAB currently computes `subtotal = Σ(volume × unit_price)` then OH/Profit/PPN at aggregate (markup-on-cost). This task makes the *displayed* per-item price the margin-on-revenue selling price and reframes the summary, reading config via `marginSettings`. PPN stays applied on selling. The stored `unit_price` (base) is untouched — the selling price is derived for display.

- **Step 1: Add imports** at the top of `src/pages/modules/RAB.tsx`:

```ts
import { sellingFromBase, kontribusi } from '@/lib/costingMargin'
import { readMarginSettings, effectiveMarginPct } from '@/lib/marginSettings'
```

- **Step 2: Resolve margin settings + a margin-mode setter.** After the line that reads `metaRates` (rate config), add:

```ts
  const marginSettings = React.useMemo(() => readMarginSettings(currentProject?.meta), [currentProject?.meta])
  const setMarginMeta = useCallback((patch: Partial<ReturnType<typeof readMarginSettings>>) => {
    if (!currentProject?.id) return
    const next = { ...readMarginSettings(currentProject.meta), ...patch }
    updateProject(currentProject.id, { meta: { ...currentProject.meta, ...next } })
  }, [currentProject, updateProject])
```

- **Step 3: Recompute the summary as margin-on-revenue.** Replace the `summary` memo body so the selling total drives OH/Profit. Replace:

```ts
  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)
    const overhead = subtotal * (overheadPct / 100)
    const profit = subtotal * (profitPct / 100)
    const taxBase = subtotal + overhead + profit
    const tax = taxBase * (taxRate / 100)
    const total = taxBase + tax
```

with:

```ts
  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)
    // Margin-on-revenue: ex-PPN selling per item = base / (1 − margin%). Sum across items.
    const sellingExTax = items.reduce((sum, item) => {
      const base = (item.volume || 0) * (item.unit_price || 0)
      return sum + sellingFromBase(base, effectiveMarginPct(marginSettings, item.id))
    }, 0)
    const kontribusiRp = kontribusi(sellingExTax, subtotal) // = total margin (OH+Profit equivalent)
    const taxBase = sellingExTax
    const tax = taxBase * (taxRate / 100)
    const total = taxBase + tax
    const overhead = 0
    const profit = kontribusiRp
```

Keep the existing `return { ... }` line but ensure it still returns `subtotal, overhead, profit, tax, total` plus any budget fields already present; add `sellingExTax, kontribusiRp` to the returned object. Update the memo dependency array to include `marginSettings`.

- **Step 4: Add the Margin Mode toggle + margin input to the toolbar.** Near the existing "Rates" control, add (use existing `Button`/`Input` imports):

```tsx
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Margin</span>
            <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setMarginMeta({ marginMode: 'fixed' })}
                className={`px-2 py-1 ${marginSettings.marginMode === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >Fix semua</button>
              <button
                type="button"
                onClick={() => setMarginMeta({ marginMode: 'per_item' })}
                className={`px-2 py-1 ${marginSettings.marginMode === 'per_item' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >Per item</button>
            </div>
            {marginSettings.marginMode === 'fixed' && (
              <div className="relative">
                <Input
                  type="number" min="0" max="99.99" step="0.1"
                  value={marginSettings.defaultMarginPct}
                  onChange={(e) => setMarginMeta({ defaultMarginPct: Math.max(0, Math.min(99.99, Number(e.target.value))) })}
                  className="h-8 w-20 text-xs font-mono pr-5"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
            )}
          </div>
```

- **Step 5: Lint + typecheck**

Run: `npx eslint src/pages/modules/RAB.tsx --ext .ts,.tsx` — Expected: 0 errors.
Run: `npx tsc --noEmit -p tsconfig.json` — Expected: no new errors in RAB.tsx.

- **Step 6: Commit**

```bash
git add src/pages/modules/RAB.tsx
git commit -m "feat(rab): margin mode toggle + margin-on-revenue selling summary"
```

> **Note for the per-item margin column inside `RABTable.tsx`:** wiring an editable per-row `Margin %` input is a follow-up step within this task once the table component is located; it writes to `project.meta.itemMargins[itemId]` via `setMarginMeta({ itemMargins: { ...marginSettings.itemMargins, [id]: value } })`. The `fixed` mode is fully functional without it.

---

## Task 5: AHSP — pure-cost guarantee + "Harga Penawaran" derived view

**Files:**
- Modify: `src/pages/modules/AHSP/index.tsx`

**Context:** AHSP master prices must stay pure cost. Add a read-only derived "Harga Penawaran" (margin-inclusive) view for the bid attachment, computed from the project default margin — never written back to AHSP.

- **Step 1: Add imports** at the top of `src/pages/modules/AHSP/index.tsx`:

```ts
import { sellingFromBase } from '@/lib/costingMargin'
import { readMarginSettings } from '@/lib/marginSettings'
```

- **Step 2: Resolve the project margin.** Inside the component, after the active project is resolved, add:

```ts
  const ahspMarginPct = React.useMemo(
    () => readMarginSettings(activeProject?.meta).defaultMarginPct,
    [activeProject?.meta],
  )
```

(Use the file's existing variable for the active project; if named differently, match it.)

- **Step 3: Add a "Harga Penawaran" column toggle.** Add a boolean state and a header toggle:

```tsx
  const [showBidPrice, setShowBidPrice] = React.useState(false)
```

```tsx
  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowBidPrice(v => !v)}>
    {showBidPrice ? 'Lihat Biaya Dasar' : 'Lihat Harga Penawaran'}
  </Button>
```

- **Step 4: Render the derived price where the AHSP unit price is shown.** Wherever a row renders its base price, branch:

```tsx
  {showBidPrice
    ? sellingFromBase(item.base_price ?? 0, ahspMarginPct).toLocaleString('id-ID')
    : (item.base_price ?? 0).toLocaleString('id-ID')}
```

Add a small badge when `showBidPrice` is on: `<span className="text-xs text-violet-600">+{ahspMarginPct}% margin</span>`.

- **Step 5: Lint + typecheck**

Run: `npx eslint src/pages/modules/AHSP/index.tsx --ext .ts,.tsx` — Expected: 0 errors.
Run: `npx tsc --noEmit -p tsconfig.json` — Expected: no new errors.

- **Step 6: Commit**

```bash
git add src/pages/modules/AHSP/index.tsx
git commit -m "feat(ahsp): derived Harga Penawaran view (margin-inclusive) for bid; master stays pure cost"
```

---

## Task 6: Resource Plan / EVM — honor cost-basis toggle

**Files:**
- Modify: `src/pages/modules/ResourcePlan.tsx`

**Context:** Add a `costBasis` toggle (RAP plafon vs RAPP) and surface which basis drives the resource cost. Full propagation into every cost figure is large; Fase A wires the toggle + the headline scaling factor.

- **Step 1: Add imports** at the top of `src/pages/modules/ResourcePlan.tsx`:

```ts
import { readMarginSettings } from '@/lib/marginSettings'
```

- **Step 2: Read + set cost basis.** Inside the component:

```ts
  const costBasis = React.useMemo(() => readMarginSettings(project?.meta).costBasis, [project?.meta])
  const setCostBasis = React.useCallback((cb: 'rap' | 'rapp') => {
    if (!project?.id) return
    const next = { ...readMarginSettings(project.meta), costBasis: cb }
    useProjectStore.getState().updateProject(project.id, { meta: { ...project.meta, ...next } })
  }, [project])
```

- **Step 3: Render the toggle** in the module header actions:

```tsx
  <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
    <button type="button" onClick={() => setCostBasis('rap')}
      className={`px-2 py-1 ${costBasis === 'rap' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Dasar: RAP</button>
    <button type="button" onClick={() => setCostBasis('rapp')}
      className={`px-2 py-1 ${costBasis === 'rapp' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Dasar: RAPP</button>
  </div>
```

- **Step 4: Show the active basis in the rekap header** (informational in Fase A):

```tsx
  <span className="text-xs text-slate-400">Dasar biaya: {costBasis === 'rap' ? 'RAP Kontribusi (plafon)' : 'RAPP (rencana PM)'}</span>
```

- **Step 5: Lint + typecheck**

Run: `npx eslint src/pages/modules/ResourcePlan.tsx --ext .ts,.tsx` — Expected: 0 errors.
Run: `npx tsc --noEmit -p tsconfig.json` — Expected: no new errors.

- **Step 6: Commit**

```bash
git add src/pages/modules/ResourcePlan.tsx
git commit -m "feat(resource-plan): cost-basis toggle (RAP plafon vs RAPP)"
```

---

## Task 7: Final verification

- **Step 1: Full test run**

Run: `npx vitest run src/lib/__tests__/costingMargin.test.ts src/lib/__tests__/marginSettings.test.ts`
Expected: all PASS.

- **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exactly the 4 pre-existing errors (costDashboardService.test, rapService.test, projectStore ×2). No new errors.

- **Step 3: Production build**

Run: `npx vite build`
Expected: EXIT 0.

- **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test(costing): verify margin model Fase A builds clean"
```

---

## Self-Review

**Spec coverage:**
- §2 waterfall + margin-on-revenue → Tasks 1, 3 ✓
- §3 AHSP dual view → Task 5 ✓
- §4 toggles (margin mode, cost basis) → Tasks 3/4, 6 ✓
- §5 lock kontribusi → reuses existing RAB lock; no code beyond RAB respecting `isLocked` (already in RAB). Noted; no new task required for Fase A display. ✓
- §6 data model in `project.meta` (no migration) → Task 2 ✓
- §7 pure helpers + tests → Tasks 1, 2 ✓
- §8 UI per module → Tasks 3–6 ✓
- §9 edge cases (clamp, 0, unlinked, overrun, PPN excluded) → Task 1 tests + Task 3 per-row null handling ✓
- §10 testing + CMPLNG fixture → Task 1 ✓
- §11 Fase B excluded → not in plan ✓

**Placeholder scan:** Task 4 per-item column inside `RABTable.tsx` is flagged as a follow-up because the exact table file/line must be located at execution time; the `fixed` margin mode is fully functional without it, so each task still produces working software. No "TBD" left in logic.

**Type consistency:** `MarginSettings` fields (`marginMode`, `defaultMarginPct`, `costBasis`, `itemMargins`) are used identically in Tasks 2–6. Helper names (`sellingFromBase`, `kontribusi`, `bonus`, `effectiveMarginPct`, `readMarginSettings`) match across tasks. `waterfall.{rabSelling,rapKontribusi,rapp,kontribusiRp,kontribusiPct,bonusRp,bonusPct}` defined in Task 3 Step 2 and consumed in Steps 4/6/7.
