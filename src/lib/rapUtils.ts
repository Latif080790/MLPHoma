/**
 * src/lib/rapUtils.ts
 *
 * Utilities for RAP generation.
 * - distributeVolumeByTasks: distribute volumes across timeline tasks proportionally
 *   to business (working) days (weekends excluded).
 * - distributeVolumeByTasksCPMAware: supports CPM-aware weighting where critical tasks
 *   get boosted weight via 'criticalBoost'.
 *
 * File exports small helpers used by RAP generator components.
 */

import type { RABItem } from '../store/rabStore'
import { computeCPM, CPMTask, CPMDependency } from './cpm'
import { calculatePriceWithMarkup } from './calculationService'

/**
 * ScheduleTask
 * Represents a task (time bucket) used for RAP distribution.
 */
export interface ScheduleTask {
  id: string
  title: string
  startDate: string // ISO date
  endDate: string // ISO date
  /** Optional dependency list compatible with CPMDependency (predecessor relations) */
  dependencies?: CPMDependency[]
}

/**
 * Count business days between two dates (inclusive)
 * Excludes Saturdays and Sundays.
 *
 * @param start ISO date string
 * @param end ISO date string
 */
export function businessDaysBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  if (s > e) return 0
  let count = 0
  const d = new Date(s)
  while (d <= e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * distributeVolumeByTasks
 *
 * Distribute RAB items across tasks proportionally to business days.
 */
/**
 * Derive the effective per-unit final price from a RABItem.
 *
 * Priority:
 *  1. Pre-computed finalTotal / volume  (markup already applied upstream — most accurate)
 *  2. markupConfig supplied by caller    (applies OH/profit to unitPrice on the fly)
 *  3. Raw unit_price                     (no markup — cashflow understates by OH+profit)
 *
 * This ensures the S-Curve and cashflow projections reflect the RAB *contract* total,
 * not just the bare base-cost subtotal.
 */
function effectiveFinalUnitPrice(
  it: RABItem,
  markupConfig?: { overheadPercent: number; profitPercent: number; taxPercent: number; profitBasis?: 'base_plus_overhead' | 'base' },
): number {
  const volume = Number(it.volume || 0)
  const unitPrice = Number(it.unit_price || it.unitPrice || 0)

  // 1. Use pre-computed finalTotal (set after RAB aggregate calculation)
  const precomputed = Number(it.finalTotal || it.final_total || 0)
  if (precomputed > 0 && volume > 0) return precomputed / volume

  // 2. Compute via markupConfig if provided
  if (markupConfig && (markupConfig.overheadPercent > 0 || markupConfig.profitPercent > 0 || markupConfig.taxPercent > 0)) {
    const breakdown = calculatePriceWithMarkup({
      basePrice: unitPrice,
      overheadPercent: it.is_overhead ? 0 : markupConfig.overheadPercent,  // is_overhead guard
      profitPercent: markupConfig.profitPercent,
      taxPercent: markupConfig.taxPercent,
      profitBasis: markupConfig.profitBasis ?? 'base_plus_overhead',
    })
    return breakdown.finalPrice
  }

  // 3. Fallback: raw unitPrice (no markup)
  return unitPrice
}

/**
 * distributeVolumeByTasks
 *
 * Distribute RAB items across tasks proportionally to business days.
 * Uses effectiveFinalUnitPrice() so cashflow reflects full contract value (OH + profit included).
 *
 * @param markupConfig  Optional — if items lack precomputed finalTotal, apply these markup %s.
 */
export function distributeVolumeByTasks(
  items: RABItem[],
  tasks: ScheduleTask[],
  markupConfig?: { overheadPercent: number; profitPercent: number; taxPercent: number; profitBasis?: 'base_plus_overhead' | 'base' },
) {
  const taskDays = tasks.map((t) => ({ ...t, days: businessDaysBetween(t.startDate, t.endDate) }))
  const totalDays = taskDays.reduce((s, t) => s + t.days, 0) || 0.000001

  const result: Record<
    string,
    { task: ScheduleTask; totalVolume: number; totalValue: number; items: Array<{ id: string; volume: number; value: number }> }
  > = {}
  for (const t of taskDays) {
    result[t.id] = { task: t, totalVolume: 0, totalValue: 0, items: [] }
  }

  for (const it of items) {
    const volume = Number(it.volume || 0)
    if (volume <= 0) {
      for (const t of taskDays) result[t.id].items.push({ id: it.id, volume: 0, value: 0 })
      continue
    }
    // Use finalTotal-aware unit price instead of raw unit_price
    const finalUnitPrice = effectiveFinalUnitPrice(it, markupConfig)
    for (const t of taskDays) {
      const share = t.days / totalDays
      const v = volume * share
      const val = v * finalUnitPrice
      result[t.id].items.push({ id: it.id, volume: v, value: val })
      result[t.id].totalVolume += v
      result[t.id].totalValue += val
    }
  }

  return result
}

/**
 * distributeVolumeByTasksCPMAware
 *
 * Distribute items across tasks using CPM to bias allocation toward critical tasks.
 * - tasks may include .dependencies (CPMDependency[]). When provided, computeCPM will
 *   consider them and identify critical tasks correctly.
 *
 * @param items - RABItem[]
 * @param tasks - ScheduleTask[] (may include dependencies)
 * @param options - { criticalBoost?: number }
 * @returns { distribution, cpm } where distribution is same shape as distributeVolumeByTasks and cpm is computeCPM result
 */
/**
 * distributeVolumeByTasksCPMAware
 *
 * Same as distributeVolumeByTasks but biases allocation toward CPM critical-path tasks.
 * markupConfig is forwarded to effectiveFinalUnitPrice for cashflow accuracy.
 */
export function distributeVolumeByTasksCPMAware(
  items: RABItem[],
  tasks: ScheduleTask[],
  options?: {
    criticalBoost?: number
    markupConfig?: { overheadPercent: number; profitPercent: number; taxPercent: number; profitBasis?: 'base_plus_overhead' | 'base' }
  },
) {
  const criticalBoost = Number(options?.criticalBoost ?? 1.5)

  // Build CPM input using business-day durations and pass-through dependencies (if any)
  const cpmTasks: CPMTask[] = tasks.map((t) => ({
    id: t.id,
    duration: Math.max(1, businessDaysBetween(t.startDate, t.endDate)),
    // If tasks supply dependencies (predecessor relations) forward them to CPM
    dependencies: (t.dependencies || []).map((d) => ({ predecessorId: d.predecessorId, type: d.type, lag: d.lag })),
  }))

  const cpmResult = computeCPM(cpmTasks)
  const criticalSet = cpmResult.criticalIds

  // compute weights: base = days, weight = base * (critical ? criticalBoost : 1)
  const taskInfo = tasks.map((t) => {
    const days = businessDaysBetween(t.startDate, t.endDate) || 0
    const base = days
    const weight = base * (criticalSet.has(t.id) ? criticalBoost : 1)
    return { id: t.id, task: t, days, base, weight }
  })

  const totalWeight = taskInfo.reduce((s, it) => s + it.weight, 0) || 0.000001

  const result: Record<
    string,
    { task: ScheduleTask; totalVolume: number; totalValue: number; items: Array<{ id: string; volume: number; value: number }> }
  > = {}
  for (const info of taskInfo) result[info.id] = { task: info.task, totalVolume: 0, totalValue: 0, items: [] }

  for (const it of items) {
    const volume = Number(it.volume || 0)
    if (volume <= 0) {
      for (const info of taskInfo) result[info.id].items.push({ id: it.id, volume: 0, value: 0 })
      continue
    }
    // Use finalTotal-aware unit price (same logic as distributeVolumeByTasks)
    const finalUnitPrice = effectiveFinalUnitPrice(it, options?.markupConfig)

    let allocated = 0
    for (let i = 0; i < taskInfo.length; i++) {
      const info = taskInfo[i]
      const share = info.weight / totalWeight
      let v = volume * share
      if (i === taskInfo.length - 1) {
        v = Math.max(0, volume - allocated)
      } else {
        v = Number(v)
      }
      const val = v * finalUnitPrice
      result[info.id].items.push({ id: it.id, volume: v, value: val })
      result[info.id].totalVolume += v
      result[info.id].totalValue += val
      allocated += v
    }
  }

  return { distribution: result, cpm: cpmResult }
}

/**
 * Convert distribution to series usable by charting
 */
export function distributionToSeries(distribution: Record<string, { task: ScheduleTask; totalVolume: number; totalValue: number }>) {
  return Object.values(distribution).map((d) => ({ name: d.task.title, value: Math.round(d.totalValue) }))
}

export default {
  businessDaysBetween,
  distributeVolumeByTasks,
  distributeVolumeByTasksCPMAware,
  distributionToSeries,
}