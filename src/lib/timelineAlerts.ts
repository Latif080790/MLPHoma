import { TimelineTask } from '../store/timelineStore'

export type AlertSeverity = 'critical' | 'warning'

export interface TimelineAlert {
    taskId: string
    taskName: string
    severity: AlertSeverity
    message: string
    expectedProgress: number
    actualProgress: number
    delayDays: number
}

/**
 * Parses ISO Date (YYYY-MM-DD) natively
 */
function parseISODate(s: string): number {
    return new Date(s).setHours(0, 0, 0, 0)
}

/**
 * Calculate expected versus actual progress, throwing alerts for delays on critical tasks.
 */
export function calculateTimelineAlerts(tasks: TimelineTask[]): TimelineAlert[] {
    const alerts: TimelineAlert[] = []

    // Set current date to midnight
    const today = new Date().setHours(0, 0, 0, 0)

    for (const t of tasks) {
        if (t.progress >= 100 || t.status === 'completed') continue

        const start = parseISODate(t.startDate)
        const end = parseISODate(t.endDate)
        const totalDurationMs = end - start

        // Case 1: End Date Exceeded (Critical Delay)
        if (today > end) {
            const delayDays = Math.floor((today - end) / (1000 * 60 * 60 * 24))
            alerts.push({
                taskId: t.id,
                taskName: t.name,
                severity: 'critical',
                message: `Overdue by ${delayDays} day(s)`,
                expectedProgress: 100,
                actualProgress: t.progress,
                delayDays
            })
            continue
        }

        // Case 2: In Progress - Compare actual vs linear expected (Warning)
        if (today >= start && today <= end) {
            const elapsedMs = today - start
            // Expected linear progress %
            const expectedLinearPct = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 100

            // If actual is lagging behind expected by more than 15%
            if (expectedLinearPct - t.progress > 15) {
                alerts.push({
                    taskId: t.id,
                    taskName: t.name,
                    severity: 'warning',
                    message: `Lagging behind expected pace (${expectedLinearPct.toFixed(0)}%)`,
                    expectedProgress: expectedLinearPct,
                    actualProgress: t.progress,
                    delayDays: 0
                })
            }
        }
    }

    // Sort: Criticals first
    return alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1
        if (a.severity !== 'critical' && b.severity === 'critical') return 1
        return b.delayDays - a.delayDays
    })
}
