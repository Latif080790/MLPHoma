import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'

export interface RapItem {
    id: string
    project_id: string
    wbs_id?: string
    ahsp_id?: string
    rab_item_id?: string
    name?: string  // Local name carried from RAB source

    qty_budget: number
    unit_price_budget: number
    total_budget: number // Generated

    // Split Cost Budget (Unit Prices)
    cost_material: number
    cost_labor: number
    cost_equipment: number
    cost_subcon: number

    committed_cost: number
    actual_cost: number
    remaining_budget: number // Generated

    risk_buffer_amount: number
    risk_level?: 'low' | 'medium' | 'high' | 'critical'
    notes?: string

    // Joined relation fields (optional)
    ahsp_items?: { name: string; unit?: string }
    rab_items?: { name: string }
    wbs_items?: { name: string; code: string }
}

export const rapService = {
    /**
     * Get all RAP items for a project
     */
    async getByProject(projectId: string) {
        const client = assertSupabase()
        const { data, error } = await client
            .from('rap_items')
            .select(`
        *,
        wbs_items ( name, code ),
        ahsp_items ( name, unit ),
        rab_items ( name )
      `)
            .eq('project_id', projectId)

        if (error) {
            console.warn('[rap] getByProject error:', error.message)
            return []
        }
        return data || []
    },

    /**
     * Upsert a RAP item (Create or Update)
     */
    async upsert(item: Partial<RapItem>) {
        const client = assertSupabase()
        const { data, error } = await client
            .from('rap_items')
            .upsert(item)
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Delete all RAP items for a project (for re-sync)
     */
    async deleteAllByProject(projectId: string) {
        const client = assertSupabase()
        const { error } = await client
            .from('rap_items')
            .delete()
            .eq('project_id', projectId)

        if (error) throw error
    },

    /**
     * Initialize RAP items from RAB (Import from Estimate)
     * Smart Merge Strategy: Updates existing, inserts new, deletes removed (if no costs)
     */
    async initFromRab(projectId: string, rabItems: any[]) {
        const client = assertSupabase()

        // 1. Fetch existing RAP items
        const { data: existingRap } = await client
            .from('rap_items')
            .select('id, rab_item_id, committed_cost, actual_cost')
            .eq('project_id', projectId)

        const existingMap = new Map((existingRap || []).map(r => [r.rab_item_id, r]))

        // 2. Prepare items for Upsert
        const toUpsert = rabItems.map(rab => {
            const existing = existingMap.get(rab.id)
            return {
                id: (rab as any).rap_id || existing?.id || generateId('rap'),
                project_id: projectId,
                rab_item_id: rab.id,
                wbs_id: rab.wbs_id || rab.wbsId || null,
                ahsp_id: rab.ahsp_id || rab.ahspId || null,
                name: rab.name || rab.item_name || 'Unnamed Item',

                qty_budget: rab.volume || 0,
                unit_price_budget: rab.unit_price || rab.unitPrice || 0,

                cost_material: rab.cost_material || 0,
                cost_labor: rab.cost_labor || 0,
                cost_equipment: rab.cost_equipment || 0,
                cost_subcon: rab.cost_subcon || 0,

                // Preserve existing costs
                committed_cost: existing?.committed_cost || 0,
                actual_cost: existing?.actual_cost || 0,
                status: (rab as any).status || 'not_started'
            }
        })

        // 3. Identify items to delete (those in existing but NOT in new selection)
        const incomingRabIds = new Set(rabItems.map(r => r.id))
        const toDeleteIds = (existingRap || [])
            .filter(r => r.rab_item_id && !incomingRabIds.has(r.rab_item_id))
            .filter(r => Number(r.committed_cost || 0) === 0 && Number(r.actual_cost || 0) === 0)
            .map(r => r.id)

        // 4. Execute Operations
        // Delete removals first
        if (toDeleteIds.length > 0) {
            await client.from('rap_items').delete().in('id', toDeleteIds)
        }

        // Upsert all items (Update matched, Insert new)
        const { data, error } = await client
            .from('rap_items')
            .upsert(toUpsert)
            .select()

        if (error) {
            console.error('[rapService] Upsert error:', error)
            if (error.code === '23503') {
                throw new Error('Synchronization failed: Some RAB items are missing in the database. Please ensure you have "Published" your RAB baseline before syncing to RAP.')
            }
            throw error
        }
        return data
    }
}
