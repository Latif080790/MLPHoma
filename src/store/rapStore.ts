import { create } from 'zustand'
import { rapService, RapItem } from '../services/rapService'
import { syncRAPItem, syncRAPItems } from '../lib/supabaseSyncService'
import { generateId } from '../lib/idGenerator'
import { toast } from 'sonner'

interface RapState {
  items: RapItem[]
  isLoading: boolean
  error: string | null

  fetchItems: (projectId: string) => Promise<void>
  updateItem: (item: Partial<RapItem>) => Promise<void>
  initFromRab: (projectId: string, rabItems: any[]) => Promise<void>
  /** Return RAP items as monthly plan entries for Curva-S / CashFlow import */
  getPlan: (projectId: string) => { date: string; planned: number; actual: number }[]
}

export const useRapStore = create<RapState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchItems: async (projectId: string) => {
    set({ isLoading: true, error: null })
    try {
      const data = await rapService.getByProject(projectId)
      set({ items: data as RapItem[] })
    } catch (err: any) {
      set({ error: err.message })
      toast.error('Failed to load RAP items: ' + err.message)
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
    const items = get().items.filter(i => i.project_id === projectId)
    if (!items.length) return []
    // Group by month and aggregate budget vs actual
    const monthly: Record<string, { planned: number; actual: number }> = {}
    items.forEach((i) => {
      const key = (i as any).createdAt
        ? (i as any).createdAt.substring(0, 7)   // YYYY-MM
        : new Date().toISOString().substring(0, 7)
      if (!monthly[key]) monthly[key] = { planned: 0, actual: 0 }
      monthly[key].planned += i.total_budget || 0
      monthly[key].actual += i.actual_cost || 0
    })
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: `${date}-01`, planned: v.planned, actual: v.actual }))
  },

  initFromRab: async (projectId: string, rabItems: any[]) => {
    set({ isLoading: true })
    try {
      const now = new Date().toISOString()
      const rapItems = rabItems.map(rab => ({
        id: (rab as any).rap_id || generateId('rap'),
        project_id: projectId,
        rab_item_id: rab.id,
        // Use only valid wbs_id (never timeline taskId which is a different FK)
        wbs_id: rab.wbsId || rab.wbs_id || null,
        ahsp_id: rab.ahspId || rab.ahsp_id || null,
        // Carry the name locally so UI doesn't depend on DB joins
        name: rab.name || rab.item_name || 'Unnamed Item',
        qty_budget: rab.volume,
        unit_price_budget: rab.unit_price,
        total_budget: (rab.volume || 0) * (rab.unit_price || 0),
        cost_material: rab.cost_material || 0,
        cost_labor: rab.cost_labor || 0,
        cost_equipment: rab.cost_equipment || 0,
        cost_subcon: rab.cost_subcon || 0,
        committed_cost: 0,
        actual_cost: 0,
        remaining_budget: (rab.volume || 0) * (rab.unit_price || 0),
        risk_buffer_amount: 0,
        status: 'not_started',
        createdAt: now,
        updatedAt: now,
      }))

      // Update local state
      set({ items: rapItems })

      // Batch Sync
      syncRAPItems(rapItems, projectId)

      toast.success(`RAP initialized with ${rapItems.length} items`)
    } catch (err: any) {
      toast.error('Failed to initialize RAP: ' + err.message)
    } finally {
      set({ isLoading: false })
    }
  }
}))

