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
import { supabase, upsertRabItems, deleteRabItem, deleteRabItemsByProject } from '../lib/supabaseClient'

/**
 * RABItem
 * Minimal shape used by UI and stores.
 */
export interface RABItem {
  id: string
  projectId: string
  item_code?: string
  item_name?: string
  name?: string
  unit?: string
  volume?: number
  unit_price?: number
  finalTotal?: number
  final_total?: number
  finalPrice?: number
  createdAt?: string
  updatedAt?: string
  [key: string]: any
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

function generateId(prefix = 'rab') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
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
      snapshotForHistory(projectId)
      const id = generateId('item')
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
      if (supabase) {
        upsertRabItems([
          {
            id: newItem.id,
            project_id: projectId,
            ahsp_code: newItem.item_code,
            name: newItem.name,
            unit: newItem.unit,
            volume: newItem.volume,
            unit_price: newItem.unit_price,
            final_total: newItem.finalTotal ?? newItem.final_total ?? newItem.finalPrice,
            created_at: newItem.createdAt,
            updated_at: newItem.updatedAt,
          },
        ])
      }
      return id
    },

    updateItem: (projectId, id, updates) => {
      snapshotForHistory(projectId)
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const updated = arr.map((it) => (it.id === id ? { ...it, ...updates, updatedAt: new Date().toISOString() } : it))
        return { itemsByProject: { ...s.itemsByProject, [projectId]: updated } }
      })
      get().logAction({ projectId, action: 'updateItem', payload: { id, updates } })
      get().persist()
      if (supabase) {
        const item = get().itemsByProject[projectId]?.find(i => i.id === id)
        if (item) {
          upsertRabItems([
            {
              id: item.id,
              project_id: projectId,
              ahsp_code: item.item_code,
              name: item.name,
              unit: item.unit,
              volume: item.volume,
              unit_price: item.unit_price,
              final_total: item.finalTotal ?? item.final_total ?? item.finalPrice,
              created_at: item.createdAt,
              updated_at: item.updatedAt,
            },
          ])
        }
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
        id: it.id || generateId('imp'),
        projectId,
        createdAt: it.createdAt || now,
        updatedAt: it.updatedAt || now,
      }))

      set((s) => ({ itemsByProject: { ...s.itemsByProject, [projectId]: normalized } }))
      get().logAction({ projectId, action: 'importItems', payload: { count: normalized.length } })
      get().persist()
      if (supabase && normalized.length) {
        upsertRabItems(normalized.map(n => ({
          id: n.id,
          project_id: projectId,
          ahsp_code: n.item_code,
          name: n.name,
          unit: n.unit,
          volume: n.volume,
          unit_price: n.unit_price,
          final_total: n.finalTotal ?? n.final_total ?? n.finalPrice,
          created_at: n.createdAt,
          updated_at: n.updatedAt,
        })))
      }
    },

    clearProject: (projectId) => {
      snapshotForHistory(projectId)
      set((s) => {
        const copy = { ...s.itemsByProject }
        delete copy[projectId]
        return { itemsByProject: copy }
      })
      get().logAction({ projectId, action: 'clearProject' })
      get().persist()
      if (supabase) {
        deleteRabItemsByProject(projectId).catch(err => console.warn('Failed to delete project from Supabase:', err))
      }
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
      if (supabase) {
        deleteRabItem(id).catch(err => console.warn('Failed to delete RAB item from Supabase:', err))
      }
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
        id: generateId('audit'),
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
      if (!supabase) return
      const items = get().itemsByProject[projectId] || []
      if (!items.length) return
      await upsertRabItems(items.map(it => ({
        id: it.id,
        project_id: projectId,
        ahsp_code: it.item_code,
        name: it.name,
        unit: it.unit,
        volume: it.volume,
        unit_price: it.unit_price,
        final_total: it.finalTotal ?? it.final_total ?? it.finalPrice,
        created_at: it.createdAt,
        updated_at: it.updatedAt,
      })))
      get().logAction({ projectId, action: 'syncProjectToSupabase', payload: { count: items.length } })
    },
  }
})

export default useRabStore