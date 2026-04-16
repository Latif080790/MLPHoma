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
import { syncDelete, syncRABItems } from '../lib/supabaseSyncService'
import { fetchRabItems } from '../lib/supabaseClient'
import { validate } from '../lib/validationMiddleware'
import { rabItemInputSchema, rabItemUpdateSchema } from '../lib/validationSchemas'
import { toast } from 'sonner'
import { generateId } from '../lib/idGenerator'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { eventBus } from '../lib/eventBus'
import type { RABItem } from '../types/rab'

// Re-export RABItem for backward compatibility
export type { RABItem }

// Helper to calculate Pareto Class
export const calculatePareto = (items: RABItem[]): (RABItem & { paretoClass: 'A' | 'B' | 'C' })[] => {
  if (!items.length) return []

  // 1. Sort by Total Price Descending
  const sorted = [...items].sort((a, b) => (b.finalTotal || Number(b.total_price) || 0) - (a.finalTotal || Number(a.total_price) || 0))

  // 2. Calculate Cumulative %
  const totalCost = sorted.reduce((sum, item) => sum + (item.finalTotal || Number(item.total_price) || 0), 0)
  let runningTotal = 0

  return sorted.map(item => {
    const cost = (item.finalTotal || Number(item.total_price) || 0)
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
  payload?: Record<string, unknown>
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
    details: unknown[]
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
  /** Fetch RAB items from Supabase and merge with localStorage */
  fetchItems: (projectId: string) => Promise<void>
  // Draft mode functions
  markUnsaved: (projectId: string) => void
  publishDrafts: (projectId: string) => void
  getDraftCount: (projectId: string) => number
  hasUnsaved: (projectId: string) => boolean
  takeSnapshot: (projectId: string) => Promise<void>
  unlockBaseline: (projectId: string) => Promise<void>
  isLocked: (projectId: string) => boolean
  refreshDrift: (projectId: string) => Promise<void>
  checkPriceDrift: () => Promise<void>
  syncWithCatalog: (projectId: string) => Promise<void>
}

const STORAGE_KEY = 'rabStore:v2'
const EMPTY_ITEMS: RABItem[] = []

/**
 * Helper: load legacy data from localStorage (for one-time migration)
 */
function loadLegacyLocalStorage(): { itemsByProject: Record<string, RABItem[]>; audit: AuditEntry[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to parse legacy rabStore localStorage', e)
    return null
  }
}

/**
 * Async: load persisted data from IndexedDB, falling back to localStorage
 */
async function loadPersistedAsync(): Promise<{ itemsByProject: Record<string, RABItem[]>; audit: AuditEntry[] } | null> {
  try {
    // Try IndexedDB first
    const idbData = await idbGet<{ itemsByProject: Record<string, RABItem[]>; audit: AuditEntry[] }>(STORAGE_KEY)
    if (idbData) return idbData

    // Migrate from localStorage if present
    const legacy = loadLegacyLocalStorage()
    if (legacy) {
      console.info('[RAB] Migrating persistence from localStorage → IndexedDB')
      await idbSet(STORAGE_KEY, legacy)
      localStorage.removeItem(STORAGE_KEY) // Clean up
      return legacy
    }
    return null
  } catch (e) {
    console.warn('Failed to load rabStore from IndexedDB', e)
    return loadLegacyLocalStorage() // Fallback
  }
}

/**
 * Async: persist current state to IndexedDB (fire-and-forget)
 */
async function persistToIDB(state: { itemsByProject: Record<string, RABItem[]>; audit: AuditEntry[] }) {
  try {
    await idbSet(STORAGE_KEY, { itemsByProject: state.itemsByProject, audit: state.audit })
  } catch (e) {
    console.warn('Failed to persist rabStore to IndexedDB', e)
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

  // Synchronous initial load from localStorage (for instant hydration)
  // Then async IDB load will overwrite if newer data exists
  const legacyData = loadLegacyLocalStorage()

  // Kick off async IndexedDB hydration
  loadPersistedAsync().then((data) => {
    if (data) {
      set({ itemsByProject: data.itemsByProject, audit: data.audit || [] })
    }
  })

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
    itemsByProject: legacyData?.itemsByProject || {},
    historyByProject: {},
    futureByProject: {},
    audit: legacyData?.audit || [],
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
      type RabInput = Partial<RABItem> & { itemCode?: string; itemName?: string; unitPrice?: number; finalPrice?: number; final_total?: number; taskId?: string }
      const r = item as RabInput
      const newItem: RABItem = {
        id,
        projectId,
        item_code: r.item_code ?? r.itemCode,
        item_name: r.item_name ?? r.itemName ?? r.name,
        name: r.name ?? r.item_name ?? r.itemName,
        unit: r.unit,
        volume: Number(r.volume || 0),
        unit_price: Number(r.unit_price ?? r.unitPrice ?? 0),
        finalTotal: r.finalTotal ?? r.final_total ?? r.finalPrice ?? 0,
        final_total: r.final_total ?? r.finalTotal,
        finalPrice: r.finalPrice ?? r.finalTotal,
        taskId: r.taskId,
        tkdn_percent: r.tkdn_percent ?? 0,
        isDraft: true, // new items start as draft
        is_overhead: r.is_overhead ?? false,
        boq_id: r.boq_id,
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
      // Emit event for downstream subscribers
      eventBus.emit('rab:changed', { projectId, changeType: 'add', itemIds: [id] })
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
        const updated = arr.map((it) => {
          if (it.id !== id) return it
          const merged = { ...it, ...validation.data!, updatedAt: new Date().toISOString() }
          // Canonical finalTotal: if not explicitly provided, recalculate from volume × unit_price
          if (!('finalTotal' in validation.data!) && ('volume' in validation.data! || 'unit_price' in validation.data!)) {
            merged.finalTotal = Number(merged.volume || 0) * Number(merged.unit_price || 0)
          }
          // Keep legacy aliases in sync with the canonical finalTotal
          merged.final_total = merged.finalTotal
          merged.finalPrice = merged.finalTotal
          return merged
        })
        return { itemsByProject: { ...s.itemsByProject, [projectId]: updated } }
      })
      get().logAction({ projectId, action: 'updateItem', payload: { id, updates } })
      get().markUnsaved(projectId)
      get().persist()
      // Emit event for downstream subscribers (drift detection)
      eventBus.emit('rab:changed', { projectId, changeType: 'update', itemIds: [id] })
      // Don't sync drafts to Supabase immediately
    },

    getItems: (projectId) => {
      return getItemsCached(projectId)
    },

    importItems: (projectId, items) => {
      // G2 Fix: block import when RAB is locked (snapshot taken)
      if (get().isLocked(projectId)) {
        toast.error('RAB terkunci (baseline aktif). Tidak dapat mengimpor item.')
        return
      }
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
      // Emit event for downstream subscribers
      eventBus.emit('rab:changed', { projectId, changeType: 'import', itemIds: normalized.map(i => i.id) })
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
      // Emit event for downstream subscribers
      eventBus.emit('rab:changed', { projectId, changeType: 'remove', itemIds: [id] })
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
      // Fire-and-forget async persist to IndexedDB
      void persistToIDB({ itemsByProject: get().itemsByProject, audit: get().audit })
    },

    loadFromStorage: () => {
      // Async load from IndexedDB
      void loadPersistedAsync().then((p) => {
        if (p) {
          set({ itemsByProject: p.itemsByProject, audit: p.audit || [] })
        }
      })
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

    fetchItems: async (projectId: string) => {
      try {
        const { data, error } = await fetchRabItems(projectId)
        if (error) {
          console.warn('[RAB] Failed to fetch from Supabase:', error.message)
          return
        }
        if (!data || !Array.isArray(data) || data.length === 0) return

        // Map snake_case DB columns → RABItem fields
        const supabaseItems: RABItem[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          projectId: row.project_id as string,
          item_code: row.ahsp_code as string | undefined,
          code: row.ahsp_code as string | undefined,
          name: row.name as string | undefined,
          item_name: row.name as string | undefined,
          unit: row.unit as string | undefined,
          volume: Number(row.volume || 0),
          unit_price: Number(row.unit_price || 0),
          cost_material: Number(row.cost_material || 0),
          cost_labor: Number(row.cost_labor || 0),
          cost_equipment: Number(row.cost_equipment || 0),
          cost_subcon: Number(row.cost_subcon || 0),
          markup_percentage: Number(row.markup_percentage || 0),
          weight_percentage: Number(row.weight_percentage || 0),
          finalTotal: Number(row.final_total || 0),
          final_total: Number(row.final_total || 0),
          finalPrice: Number(row.final_total || 0),
          snapshot_price: row.snapshot_price,
          is_overhead: row.is_overhead as boolean | undefined,
          createdAt: row.created_at as string | undefined,
          updatedAt: row.updated_at as string | undefined,
        }))

        // Merge with existing localStorage items:
        // Supabase items win for matching IDs; local-only items are preserved
        const localItems = get().itemsByProject[projectId] || []
        const supabaseIdSet = new Set(supabaseItems.map(i => i.id))
        const localOnlyItems = localItems.filter(i => !supabaseIdSet.has(i.id))
        const merged = [...supabaseItems, ...localOnlyItems]

        set((s) => ({
          itemsByProject: { ...s.itemsByProject, [projectId]: merged }
        }))
        get().persist()
      } catch (err) {
        console.warn('[RAB] fetchItems error:', err)
      }
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
      // G3 Fix: block publish when RAB is locked (snapshot taken)
      if (get().isLocked(projectId)) {
        toast.error('RAB terkunci (baseline aktif). Tidak dapat mempublikasikan draft.')
        return
      }
      const items = get().itemsByProject[projectId] || []
      const draftItems = items.filter(item => item.isDraft)

      if (draftItems.length === 0) {
        toast.info('No draft items to publish')
        return
      }

      // Mark all items as published
      set((s) => {
        const arr = s.itemsByProject[projectId] || []
        const updated = arr.map(item => {
          if (item.isDraft) {
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
      return items.filter(item => item.isDraft).length
    },

    hasUnsaved: (projectId: string) => {
      return get().hasUnsavedChanges[projectId] || false
    },
    takeSnapshot: async (projectId: string) => {
      const { ahspSnapshotService } = await import('../services/ahspSnapshotService')
      const result = await ahspSnapshotService.takeSnapshot(projectId)
      if (result.itemsSnapshotted > 0) {
        // Re-fetch items via RPC to get updated snapshot_price in local state
        try {
          const { assertSupabase } = await import('../lib/supabaseClient')
          const client = assertSupabase()
          const { data } = await client.rpc('rpc_get_rab_items', {
            p_project_id: projectId,
          })
          if (data && Array.isArray(data) && data.length > 0) {
            const currentItems = get().itemsByProject[projectId] || []
            const existingMap = new Map(currentItems.map(i => [i.id, i]))
            const refreshed: import('../types/rab').RABItem[] = data
              .filter((row: Record<string, unknown>) => typeof row.id === 'string')
              .map((row: Record<string, unknown>) => ({
                ...existingMap.get(row.id as string),
                ...(row as Partial<import('../types/rab').RABItem>),
                id: row.id as string,
                snapshotPrice: row.snapshot_price as number | undefined,
              } as import('../types/rab').RABItem))
            set((s) => ({
              itemsByProject: { ...s.itemsByProject, [projectId]: refreshed }
            }))
            get().persist()
          }
        } catch (refetchErr) {
          console.warn('[RAB] Failed to re-fetch after snapshot:', refetchErr)
        }
      } else {
        throw new Error('Tidak ada item yang bisa di-snapshot. Pastikan RAB memiliki item dengan harga > 0.')
      }
    },
    unlockBaseline: async (projectId: string) => {
      const { assertSupabase } = await import('../lib/supabaseClient')
      const client = assertSupabase()
      const { data, error } = await client.rpc('rpc_unlock_rab_baseline', {
        p_project_id: projectId,
      })
      if (error) {
        throw new Error(`Gagal unlock baseline: ${error.message}`)
      }
      if ((data as Record<string, unknown>)?.itemsUnlocked) {
        // Re-fetch items to clear snapshot_price in local state
        try {
          const { data: items } = await client.rpc('rpc_get_rab_items', {
            p_project_id: projectId,
          })
          if (items && Array.isArray(items) && items.length > 0) {
            const currentItems = get().itemsByProject[projectId] || []
            const existingMap = new Map(currentItems.map(i => [i.id, i]))
            const refreshed: import('../types/rab').RABItem[] = items
              .filter((row: Record<string, unknown>) => typeof row.id === 'string')
              .map((row: Record<string, unknown>) => ({
                ...existingMap.get(row.id as string),
                ...(row as Partial<import('../types/rab').RABItem>),
                id: row.id as string,
                snapshotPrice: undefined,
              } as import('../types/rab').RABItem))
            set((s) => ({
              itemsByProject: { ...s.itemsByProject, [projectId]: refreshed }
            }))
            get().persist()
          }
        } catch (e) {
          console.warn('[RAB] Failed to re-fetch after unlock:', e)
        }
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

    checkPriceDrift: async () => {
      // Find active project from projectStore
      try {
        const { useProjectStore } = await import('./projectStore')
        const activeProjectId = useProjectStore.getState().activeProjectId
        if (activeProjectId) {
          const locked = get().isLocked(activeProjectId)
          
          if (!locked) {
            // Rule: Auto-sync if not locked
            await get().syncWithCatalog(activeProjectId)
          }

          // In both cases, refresh the drift metadata (Locked will show actual drift, Unlocked will show 0 impact)
          await get().refreshDrift(activeProjectId)
        }
      } catch (err) {
        console.warn('[RAB] Failed to check price drift:', err)
      }
    },

    syncWithCatalog: async (projectId: string) => {
      if (get().isLocked(projectId)) return

      const { useAHSPStore } = await import('./ahspStore')
      const catalog = useAHSPStore.getState().ahspItems
      if (!catalog.length) return

      const catalogMap = new Map(catalog.map(h => [h.code, h]))
      const currentItems = get().itemsByProject[projectId] || []
      
      let changed = false
      const updated = currentItems.map(item => {
        const code = item.item_code || item.code
        if (!code) return item

        const master = catalogMap.get(code)
        if (master && master.finalPrice !== item.unit_price) {
          changed = true
          const newUnitPrice = master.finalPrice
          const newTotal = Number(item.volume || 0) * newUnitPrice
          
          return {
            ...item,
            unit_price: newUnitPrice,
            finalTotal: newTotal,
            final_total: newTotal,
            finalPrice: newTotal,
            cost_material: master.price_material || 0,
            cost_labor: master.price_labor || 0,
            cost_equipment: master.price_equipment || 0,
            cost_subcon: master.price_subcon || 0,
            updatedAt: new Date().toISOString()
          }
        }
        return item
      })

      if (changed) {
        set((s) => ({
          itemsByProject: { ...s.itemsByProject, [projectId]: updated }
        }))
        get().persist()
        syncRABItems(updated, projectId)
        toast.info('RAB updated with new catalog prices', { 
          description: 'This project is in draft mode (not locked).' 
        })
      }
    },
  }
})


// Subscriptions
eventBus.on('rab:changed', ({ projectId, changeType }) => {
  if (changeType === 'update' || changeType === 'import' || changeType === 'remove') {
    if (projectId) {
      useRabStore.getState().fetchItems(projectId)
    }
  }
})

/**
 * Cross-Store Synchronization: RAB → Timeline
 *
 * When RAB items change (price/volume update), propagate cost metadata
 * to linked Timeline tasks. Fulfills Section 4.3A.3 of the refactoring plan.
 */
eventBus.on('rab:changed', ({ changeType }) => {
  if (changeType === 'update' || changeType === 'import') {
    // Debounce: let batch changes settle before syncing
    setTimeout(() => {
      import('./timelineStore').then(module => {
        module.default.getState().syncTaskCostsFromRAB()
      }).catch(() => {
        // Timeline store not yet loaded — skip
      })
    }, 500)
  }
})

export default useRabStore
