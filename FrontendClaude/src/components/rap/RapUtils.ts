/**
 * RapUtils.ts
 * Utility functions and types for RAP (Rencana Anggaran Pelaksanaan) monthly distribution.
 *
 * Provides:
 * - Month key generation (YYYY-MM)
 * - Preset distributions (linear, front, back, bell)
 * - Normalization and smoothing
 * - Plan helpers (sum, clone, align)
 */

export interface RapPlanItem {
  /** Period key formatted as YYYY-MM */
  period: string
  /** Planned cost for the period (Rp) */
  planned: number
  /** Actual cost for the period (Rp) */
  actual?: number
}

/** Build YYYY-MM from year and month (1..12) */
export function ym(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Add months to a starting year-month and return YYYY-MM */
export function addYM(y: number, m: number, step: number): string {
  const idx = y * 12 + (m - 1) + step
  const yy = Math.floor(idx / 12)
  const mm = (idx % 12) + 1
  return ym(yy, mm)
}

/** Generate month keys starting from a specific date (or now) for n months */
export function makeMonthKeys(months: number, startDate?: Date | string): string[] {
  const start = startDate ? new Date(startDate) : new Date()
  const y = start.getFullYear()
  const m = start.getMonth() + 1
  return Array.from({ length: months }, (_, i) => addYM(y, m, i))
}

/** Sum planned total */
export function sumPlan(plan: RapPlanItem[]): number {
  return plan.reduce((s, p) => s + (p.planned || 0), 0)
}

/** Normalize arbitrary weights so that sum(weights) = 1.0 */
export function normalizeWeights(weights: number[]): number[] {
  const s = weights.reduce((a, b) => a + b, 0)
  if (s <= 0) return weights.map(() => 0)
  return weights.map((w) => (w < 0 ? 0 : w / s))
}

/** Linear weights (flat) */
export function weightsLinear(n: number): number[] {
  return Array.from({ length: n }, () => 1)
}

/** Front-loaded (more at start): descending linearly */
export function weightsFront(n: number): number[] {
  if (n <= 1) return [1]
  // from n -> 1
  return Array.from({ length: n }, (_, i) => n - i)
}

/** Back-loaded (more at end): ascending linearly */
export function weightsBack(n: number): number[] {
  if (n <= 1) return [1]
  // from 1 -> n
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** Bell-shaped weights using Gaussian-like curve */
export function weightsBell(n: number): number[] {
  if (n <= 1) return [1]
  const mid = (n - 1) / 2
  const sigma = Math.max(1, n / 4)
  const w = Array.from({ length: n }, (_, i) => {
    const x = (i - mid) / sigma
    return Math.exp(-0.5 * x * x)
  })
  return w
}

/** Build plan from month keys, total amount, and weights (auto-normalized). */
export function planFromWeights(keys: string[], total: number, weights: number[]): RapPlanItem[] {
  const norm = normalizeWeights(weights)
  return keys.map((k, i) => ({ period: k, planned: norm[i] * total }))
}

/** Normalize an existing plan to match a target total (proportional). */
export function normalizePlan(plan: RapPlanItem[], targetTotal: number): RapPlanItem[] {
  const current = sumPlan(plan)
  if (current <= 0) {
    return plan.map((p, i) => ({ ...p, planned: i === 0 ? targetTotal : 0 }))
  }
  const ratio = targetTotal / current
  return plan.map((p) => ({ ...p, planned: p.planned * ratio }))
}

/** Smooth plan by simple moving average (window size odd), then re-normalize to original total. */
export function smoothPlan(plan: RapPlanItem[], window = 3): RapPlanItem[] {
  if (plan.length === 0) return plan
  const total = sumPlan(plan)
  const w = Math.max(1, window | 0)
  const half = Math.floor(w / 2)

  const padded = [...plan]
  const smoothed: RapPlanItem[] = plan.map((p, idx) => {
    let acc = 0
    let cnt = 0
    for (let j = idx - half; j <= idx + half; j++) {
      if (j >= 0 && j < padded.length) {
        acc += padded[j].planned
        cnt++
      }
    }
    const avg = cnt > 0 ? acc / cnt : p.planned
    return { ...p, planned: avg }
  })

  // Preserve total
  return normalizePlan(smoothed, total)
}

/** Align baseline vs current by period joining; missing periods get 0. */
export function alignPlans(base: RapPlanItem[], curr: RapPlanItem[]): { periods: string[]; base: number[]; curr: number[] } {
  const set = new Set<string>()
  base.forEach((p) => set.add(String(p.period)))
  curr.forEach((p) => set.add(String(p.period)))
  const periods = Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
  const baseMap = new Map(base.map((p) => [String(p.period), p.planned]))
  const currMap = new Map(curr.map((p) => [String(p.period), p.planned]))
  return {
    periods,
    base: periods.map((k) => baseMap.get(k) || 0),
    curr: periods.map((k) => currMap.get(k) || 0),
  }
}

/** Clone plan */
export function clonePlan(plan: RapPlanItem[]): RapPlanItem[] {
  return plan.map((p) => ({ period: String(p.period), planned: Number(p.planned || 0) }))
}
