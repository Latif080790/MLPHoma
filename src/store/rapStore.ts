import { create } from 'zustand'
import { rapService, RapItem } from '../services/rapService'
import { toast } from 'sonner'

interface RapState {
  items: RapItem[]
  isLoading: boolean
  error: string | null

  fetchItems: (projectId: string) => Promise<void>
  updateItem: (item: Partial<RapItem>) => Promise<void>
  initFromRab: (projectId: string, rabItems: any[]) => Promise<void>
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
    try {
      const updated = await rapService.upsert(item)
      set((state) => ({
        items: state.items.map((i) => (i.id === updated.id ? updated : i))
      }))
      toast.success('RAP Item updated')
    } catch (err: any) {
      toast.error('Failed to update RAP item: ' + err.message)
    }
  },

  initFromRab: async (projectId: string, rabItems: any[]) => {
    set({ isLoading: true })
    try {
      await rapService.initFromRab(projectId, rabItems)
      await get().fetchItems(projectId)
      toast.success('RAP initialized from RAB')
    } catch (err: any) {
      toast.error('Failed to initialize RAP: ' + err.message)
    } finally {
      set({ isLoading: false })
    }
  }
}))

