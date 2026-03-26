/**
 * timelineStore.ts
 * Zustand store for Timeline/Gantt tasks.
 *
 * - Stores tasks per projectId and provides CRUD operations.
 * - getTasks uses a cached getter per project to return a stable, sorted array
 *   reference when underlying data hasn't changed to avoid unnecessary re-renders.
 * - Utility date helpers are provided for ISO (YYYY-MM-DD) manipulation in UTC.
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import { createCachedGetterWithKey } from '../lib/cachedGetter'
import { validate, mergeErrorMessages } from '../lib/validationMiddleware'
import { timelineTaskInputSchema, timelineTaskUpdateSchema } from '../lib/validationSchemas'
import { syncTimelineTask, syncDelete, syncTimelineTasks } from '../lib/supabaseSyncService'
import { generateId } from '../lib/idGenerator'
import { eventBus } from '../lib/eventBus'
import type { TimelineProgressEvidence } from '../types/progressEvidence'
import { supabase } from '../lib/supabaseClient'

/**
 * Task status
 */
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'

/**
 * Task priority
 */
export type TaskPriority = 'low' | 'medium' | 'high'

/**
 * Simple dependency relation between tasks
 */
export interface TaskDependency {
  /** Unique dependency id */
  id: string
  /** Predecessor task id */
  predecessorId: string
  /** Successor task id */
  successorId: string
  /** Relation type, default 'FS' */
  type?: 'FS' | 'SS' | 'FF' | 'SF'
  /** Lag in days (may be negative) */
  lag?: number
}

/**
 * Timeline / Gantt task entity
 */
export interface TimelineTask {
  id: string
  projectId: string
  name: string
  description?: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  duration: number // inclusive days
  progress: number // 0..100
  progressEvidence?: TimelineProgressEvidence
  status: TaskStatus
  priority: TaskPriority
  wbsId?: string
  wbsCode?: string
  rabId?: string
  dependencies?: TaskDependency[]
  assignedResources?: string[]

  baselineStartDate?: string
  baselineEndDate?: string

  createdAt: string
  updatedAt: string
}

/**
 * Store interface and actions
 */
export interface TimelineState {
  /** Tasks grouped by projectId */
  tasksByProject: Record<string, TimelineTask[]>

  /** Get tasks for project (sorted) */
  getTasks: (projectId: string) => TimelineTask[]

  /** Set/replace all tasks for a project */
  setTasks: (projectId: string, tasks: TimelineTask[]) => void

  /** Add a task; returns generated id */
  addTask: (
    projectId: string,
    data: Omit<TimelineTask, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'endDate' | 'duration' | 'baselineStartDate' | 'baselineEndDate'> &
      Partial<Pick<TimelineTask, 'endDate' | 'duration'>>
  ) => string

  /** Update partial task fields */
  updateTask: (projectId: string, id: string, patch: Partial<TimelineTask>) => void

  /** Update start/end dates (duration recalculated) */
  updateTaskDates: (projectId: string, id: string, dates: { startDate: string; endDate: string }) => void

  /** Remove a task and clean dependencies */
  removeTask: (projectId: string, id: string) => void

  /** Snapshot baseline (copy current dates to baseline fields) */
  setBaseline: (projectId: string, overwrite?: boolean) => void

  /** Import multiple tasks (Batch) */
  importTasks: (projectId: string, tasks: Partial<TimelineTask>[]) => void

  /** Load tasks from Supabase for a project (replaces local state) */
  fetchTasks: (projectId: string) => Promise<void>

  /** Clear all tasks for a project (local + DB) */
  clearTasks: (projectId: string) => Promise<void>
}

/**
 * Parse ISO date (YYYY-MM-DD) as UTC date object to avoid TZ drift
 *
 * @param s ISO date string
 * @returns Date (UTC)
 */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Convert Date -> YYYY-MM-DD (UTC)
 *
 * @param d date
 * @returns YYYY-MM-DD
 */
function toISODate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().split('T')[0]
}

/**
 * Add days to ISO date (UTC)
 *
 * @param baseISO base ISO date
 * @param days days to add (can be negative)
 * @returns new ISO date string
 */
function addDays(baseISO: string, days: number): string {
  const d = parseISODate(baseISO)
  d.setUTCDate(d.getUTCDate() + days)
  return toISODate(d)
}

/**
 * Inclusive days between start..end (>=1)
 *
 * @param startISO start date (YYYY-MM-DD)
 * @param endISO end date (YYYY-MM-DD)
 * @returns number of days inclusive
 */
function inclusiveDays(startISO: string, endISO: string): number {
  const s = parseISODate(startISO).getTime()
  const e = parseISODate(endISO).getTime()
  const one = 1000 * 60 * 60 * 24
  return Math.max(1, Math.floor((e - s) / one) + 1)
}

/**
 * Create Timeline store with cached getter per project to return stable arrays
 */
export const useTimelineStore = create<TimelineState>((set, get) => {
  // cached getter per project: returns sorted stable array while source reference unchanged
  const getTasksCached = createCachedGetterWithKey<TimelineTask[] | undefined, TimelineTask[]>(
    (projectId?: string) => {
      const pid = projectId || ''
      return get().tasksByProject[pid] || []
    },
    (src) => {
      const arr = src ? [...src] : []
      arr.sort((a, b) => {
        if (a.startDate === b.startDate) return a.name.localeCompare(b.name)
        return a.startDate.localeCompare(b.startDate)
      })
      return arr
    }
  )

  return {
    tasksByProject: {},

    getTasks: (projectId: string) => {
      return getTasksCached(projectId)
    },

    setTasks: (projectId: string, tasks: TimelineTask[]) => {
      set((s) => ({
        tasksByProject: {
          ...s.tasksByProject,
          [projectId]: tasks.map((t) => ({ ...t, duration: inclusiveDays(t.startDate, t.endDate) })),
        },
      }))
    },

    addTask: (projectId, data) => {
      // Calculate end date if not provided
      const dur = Math.max(1, Number(data.duration || 1))
      const endDate = data.endDate ?? addDays(data.startDate, dur - 1)

      // Prepare task data for validation
      const taskData = {
        projectId,
        name: data.name,
        description: data.description || '',
        startDate: data.startDate,
        endDate,
        duration: inclusiveDays(data.startDate, endDate),
        progress: Number(data.progress || 0),
        progressEvidence: data.progressEvidence,
        status: (data.status as TaskStatus) || 'not_started',
        priority: (data.priority as TaskPriority) || 'medium',
        wbsId: data.wbsId,
        rabId: data.rabId,
        dependencies: data.dependencies || [],
        assignedResources: data.assignedResources || [],
      }

      // Validate input
      const validation = validate(timelineTaskInputSchema, taskData)
      if (!validation.success) {
        const errorMsg = mergeErrorMessages(validation.errors)
        toast.error('Failed to add task', { description: errorMsg })
        return ''
      }

      const id = generateId('task')
      const now = new Date().toISOString()
      const task = {
        ...taskData,
        ...validation.data,
        id,
        createdAt: now,
        updatedAt: now,
      } as TimelineTask

      set((s) => {
        const arr = s.tasksByProject[projectId] || []
        return { tasksByProject: { ...s.tasksByProject, [projectId]: [...arr, task] } }
      })

      // Sync to Supabase
      syncTimelineTask(task)

      return id
    },

    updateTask: (projectId, id, patch) => {
      // Validate updates
      const validation = validate(timelineTaskUpdateSchema, patch)
      if (!validation.success) {
        const errorMsg = mergeErrorMessages(validation.errors)
        toast.error('Failed to update task', { description: errorMsg })
        return
      }

      let updatedTask: TimelineTask | null = null

      set((s) => {
        const arr = s.tasksByProject[projectId] || []
        const next = arr.map((t) => {
          if (t.id !== id) return t
          const start = validation.data?.startDate ?? t.startDate
          const end = validation.data?.endDate ?? t.endDate
          updatedTask = { ...t, ...validation.data, duration: inclusiveDays(start, end), updatedAt: new Date().toISOString() }
          return updatedTask
        })
        return { tasksByProject: { ...s.tasksByProject, [projectId]: next } }
      })

      // Sync to Supabase
      if (updatedTask) {
        syncTimelineTask(updatedTask)
      }
    },

    updateTaskDates: (projectId, id, dates) => {
      const { startDate, endDate } = dates
      get().updateTask(projectId, id, { startDate, endDate })
    },

    removeTask: (projectId, id) => {
      set((s) => {
        const arr = s.tasksByProject[projectId] || []
        const filtered = arr.filter((t) => t.id !== id)
        const cleaned = filtered.map((t) => ({ ...t, dependencies: (t.dependencies || []).filter((d) => d.predecessorId !== id && d.successorId !== id) }))
        return { tasksByProject: { ...s.tasksByProject, [projectId]: cleaned } }
      })

      // Sync deletion to Supabase
      syncDelete('timeline_tasks', id)
    },

    setBaseline: (projectId, overwrite = true) => {
      set((s) => {
        const arr = s.tasksByProject[projectId] || []
        const next = arr.map((t) => {
          if (!overwrite && t.baselineStartDate && t.baselineEndDate) return t
          return { ...t, baselineStartDate: t.startDate, baselineEndDate: t.endDate, updatedAt: new Date().toISOString() }
        })
        return { tasksByProject: { ...s.tasksByProject, [projectId]: next } }
      })
    },

    importTasks: (projectId, tasks) => {
      const now = new Date().toISOString()
      const newTasks: TimelineTask[] = tasks.map((t) => {
        const dur = Math.max(1, Number(t.duration || 1))
        const startDate = t.startDate || toISODate(new Date())
        const endDate = t.endDate ?? addDays(startDate, dur - 1)

        return {
          id: t.id || generateId('task'),
          projectId,
          name: t.name || 'Unhamed Task',
          description: t.description || '',
          startDate,
          endDate,
          duration: inclusiveDays(startDate, endDate),
          progress: Number(t.progress || 0),
          progressEvidence: t.progressEvidence,
          status: t.status || 'not_started',
          priority: t.priority || 'medium',
          wbsId: t.wbsId,
          rabId: t.rabId,
          dependencies: t.dependencies || [],
          assignedResources: t.assignedResources || [],
          createdAt: now,
          updatedAt: now,
        }
      })

      set((s) => {
        const arr = s.tasksByProject[projectId] || []
        return { tasksByProject: { ...s.tasksByProject, [projectId]: [...arr, ...newTasks] } }
      })

      // Sync to Supabase using batch
      syncTimelineTasks(newTasks, projectId)
    },

    fetchTasks: async (projectId: string) => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('timeline_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })
      if (error) {
        toast.error('Failed to load timeline tasks', { description: error.message })
        return
      }
      type TaskRow = {
        id: string; project_id: string; name: string; description?: string
        start_date: string; end_date: string; duration: number; progress: number
        status: string; priority: string; wbs_id?: string; rab_id?: string
        dependencies?: string | null; assigned_resources?: string[]
        baseline_start_date?: string; baseline_end_date?: string
        created_at: string; updated_at: string
        progress_evidence?: TimelineProgressEvidence
      }
      const tasks: TimelineTask[] = ((data || []) as TaskRow[]).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        duration: row.duration ?? inclusiveDays(row.start_date, row.end_date),
        progress: Number(row.progress ?? 0),
        progressEvidence: row.progress_evidence,
        status: (row.status as TimelineTask['status']) || 'not_started',
        priority: (row.priority as TimelineTask['priority']) || 'medium',
        wbsId: row.wbs_id,
        rabId: row.rab_id,
        dependencies: (() => {
          try { return typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : (row.dependencies ?? []) }
          catch { return [] }
        })(),
        assignedResources: row.assigned_resources ?? [],
        baselineStartDate: row.baseline_start_date,
        baselineEndDate: row.baseline_end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
      set((s) => ({
        tasksByProject: { ...s.tasksByProject, [projectId]: tasks },
      }))
    },

    clearTasks: async (projectId: string) => {
      if (!supabase) return
      // Clear locally
      set((s) => ({ tasksByProject: { ...s.tasksByProject, [projectId]: [] } }))
      // Clear from DB
      const { error } = await supabase.from('timeline_tasks').delete().eq('project_id', projectId)
      if (error) {
        console.error('Failed to clear timeline tasks in DB:', error.message)
      }
    },
  }
})


// Subscriptions
eventBus.on('timeline:changed', ({ projectId }) => {
  if (projectId) {
    useTimelineStore.getState().fetchTasks(projectId)
  }
})

export default useTimelineStore