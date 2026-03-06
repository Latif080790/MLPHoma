import { create } from 'zustand'
import { rapService, RapItem } from '../services/rapService'
import { syncRAPItem } from '../lib/supabaseSyncService'
import { toast } from 'sonner'
import { createCachedGetterWithKey } from '../lib/cachedGetter'

interface RapState {
  items: RapItem[]
  isLoading: boolean
  error: string | null

  fetchItems: (projectId: string) => Promise<void>
  updateItem: (item: Partial<RapItem>) => Promise<void>
  initFromRab: (projectId: string, rabItems: Array<Record<string, unknown>>) => Promise<void>
  /** Return RAP items as monthly plan entries for Curva-S / CashFlow import */
  getPlan: (projectId: string) => { date: string; planned: number; actual: number }[]
  /** Aggregate RAP items by wbs_id for EVM cost drill-down */
  getCostByWBS: (projectId: string) => {
    wbsId: string
    itemCount: number
    plannedCost: number
    actualCost: number
    committedCost: number
    variance: number
    variancePercent: number
  }[]
}

export const useRapStore = create<RapState>((set, get) => {
  const EMPTY_PLAN: { date: string; planned: number; actual: number }[] = []

  const getPlanCached = createCachedGetterWithKey<RapItem[], { date: string; planned: number; actual: number }[]>(
    (key) => get().items.filter(i => i.project_id === key),
    (items) => {
      if (!items.length) return EMPTY_PLAN
      const monthly: Record<string, { planned: number; actual: number }> = {}
      items.forEach((i) => {
        // Prefer start_date (added in migration 046), fall back to createdAt
        const dateStr = i.start_date
          || (i as RapItem & { createdAt?: string }).createdAt
          || new Date().toISOString()
        const key = dateStr.substring(0, 7)
        if (!monthly[key]) monthly[key] = { planned: 0, actual: 0 }
        monthly[key].planned += i.total_budget || 0
        monthly[key].actual += i.actual_cost || 0
      })
      return Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date: `${date}-01`, planned: v.planned, actual: v.actual }))
    }
  )

  return {
    items: [],
    isLoading: false,
    error: null,

    fetchItems: async (projectId: string) => {
      set({ isLoading: true, error: null })
      try {
        const data = await rapService.getByProject(projectId)
        set({ items: data as RapItem[] })
      } catch (err: unknown) {
        set({ error: (err as Error).message })
        toast.error('Failed to load RAP items: ' + (err as Error).message)
      } finally {
        set({ isLoading: false })
      }
    },

    updateItem: async (item: Partial<RapItem>) => {
      // Optimistic update
      set((state) => ({
        items: state.items.map((i) => (i.id === item.id ? { ...i, ...item } : i))
      }))

      // Sync using service
      syncRAPItem(item)
      toast.success('RAP Item update queued')
    },

    getPlan: (projectId: string) => {
      return getPlanCached(projectId)
    },

    getCostByWBS: (projectId: string) => {
      const items = get().items.filter(i => i.project_id === projectId)
      if (!items.length) return []

      const byWbs: Record<string, {
        wbsId: string; itemCount: number;
        plannedCost: number; actualCost: number; committedCost: number;
      }> = {}

      items.forEach(item => {
        const wbsId = (item as RapItem & { wbs_id?: string }).wbs_id || 'unlinked'
        if (!byWbs[wbsId]) {
          byWbs[wbsId] = { wbsId, itemCount: 0, plannedCost: 0, actualCost: 0, committedCost: 0 }
        }
        byWbs[wbsId].itemCount += 1
        byWbs[wbsId].plannedCost += item.total_budget || 0
        byWbs[wbsId].actualCost += item.actual_cost || 0
        byWbs[wbsId].committedCost += item.committed_cost || 0
      })

      return Object.values(byWbs).map(entry => ({
        ...entry,
        variance: entry.plannedCost - entry.actualCost,
        variancePercent: entry.plannedCost > 0
          ? parseFloat((((entry.plannedCost - entry.actualCost) / entry.plannedCost) * 100).toFixed(1))
          : 0,
      }))
    },

    initFromRab: async (projectId: string, rabItems: Array<Record<string, unknown>>) => {
      set({ isLoading: true })
      try {
        const data = await rapService.initFromRab(projectId, rabItems)
        // Update local state with fresh data from DB
        set({ items: data as RapItem[] })
        toast.success(`RAP initialized with ${data.length} items from RAB`)
      } catch (err: unknown) {
        toast.error('Failed to initialize RAP: ' + (err as Error).message)
      } finally {
        set({ isLoading: false })
      }
    }
  }
})

