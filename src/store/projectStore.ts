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
import { fetchProjects, supabase } from '../lib/supabaseClient'
import { syncProject as syncProj, syncDelete } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import { projectInputSchema, projectUpdateSchema } from '../lib/validationSchemas'
import { toast } from 'sonner'
import { useAuthStore } from './authStore'

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
  [key: string]: any
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
  /** User ID (owner of the project) */
  userId?: string
  /** Optional payment terms attached to the project */
  paymentTerms?: PaymentTerms
  /** Optional AHSP Pricing Zone ID */
  zoneId?: string
  /** Misc free-form metadata */
  meta?: Record<string, any>
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

  return {
    projects: {},

    activeProjectId: undefined,

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
      const { id, ...projectData } = project
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
        return { projects: copy, activeProjectId: nextActive }
      })
      // Queue-based delete with retry
      syncDelete('projects', projectId)
    },

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
        const archived = { ...existing, status: 'ARCHIVED' }
        return { projects: { ...state.projects, [projectId]: archived } }
      })

      // 2. Sync via centralized service (queued + retry)
      const existing = get().projects[projectId]
      if (existing) {
        syncProj({
          ...existing,
          status: 'ARCHIVED',
          archived_at: new Date().toISOString(),
        })
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
          data.forEach((row: any) => {
            projects[row.id] = {
              id: row.id,
              name: row.name,
              code: row.code,
              clientName: row.client_name,
              location: row.location,
              startDate: row.start_date,
              endDate: row.end_date,
              budget: row.budget,
              status: row.status,
              userId: row.user_id,
              paymentTerms: row.payment_terms,
              meta: row.meta,
            }
          })
          set({ projects })
        }
      } catch (err) {
        console.warn('Failed to load projects from Supabase', err)
      }
    },
  }
})

export default useProjectStore