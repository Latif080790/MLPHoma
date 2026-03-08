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
