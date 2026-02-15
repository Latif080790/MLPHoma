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
     * Initialize RAP items from RAB (Import from Estimate)
     * This is a "bulk insert" operation
     */
    async initFromRab(projectId: string, rabItems: any[]) {
        // 1. Map RAB items to RAP items structure
        const rapItems = rabItems.map(rab => ({
            project_id: projectId,
            rab_item_id: rab.id,
            wbs_id: rab.wbs_id, // Assuming RAB has WBS link

            // Default Budget = RAB Estimate
            qty_budget: rab.volume,
            unit_price_budget: rab.unit_price,

            // Link split costs if available (Unit Costs)
            cost_material: rab.cost_material || 0,
            cost_labor: rab.cost_labor || 0,
            cost_equipment: rab.cost_equipment || 0,
            cost_subcon: rab.cost_subcon || 0,

            // Initialize zero real costs
            committed_cost: 0,
            actual_cost: 0
        }))

        // 2. Insert
        const client = assertSupabase()
        const { data, error } = await client
            .from('rap_items')
            .insert(rapItems)
            .select()

        if (error) throw error
        return data
    }
}
