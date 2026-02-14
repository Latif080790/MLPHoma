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
import { supabase } from '../lib/supabaseClient'
import { syncRABItem, syncDelete } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import { rabItemInputSchema, rabItemUpdateSchema } from '../lib/validationSchemas'
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

    addItem: (projectId, item) => {
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
      get().persist()
      syncRABItem(newItem, projectId)
      return id
    },

    updateItem: (projectId, id, updates) => {
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
      get().persist()
      const item = get().itemsByProject[projectId]?.find(i => i.id === id)
      if (item) {
        syncRABItem(item, projectId)
      }
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
      // Queue-based sync with retry for each item
      normalized.forEach(item => syncRABItem(item, projectId))
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
      // Queue-based sync with retry for each item
      items.forEach(item => syncRABItem(item, projectId))
      get().logAction({ projectId, action: 'syncProjectToSupabase', payload: { count: items.length } })
    },
  }
})

export default useRabStore