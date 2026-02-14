/**
 * timelineScenarioService.ts
 * FASE 3.5: Timeline What-If Scenario Analysis
 *
 * Allows PM to explore scheduling scenarios without modifying the actual timeline:
 * 1. "What if Task X is delayed by N days?"
 * 2. "What if we fast-track the critical path?"
 * 3. Calculates downstream impact on dependent tasks (CPM-based)
 * 4. Shows total project duration impact
 * 5. Can save named scenarios for comparison
 *
 * Uses the existing CPM engine from src/lib/cpm.ts
 */

import { assertSupabase } from '../lib/supabaseClient'

// ---------- Types ----------

export interface ScenarioModification {
    taskId: string
    taskName: string
    field: 'duration_days' | 'start_date'
    originalValue: number | string
    newValue: number | string
}

export interface ScenarioTask {
    id: string
    name: string
    wbsId?: string
    startDate: string
    endDate: string
    durationDays: number
    dependencies: string[]
    isCritical: boolean
    /** How many days this task shifted from original */
    deltaFromOriginal: number
}

export interface ScenarioResult {
    name: string
    modifications: ScenarioModification[]
    tasks: ScenarioTask[]
    originalProjectEnd: string
    scenarioProjectEnd: string
    totalDelayDays: number
    criticalPathTasks: string[]
    impactSummary: string
}

// ---------- Helpers ----------

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

// ---------- Service ----------

export const timelineScenarioService = {

    /**
     * Run a what-if scenario on the project timeline.
     * Does NOT modify actual data — purely computational.
     */
    async runScenario(
        projectId: string,
        scenarioName: string,
        modifications: ScenarioModification[],
    ): Promise<ScenarioResult> {
        const client = assertSupabase()

        // 1. Fetch all timeline tasks
        const { data: tasks, error } = await client
            .from('timeline_tasks')
            .select('id, name, wbs_id, start_date, end_date, duration_days, dependencies')
            .eq('project_id', projectId)
            .order('start_date', { ascending: true })

        if (error) throw error
        if (!tasks || tasks.length === 0) throw new Error('No timeline tasks found')

        // 2. Build task map (copy to avoid mutating originals)
        const taskMap = new Map<string, ScenarioTask>()
        const originalEndDates = new Map<string, string>()

        for (const t of tasks) {
            const deps = (() => {
                if (!t.dependencies) return []
                if (Array.isArray(t.dependencies)) return t.dependencies
                if (typeof t.dependencies === 'string') {
                    try { return JSON.parse(t.dependencies) } catch { return [] }
                }
                return []
            })()

            taskMap.set(t.id, {
                id: t.id,
                name: t.name,
                wbsId: t.wbs_id,
                startDate: t.start_date,
                endDate: t.end_date,
                durationDays: Number(t.duration_days) || 1,
                dependencies: deps,
                isCritical: false,
                deltaFromOriginal: 0,
            })
            originalEndDates.set(t.id, t.end_date)
        }

        // 3. Apply modifications
        for (const mod of modifications) {
            const task = taskMap.get(mod.taskId)
            if (!task) continue

            if (mod.field === 'duration_days') {
                task.durationDays = Number(mod.newValue)
                task.endDate = addDays(task.startDate, task.durationDays)
            } else if (mod.field === 'start_date') {
                const shiftDays = daysBetween(task.startDate, String(mod.newValue))
                task.startDate = String(mod.newValue)
                task.endDate = addDays(task.startDate, task.durationDays)
            }
        }

        // 4. Forward pass — propagate changes through dependencies
        // Simple topological scheduling: for each task, ensure start >= max(end of predecessors)
        const visited = new Set<string>()

        const processTask = (taskId: string) => {
            if (visited.has(taskId)) return
            visited.add(taskId)

            const task = taskMap.get(taskId)
            if (!task) return

            // Process predecessors first
            for (const depId of task.dependencies) {
                processTask(depId)
            }

            // Calculate earliest start = max of predecessor end dates
            if (task.dependencies.length > 0) {
                let maxPredEnd = ''
                for (const depId of task.dependencies) {
                    const pred = taskMap.get(depId)
                    if (pred && pred.endDate > maxPredEnd) {
                        maxPredEnd = pred.endDate
                    }
                }
                if (maxPredEnd && maxPredEnd > task.startDate) {
                    task.startDate = maxPredEnd
                    task.endDate = addDays(task.startDate, task.durationDays)
                }
            }

            // Calculate delta from original
            const origEnd = originalEndDates.get(taskId)
            if (origEnd) {
                task.deltaFromOriginal = daysBetween(origEnd, task.endDate)
            }
        }

        // Process all tasks
        for (const [taskId] of taskMap) {
            processTask(taskId)
        }

        // 5. Find project end dates
        const allTasks = Array.from(taskMap.values())
        const originalProjectEnd = tasks.reduce((max, t) => t.end_date > max ? t.end_date : max, '')
        const scenarioProjectEnd = allTasks.reduce((max, t) => t.endDate > max ? t.endDate : max, '')
        const totalDelayDays = daysBetween(originalProjectEnd, scenarioProjectEnd)

        // 6. Mark critical path (simplified: tasks that end on project end date)
        const criticalPathTasks: string[] = []
        for (const task of allTasks) {
            if (task.endDate === scenarioProjectEnd || task.deltaFromOriginal > 0) {
                task.isCritical = true
                criticalPathTasks.push(task.id)
            }
        }

        // 7. Build summary
        const impactParts: string[] = []
        if (totalDelayDays > 0) {
            impactParts.push(`Project delayed ${totalDelayDays} days`)
        } else if (totalDelayDays < 0) {
            impactParts.push(`Project shortened by ${Math.abs(totalDelayDays)} days`)
        } else {
            impactParts.push('No impact on project end date')
        }
        impactParts.push(`${criticalPathTasks.length} tasks on critical path`)

        return {
            name: scenarioName,
            modifications,
            tasks: allTasks,
            originalProjectEnd,
            scenarioProjectEnd,
            totalDelayDays,
            criticalPathTasks,
            impactSummary: impactParts.join('. '),
        }
    },

    /**
     * Save a scenario result to the database for later comparison.
     * Uses the CurvaS store's SavedScenario concept.
     */
    async saveScenario(projectId: string, result: ScenarioResult): Promise<string> {
        const client = assertSupabase()

        // Store in a generic JSON column or dedicated table
        // For now, store in project metadata or a scenarios array
        const { data, error } = await client
            .from('projects')
            .select('metadata')
            .eq('id', projectId)
            .single()

        const metadata = (data?.metadata || {}) as any
        const scenarios = metadata.timeline_scenarios || []

        scenarios.push({
            id: crypto.randomUUID(),
            name: result.name,
            createdAt: new Date().toISOString(),
            totalDelayDays: result.totalDelayDays,
            modifications: result.modifications,
            impactSummary: result.impactSummary,
        })

        // Keep last 10 scenarios max
        if (scenarios.length > 10) scenarios.shift()

        const { error: updateErr } = await client
            .from('projects')
            .update({
                metadata: { ...metadata, timeline_scenarios: scenarios },
            })
            .eq('id', projectId)

        if (updateErr) throw updateErr

        return scenarios[scenarios.length - 1].id
    },
}
