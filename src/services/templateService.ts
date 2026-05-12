/**
 * templateService.ts
 * v4 Sprint 3 — Item 15: Project Templates
 *
 * Saves/loads project templates in localStorage.
 * A template captures WBS items, RAB items, and basic project metadata
 * from the current stores and serializes them for reuse.
 */

import { useTimelineStore } from '@/store/timelineStore'

const STORAGE_KEY = 'nata_project_templates'

export interface TemplateWBSItem {
  name: string
  level: number
  code?: string
  unit?: string
  duration?: number
}

export interface TemplateRABItem {
  name: string
  description?: string
  unit?: string
  qty?: number
  unitPrice?: number
}

export interface ProjectTemplate {
  id: string
  name: string
  description?: string
  wbsItems: TemplateWBSItem[]
  rabItems: TemplateRABItem[]
  createdAt: string
}

function loadRaw(): ProjectTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ProjectTemplate[]
  } catch {
    return []
  }
}

function saveRaw(templates: ProjectTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function loadTemplates(): ProjectTemplate[] {
  return loadRaw()
}

export function getTemplate(id: string): ProjectTemplate | null {
  return loadRaw().find((t) => t.id === id) ?? null
}

/**
 * Save the current project's timeline tasks as a template.
 * Captures task names and durations without dates so they're relative.
 */
export function saveTemplateFromProject(projectId: string, name: string, description?: string): ProjectTemplate {
  const timelineState = useTimelineStore.getState()
  const tasks = timelineState.getTasks ? timelineState.getTasks(projectId) : []

  const wbsItems: TemplateWBSItem[] = tasks.map((t) => ({
    name: t.name,
    level: (t as { level?: number }).level ?? 1,
    code: (t as { code?: string }).code,
    unit: (t as { unit?: string }).unit,
    duration: t.duration ?? 1,
  }))

  const template: ProjectTemplate = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    wbsItems,
    rabItems: [],
    createdAt: new Date().toISOString(),
  }

  const existing = loadRaw()
  saveRaw([...existing, template])
  return template
}

/**
 * Apply a template to a target project.
 * Creates tasks starting from today, each duration day(s) after the previous.
 */
export function applyTemplate(templateId: string, projectId: string): number {
  const template = getTemplate(templateId)
  if (!template) return 0

  const timelineState = useTimelineStore.getState()

  let cursor = new Date()
  let count = 0

  for (const item of template.wbsItems) {
    const startDate = cursor.toISOString().split('T')[0]
    const durationDays = Math.max(1, item.duration ?? 1)
    const endDate = new Date(cursor.getTime() + (durationDays - 1) * 86400000)
      .toISOString()
      .split('T')[0]

    if (typeof (timelineState as { addTask?: (...args: unknown[]) => void }).addTask === 'function') {
      (timelineState as { addTask: (projectId: string, task: object) => void }).addTask(projectId, {
        name: item.name,
        startDate,
        endDate,
        duration: durationDays,
        status: 'not_started',
        progress: 0,
      })
    }

    cursor = new Date(cursor.getTime() + durationDays * 86400000)
    count++
  }

  return count
}

export function deleteTemplate(id: string): void {
  saveRaw(loadRaw().filter((t) => t.id !== id))
}
