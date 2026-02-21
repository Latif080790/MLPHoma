/**
 * tkdnStore.ts
 * Zustand store for TKDN (Tingkat Komponen Dalam Negeri) module.
 * Delegates all DB operations to tkdnService.
 */

import { create } from 'zustand'
import { tkdnService } from '../services/tkdnService'
import { toast } from 'sonner'
import type { TKDNItem, TKDNSummary, TKDNCreateInput, TKDNUpdateInput } from '../types/tkdn'

export interface TKDNState {
  /** All TKDN items for the active project */
  items: TKDNItem[]
  /** Computed summary */
  summary: TKDNSummary | null
  /** Loading state */
  loading: boolean
  /** Target TKDN percentage (default 40%) */
  targetPercentage: number
  /** Last loaded project ID */
  _loadedProjectId: string | null

  /** Actions */
  fetchItems: (projectId: string) => Promise<void>
  addItem: (input: TKDNCreateInput) => Promise<TKDNItem | null>
  updateItem: (id: string, updates: TKDNUpdateInput) => Promise<void>
  removeItem: (id: string) => Promise<void>
  importFromRAP: (projectId: string) => Promise<number>
  generatePDF: () => Promise<void>
  setTargetPercentage: (pct: number) => void
  recalculate: () => void
}

export const useTKDNStore = create<TKDNState>((set, get) => ({
  items: [],
  summary: null,
  loading: false,
  targetPercentage: 40,
  _loadedProjectId: null,

  fetchItems: async (projectId: string) => {
    if (!projectId) return
    set({ loading: true })
    try {
      const items = await tkdnService.getItems(projectId)
      const summary = items.length > 0
        ? tkdnService.calculateSummary(items, get().targetPercentage)
        : null
      set({ items, summary, _loadedProjectId: projectId, loading: false })
    } catch (err: any) {
      console.error('Failed to fetch TKDN items:', err)
      toast.error('Gagal memuat data TKDN', { description: err.message })
      set({ loading: false })
    }
  },

  addItem: async (input: TKDNCreateInput) => {
    try {
      const item = await tkdnService.createItem(input)
      set((state) => {
        const items = [...state.items, item]
        return {
          items,
          summary: tkdnService.calculateSummary(items, state.targetPercentage),
        }
      })
      toast.success('Item TKDN berhasil ditambahkan')
      return item
    } catch (err: any) {
      toast.error('Gagal menambah item TKDN', { description: err.message })
      return null
    }
  },

  updateItem: async (id: string, updates: TKDNUpdateInput) => {
    try {
      const updated = await tkdnService.updateItem(id, updates)
      set((state) => {
        const items = state.items.map(i => i.id === id ? updated : i)
        return {
          items,
          summary: tkdnService.calculateSummary(items, state.targetPercentage),
        }
      })
      toast.success('Item TKDN berhasil diperbarui')
    } catch (err: any) {
      toast.error('Gagal memperbarui item TKDN', { description: err.message })
    }
  },

  removeItem: async (id: string) => {
    // Optimistic removal
    const prev = get().items
    set((state) => {
      const items = state.items.filter(i => i.id !== id)
      return {
        items,
        summary: items.length > 0
          ? tkdnService.calculateSummary(items, state.targetPercentage)
          : null,
      }
    })

    try {
      await tkdnService.deleteItem(id)
      toast.success('Item TKDN berhasil dihapus')
    } catch (err: any) {
      // Revert on failure
      set((state) => ({
        items: prev,
        summary: tkdnService.calculateSummary(prev, state.targetPercentage),
      }))
      toast.error('Gagal menghapus item TKDN', { description: err.message })
    }
  },

  importFromRAP: async (projectId: string) => {
    try {
      const count = await tkdnService.importFromRAP(projectId)
      if (count > 0) {
        await get().fetchItems(projectId)
        toast.success(`Berhasil mengimpor ${count} item dari RAP`)
      } else {
        toast.info('Tidak ada item RAP baru untuk diimpor')
      }
      return count
    } catch (err: any) {
      toast.error('Gagal mengimpor dari RAP', { description: err.message })
      return 0
    }
  },

  generatePDF: async () => {
    const { summary, items } = get()
    if (!summary || items.length === 0) {
      toast.error('Tidak ada data untuk dilaporan')
      return
    }
    try {
      await tkdnService.generatePDF(summary, items)
      toast.success('Laporan TKDN berhasil diunduh')
    } catch (err: any) {
      toast.error('Gagal membuat PDF', { description: err.message })
    }
  },

  setTargetPercentage: (pct: number) => {
    set((state) => ({
      targetPercentage: pct,
      summary: state.items.length > 0
        ? tkdnService.calculateSummary(state.items, pct)
        : null,
    }))
  },

  recalculate: () => {
    const { items, targetPercentage } = get()
    set({
      summary: items.length > 0
        ? tkdnService.calculateSummary(items, targetPercentage)
        : null,
    })
  },
}))
