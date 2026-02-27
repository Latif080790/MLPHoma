
import { create } from 'zustand'
import { ChangeOrder, ChangeOrderItem } from '../types/change-order'
import { changeOrderService } from '../services/changeOrderService'
import { changeOrderCascade } from '../services/changeOrderCascade'
import { toast } from 'sonner'
import { useAuthStore } from './authStore'

interface CascadePreview {
    affectedRabItems: number
    affectedTasks: number
    estimatedBudgetDelta: number
    estimatedScheduleDelta: number
}

interface ChangeOrderState {
    orders: ChangeOrder[]
    loading: boolean
    error: string | null
    cascadePreview: CascadePreview | null
    previewLoading: boolean

    fetchOrders: (projectId: string) => Promise<void>
    createOrder: (order: Partial<ChangeOrder>, items: Partial<ChangeOrderItem>[]) => Promise<void>
    updateStatus: (id: string, status: string) => Promise<void>
    deleteOrder: (id: string) => Promise<void>
    previewCascade: (id: string) => Promise<CascadePreview>
    clearPreview: () => void
}

export const useChangeOrderStore = create<ChangeOrderState>((set, get) => ({
    orders: [],
    loading: false,
    error: null,
    cascadePreview: null,
    previewLoading: false,

    fetchOrders: async (projectId: string) => {
        set({ loading: true, error: null })
        try {
            const data = await changeOrderService.getChangeOrders(projectId)
            set({ orders: data, loading: false })
        } catch (err: any) {
            set({ error: err.message, loading: false })
        }
    },

    createOrder: async (order: Partial<ChangeOrder>, items: Partial<ChangeOrderItem>[]) => {
        set({ loading: true, error: null })
        try {
            const newOrder = await changeOrderService.createChangeOrder(order, items)
            // For simplicity, just refetch or append. Append is tricky with items, so standard fetch is likely safer for consistency.
            // But let's try to append optimistically if newOrder is returned.
            // Actually changeOrderService.createChangeOrder returns just the order, not the joined items.
            // So fetchOrders is safest.
            const currentOrders = get().orders
            // We can mock the items array to update UI immediately
            const newOrderWithItems = {
                ...newOrder,
                items: items.map(i => ({ ...i, id: 'temp-' + Math.random(), change_order_id: newOrder.id, total_delta: (i.volume_delta || 0) * (i.unit_price || 0) }))
            }

            set({ orders: [newOrderWithItems, ...currentOrders], loading: false })

        } catch (err: any) {
            set({ error: err.message, loading: false })
            throw err
        }
    },

    updateStatus: async (id: string, status: string) => {
        try {
            const user = useAuthStore.getState().user
            await changeOrderService.updateChangeOrderStatus(
                id,
                status,
                user?.id,
                user?.user_metadata?.full_name || user?.email || 'System'
            )
            set(state => ({
                orders: state.orders.map(o => o.id === id ? { ...o, status: status as any } : o)
            }))

            // FASE 2.4: Cascade on approval — update RAB items, timeline tasks, budget
            if (status === 'APPROVED') {
                try {
                    const result = await changeOrderCascade.execute(id)
                    if (result.errors.length > 0) {
                        toast.warning('VO Approved with warnings', {
                            description: `RAB: ${result.rabItemsUpdated} updated, Timeline: ${result.timelineTasksUpdated} updated. ${result.errors.length} warning(s).`,
                        })
                    } else {
                        toast.success('VO Approved — Cascade Complete', {
                            description: `RAB: ${result.rabItemsUpdated} item updated (Rp ${Math.abs(result.budgetDelta).toLocaleString('id-ID')}). Timeline: ${result.timelineTasksUpdated} task updated.`,
                        })
                    }
                } catch (cascadeErr: any) {
                    console.error('VO cascade failed:', cascadeErr)
                    toast.error('VO approved but cascade failed', { description: cascadeErr.message })
                }
            }
        } catch (err: any) {
            set({ error: err.message })
            throw err
        }
    },

    deleteOrder: async (id: string) => {
        try {
            const user = useAuthStore.getState().user
            await changeOrderService.deleteChangeOrder(
                id,
                user?.id,
                user?.user_metadata?.full_name || user?.email || 'System'
            )
            set(state => ({
                orders: state.orders.filter(o => o.id !== id)
            }))
        } catch (err: any) {
            set({ error: err.message })
        }
    },

    previewCascade: async (id: string) => {
        set({ previewLoading: true })
        try {
            const preview = await changeOrderCascade.preview(id)
            set({ cascadePreview: preview, previewLoading: false })
            return preview
        } catch (err: any) {
            set({ previewLoading: false })
            toast.error('Failed to preview cascade: ' + err.message)
            throw err
        }
    },

    clearPreview: () => set({ cascadePreview: null })
}))
