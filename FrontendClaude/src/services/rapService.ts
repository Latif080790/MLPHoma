import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'

export interface RapItem {
    id: string
    project_id: string
    wbs_id?: string
    ahsp_id?: string
    rab_item_id?: string
    name?: string  // Local name carried from RAB source
    /** Planned start date populated from Timeline or RAPGeneratorSimple */
    start_date?: string
    /** Planned end date populated from Timeline or RAPGeneratorSimple */
    end_date?: string

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
    async initFromRab(projectId: string, rabItems: Array<Record<string, unknown>>) {
        const client = assertSupabase()

        // 1. Fetch existing RAP items + AHSP code→id map in parallel
        const [existingRapResult, ahspResult] = await Promise.all([
            client
                .from('rap_items')
                .select('id, rab_item_id, committed_cost, actual_cost')
                .eq('project_id', projectId),
            client
                .from('ahsp_items')
                .select('id, code, base_price')
                .not('code', 'is', null),
        ])

        const existingMap = new Map((existingRapResult.data || []).map(r => [r.rab_item_id, r]))

        // Build code → AHSP text-id map (rab_items stores ahsp_code, ahsp_items stores code)
        const ahspCodeMap = new Map<string, string>(
            (ahspResult.data || [])
                .filter(a => a.code && a.id)
                .map(a => [a.code as string, a.id as string])
        )

        // Build AHSP id → base_price map (production cost, no overhead/profit markup)
        // base_price = sum of resource components; RAP uses this so total_budget = execution cost ≠ contract price
        const ahspBasePriceMap = new Map<string, number>(
            (ahspResult.data || [])
                .filter(a => a.id && a.base_price != null && Number(a.base_price) > 0)
                .map(a => [a.id as string, Number(a.base_price)])
        )

        // 2. Prepare items for Upsert
        const toUpsert = rabItems.map(rab => {
            const existing = existingMap.get(rab.id)

            // AHSP id resolution priority:
            // 1. Explicit UUID field (rab_items.ahsp_id — uuid column, often null)
            // 2. Text aliases used in frontend store (ahspItemId / ahsp_item_id)
            // 3. Code-based lookup via ahsp_code → ahsp_items.code (most reliable)
            // 4. Code-based lookup via item_code (RAB item code may match AHSP code)
            const resolvedAhspId =
                (rab.ahsp_id as string | null) ||
                (rab.ahspId as string | null) ||
                (rab.ahspItemId as string | null) ||
                (rab.ahsp_item_id as string | null) ||
                ahspCodeMap.get(rab.ahsp_code as string) ||
                ahspCodeMap.get(rab.item_code as string) ||
                null

            return {
                id: (rab as Record<string, unknown>).rap_id as string || existing?.id || generateId('rap'),
                project_id: projectId,
                rab_item_id: rab.id,
                wbs_id: rab.wbs_id || rab.wbsId || null,
                ahsp_id: resolvedAhspId,
                name: rab.name || rab.item_name || 'Unnamed Item',

                qty_budget: rab.volume || 0,
                // RAP unit_price_budget = AHSP base_price (production/execution cost,
                // WITHOUT overhead + profit markup). This separates RAP (cost to execute)
                // from RAB (contract price to client = base + OH + profit + tax).
                // Falls back to rab.unit_price when the item has no AHSP link.
                unit_price_budget: (resolvedAhspId && ahspBasePriceMap.has(resolvedAhspId))
                    ? ahspBasePriceMap.get(resolvedAhspId)!
                    : ((rab.unit_price as number) || (rab.unitPrice as number) || 0),
                // NOTE: total_budget and remaining_budget are GENERATED ALWAYS AS columns
                // in Supabase (qty_budget * unit_price_budget) — do NOT include them here.

                cost_material: rab.cost_material || 0,
                cost_labor: rab.cost_labor || 0,
                cost_equipment: rab.cost_equipment || 0,
                cost_subcon: rab.cost_subcon || 0,

                // Preserve existing costs
                committed_cost: existing?.committed_cost || 0,
                actual_cost: existing?.actual_cost || 0,
                status: (rab as Record<string, unknown>).status as string || 'not_started',
                // Schedule dates — carried from linked timeline task or distributeVolumeByTasks output
                start_date: (rab.start_date || rab.startDate) as string | null || null,
                end_date: (rab.end_date || rab.endDate) as string | null || null,
            }
        })

        // 3. Identify items to delete (those in existing but NOT in new selection)
        const incomingRabIds = new Set(rabItems.map(r => r.id))
        const toDeleteIds = (existingRapResult.data || [])
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
