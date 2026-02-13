
import { create } from 'zustand'
import { ChangeOrder, ChangeOrderItem } from '../types/change-order'
import { changeOrderService } from '../services/changeOrderService'

interface ChangeOrderState {
    orders: ChangeOrder[]
    loading: boolean
    error: string | null

    fetchOrders: (projectId: string) => Promise<void>
    createOrder: (order: Partial<ChangeOrder>, items: Partial<ChangeOrderItem>[]) => Promise<void>
    updateStatus: (id: string, status: string) => Promise<void>
    deleteOrder: (id: string) => Promise<void>
}

export const useChangeOrderStore = create<ChangeOrderState>((set, get) => ({
    orders: [],
    loading: false,
    error: null,

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
            await changeOrderService.updateChangeOrderStatus(id, status)
            set(state => ({
                orders: state.orders.map(o => o.id === id ? { ...o, status: status as any } : o)
            }))
        } catch (err: any) {
            set({ error: err.message })
            throw err
        }
    },

    deleteOrder: async (id: string) => {
        try {
            await changeOrderService.deleteChangeOrder(id)
            set(state => ({
                orders: state.orders.filter(o => o.id !== id)
            }))
        } catch (err: any) {
            set({ error: err.message })
        }
    }
}))
