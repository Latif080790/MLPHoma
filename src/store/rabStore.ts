/**
 * src/store/rabStore.ts
 *
 * Zustand store for RAB items with:
 * - cached getter per project (stable reference)
 * - localStorage persistence (simple)
 * - multi-level undo/redo history (per project)
 * - lightweight audit log (in-memory + persisted)
 *
 * Responsibilities:
 * - Keep mutation history snapshots to allow undo/redo
 * - Persist items and audit log to localStorage under STORAGE_KEY
 */

import { create } from 'zustand'
import { createCachedGetterWithKey } from '../lib/cachedGetter'
import { syncRABItem, syncDelete, syncRABItems } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import { rabItemInputSchema, rabItemUpdateSchema, rabItemSchema } from '../lib/validationSchemas'
import { toast } from 'sonner'
import { generateId } from '../lib/idGenerator'
import type { RABItem } from '../types/rab'

// Re-export RABItem for backward compatibility
export type { RABItem }

// Helper to calculate Pareto Class
export const calculatePareto = (items: RABItem[]): (RABItem & { paretoClass: 'A' | 'B' | 'C' })[] => {
  if (!items.length) return []

  // 1. Sort by Total Price Descending
  const sorted = [...items].sort((a, b) => (b.finalTotal || b.total_price || 0) - (a.finalTotal || a.total_price || 0))

  // 2. Calculate Cumulative %
  const totalCost = sorted.reduce((sum, item) => sum + (item.finalTotal || item.total_price || 0), 0)
  let runningTotal = 0

  return sorted.map(item => {
    const cost = (item.finalTotal || item.total_price || 0)
    runningTotal += cost
    const cumPercent = totalCost > 0 ? (runningTotal / totalCost) * 100 : 0

    let pClass: 'A' | 'B' | 'C' = 'C'
    if (cumPercent <= 80) pClass = 'A' // Top 80% of value
    else if (cumPercent <= 95) pClass = 'B' // Next 15%

    return { ...item, paretoClass: pClass }
  })
}

/**
 * Simple audit entry for actions affecting RAB
 */
export interface AuditEntry {
  id: string
  projectId: string
  action: string
  payload?: any
  timestamp: string
}

/**
 * RabState
 */
interface RabState {
  itemsByProject: Record<string, RABItem[]>
  historyByProject: Record<string, RABItem[][]> // past snapshots (oldest..latest)
  futureByProject: Record<string, RABItem[][]> // redo stack (latest..oldest)
  audit: AuditEntry[]
  hasUnsavedChanges: Record<string, boolean> // track unsaved changes per project
  autoSaveTimers: Record<string, NodeJS.Timeout> // auto-save timers per project
  priceDrift: Record<string, {
    totalDrift: number
    details: any[]
    lastChecked: string
  }>
  addItem: (projectId: string, item: Partial<RABItem>) => string
  updateItem: (projectId: string, id: string, updates: Partial<RABItem>) => void
  getItems: (projectId: string) => RABItem[]
  importItems: (projectId: string, items: RABItem[]) => void
  clearProject: (projectId: string) => void
  removeItem: (projectId: string, id: string) => void
  undo: (projectId: string) => boolean
  redo: (projectId: string) => boolean
  logAction: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void
  persist: () => void
  loadFromStorage: () => void
  getHistory: (projectId: string) => { past: number; future: number }
  clearHistory: (projectId: string) => void
  syncProjectToSupabase?: (projectId: string) => Promise<void>
  // Draft mode functions
  markUnsaved: (projectId: string) => void
  publishDrafts: (projectId: string) => void
  getDraftCount: (projectId: string) => number
  hasUnsaved: (projectId: string) => boolean
  takeSnapshot: (projectId: string) => Promise<void>
  isLocked: (projectId: string) => boolean
  refreshDrift: (projectId: string) => Promise<void>
}

const STORAGE_KEY = 'rabStore:v2'
const EMPTY_ITEMS: RABItem[] = []

/**
 * Helper load from localStorage
 */
function loadPersisted(): { itemsByProject: Record<string, RABItem[]>; audit: AuditEntry[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to parse persisted rabStore', e)
    return null
  }
}

/**
 * Create store
 */
export const useRabStore = create<RabState>((set, get) => {
  // cached getter per project: returns stable array reference while source unchanged
  const getItemsCached = createCachedGetterWithKey<RABItem[] | undefined, RABItem[]>(
    (projectId?: string) => {
      const pid = projectId || ''
      return get().itemsByProject[pid] || EMPTY_ITEMS
    },
    (src) => src || EMPTY_ITEMS
  )

  // initialize from storage if available
  const persisted = loadPersisted()

  /**
   * snapshotForHistory
   * Push current items of projectId to history stack and clear future (redo) stack.
   */
  function snapshotForHistory(projectId: string) {
    set((s) => {
      const prev = s.itemsByProject[projectId] || []
      const past = s.historyByProject[projectId] ? [...s.historyByProject[projectId]] : []
      past.push(prev.slice()) // push copy
      // limit history size
      const bounded = past.slice(-50)
      const newHistory = { ...s.historyByProject, [projectId]: bounded }
      const newFuture = { ...s.futureByProject, [projectId]: [] } // new branch clears redo
      return { historyByProject: newHistory, futureByProject: newFuture }
    })
  }

  return {
    itemsByProject: persisted?.itemsByProject || {},
    historyByProject: {},
    futureByProject: {},
    audit: persisted?.audit || [],
    hasUnsavedChanges: {},
    autoSaveTimers: {},
    priceDrift: {},

    addItem: (projectId, item) => {
      if (get().isLocked(projectId)) {
        toast.error('Project is locked. Cannot add items.')
        return ''
      }

      // Validate input
      const validation = validate(rabItemInputSchema, { ...item, projectId })
      if (!validation.success) {
        const errors = validation.errors || []
        const errorMsg = errors[0]?.message || 'Validation failed'
        toast.error('Failed to add RAB item', {
          description: errorMsg
        })
        return ''
      }

      snapshotForHistory(projectId)
      const id = generateId('rab')
      const now = new Date().toISOString()
      const newItem: RABItem = {
        id,
        projectId,
        item_code: (item as any).item_code ?? (item as any).itemCode,
        item_name: (item as any).item_name ?? (item as any).itemName ?? (item as any).name,
        name: (item as any).name ?? (item as any).item_name ?? (item as any).itemName,
        unit: (item as any).unit,
        volume: Number((item as any).volume || 0),
        unit_price: Number((item as any).unit_price ?? (item as any).unitPrice ?? 0),
        finalTotal: (item as any).finalTotal ?? (item as any).final_total ?? (item as any).finalPrice ?? 0,
        final_total: (item as any).final_total ?? (item as any).finalTotal,
        finalPrice: (item as any).finalPrice ?? (item as any).finalTotal,
        taskId: (item as any).taskId,
        tkdn_percent: (item as any).tkdn_percent ?? 0,
        isDraft: true, // new items start as draft
        is_overhead: (item as any).is_overhead ?? false,
        boq_id: (item as any).boq_id,
        createdAt: now,
        updatedAt: now,
        ...item,
      }
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const next = { itemsByProject: { ...s.itemsByProject, [projectId]: [...arr, newItem] } }
        return next
      })
      get().logAction({ projectId, action: 'addItem', payload: newItem })
      get().markUnsaved(projectId)
      get().persist()
      // Don't sync drafts to Supabase immediately
      return id
    },

    updateItem: (projectId, id, updates) => {
      if (get().isLocked(projectId)) {
        toast.error('Project is locked. Cannot update items.')
        return
      }

      // Validate updates
      const validation = validate(rabItemUpdateSchema, updates)
      if (!validation.success) {
        const errors = validation.errors || []
        const errorMsg = errors[0]?.message || 'Validation failed'
        toast.error('Failed to update RAB item', {
          description: errorMsg
        })
        return
      }

      snapshotForHistory(projectId)
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const updated = arr.map((it) => (it.id === id ? { ...it, ...validation.data!, updatedAt: new Date().toISOString() } : it))
        return { itemsByProject: { ...s.itemsByProject, [projectId]: updated } }
      })
      get().logAction({ projectId, action: 'updateItem', payload: { id, updates } })
      get().markUnsaved(projectId)
      get().persist()
      // Don't sync drafts to Supabase immediately
    },

    getItems: (projectId) => {
      return getItemsCached(projectId)
    },

    importItems: (projectId, items) => {
      snapshotForHistory(projectId)
      const now = new Date().toISOString()
      const normalized = (items || []).map((it) => ({
        ...it,
        id: it.id || generateId('rab'),
        projectId,
        createdAt: it.createdAt || now,
        updatedAt: it.updatedAt || now,
      }))

      set((s) => ({ itemsByProject: { ...s.itemsByProject, [projectId]: normalized } }))
      get().logAction({ projectId, action: 'importItems', payload: { count: normalized.length } })
      get().persist()
      // Use batch sync for better performance
      syncRABItems(normalized, projectId)
    },

    clearProject: (projectId) => {
      snapshotForHistory(projectId)
      const items = get().itemsByProject[projectId] || []
      // Queue delete for each item
      items.forEach(item => syncDelete('rab_items', item.id))
      set((s) => {
        const copy = { ...s.itemsByProject }
        delete copy[projectId]
        return { itemsByProject: copy }
      })
      get().logAction({ projectId, action: 'clearProject' })
      get().persist()
    },

    removeItem: (projectId, id) => {
      if (get().isLocked(projectId)) {
        toast.error('Project is locked. Cannot remove items.')
        return
      }
      snapshotForHistory(projectId)
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const filtered = arr.filter((it) => it.id !== id)
        return { itemsByProject: { ...s.itemsByProject, [projectId]: filtered } }
      })
      get().logAction({ projectId, action: 'removeItem', payload: { id } })
      get().persist()
      syncDelete('rab_items', id)
    },

    undo: (projectId) => {
      const history = get().historyByProject[projectId] || []
      if (!history || history.length === 0) return false
      const last = history[history.length - 1]
      const current = get().itemsByProject[projectId] || []
      // push current to future stack
      set((s) => {
        const future = s.futureByProject[projectId] ? [...s.futureByProject[projectId]] : []
        future.push(current.slice())
        const newFuture = { ...s.futureByProject, [projectId]: future }
        const newHistory = { ...s.historyByProject, [projectId]: s.historyByProject[projectId]!.slice(0, -1) }
        return { itemsByProject: { ...s.itemsByProject, [projectId]: last }, futureByProject: newFuture, historyByProject: newHistory }
      })
      get().logAction({ projectId, action: 'undo' })
      get().persist()
      return true
    },

    redo: (projectId) => {
      const future = get().futureByProject[projectId] || []
      if (!future || future.length === 0) return false
      const next = future[future.length - 1]
      const current = get().itemsByProject[projectId] || []
      set((s) => {
        const history = s.historyByProject[projectId] ? [...s.historyByProject[projectId]] : []
        history.push(current.slice())
        const newHistory = { ...s.historyByProject, [projectId]: history.slice(-50) }
        const newFuture = { ...s.futureByProject, [projectId]: s.futureByProject[projectId]!.slice(0, -1) }
        return { itemsByProject: { ...s.itemsByProject, [projectId]: next }, historyByProject: newHistory, futureByProject: newFuture }
      })
      get().logAction({ projectId, action: 'redo' })
      get().persist()
      return true
    },

    logAction: (entry) => {
      const now = new Date().toISOString()
      const e: AuditEntry = {
        id: generateId('rab'),
        timestamp: now,
        ...entry,
      }
      set((s) => ({ audit: [...s.audit, e] }))
    },

    persist: () => {
      try {
        const payload = { itemsByProject: get().itemsByProject, audit: get().audit }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (e) {
        console.warn('Failed to persist rabStore', e)
      }
    },

    loadFromStorage: () => {
      const p = loadPersisted()
      if (p) {
        set({ itemsByProject: p.itemsByProject, audit: p.audit || [] })
      }
    },

    getHistory: (projectId: string) => {
      const past = get().historyByProject[projectId]?.length || 0
      const futureCount = get().futureByProject[projectId]?.length || 0
      return { past, future: futureCount }
    },

    clearHistory: (projectId: string) => {
      set((s) => ({ historyByProject: { ...s.historyByProject, [projectId]: [] }, futureByProject: { ...s.futureByProject, [projectId]: [] } }))
      get().logAction({ projectId, action: 'clearHistory' })
      get().persist()
    },
    syncProjectToSupabase: async (projectId: string) => {
      const items = get().itemsByProject[projectId] || []
      if (!items.length) return
      // Use batch sync for better performance
      syncRABItems(items, projectId)
      get().logAction({ projectId, action: 'syncProjectToSupabase', payload: { count: items.length } })
    },

    // Draft mode functions
    markUnsaved: (projectId: string) => {
      set((s) => ({
        hasUnsavedChanges: { ...s.hasUnsavedChanges, [projectId]: true }
      }))

      // Set up auto-save after 30 seconds
      const existing = get().autoSaveTimers[projectId]
      if (existing) clearTimeout(existing)

      const timer = setTimeout(() => {
        get().persist()
        toast.info('Changes auto-saved', { duration: 2000 })
      }, 30000) // 30 seconds

      set((s) => ({
        autoSaveTimers: { ...s.autoSaveTimers, [projectId]: timer }
      }))
    },

    publishDrafts: (projectId: string) => {
      const items = get().itemsByProject[projectId] || []
      const draftItems = items.filter(item => (item as any).isDraft)

      if (draftItems.length === 0) {
        toast.info('No draft items to publish')
        return
      }

      // Mark all items as published
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const updated = arr.map(item => {
          if ((item as any).isDraft) {
            return { ...item, isDraft: false, updatedAt: new Date().toISOString() }
          }
          return item
        })
        return {
          itemsByProject: { ...s.itemsByProject, [projectId]: updated },
          hasUnsavedChanges: { ...s.hasUnsavedChanges, [projectId]: false }
        }
      })

      // Clear auto-save timer
      const timer = get().autoSaveTimers[projectId]
      if (timer) clearTimeout(timer)

      get().persist()

      // Sync to Supabase
      const updatedItems = get().itemsByProject[projectId] || []
      syncRABItems(updatedItems, projectId)

      toast.success(`Published ${draftItems.length} items to database`)
      get().logAction({ projectId, action: 'publishDrafts', payload: { count: draftItems.length } })
    },

    getDraftCount: (projectId: string) => {
      const items = get().itemsByProject[projectId] || []
      return items.filter(item => (item as any).isDraft).length
    },

    hasUnsaved: (projectId: string) => {
      return get().hasUnsavedChanges[projectId] || false
    },
    takeSnapshot: async (projectId: string) => {
      const { ahspSnapshotService } = await import('../services/ahspSnapshotService')
      const result = await ahspSnapshotService.takeSnapshot(projectId)
      if (result.itemsSnapshotted > 0) {
        toast.success(`Snapshot taken: ${result.itemsSnapshotted} items baseline locked.`)
        // Refetch or update local state
        const sync = get().syncProjectToSupabase
        if (sync) sync(projectId)
      }
    },
    isLocked: (projectId: string) => {
      const items = get().itemsByProject[projectId] || []
      return items.some(item => !!item.snapshot_price)
    },
    refreshDrift: async (projectId: string) => {
      const { livingPriceService } = await import('../services/livingPriceService')
      const analysis = await livingPriceService.getProjectPriceAnalysis(projectId)
      const totalDrift = analysis.reduce((sum, item) => sum + item.potentialImpact, 0)

      set((s) => ({
        priceDrift: {
          ...s.priceDrift,
          [projectId]: {
            totalDrift,
            details: analysis,
            lastChecked: new Date().toISOString()
          }
        }
      }))
    },
  }
})

export default useRabStore