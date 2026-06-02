/**
 * costingMargin.ts
 * Pure helpers for the RAB → RAP margin reconciliation.
 *
 * Money-flow model (authoritative, matches the RAB module summary):
 *   - AHSP base_price  = pure resource/production cost (NO markup).
 *   - RAB base         = Σ(volume × unit_price) = production cost (project-level markup mode).
 *   - RAB contract     = base + OH + Profit (+ PPN). OH/Profit are the markup; PPN is a
 *                        pass-through tax, NOT contractor margin → excluded from margin math.
 *   - RAP execution    = qty × AHSP base_price = cost to execute.
 *   - Gross margin      = RAB contract (ex-PPN) − RAP execution.
 *
 * Why a markup multiplier is required: in project-level markup mode the per-item
 * `final_total` carries NO margin (it equals the base), so comparing it directly against
 * the RAP execution cost yields ~0. The OH+Profit rates (from project.meta.rabRates) must
 * be applied to recover the contract value before computing margin.
 */

/** Markup multiplier for ex-PPN contract value: 1 + (OH% + Profit%)/100. */
export function rabMarkupMultiplier(overheadPct: number, profitPct: number): number {
  const oh = Number.isFinite(overheadPct) ? overheadPct : 0
  const p = Number.isFinite(profitPct) ? profitPct : 0
  return 1 + (oh + p) / 100
}

/** RAB contract value excluding PPN = base production cost × markup multiplier. */
export function rabContractExTax(baseCost: number, overheadPct: number, profitPct: number): number {
  return baseCost * rabMarkupMultiplier(overheadPct, profitPct)
}

/** Planned gross margin (Rp) = RAB contract (ex-PPN) − RAP execution cost. */
export function grossMargin(rabContractValue: number, rapExecutionCost: number): number {
  return rabContractValue - rapExecutionCost
}

/**
 * Gross margin as a percentage of contract revenue.
 * Returns null when there is no contract value to divide by (avoids NaN/Infinity in the UI).
 */
export function grossMarginPct(rabContractValue: number, rapExecutionCost: number): number | null {
  if (!(rabContractValue > 0)) return null
  return ((rabContractValue - rapExecutionCost) / rabContractValue) * 100
}

/** Clamp a margin percentage to [0, 99.99] (and coerce non-finite to 0). */
export function clampMarginPct(marginPct: number): number {
  if (!Number.isFinite(marginPct)) return 0
  if (marginPct < 0) return 0
  if (marginPct >= 100) return 99.99
  return marginPct
}

/** Margin-on-revenue selling price: base / (1 - m). The contractor's bid unit price. */
export function sellingFromBase(base: number, marginPct: number): number {
  const m = clampMarginPct(marginPct) / 100
  return base / (1 - m)
}

/** Inverse of sellingFromBase - strip margin back to base cost. */
export function baseFromSelling(selling: number, marginPct: number): number {
  const m = clampMarginPct(marginPct) / 100
  return selling * (1 - m)
}

/** Kontribusi ke Kantor = RAB selling (ex-PPN) - RAP Kontribusi (plafon = base). */
export function kontribusi(rabSellingExTax: number, rapKontribusi: number): number {
  return rabSellingExTax - rapKontribusi
}

/** Bonus Project = RAP Kontribusi - RAPP. Negative => overrun above plafon. */
export function bonus(rapKontribusi: number, rapp: number): number {
  return rapKontribusi - rapp
}
