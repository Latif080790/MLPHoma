import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { rapService, RapItem } from '../services/rapService'
import { syncRAPItem } from '../lib/supabaseSyncService'
import { toast } from 'sonner'
import { createCachedGetterWithKey } from '../lib/cachedGetter'
import { useCurvaSStore } from './curvaSStore'

interface RapState {
  items: RapItem[]
  /** Standardized loading flag (was isLoading — renamed for StandardStoreContract compliance) */
  loading: boolean
  error: string | null
  lastSyncedAt: number | null

  // Standard actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  fetchItems: (projectId: string) => Promise<void>
  updateItem: (item: Partial<RapItem>) => Promise<void>
  initFromRab: (projectId: string, rabItems: Array<Record<string, unknown>>) => Promise<void>
  /** Return RAP items as monthly plan entries for Curva-S / CashFlow import */
  getPlan: (projectId: string) => { period: string; planned: number; actual: number }[]
  /** Recalculate monthly distribution — called from Timeline→RAP cross-store subscription */
  recalculateDistribution: (projectId: string) => void
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

export const useRapStore = create<RapState>()(
  subscribeWithSelector((set, get) => {
    const EMPTY_PLAN: { period: string; planned: number; actual: number }[] = []

    const getPlanCached = createCachedGetterWithKey<RapItem[], { period: string; planned: number; actual: number }[]>(
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
          .map(([date, v]) => ({ period: date, planned: v.planned, actual: v.actual }))
      }
    )

    return {
      items: [],
      loading: false,
      error: null,
      lastSyncedAt: null,

      setLoading: (loading: boolean) => set({ loading }),
      setError: (error: string | null) => set({ error }),

      fetchItems: async (projectId: string) => {
        set({ loading: true, error: null })
        try {
          const data = await rapService.getByProject(projectId)
          set({ items: data as RapItem[], lastSyncedAt: Date.now() })
        } catch (err: unknown) {
          set({ error: (err as Error).message })
          toast.error('Failed to load RAP items: ' + (err as Error).message)
        } finally {
          set({ loading: false })
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

      recalculateDistribution: (projectId: string) => {
        // Force cache invalidation by touching items array reference.
        // The cached getter (createCachedGetterWithKey) checks identity,
        // so re-setting the same array reference won't help — we need to
        // trigger a fresh computation via the RAP→CurvaS subscription.
        const currentItems = get().items
        const projectItems = currentItems.filter(i => i.project_id === projectId)

        if (projectItems.length === 0) return

        // Recompute the monthly distribution plan
        const plan = get().getPlan(projectId)
        if (plan.length === 0) return

        const totalBudget = projectItems.reduce((sum, i) => sum + (i.total_budget || 0), 0)

        // Direct push to CurvaS (bypasses subscription latency for immediate UI feedback)
        import('./curvaSStore').then(m => {
          m.useCurvaSStore.getState().setPlannedFromRap(projectId, plan, totalBudget)
        }).catch(() => {})

        set({ lastSyncedAt: Date.now() })
      },

      initFromRab: async (projectId: string, rabItems: Array<Record<string, unknown>>) => {
        set({ loading: true })
        try {
          const data = await rapService.initFromRab(projectId, rabItems)
          // Update local state with fresh data from DB
          set({ items: data as RapItem[], lastSyncedAt: Date.now() })
          toast.success(`RAP initialized with ${data.length} items from RAB`)
        } catch (err: unknown) {
          toast.error('Failed to initialize RAP: ' + (err as Error).message)
        } finally {
          set({ loading: false })
        }
      }
    }
  })
)

/**
 * Cross-Store Synchronization: RAP → Curva-S  [Subscription 4 of 4]
 *
 * Automatically rebuild S-Curve planned data whenever RAP items change.
 * This fulfills audit requirement CF-03 (EVM Pipeline continuity).
 *
 * Triggered by: fetchItems, updateItem, initFromRab
 * Downstream: curvaSStore.setPlannedFromRap()
 */
useRapStore.subscribe(
  (state) => state.items,
  (items) => {
    if (!items || items.length === 0) return

    // Group by project and sync each project's S-Curve
    const projectIds = [...new Set(items.map(i => i.project_id).filter(Boolean))]

    projectIds.forEach(projectId => {
      const projectItems = items.filter(i => i.project_id === projectId)
      if (projectItems.length === 0) return

      const plan = useRapStore.getState().getPlan(projectId)
      if (plan.length === 0) return

      // Calculate total budget from actual RAP items (not hardcoded 0)
      const totalBudget = projectItems.reduce((sum, i) => sum + (i.total_budget || 0), 0)

      console.debug(
        `[Sync 4/4] RAP→CurvaS: project=${projectId}, items=${projectItems.length}, ` +
        `periods=${plan.length}, totalBudget=${totalBudget.toLocaleString('id-ID')}`
      )

      useCurvaSStore.getState().setPlannedFromRap(projectId, plan, totalBudget)
    })
  }
)

