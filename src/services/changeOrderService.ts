

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import { ChangeOrder, ChangeOrderItem } from '../types/change-order'

export const changeOrderService = {
    async getChangeOrders(projectId: string): Promise<ChangeOrder[]> {
        const client = assertSupabase()
        const { data: orders, error } = await client
            .from('change_orders')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[changeOrder] getChangeOrders error:', error.message)
            return []
        }

        // Fetch items for each order (could be optimized with a join but array join in supabase-js is tricky sometimes for nested lists)
        // For now simple approach
        const fullOrders: ChangeOrder[] = []

        for (const order of (orders || [])) {
            const { data: items } = await client
                .from('change_order_items')
                .select('*, wbs_items(name)')
                .eq('change_order_id', order.id)

            fullOrders.push({
                ...order,
                items: items?.map((i: any) => ({
                    ...i,
                    wbs_name: i.wbs_items?.name
                })) || []
            })
        }

        return fullOrders
    },

    async createChangeOrder(order: Partial<ChangeOrder>, items: Partial<ChangeOrderItem>[]) {
        const client = assertSupabase()
        const id = generateId()

        // 1. Create Header
        const { data: newOrder, error: orderError } = await client
            .from('change_orders')
            .insert({
                id,
                project_id: order.project_id,
                vo_number: order.vo_number,
                title: order.title,
                description: order.description,
                status: order.status || 'DRAFT',
                cost_impact: order.cost_impact,
                schedule_impact_days: order.schedule_impact_days
            })
            .select()
            .single()

        if (orderError) throw orderError

        // 2. Create Items
        if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
                id: generateId(),
                change_order_id: id,
                item_description: item.item_description,
                volume_delta: item.volume_delta,
                unit_price: item.unit_price,
                total_delta: item.total_delta,
                target_wbs_id: item.target_wbs_id
            }))

            const { error: itemsError } = await client
                .from('change_order_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError
        }

        return newOrder
    },

    async updateChangeOrderStatus(id: string, status: string) {
        const client = assertSupabase()
        const { error } = await client
            .from('change_orders')
            .update({ status })
            .eq('id', id)

        if (error) throw error
    },

    async deleteChangeOrder(id: string) {
        const client = assertSupabase()

        // Items cascade delete usually, but good to be safe if not set in DB
        const { error } = await client
            .from('change_orders')
            .delete()
            .eq('id', id)

        if (error) throw error
    }
}
