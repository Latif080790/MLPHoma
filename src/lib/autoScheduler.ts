/**
 * src/lib/autoScheduler.ts
 * 
 * Logic for automatically generating a Schedule (WBS & Timeline) from RAB.
 * 
 * Logic Flow:
 * 1. Calculate Duration:
 *    - Formula: (Volume * Total Labor Coefficient) / Assumed Team Size
 *    - Fallback: Max 14 days for pure material items to prevent 255-month bug.
 * 2. True Auto-Scheduling Sequence:
 *    - Tasks are sequenced Finish-to-Start (FS).
 *    - Negative lag (fast-tracking) is applied automatically for overlaps.
 */

import { RABItem } from '../store/rabStore'
import { TimelineTask } from '../store/timelineStore'
import { AHSPItem, AHSPComponent } from '../types/ahsp'

const DEFAULT_TEAM_SIZE = 3 // Assumed number of workers per task

let _taskCounter = 0
function generateTaskId(): string {
  _taskCounter++
  return `${Date.now()}-${_taskCounter}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Calculate rational duration based on AHSP analysis
 */
export function calculateDuration(
  volume: number,
  components: AHSPComponent[]
): number {
  // 1. Find Labor components (OH - Orang Hari or Jam)
  const laborComps = components.filter(c => c.type === 'labor')

  if (laborComps.length === 0) {
    // BUG FIX (255-month): Cap fallback duration for pure material procurement
    // Volume magnitude can be massive (e.g., 76,000 kg). 
    // We assume non-labor materials can be procured in bulk over max 14 days limit.
    let estimated = Math.ceil(volume / 50)
    if (estimated > 14) estimated = 14
    return Math.max(1, estimated)
  }

  // 2. Calculate Total Man-Days required
  const totalManDays = laborComps.reduce((sum, comp) => {
    return sum + comp.coefficient
  }, 0) * volume

  // 3. Calculate Duration
  const dynamicTeamSize = Math.max(DEFAULT_TEAM_SIZE, Math.ceil(totalManDays / 30)) // Aim for max 30 days per task
  const duration = Math.ceil(totalManDays / dynamicTeamSize)

  return Math.max(1, duration) // Minimum 1 day
}

/**
 * Add days to a date string
 */
function addDays(dateStr: string, days: number): string {
  if (days === 0) return dateStr
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Main Generator Function
 */
export function generateScheduleFromRAB(
  projectId: string,
  projectStartDate: string,
  rabItems: RABItem[],
  ahspMap: Map<string, AHSPItem>,
  componentsByAHSP: Record<string, AHSPComponent[]>
): TimelineTask[] {
  const tasks: TimelineTask[] = []

  let currentStartDate = projectStartDate
  let previousTaskId: string | null = null
  let previousTaskDuration = 0

  // 1. Group by Category (WBS Structure)
  const byCategory = new Map<string, RABItem[]>()

  rabItems.forEach(item => {
    const ahsp = ahspMap.get(item.item_code || item.code || '')
    const category = ahsp?.category || 'Uncategorized'

    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(item)
  })

  // 2. Sequence Tasks (Finish-to-Start with Lag)
  for (const [category, items] of byCategory.entries()) {
    for (const item of items) {
      const ahsp = ahspMap.get(item.item_code || item.code || '')
      const components = ahsp ? (componentsByAHSP[ahsp.id] || []) : []

      const duration = calculateDuration(item.volume || 0, components)
      const taskId = item.taskId || `task-${generateTaskId()}`

      let startDate = currentStartDate
      const dependencies: { id: string; predecessorId: string; successorId: string; type: 'FS'; lag: number }[] = []

      if (previousTaskId) {
        // True Auto-Scheduling: Finish-to-Start with a default lag for fast-tracking
        // Overlap by 2 days (lag = -2) if tasks are long enough
        let lag = -2
        if (duration <= 2 || previousTaskDuration <= 2) lag = 0 // No overlap for short tasks

        dependencies.push({
          id: `dep-${generateTaskId()}`,
          predecessorId: previousTaskId,
          successorId: taskId,
          type: 'FS',
          lag
        })

        // Calculate logical Start Date based on predecessor End + Lag + 1
        // (End Date of previous = currentStartDate + previousTaskDuration - 1)
        startDate = addDays(currentStartDate, previousTaskDuration - 1 + lag + 1)

        // Guard against negative drift before project start
        if (startDate < projectStartDate) startDate = projectStartDate
      }

      const endDate = addDays(startDate, duration - 1)

      const task: TimelineTask = {
        id: taskId,
        projectId,
        name: item.name || item.item_name || 'Untitled Task',
        description: `Generated from RAB Item: ${item.item_code}`,
        startDate,
        endDate,
        duration,
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        rabId: item.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dependencies
      }

      tasks.push(task)

      previousTaskId = taskId
      currentStartDate = startDate
      previousTaskDuration = duration
    }
  }

  return tasks
}

import type { TaskDependency } from '../store/timelineStore'

/**
 * addDaysUTC - Safe UTC date arithmetic (avoids DST off-by-one)
 */
function addDaysUTC(dateStr: string, days: number): string {
  if (days === 0) return dateStr
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * compareDates - Compare two ISO date strings
 */
function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * maxDate - Return the later of two ISO date strings
 */
function maxDate(a: string, b: string): string {
  return compareDates(a, b) >= 0 ? a : b
}

/**
 * runForwardPass
 *
 * Topologically sorts tasks and computes new start/end dates using forward-pass CPM logic.
 * Supports all 4 dependency types: FS, SS, FF, SF with lag.
 *
 * Dependency logic:
 *   FS (Finish-Start, lag L): succ.start = pred.end + L + 1 day
 *   SS (Start-Start, lag L):  succ.start = pred.start + L
 *   FF (Finish-Finish, lag L): succ.end = pred.end + L → succ.start = succ.end - (dur - 1)
 *   SF (Start-Finish, lag L): succ.end = pred.start + L → succ.start = succ.end - (dur - 1)
 *
 * @param tasks - Array of timeline tasks (with dependencies)
 * @param projectStart - ISO date string; used as fallback earliest start
 * @returns Updated tasks array with recomputed startDate and endDate
 */
export function runForwardPass(tasks: TimelineTask[], projectStart: string): TimelineTask[] {
  if (!tasks.length) return tasks

  const taskMap = new Map<string, TimelineTask>(tasks.map((t) => [t.id, t]))

  const predAdj = new Map<string, Array<{ pred: TimelineTask; dep: TaskDependency }>>()
  tasks.forEach((t) => {
    (t.dependencies ?? []).forEach((dep) => {
      const pred = taskMap.get(dep.predecessorId)
      if (!pred) return
      const list = predAdj.get(t.id) ?? []
      list.push({ pred, dep })
      predAdj.set(t.id, list)
    })
  })

  // Kahn's topological sort
  const inDegree = new Map<string, number>(tasks.map((t) => [t.id, 0]))
  tasks.forEach((t) => {
    (t.dependencies ?? []).forEach((dep) => {
      inDegree.set(dep.successorId, (inDegree.get(dep.successorId) ?? 0) + 1)
    })
  })

  const succAdj = new Map<string, string[]>()
  tasks.forEach((t) => {
    (t.dependencies ?? []).forEach((dep) => {
      const list = succAdj.get(dep.predecessorId) ?? []
      list.push(dep.successorId)
      succAdj.set(dep.predecessorId, list)
    })
  })

  const queue = tasks.filter((t) => (inDegree.get(t.id) ?? 0) === 0)
  const sorted: TimelineTask[] = []

  while (queue.length > 0) {
    const t = queue.shift()!
    sorted.push(t)
    const succs = succAdj.get(t.id) ?? []
    for (const sid of succs) {
      const deg = (inDegree.get(sid) ?? 1) - 1
      inDegree.set(sid, deg)
      if (deg === 0) {
        const s = taskMap.get(sid)
        if (s) queue.push(s)
      }
    }
  }

  // Fall back to original order if cycle detected
  if (sorted.length < tasks.length) {
    tasks.filter((t) => !sorted.find((s) => s.id === t.id)).forEach((t) => sorted.push(t))
  }

  const computed = new Map<string, { start: string; end: string }>()

  for (const t of sorted) {
    const dur = Math.max(1, t.duration ?? 1)
    const preds = predAdj.get(t.id) ?? []
    let earliestStart = projectStart

    for (const { pred, dep } of preds) {
      const predDates = computed.get(pred.id) ?? { start: pred.startDate, end: pred.endDate }
      const lag = dep.lag ?? 0
      const type = dep.type ?? 'FS'
      let constraintStart: string

      switch (type) {
        case 'FS':
          constraintStart = addDaysUTC(predDates.end, lag + 1)
          break
        case 'SS':
          constraintStart = addDaysUTC(predDates.start, lag)
          break
        case 'FF':
          constraintStart = addDaysUTC(predDates.end, lag - (dur - 1))
          break
        case 'SF':
          constraintStart = addDaysUTC(predDates.start, lag - (dur - 1))
          break
        default:
          constraintStart = addDaysUTC(predDates.end, lag + 1)
      }

      earliestStart = maxDate(earliestStart, constraintStart)
    }

    const end = addDaysUTC(earliestStart, dur - 1)
    computed.set(t.id, { start: earliestStart, end })
  }

  return tasks.map((t) => {
    const dates = computed.get(t.id)
    if (!dates) return t
    return { ...t, startDate: dates.start, endDate: dates.end }
  })
}
