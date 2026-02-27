/**
 * scheduleAlertService.ts
 * Detects schedule deviations and critical path warnings.
 * Helps PMs identify tasks that are behind schedule.
 */

import { assertSupabase } from '../lib/supabaseClient'

/**
 * Schedule alert severity
 */
export type AlertSeverity = 'MINOR' | 'MODERATE' | 'CRITICAL'

/**
 * Schedule alert
 */
export interface ScheduleAlert {
    id: string
    projectId: string
    taskId: string
    taskName: string
    taskCode?: string

    severity: AlertSeverity
    alertType: 'BEHIND_SCHEDULE' | 'CRITICAL_PATH_DELAYED' | 'DEPENDENCY_BLOCKED' | 'OVERDUE'

    // Schedule details
    plannedStartDate: string
    plannedEndDate: string
    actualStartDate?: string
    currentProgress: number

    // Deviation metrics
    daysBehind: number
    daysRemaining: number
    projectedDelayDays: number

    // Critical path info
    isCriticalPath: boolean
    affectedSuccessors?: string[] // Task IDs

    message: string
    recommendations: string[]

    detectedAt: string
}

/**
 * Critical path calculation result
 */
export interface CriticalPathResult {
    criticalTasks: string[] // Task IDs on critical path
    projectEndDate: string
    totalDuration: number // days
}

/**
 * Threshold configuration for schedule deviation severity.
 */
export interface ScheduleAlertThresholds {
    minorDays: number
    moderateDays: number
    criticalDays: number
    minProgressGapPercent: number
}

/**
 * Task for schedule analysis
 */
interface TaskForAnalysis {
    id: string
    name: string
    code?: string
    plannedStartDate: string
    plannedEndDate: string
    actualStartDate?: string
    actualEndDate?: string
    progress: number
    dependencies: string[] // predecessor task IDs
    duration: number // days
}

// ---------- Constants ----------

const DEFAULT_THRESHOLDS: ScheduleAlertThresholds = {
    minorDays: 2,
    moderateDays: 5,
    criticalDays: 10,
    minProgressGapPercent: 5,
}

// ---------- Helpers ----------

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
    const diff = date2.getTime() - date1.getTime()
    return Math.round(diff / (1000 * 60 * 60 * 24))
}

/**
 * Determine alert severity based on days behind
 */
function getSeverity(daysBehind: number, isCriticalPath: boolean, thresholds: ScheduleAlertThresholds): AlertSeverity {
    if (isCriticalPath) {
        // Critical path tasks get elevated severity
        if (daysBehind >= thresholds.moderateDays) return 'CRITICAL'
        if (daysBehind >= thresholds.minorDays) return 'MODERATE'
    }

    if (daysBehind >= thresholds.criticalDays) return 'CRITICAL'
    if (daysBehind >= thresholds.moderateDays) return 'MODERATE'
    return 'MINOR'
}

function normalizeDependencies(raw: unknown): string[] {
    if (!raw) return []

    const parseDependencyValue = (value: unknown): string | null => {
        if (typeof value === 'string') {
            const trimmed = value.trim()
            return trimmed.length ? trimmed : null
        }
        if (value && typeof value === 'object') {
            const candidate = (value as any).predecessorId ?? (value as any).id
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate.trim()
            }
        }
        return null
    }

    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw)
            return normalizeDependencies(parsed)
        } catch {
            return []
        }
    }

    if (!Array.isArray(raw)) return []

    const normalized = raw
        .map(parseDependencyValue)
        .filter((v): v is string => Boolean(v))

    return Array.from(new Set(normalized))
}

/**
 * Calculate critical path using CPM (Critical Path Method)
 * Simplified version - uses forward and backward pass
 */
function calculateCriticalPath(tasks: TaskForAnalysis[]): CriticalPathResult {
    // Build task map
    const taskMap = new Map<string, TaskForAnalysis>()
    tasks.forEach(t => taskMap.set(t.id, t))

    // Calculate earliest start/finish times (forward pass)
    const earliestStart = new Map<string, number>()
    const earliestFinish = new Map<string, number>()

    const calculateEarliest = (taskId: string): void => {
        if (earliestStart.has(taskId)) return

        const task = taskMap.get(taskId)
        if (!task) return

        // Calculate earliest start based on predecessors
        let maxPredFinish = 0
        task.dependencies.forEach(predId => {
            calculateEarliest(predId)
            const predFinish = earliestFinish.get(predId) || 0
            maxPredFinish = Math.max(maxPredFinish, predFinish)
        })

        earliestStart.set(taskId, maxPredFinish)
        earliestFinish.set(taskId, maxPredFinish + task.duration)
    }

    tasks.forEach(t => calculateEarliest(t.id))

    // Find project end date (maximum finish time)
    let projectEnd = 0
    earliestFinish.forEach(finish => {
        projectEnd = Math.max(projectEnd, finish)
    })

    // Calculate latest start/finish times (backward pass)
    const latestStart = new Map<string, number>()
    const latestFinish = new Map<string, number>()

    const calculateLatest = (taskId: string): void => {
        if (latestFinish.has(taskId)) return

        const task = taskMap.get(taskId)
        if (!task) return

        // Find successors
        const successors = tasks.filter(t => t.dependencies.includes(taskId))

        if (successors.length === 0) {
            // Leaf task - latest finish is project end
            latestFinish.set(taskId, projectEnd)
        } else {
            // Latest finish is minimum of successors' latest starts
            let minSuccStart = projectEnd
            successors.forEach(succ => {
                calculateLatest(succ.id)
                const succStart = latestStart.get(succ.id) || projectEnd
                minSuccStart = Math.min(minSuccStart, succStart)
            })
            latestFinish.set(taskId, minSuccStart)
        }

        latestStart.set(taskId, (latestFinish.get(taskId) || 0) - task.duration)
    }

    tasks.forEach(t => calculateLatest(t.id))

    // Identify critical tasks (where earliest = latest)
    const criticalTasks: string[] = []
    tasks.forEach(task => {
        const es = earliestStart.get(task.id) || 0
        const ls = latestStart.get(task.id) || 0
        if (Math.abs(es - ls) < 0.1) {
            // Zero or near-zero slack = critical path
            criticalTasks.push(task.id)
        }
    })

    // Calculate project end date
    const today = new Date()
    const projectEndDate = new Date(today.getTime() + projectEnd * 24 * 60 * 60 * 1000)

    return {
        criticalTasks,
        projectEndDate: projectEndDate.toISOString(),
        totalDuration: projectEnd,
    }
}

/**
 * Analyze task for schedule deviation
 */
function analyzeTask(
    task: TaskForAnalysis,
    isCriticalPath: boolean,
    now: Date,
    thresholds: ScheduleAlertThresholds,
): ScheduleAlert | null {
    const plannedEnd = new Date(task.plannedEndDate)
    const plannedStart = new Date(task.plannedStartDate)
    const actualStart = task.actualStartDate ? new Date(task.actualStartDate) : null

    // Calculate expected progress based on planned dates
    const plannedDuration = Math.max(1, daysBetween(plannedStart, plannedEnd))
    const daysElapsed = Math.max(0, daysBetween(plannedStart, now))
    const expectedProgress = Math.min(100, (daysElapsed / plannedDuration) * 100)

    // Calculate deviation
    const progressGap = expectedProgress - task.progress

    // Only alert if task has started or should have started, and is behind
    const shouldHaveStarted = now >= plannedStart
    if (!shouldHaveStarted || progressGap < thresholds.minProgressGapPercent) {
        // Less than 5% behind = acceptable variance
        return null
    }

    // Calculate days behind
    const daysBehind = Math.round((progressGap / 100) * plannedDuration)
    const daysRemaining = Math.max(0, daysBetween(now, plannedEnd))

    // Project delay
    const remainingWork = 100 - task.progress
    const currentVelocity = task.progress / Math.max(1, daysElapsed)
    const daysNeeded = remainingWork / Math.max(0.1, currentVelocity)
    const projectedDelayDays = Math.round(Math.max(0, daysNeeded - daysRemaining))

    // Determine alert type
    let alertType: ScheduleAlert['alertType'] = 'BEHIND_SCHEDULE'
    if (now > plannedEnd) {
        alertType = 'OVERDUE'
    } else if (isCriticalPath) {
        alertType = 'CRITICAL_PATH_DELAYED'
    }

    // Determine severity
    const severity = getSeverity(daysBehind, isCriticalPath, thresholds)

    // Build message
    let message = `Task is ${daysBehind} days behind schedule`
    if (isCriticalPath) {
        message += ' (on critical path!)'
    }
    if (projectedDelayDays > 0) {
        message += `. Projected to finish ${projectedDelayDays} days late.`
    }

    // Build recommendations
    const recommendations: string[] = []
    if (daysBehind >= thresholds.moderateDays) {
        recommendations.push('Review resource allocation and consider adding more workers')
    }
    if (isCriticalPath) {
        recommendations.push('Prioritize this task to avoid project delay')
        recommendations.push('Consider fast-tracking or crashing techniques')
    }
    if (task.progress < 20 && daysElapsed > plannedDuration * 0.3) {
        recommendations.push('Task appears blocked - investigate dependencies and constraints')
    }

    return {
        id: `alert_${task.id}_${Date.now()}`,
        projectId: '', // Will be set by caller
        taskId: task.id,
        taskName: task.name,
        taskCode: task.code,
        severity,
        alertType,
        plannedStartDate: task.plannedStartDate,
        plannedEndDate: task.plannedEndDate,
        actualStartDate: task.actualStartDate,
        currentProgress: task.progress,
        daysBehind,
        daysRemaining,
        projectedDelayDays,
        isCriticalPath,
        message,
        recommendations,
        detectedAt: now.toISOString(),
    }
}

// ---------- Service ----------

export const scheduleAlertService = {

    getDefaultThresholds(): ScheduleAlertThresholds {
        return { ...DEFAULT_THRESHOLDS }
    },

    /**
     * Get all schedule alerts for a project
     */
    async getProjectAlerts(projectId: string, thresholds: Partial<ScheduleAlertThresholds> = {}): Promise<ScheduleAlert[]> {
        const client = assertSupabase()
        const effectiveThresholds: ScheduleAlertThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }

        // Fetch project tasks from timeline_tasks
        const { data: tasksData, error } = await client
            .from('timeline_tasks')
            .select('id, name, start_date, end_date, progress, dependencies, duration, wbs_id')
            .eq('project_id', projectId)
            .order('start_date')

        if (error || !tasksData) {
            console.error('Failed to fetch tasks for schedule analysis:', error)
            return []
        }

        // Convert to analysis format
        const tasks: TaskForAnalysis[] = tasksData.map((row: any) => {
            return {
                id: row.id,
                name: row.name,
                plannedStartDate: row.start_date,
                plannedEndDate: row.end_date,
                progress: row.progress || 0,
                dependencies: normalizeDependencies(row.dependencies),
                duration: row.duration || Math.max(1, daysBetween(new Date(row.start_date), new Date(row.end_date))),
            }
        })

        // Calculate critical path
        const criticalPath = calculateCriticalPath(tasks)
        const criticalTaskSet = new Set(criticalPath.criticalTasks)

        // Analyze each task
        const now = new Date()
        const alerts: ScheduleAlert[] = []

        tasks.forEach(task => {
            const isCritical = criticalTaskSet.has(task.id)
            const alert = analyzeTask(task, isCritical, now, effectiveThresholds)

            if (alert) {
                alert.projectId = projectId
                alerts.push(alert)
            }
        })

        // Sort by severity and days behind
        alerts.sort((a, b) => {
            const severityOrder = { CRITICAL: 0, MODERATE: 1, MINOR: 2 }
            const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
            if (severityDiff !== 0) return severityDiff
            return b.daysBehind - a.daysBehind
        })

        return alerts
    },

    /**
     * Get critical path for a project
     */
    async getCriticalPath(projectId: string): Promise<CriticalPathResult> {
        const client = assertSupabase()

        const { data: tasksData, error } = await client
            .from('timeline_tasks')
            .select('id, start_date, end_date, dependencies, duration')
            .eq('project_id', projectId)

        if (error || !tasksData) {
            return {
                criticalTasks: [],
                projectEndDate: new Date().toISOString(),
                totalDuration: 0,
            }
        }

        const tasks: TaskForAnalysis[] = tasksData.map((row: any) => {
            return {
                id: row.id,
                name: '',
                plannedStartDate: row.start_date,
                plannedEndDate: row.end_date,
                progress: 0,
                dependencies: normalizeDependencies(row.dependencies),
                duration: row.duration || Math.max(1, daysBetween(new Date(row.start_date), new Date(row.end_date))),
            }
        })

        return calculateCriticalPath(tasks)
    },

    /**
     * Get alerts by severity
     */
    async getAlertsBySeverity(projectId: string, severity: AlertSeverity): Promise<ScheduleAlert[]> {
        const allAlerts = await this.getProjectAlerts(projectId)
        return allAlerts.filter(a => a.severity === severity)
    },

    /**
     * Get count of alerts by severity
     */
    async getAlertCounts(projectId: string): Promise<Record<AlertSeverity, number>> {
        const allAlerts = await this.getProjectAlerts(projectId)

        return {
            CRITICAL: allAlerts.filter(a => a.severity === 'CRITICAL').length,
            MODERATE: allAlerts.filter(a => a.severity === 'MODERATE').length,
            MINOR: allAlerts.filter(a => a.severity === 'MINOR').length,
        }
    },
}
