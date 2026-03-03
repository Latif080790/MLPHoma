/**
 * projectStore.ts
 *
 * Zustand store that manages projects and active project selection.
 * - Provides stable selectors and setters used across the app.
 * - Exposes helpers: getProject, getActiveProject, addProject, updateProject,
 *   setActiveProject, setPaymentTerms, removeProject, getProjects.
 *
 * This file is written defensively to keep function references stable so React + Zustand
 * subscriptions do not trigger unnecessary re-renders that can lead to update-depth loops.
 */

import { create } from 'zustand'
import { createCachedGetter } from '../lib/cachedGetter'
import { fetchProjects, supabase, assertSupabase } from '../lib/supabaseClient'
import { syncProject as syncProj, syncDelete } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import { projectInputSchema, projectUpdateSchema } from '../lib/validationSchemas'
import { toast } from 'sonner'
import { useAuthStore } from './authStore'
import { auditService } from '@/services/auditService'

/**
 * PaymentTerms
 * Lightweight representation of payment-related settings for a project.
 */
export interface PaymentTerms {
  /** Down payment fraction (0..1) */
  downPaymentPercent?: number
  /** Billing fraction (0..1) */
  billingPercent?: number
  /** Retention fraction (0..1) */
  retentionRate?: number
  /** Loan Interest Rate (annual fraction, e.g. 0.12 for 12%) */
  loanInterestRate?: number
  /** Tax Rate (fraction of billing, e.g. 0.11 for PPN or 0.03 for PPH) */
  taxRate?: number
  /** Optional additional fields */
  [key: string]: unknown
}

/**
 * Project
 * Core project type used in the UI and stores.
 */
export interface Project {
  id: string
  code?: string
  name: string
  clientName?: string
  location?: string
  startDate?: string
  endDate?: string
  budget?: number
  status?: string
  archived_at?: string
  /** User ID (owner of the project) */
  userId?: string
  /** Optional payment terms attached to the project */
  paymentTerms?: PaymentTerms
  /** Optional AHSP Pricing Zone ID */
  zoneId?: string
  /** Misc free-form metadata */
  meta?: Record<string, unknown>
}

/**
 * ProjectState
 * Shape of Zustand store for project management.
 */
interface ProjectState {
  /** All projects indexed by id */
  projects: Record<string, Project>
  /** Current active project id */
  activeProjectId?: string

  /** Add a new project (idempotent: will overwrite same id) */
  addProject: (project: Project) => void
  /** Update a project partially by id */
  updateProject: (projectId: string, patch: Partial<Project>) => void
  /** Remove a project by id */
  removeProject: (projectId: string) => void
  /** Set the active project id */
  setActiveProject: (projectId?: string) => void
  /** Activate a project (transition to Execution state & freeze baseline) */
  activateProject: (projectId: string) => Promise<void>
  /** Set payment terms for a project (partial replace/merge) */
  setPaymentTerms: (projectId: string, terms: Partial<PaymentTerms>) => void

  /** Archive a project */
  archiveProject: (projectId: string) => Promise<void>

  /** Getters (stable references) */
  getProject: (projectId: string) => Project | null
  getActiveProject: () => Project | null
  getProjects: () => Project[]

  /** Supabase Sync */
  loadProjects: () => Promise<void>
}

/**
 * createProjectStore
 *
 * Initialize the Zustand store with stable functions. All setters use functional updates
 * to avoid creating new object references unnecessarily.
 */
export const useProjectStore = create<ProjectState>((set, get) => {
  // cached getter for all projects array (stable identity while `projects` reference unchanged)
  const getProjectsCached = createCachedGetter(
    () => get().projects,
    (src) => Object.values(src || {})
  )

  // Restore persisted activeProjectId from localStorage
  const persistedActiveId = (() => {
    try {
      const stored = localStorage.getItem('mlphoma:activeProjectId')
      return stored || undefined
    } catch { return undefined }
  })()

  return {
    projects: {},

    activeProjectId: persistedActiveId,

    /**
     * addProject
     * Add or replace a project in the store.
     */
    addProject: (project: Project) => {
      if (!project || !project.id) return

      // Auto-populate userId from auth store if not provided
      if (!project.userId) {
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          project = { ...project, userId }
        }
      }

      // Validate input (skip id field)
      const { id: _id, ...projectData } = project
      const validation = validate(projectInputSchema, projectData)
      if (!validation.success) {
        const errors = validation.errors || []
        const errorMsg = errors[0]?.message || 'Validation failed'
        toast.error('Failed to add project', {
          description: errorMsg
        })
        return
      }

      set((state) => {
        // If identical object reference exists, keep state unchanged
        const prev = state.projects[project.id]
        if (prev === project) return state
        return {
          projects: { ...state.projects, [project.id]: project },
        }
      })
      // Queue-based sync with retry
      syncProj(project)
    },

    /**
     * updateProject
     * Merge partial fields into an existing project.
     */
    updateProject: (projectId: string, patch: Partial<Project>) => {
      if (!projectId) return

      // Validate updates
      const validation = validate(projectUpdateSchema, patch)
      if (!validation.success) {
        const errors = validation.errors || []
        const errorMsg = errors[0]?.message || 'Validation failed'
        toast.error('Failed to update project', {
          description: errorMsg
        })
        return
      }

      set((state) => {
        const existing = state.projects[projectId]
        if (!existing) return state
        const merged: Project = { ...existing, ...validation.data! }
        // If nothing changed by shallow compare, return same state
        if (Object.is(existing, merged)) return state

        return { projects: { ...state.projects, [projectId]: merged } }
      })
      // Queue-based sync with retry
      const updated = get().projects[projectId]
      if (updated) {
        syncProj(updated)
      }
    },

    /**
     * removeProject
     * Remove a project and clear activeProjectId if it was the removed one.
     */
    removeProject: (projectId: string) => {
      if (!projectId) return
      set((state) => {
        if (!state.projects[projectId]) return state
        const copy = { ...state.projects }
        delete copy[projectId]
        const nextActive = state.activeProjectId === projectId ? undefined : state.activeProjectId
        // Clear localStorage if active was removed
        if (state.activeProjectId === projectId) {
          try { localStorage.removeItem('mlphoma:activeProjectId') } catch { /* */ }
        }
        return { projects: copy, activeProjectId: nextActive }
      })
      // Queue-based delete with retry
      syncDelete('projects', projectId)
    },

    /**
     * archiveProject
     * Mark project as ARCHIVED locally and sync via centralized sync service.
     */
    /**
     * archiveProject
     * Mark project as ARCHIVED locally and sync via centralized sync service.
     */
    archiveProject: async (projectId: string) => {
      if (!projectId) return

      // 1. Optimistic Update
      set((state) => {
        const existing = state.projects[projectId]
        if (!existing) return state

        const archived: Project = {
          ...existing,
          status: 'ARCHIVED',
          archived_at: new Date().toISOString()
        }

        return { projects: { ...state.projects, [projectId]: archived } }
      })

      // 2. Sync via centralized service (queued + retry)
      const existing = get().projects[projectId]
      if (existing) {
        syncProj(existing)

        // Log to audit trail
        const currentUser = useAuthStore.getState().user
        auditService.log({
          action: 'PROJECT_ARCHIVED',
          userId: currentUser?.id,
          entity: 'projects',
          entityType: 'PROJECT',
          entityId: projectId,
          details: { reason: 'User archived project', previousStatus: existing.status }
        })

        toast.success('Proyek berhasil diarsipkan', {
          description: 'Project is now in read-only mode.'
        })
      }
    },

    /**
     * activateProject
     * Mark project as Active locally, sync it, and call freeze_project_baseline.
     */
    activateProject: async (projectId: string) => {
      if (!projectId) return

      // Optimistic update
      set((state) => {
        const existing = state.projects[projectId]
        if (!existing) return state
        const activated: Project = { ...existing, status: 'Active' }
        return { projects: { ...state.projects, [projectId]: activated } }
      })

      const existing = get().projects[projectId]
      if (existing) {
        // Sync new status
        syncProj(existing)

        // Supabase RPC to freeze baselines
        try {
          const client = assertSupabase()
          // If project ID is still uuid, we pass it. If it changed to text, it's fine too.
          const { error } = await client.rpc('freeze_project_baseline', {
            p_project_id: projectId,
            p_snapshot_name: 'Initial Baseline'
          })

          if (error) throw error

          const currentUser = useAuthStore.getState().user
          auditService.log({
            action: 'PROJECT_ACTIVATED',
            userId: currentUser?.id,
            entity: 'projects',
            entityType: 'PROJECT',
            entityId: projectId,
            details: { reason: 'User activated project and froze baseline' }
          })

          toast.success('Project Activated', {
            description: 'Baseline snapshots for RAB and RAP have been frozen successfully.'
          })
        } catch (err: unknown) {
          console.error('[Project Activation] Freeze failed:', err)
          toast.error('Baseline Freeze Failed', {
            description: (err as Error).message || 'Could not freeze baseline data.'
          })
        }
      }
    },

    /**
     * setActiveProject
     * Set active project by id. Accepts undefined to clear selection.
     */
    setActiveProject: (projectId?: string) => {
      set((state) => {
        if (projectId === state.activeProjectId) return state
        // ensure the project exists before setting (if provided)
        if (projectId && !state.projects[projectId]) {
          // if not exists, do not change active; caller should addProject first
          return state
        }
        return { activeProjectId: projectId }
      })
      // Persist to localStorage
      try {
        if (projectId) {
          localStorage.setItem('mlphoma:activeProjectId', projectId)
        } else {
          localStorage.removeItem('mlphoma:activeProjectId')
        }
      } catch { /* storage unavailable */ }
    },

    /**
     * setPaymentTerms
     * Merge payment terms into an existing project's paymentTerms field.
     */
    setPaymentTerms: (projectId: string, terms: Partial<PaymentTerms>) => {
      if (!projectId) return
      set((state) => {
        const proj = state.projects[projectId]
        if (!proj) return state
        const prevTerms = proj.paymentTerms || {}
        const nextTerms = { ...prevTerms, ...terms }
        // If identical, avoid update
        if (JSON.stringify(prevTerms) === JSON.stringify(nextTerms)) return state
        const updated: Project = { ...proj, paymentTerms: nextTerms }
        return { projects: { ...state.projects, [projectId]: updated } }
      })

      // Fix: Sync to Supabase
      const updatedProject = get().projects[projectId]
      if (updatedProject) {
        syncProj(updatedProject)
      }
    },

    /**
     * getProject
     * Return a project by id or null if missing.
     */
    getProject: (projectId: string) => {
      const p = get().projects[projectId]
      return p ?? null
    },

    /**
     * getActiveProject
     * Return currently active project or null.
     */
    getActiveProject: () => {
      const id = get().activeProjectId
      if (!id) return null
      return get().projects[id] ?? null
    },

    /**
     * getProjects
     * Return array of all projects (stable reference while store.projects unchanged).
     */
    getProjects: () => {
      return getProjectsCached()
    },

    /**
     * loadProjects
     * Fetch projects from Supabase and merge into store.
     */
    loadProjects: async () => {
      if (!supabase) return
      try {
        const { data, error } = await fetchProjects()
        if (error) throw error
        if (data) {
          const projects: Record<string, Project> = {}
          data.forEach((row: Record<string, unknown>) => {
            const rowId = row.id as string
            projects[rowId] = {
              id: rowId,
              name: row.name as string,
              code: row.code as string | undefined,
              clientName: row.client_name as string | undefined,
              location: row.location as string | undefined,
              startDate: row.start_date as string | undefined,
              endDate: row.end_date as string | undefined,
              budget: row.budget as number | undefined,
              status: row.status as string | undefined,
              userId: row.user_id as string | undefined,
              paymentTerms: row.payment_terms as import('../store/projectStore').PaymentTerms | undefined,
              meta: row.meta as Record<string, unknown> | undefined,
            }
          })
          // Validate persisted activeProjectId still exists in loaded projects
          const currentActiveId = get().activeProjectId
          if (currentActiveId && !projects[currentActiveId]) {
            set({ projects, activeProjectId: undefined })
            try { localStorage.removeItem('mlphoma:activeProjectId') } catch { /* */ }
          } else {
            set({ projects })
          }
        }
      } catch (err) {
        console.warn('Failed to load projects from Supabase', err)
      }
    },
  }
})

export default useProjectStore