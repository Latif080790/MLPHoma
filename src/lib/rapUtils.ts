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
export function distributeVolumeByTasks(items: RABItem[], tasks: ScheduleTask[]) {
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
    const unitPrice = Number(it.unit_price || 0)
    if (volume <= 0) {
      for (const t of taskDays) result[t.id].items.push({ id: it.id, volume: 0, value: 0 })
      continue
    }
    for (const t of taskDays) {
      const share = t.days / totalDays
      const v = volume * share
      const val = v * unitPrice
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
export function distributeVolumeByTasksCPMAware(
  items: RABItem[],
  tasks: ScheduleTask[],
  options?: { criticalBoost?: number }
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
    const unitPrice = Number(it.unit_price || 0)
    if (volume <= 0) {
      for (const info of taskInfo) result[info.id].items.push({ id: it.id, volume: 0, value: 0 })
      continue
    }

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
      const val = v * unitPrice
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

import type { RABItem } from '../store/rabStore'

/**
 * Task period used for RAP distribution
 */
export interface ScheduleTask {
  id: string
  title: string
  startDate: string // ISO date
  endDate: string // ISO date
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
  // ensure start <= end
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
 * Distribute a set of RAB items' volumes across provided schedule tasks.
 * For each RABItem, distribution is proportional to the task's businessDays
 * relative to total business days across all tasks.
 *
 * @param items RABItem[]
 * @param tasks ScheduleTask[]
 * @returns mapping: taskId -> { totalVolume, totalValue, items: [] }
 */
export function distributeVolumeByTasks(items: RABItem[], tasks: ScheduleTask[]) {
  // compute working days for each task
  const taskDays = tasks.map((t) => ({ ...t, days: businessDaysBetween(t.startDate, t.endDate) }))
  const totalDays = taskDays.reduce((s, t) => s + t.days, 0) || 0.000001 // avoid /0

  // prepare result map
  const result: Record<string, { task: ScheduleTask; totalVolume: number; totalValue: number; items: Array<{ id: string; volume: number; value: number }> }> = {}
  for (const t of taskDays) {
    result[t.id] = { task: t, totalVolume: 0, totalValue: 0, items: [] }
  }

  // distribute each item across tasks proportionally
  for (const it of items) {
    const volume = Number(it.volume || 0)
    const unitPrice = Number(it.unit_price || 0)
    const value = volume * unitPrice

    // if item volume zero, push zeros
    if (volume <= 0) {
      for (const t of taskDays) {
        result[t.id].items.push({ id: it.id, volume: 0, value: 0 })
      }
      continue
    }

    // allocate per task
    for (const t of taskDays) {
      const share = t.days / totalDays
      const v = volume * share
      const val = v * unitPrice
      result[t.id].items.push({ id: it.id, volume: v, value: val })
      result[t.id].totalVolume += v
      result[t.id].totalValue += val
    }
  }

  return result
}

/**
 * Simple helper to aggregate a per-task series (suitable for charts)
 *
 * @param distribution result of distributeVolumeByTasks
 * @returns array of { name, value } where name is task.title
 */
export function distributionToSeries(distribution: Record<string, { task: ScheduleTask; totalVolume: number; totalValue: number }>) {
  return Object.values(distribution).map((d) => ({ name: d.task.title, value: Math.round(d.totalValue) }))
}

export default {
  businessDaysBetween,
  distributeVolumeByTasks,
  distributionToSeries,
}