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
  /** Optional payment terms attached to the project */
  paymentTerms?: PaymentTerms
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

  /** Getters (stable references) */
  getProject: (projectId: string) => Project | null
  getActiveProject: () => Project | null
  getProjects: () => Project[]
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
      set((state) => {
        // If identical object reference exists, keep state unchanged
        const prev = state.projects[project.id]
        if (prev === project) return state
        return {
          projects: { ...state.projects, [project.id]: project },
        }
      })
    },

    /**
     * updateProject
     * Merge partial fields into an existing project.
     */
    updateProject: (projectId: string, patch: Partial<Project>) => {
      if (!projectId) return
      set((state) => {
        const existing = state.projects[projectId]
        if (!existing) return state
        const merged: Project = { ...existing, ...patch }
        // If nothing changed by shallow compare, return same state
        if (Object.is(existing, merged)) return state
        return { projects: { ...state.projects, [projectId]: merged } }
      })
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
  }
})

export default useProjectStore