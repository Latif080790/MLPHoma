/**
 * progressCaptureService.ts
 *
 * Evidence-Based Progress Capture Engine.
 * Filters today's active tasks from Timeline, stores progress entries
 * with photo evidence metadata, and generates daily reports.
 *
 * Storage: localStorage (project-scoped)
 */

import { useTimelineStore, type TimelineTask } from '../store/timelineStore'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { useAuthStore } from '../store/authStore'

// ─── Types ───

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy'

export interface ProgressEntry {
    id: string
    projectId: string
    taskId: string
    taskName: string
    wbsId?: string
    /** Progress percentage at time of capture (0-100) */
    progressBefore: number
    progressAfter: number
    /** Evidence metadata */
    photoCount: number
    photoNames: string[]
    notes: string
    weather: WeatherCondition
    crewCount: number
    /** Capture metadata */
    capturedBy: string
    capturedAt: string
    /** Coordinate from browser geolocation (if available) */
    latitude?: number
    longitude?: number
}

export interface DailyReport {
    projectId: string
    date: string
    entries: ProgressEntry[]
    taskCount: number
    completedToday: number
    avgProgressGain: number
    totalCrewDeployed: number
    weatherSummary: WeatherCondition
}

// ─── Storage ───

const STORAGE_KEY = 'mlphoma:progress_entries'

function loadEntries(): ProgressEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

function saveEntries(entries: ProgressEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ─── Service ───

export const progressCaptureService = {

    /**
     * Get tasks that should be active today based on Timeline dates.
     * A task is "today" if today falls between startDate and endDate,
     * and the task is not yet 100% complete.
     */
    getTodayTasks(projectId: string): TimelineTask[] {
        const tasks = useTimelineStore.getState().getTasks(projectId)
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        return tasks.filter(task => {
            if (task.progress >= 100) return false
            if (task.status === 'completed') return false
            return task.startDate <= today && task.endDate >= today
        })
    },

    /**
     * Get tasks that are overdue (endDate passed but not 100% complete).
     */
    getOverdueTasks(projectId: string): TimelineTask[] {
        const tasks = useTimelineStore.getState().getTasks(projectId)
        const today = new Date().toISOString().split('T')[0]

        return tasks.filter(task => {
            if (task.progress >= 100) return false
            if (task.status === 'completed') return false
            return task.endDate < today
        })
    },

    /**
     * Get upcoming tasks (starting within the next 3 days).
     */
    getUpcomingTasks(projectId: string, daysAhead = 3): TimelineTask[] {
        const tasks = useTimelineStore.getState().getTasks(projectId)
        const today = new Date()
        const futureDate = new Date(today)
        futureDate.setDate(futureDate.getDate() + daysAhead)
        const todayStr = today.toISOString().split('T')[0]
        const futureStr = futureDate.toISOString().split('T')[0]

        return tasks.filter(task => {
            if (task.progress >= 100) return false
            return task.startDate > todayStr && task.startDate <= futureStr
        })
    },

    /**
     * Submit a progress entry with evidence.
     * Also updates the Timeline task progress.
     */
    submitProgress(entry: Omit<ProgressEntry, 'id' | 'capturedAt'>): ProgressEntry {
        const fullEntry: ProgressEntry = {
            ...entry,
            id: generateId('prog'),
            capturedAt: new Date().toISOString(),
        }

        // Save entry
        const entries = loadEntries()
        entries.push(fullEntry)
        saveEntries(entries)

        // Update Timeline task progress
        useTimelineStore.getState().updateTask(entry.projectId, entry.taskId, {
            progress: entry.progressAfter,
            status: entry.progressAfter >= 100 ? 'completed' : 'in_progress',
        })

        // Audit log
        const { user, profile } = useAuthStore.getState()
        auditService.log({
            userId: user?.id,
            userName: profile?.full_name || user?.email,
            action: 'UPDATE',
            entity: 'site_progress',
            entityType: 'TASK',
            entityId: entry.taskId,
            details: {
                taskName: entry.taskName,
                progressBefore: entry.progressBefore,
                progressAfter: entry.progressAfter,
                photoCount: entry.photoCount,
                weather: entry.weather,
                crewCount: entry.crewCount,
            },
        })

        return fullEntry
    },

    /**
     * Get all entries for a specific date.
     */
    getEntriesForDate(projectId: string, dateStr: string): ProgressEntry[] {
        const entries = loadEntries()
        return entries.filter(e =>
            e.projectId === projectId &&
            e.capturedAt.startsWith(dateStr)
        )
    },

    /**
     * Generate a daily report.
     */
    getDailyReport(projectId: string, dateStr?: string): DailyReport {
        const date = dateStr || new Date().toISOString().split('T')[0]
        const entries = this.getEntriesForDate(projectId, date)

        const totalGain = entries.reduce((sum, e) => sum + (e.progressAfter - e.progressBefore), 0)
        const avgGain = entries.length > 0 ? totalGain / entries.length : 0

        // Most common weather
        const weatherCount: Record<string, number> = {}
        entries.forEach(e => { weatherCount[e.weather] = (weatherCount[e.weather] || 0) + 1 })
        const weatherSummary = (Object.entries(weatherCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sunny') as WeatherCondition

        return {
            projectId,
            date,
            entries,
            taskCount: entries.length,
            completedToday: entries.filter(e => e.progressAfter >= 100).length,
            avgProgressGain: avgGain,
            totalCrewDeployed: entries.reduce((sum, e) => sum + e.crewCount, 0),
            weatherSummary,
        }
    },

    /**
     * Get today's entries for a project.
     */
    getTodayEntries(projectId: string): ProgressEntry[] {
        const today = new Date().toISOString().split('T')[0]
        return this.getEntriesForDate(projectId, today)
    },
}
