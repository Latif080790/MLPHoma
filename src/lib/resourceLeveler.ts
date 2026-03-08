/**
 * src/lib/resourceLeveler.ts
 *
 * Implements a heuristic Auto-Resource Leveling algorithm.
 * 
 * Logic:
 * 1. Calculates Total Float (TF) for all tasks via CPM.
 * 2. Iterates day by day computing required resource volume.
 * 3. If a day's required volume exceeds the user-defined `maxLimit`, 
 *    it finds the active tasks on that day.
 * 4. It filters out Critical Path tasks (where TF = 0).
 * 5. It sorts the remaining active tasks by TF descending (most flexible first).
 * 6. It shifts the start/end date of the top flexible task by +1 day,
 *    decrements its TF, and re-evaluates the day.
 * 7. Repeats until the peak drops below the limit or all TF is exhausted.
 */

import { computeCPM, CPMTask } from './cpm'
import { TimelineTask } from '../store/timelineStore'
import { TimePhasedResource } from './unifiedSchedule'
import { RABItem } from '../store/rabStore'
import { AHSPItem, AHSPComponent } from '../types/ahsp'

export interface LevelingConfig {
    targetResourceType: string // e.g., 'labor', 'equipment'
    maxDailyVolumeBase: number // Maximum allowed units/cost per day
}

export interface LevelingResult {
    updatedTasks: { id: string, newStartDate: string, newEndDate: string }[]
    shiftedCount: number
    isFullyLeveled: boolean
}

/**
 * Add days to an ISO date string
 */
function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().split('T')[0]
}

/**
 * Main Resource Leveling entry point
 */
export function executeResourceLeveling(
    tasks: TimelineTask[],
    rabItems: RABItem[],
    ahspMap: Map<string, AHSPItem>,
    componentsByAHSP: Record<string, AHSPComponent[]>,
    config: LevelingConfig
): LevelingResult {
    // 1. Deep clone tasks to mutate dates during simulation
    const simulatedTasks = JSON.parse(JSON.stringify(tasks)) as TimelineTask[]
    const taskMap = new Map<string, TimelineTask>(simulatedTasks.map(t => [t.id, t]))
    const shiftedRecords = new Map<string, { newStart: string, newEnd: string }>()

    // 2. Compute CPM
    const cpmInput: CPMTask[] = simulatedTasks.map(t => ({
        id: t.id,
        duration: t.duration,
        dependencies: t.dependencies?.map(d => ({
            predecessorId: d.predecessorId,
            type: d.type,
            lag: d.lag
        })) || []
    }))

    // Initial CPM calculation to determine Total Float
    const cpmResult = computeCPM(cpmInput)
    if (cpmResult.cyclic) {
        console.error("Cyclic dependency detected. Cannot auto-level.")
        return { updatedTasks: [], shiftedCount: 0, isFullyLeveled: false }
    }

    // Keep track of remaining float per task
    const remainingFloat = new Map<string, number>()
    simulatedTasks.forEach(t => {
        const tf = cpmResult.metrics[t.id]?.TF || 0
        remainingFloat.set(t.id, tf)
    })

    // 3. Pre-calculate Daily Resource Requirements per Task
    // Map: taskId -> daily required amount of targetResourceType
    const taskDailyUsage = new Map<string, number>()
    rabItems.forEach(item => {
        if (!item.taskId || !item.volume) return
        const ahspCode = item.item_code || item.code
        const ahsp = ahspCode ? ahspMap.get(ahspCode) : undefined
        if (!ahsp) return

        const components = componentsByAHSP[ahsp.id] || []
        let itemUsageSum = 0

        components.forEach(comp => {
            const rType = comp.resource?.type || comp.type || 'material'
            if (rType.toLowerCase() === config.targetResourceType.toLowerCase()) {
                // If it's labor, maybe volume is cost or physical units. Assuming we limit by cost for simplicity.
                const resVol = item.volume! * comp.coefficient
                // Depending on user preference: level by volume or cost. Let's use cost.
                const resCost = resVol * comp.unitPrice
                itemUsageSum += resCost
            }
        })

        // Distribute linearly over task duration
        const t = taskMap.get(item.taskId)
        if (t) {
            taskDailyUsage.set(t.id, (taskDailyUsage.get(t.id) || 0) + (itemUsageSum / t.duration))
        }
    })

    // 4. Time scan algorithm
    let minDate = "9999-12-31"
    let maxDate = "0000-01-01"
    simulatedTasks.forEach(t => {
        if (t.startDate < minDate) minDate = t.startDate
        if (t.endDate > maxDate) maxDate = t.endDate
    })

    if (minDate > maxDate) {
        return { updatedTasks: [], shiftedCount: 0, isFullyLeveled: true }
    }

    // Convert string bounds to dates
    const startObj = new Date(minDate)
    const endObj = new Date(maxDate)
    let isFullyLeveled = true

    // Iterate through every active day of the project
    for (let current = new Date(startObj); current <= endObj; current.setUTCDate(current.getUTCDate() + 1)) {
        const dayStr = current.toISOString().split('T')[0]

        let leveledDay = false
        // Prevent infinite loops if TF shifting can't solve it
        let safetyCounter = 0

        while (!leveledDay && safetyCounter < 100) {
            safetyCounter++

            // 4a. Measure total load on this day
            let dailyLoad = 0
            const activeTaskIds: string[] = []

            simulatedTasks.forEach(t => {
                if (dayStr >= t.startDate && dayStr <= t.endDate) {
                    const usage = taskDailyUsage.get(t.id) || 0
                    if (usage > 0) {
                        dailyLoad += usage
                        activeTaskIds.push(t.id)
                    }
                }
            })

            // 4b. Check limit
            if (dailyLoad <= config.maxDailyVolumeBase) {
                leveledDay = true // Day is fine, move to next
                break
            }

            // 4c. Limit exceeded. Find tasks we can shift!
            // Filter tasks that have TF > 0
            const shiftableTasks = activeTaskIds.filter(id => (remainingFloat.get(id) || 0) > 0)

            if (shiftableTasks.length === 0) {
                // We're over the limit, but all active tasks are Critical Path (TF = 0)
                // We cannot shift anything without extending the overall project!
                isFullyLeveled = false
                leveledDay = true // Give up on this day to prevent infinite loop
                break
            }

            // 4d. Sort shiftable tasks by TF descending (shift the most flexible one first)
            // Tie-breaker: shift the one with the smallest daily usage to fine-tune, or largest to drop big loads.
            shiftableTasks.sort((a, b) => {
                const tfA = remainingFloat.get(a)!
                const tfB = remainingFloat.get(b)!
                if (tfB !== tfA) return tfB - tfA // Descending TF

                // Tie-breaker: Descending usage (shift Heavy tasks first to fix the peak faster)
                const useA = taskDailyUsage.get(a)!
                const useB = taskDailyUsage.get(b)!
                return useB - useA
            })

            const targetTaskToShiftId = shiftableTasks[0]
            const targetTask = taskMap.get(targetTaskToShiftId)!

            // 4e. Shift it 1 day into the future
            targetTask.startDate = addDays(targetTask.startDate, 1)
            targetTask.endDate = addDays(targetTask.endDate, 1)

            // 4f. Decrement its TF (it burned 1 day of flexibility)
            const oldTf = remainingFloat.get(targetTaskToShiftId)!
            remainingFloat.set(targetTaskToShiftId, oldTf - 1)

            // Mark as shifted
            shiftedRecords.set(targetTaskToShiftId, { newStart: targetTask.startDate, newEnd: targetTask.endDate })

            // The exact End Date of the project extended? No, TF guarantees it won't push the CP boundary 
            // unless we exceed the TF limit (which we prevent by filtering TF > 0).

            // Loop back, measure day again (dailyLoad will be lower if targetTask isn't active on this day anymore, 
            // or we might shift another task if it's still active but we're still over limit).
        }
    }

    const updatedTasks = Array.from(shiftedRecords.entries()).map(([id, dates]) => ({
        id,
        newStartDate: dates.newStart,
        newEndDate: dates.newEnd
    }))

    return {
        updatedTasks,
        shiftedCount: updatedTasks.length,
        isFullyLeveled
    }
}
