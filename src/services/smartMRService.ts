/**
 * smartMRService.ts
 * FASE 3.1: Smart Material Request — Auto-suggest from AHSP
 *
 * When creating a Material Request, the system can:
 * 1. Look up the WBS → find linked AHSP item
 * 2. Extract material components from AHSP with coefficients
 * 3. Multiply coefficient × actual volume to get required qty
 * 4. Check existing inventory stock to compute net demand
 * 5. Auto-fill MR form with pre-calculated quantities
 */

import { assertSupabase } from '../lib/supabaseClient'

// ---------- Types ----------

export interface MaterialSuggestion {
    resourceId: string
    resourceName: string
    resourceType: 'material' | 'labor' | 'equipment' | 'subcontractor'
    unit: string
    coefficient: number
    /** Required qty = coefficient × planned volume */
    requiredQty: number
    /** Current stock from inventory */
    currentStock: number
    /** Net demand = max(0, required - currentStock) */
    netDemand: number
    /** Estimated unit price from AHSP */
    estimatedUnitPrice: number
    /** Source AHSP item name */
    ahspItemName: string
}

// ---------- Service ----------

export const smartMRService = {

    /**
     * Get material suggestions for a WBS item.
     * Looks up AHSP → extracts material components → checks inventory.
     */
    async getSuggestionsForWBS(
        projectId: string,
        wbsId: string,
        plannedVolume: number = 1,
    ): Promise<MaterialSuggestion[]> {
        const client = assertSupabase()

        // 1. Find AHSP linked to the WBS via RAB → AHSP
        const { data: rabItem } = await client
            .from('rab_items')
            .select('ahsp_id, volume')
            .eq('project_id', projectId)
            .eq('wbs_id', wbsId)
            .maybeSingle()

        if (!rabItem?.ahsp_id) return []

        const volume = plannedVolume || Number(rabItem.volume) || 1

        // 2. Get AHSP components (materials only for MR, but include all for reference)
        const { data: components } = await client
            .from('ahsp_components')
            .select(`
                id,
                coefficient,
                unit,
                unit_price,
                type,
                resource_id,
                resources ( id, name, unit, unit_price, type )
            `)
            .eq('ahsp_id', rabItem.ahsp_id)

        if (!components || components.length === 0) return []

        // Get AHSP item name for context
        const { data: ahspItem } = await client
            .from('ahsp_items')
            .select('name')
            .eq('id', rabItem.ahsp_id)
            .single()

        const ahspName = ahspItem?.name || 'Unknown AHSP'

        // 3. Get current inventory stock for this project
        const { data: stockData } = await client
            .from('inventory_transactions')
            .select('material_name, transaction_type, quantity')
            .eq('project_id', projectId)

        // Build stock map
        const stockMap = new Map<string, number>()
        for (const tx of (stockData || [])) {
            const current = stockMap.get(tx.material_name) || 0
            if (tx.transaction_type === 'IN') {
                stockMap.set(tx.material_name, current + Number(tx.quantity))
            } else if (tx.transaction_type === 'OUT') {
                stockMap.set(tx.material_name, current - Number(tx.quantity))
            }
        }

type AhspCompRow = { type?: string; resource_id?: string; id?: string; coefficient?: number; unit?: string; unit_price?: number; resources?: { name?: string; unit?: string; unit_price?: number } | Array<{ name?: string; unit?: string; unit_price?: number }> | null }

        // 4. Build suggestions
        const suggestions: MaterialSuggestion[] = (components as AhspCompRow[])
            .filter((c: AhspCompRow) => c.type === 'material') // Only material components for MR
            .map((comp: AhspCompRow) => {
                const resource = (Array.isArray(comp.resources) ? comp.resources[0] : comp.resources) || {}
                const resourceName = resource.name || `Resource-${comp.resource_id}`
                const requiredQty = Number(comp.coefficient) * volume
                const currentStock = stockMap.get(resourceName) || 0
                const netDemand = Math.max(0, requiredQty - currentStock)

                return {
                    resourceId: comp.resource_id || comp.id || '',
                    resourceName,
                    resourceType: (comp.type || 'material') as MaterialSuggestion['resourceType'],
                    unit: comp.unit || resource.unit || 'unit',
                    coefficient: Number(comp.coefficient),
                    requiredQty,
                    currentStock: Math.max(0, currentStock),
                    netDemand,
                    estimatedUnitPrice: Number(comp.unit_price || resource.unit_price || 0),
                    ahspItemName: ahspName,
                }
            })
            .filter((s: MaterialSuggestion) => s.netDemand > 0) // Only show items with actual demand

        return suggestions
    },

    /**
     * Get suggestions for all WBS items in a project that have linked AHSPs.
     * Useful for bulk MR generation.
     */
    async getBulkSuggestions(projectId: string): Promise<Record<string, MaterialSuggestion[]>> {
        const client = assertSupabase()

        // Get all RAB items with WBS links and AHSP links
        const { data: rabItems } = await client
            .from('rab_items')
            .select('wbs_id, ahsp_id, volume')
            .eq('project_id', projectId)
            .not('wbs_id', 'is', null)
            .not('ahsp_id', 'is', null)

        const result: Record<string, MaterialSuggestion[]> = {}

        for (const rab of (rabItems || [])) {
            if (!rab.wbs_id) continue
            try {
                const suggestions = await this.getSuggestionsForWBS(
                    projectId,
                    rab.wbs_id,
                    Number(rab.volume) || 1,
                )
                if (suggestions.length > 0) {
                    result[rab.wbs_id] = suggestions
                }
            } catch (e) {
                console.warn(`Smart MR failed for WBS ${rab.wbs_id}:`, e)
            }
        }

        return result
    },
}
