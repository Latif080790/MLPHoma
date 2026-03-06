/**
 * ahspRepository.ts
 *
 * Data-access layer for AHSP module. Extracts all Supabase direct calls
 * from the monolithic ahspStore.ts into a clean, testable repository.
 *
 * All methods return { data, error } tuples for standardized handling.
 */

import { assertSupabase, fetchResources as sbFetchResources, fetchAhspItems as sbFetchAhspItems, bulkImportAHSPDirect } from './supabaseClient'
import type { AhspItemRow, ResourceRow, AhspComponentRow } from './supabaseClient'
import { syncAHSPItem, syncResource, syncResources, syncAHSPComponent, syncDelete, syncAHSPItemsWithComponents } from './supabaseSyncService'
import type {
    Resource,
    AHSPItem,
    AHSPComponent,
    ResourceType,
    ResourceUnit,
    PriceHistory,
    Zone,
    AhspZonePrice
} from '../types/ahsp'

// ─── Row-to-Model Mappers ───

function mapResourceRow(r: ResourceRow): Resource {
    const dbType = (r.type || '').toUpperCase()
    const type: ResourceType =
        dbType === 'LABOR' ? 'labor' :
            dbType === 'EQUIPMENT' ? 'equipment' :
                dbType === 'SUBCON' || dbType === 'SUBCONTRACTOR' ? 'subcontractor' :
                    'material'

    return {
        id: r.id,
        code: r.code,
        name: r.name,
        type,
        unit: r.unit as ResourceUnit,
        unitPrice: r.unit_price,
        isActive: r.is_active ?? true,
        supplier: r.supplier,
        specifications: r.specifications,
        createdAt: r.created_at || new Date().toISOString(),
        updatedAt: r.updated_at || new Date().toISOString()
    }
}

function mapAhspItemRow(item: AhspItemRow): AHSPItem {
    return {
        ...item,
        basePrice: item.base_price || 0,
        finalPrice: item.final_price || 0,
        isActive: item.is_active ?? true,
        price_material: item.price_material || 0,
        price_labor: item.price_labor || 0,
        price_equipment: item.price_equipment || 0,
        price_subcon: item.price_subcon || 0,
        overheadPercentage: item.overhead_percentage || 0,
        profitPercentage: item.profit_percentage || 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at
    } as AHSPItem
}

function mapComponentRow(comp: AhspComponentRow & { resource: ResourceRow | null }): AHSPComponent {
    return {
        id: comp.id,
        ahspId: comp.ahsp_id,
        type: comp.type as ResourceType,
        resourceId: comp.resource_id,
        coefficient: comp.coefficient,
        unit: comp.unit as ResourceUnit,
        unitPrice: comp.unit_price,
        subtotal: comp.subtotal,
        resource: comp.resource ? mapResourceRow(comp.resource) : undefined,
        createdAt: comp.created_at || new Date().toISOString(),
        updatedAt: comp.updated_at || new Date().toISOString(),
    }
}

// ─── Repository ───

export const ahspRepository = {

    // ─────────────────── Resources ───────────────────

    async fetchAllResources(): Promise<{ data: Resource[]; error: string | null }> {
        try {
            const allResources: Resource[] = []
            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await sbFetchResources(batchSize, offset)
                if (error) throw error

                const rows = (data as ResourceRow[]) || []
                if (rows.length === 0) break

                allResources.push(...rows.map(mapResourceRow))
                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            return { data: allResources, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch resources' }
        }
    },

    syncResource(resource: Resource) {
        syncResource(resource)
    },

    syncResources(resources: Resource[]) {
        syncResources(resources)
    },

    deleteResource(id: string) {
        syncDelete('resources', id)
    },

    // ─────────────────── AHSP Items ───────────────────

    async fetchAllAHSPItems(): Promise<{ data: AHSPItem[]; error: string | null }> {
        try {
            const allItems: AHSPItem[] = []
            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await sbFetchAhspItems(batchSize, offset)
                if (error) throw error

                const rows = (data as AhspItemRow[]) || []
                if (rows.length === 0) break

                allItems.push(...rows.map(mapAhspItemRow))
                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            return { data: allItems, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch AHSP items' }
        }
    },

    async fetchCreationLogs(ahspIds: string[]): Promise<Map<string, { creation_mode: string; source_reference: string | null }>> {
        const logMap = new Map<string, { creation_mode: string; source_reference: string | null }>()

        if (ahspIds.length === 0) return logMap

        try {
            const client = assertSupabase()
            const LOG_BATCH_SIZE = 500

            for (let i = 0; i < ahspIds.length; i += LOG_BATCH_SIZE) {
                const ids = ahspIds.slice(i, i + LOG_BATCH_SIZE)
                const { data: logs, error } = await client
                    .from('ahsp_creation_logs')
                    .select('ahsp_id, creation_mode, source_reference, created_at')
                    .in('ahsp_id', ids)
                    .order('created_at', { ascending: false })

                if (error) continue
                    ; (logs || []).forEach((log: { ahsp_id: string; creation_mode: string; source_reference?: string | null }) => {
                        if (!logMap.has(log.ahsp_id)) {
                            logMap.set(log.ahsp_id, {
                                creation_mode: log.creation_mode,
                                source_reference: log.source_reference ?? null,
                            })
                        }
                    })
            }
        } catch {
            // Non-critical — gracefully ignore
        }

        return logMap
    },

    syncAHSPItem(item: AHSPItem) {
        syncAHSPItem(item)
    },

    syncAHSPItemsWithComponents(items: AHSPItem[], components: AHSPComponent[]) {
        return syncAHSPItemsWithComponents(items, components)
    },

    deleteAHSPItem(id: string) {
        syncDelete('ahsp_items', id)
    },

    async bulkImport(
        ahspRows: AhspItemRow[],
        resourceRows: ResourceRow[],
        componentRows: AhspComponentRow[]
    ) {
        return bulkImportAHSPDirect(ahspRows, resourceRows, componentRows)
    },

    // ─────────────────── Components ───────────────────

    async fetchComponents(ahspId?: string): Promise<{ data: Record<string, AHSPComponent[]>; error: string | null }> {
        try {
            const client = assertSupabase()
            const componentsByAHSP: Record<string, AHSPComponent[]> = {}

            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                let query = client
                    .from('ahsp_components')
                    .select(`*, resource:resources(*)`)
                    .range(offset, offset + batchSize - 1)
                    .order('created_at', { ascending: true })

                if (ahspId) {
                    query = query.eq('ahsp_id', ahspId)
                }

                const { data, error } = await query
                if (error) throw error

                const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[]) || []
                if (rows.length === 0) break

                rows.forEach(row => {
                    const component = mapComponentRow(row)
                    if (!componentsByAHSP[row.ahsp_id]) {
                        componentsByAHSP[row.ahsp_id] = []
                    }
                    componentsByAHSP[row.ahsp_id].push(component)
                })

                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            return { data: componentsByAHSP, error: null }
        } catch (err: unknown) {
            return { data: {}, error: (err as Error).message || 'Failed to fetch components' }
        }
    },

    /**
     * Batch-fetch components for multiple AHSP ids in a single query.
     * Replaces N individual fetchComponents() calls in ResourcePlan.
     */
    async fetchComponentsBatch(ahspIds: string[]): Promise<{ data: Record<string, AHSPComponent[]>; error: string | null }> {
        if (!ahspIds.length) return { data: {}, error: null }
        try {
            const client = assertSupabase()
            const componentsByAHSP: Record<string, AHSPComponent[]> = {}

            // Use .in() filter — single round-trip for all ids
            const { data, error } = await client
                .from('ahsp_components')
                .select(`*, resource:resources(*)`)
                .in('ahsp_id', ahspIds)
                .order('created_at', { ascending: true })

            if (error) throw error

            const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[]) || []
            rows.forEach(row => {
                const component = mapComponentRow(row)
                if (!componentsByAHSP[row.ahsp_id]) {
                    componentsByAHSP[row.ahsp_id] = []
                }
                componentsByAHSP[row.ahsp_id].push(component)
            })

            return { data: componentsByAHSP, error: null }
        } catch (err: unknown) {
            return { data: {}, error: (err as Error).message || 'Failed to batch-fetch components' }
        }
    },

    syncComponent(component: AHSPComponent) {
        syncAHSPComponent(component)
    },

    deleteComponent(id: string) {
        syncDelete('ahsp_components', id)
    },

    // ─────────────────── Zones ───────────────────

    async fetchZones(): Promise<{ data: Zone[]; error: string | null }> {
        try {
            const client = assertSupabase()
            const { data, error } = await client.from('zones').select('*').order('created_at')
            if (error) throw error

            const zones: Zone[] = (data || []).map((z: { id: string; name: string; description?: string; is_active?: boolean; created_at?: string; updated_at?: string }) => ({
                id: z.id,
                name: z.name,
                description: z.description,
                isActive: z.is_active ?? true,
                createdAt: z.created_at || '',
                updatedAt: z.updated_at || ''
            }))

            return { data: zones, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch zones' }
        }
    },

    async insertZone(zone: Zone) {
        const client = assertSupabase()
        return client.from('zones').insert({
            id: zone.id,
            name: zone.name,
            description: zone.description,
            is_active: zone.isActive,
            created_at: zone.createdAt,
            updated_at: zone.updatedAt
        })
    },

    async updateZone(id: string, updates: Partial<Zone>) {
        const client = assertSupabase()
        return client.from('zones').update({
            name: updates.name,
            description: updates.description,
            is_active: updates.isActive,
            updated_at: new Date().toISOString()
        }).eq('id', id)
    },

    deleteZone(id: string) {
        syncDelete('zones', id)
    },

    // ─────────────────── Zone Prices ───────────────────

    async fetchZonePrices(zoneId: string): Promise<{ data: AhspZonePrice[]; error: string | null }> {
        try {
            const client = assertSupabase()
            const { data, error } = await client
                .from('ahsp_zone_prices')
                .select('*')
                .eq('zone_id', zoneId)

            if (error) throw error

            const prices: AhspZonePrice[] = (data || []).map((p: { id: string; ahsp_id: string; zone_id: string; price_material?: number; price_labor?: number; price_equipment?: number; price_subcon?: number; overhead_percentage?: number; profit_percentage?: number; final_price?: number; created_at?: string; updated_at?: string }) => ({
                id: p.id,
                ahspId: p.ahsp_id,
                zoneId: p.zone_id,
                price_material: p.price_material || 0,
                price_labor: p.price_labor || 0,
                price_equipment: p.price_equipment || 0,
                price_subcon: p.price_subcon || 0,
                overheadPercentage: p.overhead_percentage || 0,
                profitPercentage: p.profit_percentage || 0,
                finalPrice: p.final_price || 0,
                createdAt: p.created_at || '',
                updatedAt: p.updated_at || ''
            }))

            return { data: prices, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch zone prices' }
        }
    },

    async upsertZonePrice(price: AhspZonePrice) {
        const client = assertSupabase()
        return client.from('ahsp_zone_prices').upsert({
            id: price.id,
            ahsp_id: price.ahspId,
            zone_id: price.zoneId,
            price_material: price.price_material,
            price_labor: price.price_labor,
            price_equipment: price.price_equipment,
            price_subcon: price.price_subcon,
            overhead_percentage: price.overheadPercentage,
            profit_percentage: price.profitPercentage,
            updated_at: price.updatedAt
        })
    },

    // ─────────────────── Price History ───────────────────

    async fetchPriceHistory(ahspId: string, zoneId?: string): Promise<{ data: PriceHistory[]; error: string | null }> {
        try {
            const client = assertSupabase()
            let query = client
                .from('ahsp_price_history')
                .select('*')
                .eq('ahsp_id', ahspId)
                .order('recorded_at', { ascending: false })
                .limit(50)

            if (zoneId) {
                query = query.eq('zone_id', zoneId)
            }

            const { data, error } = await query
            if (error) throw error

            const history: PriceHistory[] = (data || []).map((h: { id: string; ahsp_id: string; old_price?: number | null; new_price?: number; change_type?: string; change_reason?: string; created_at?: string }) => ({
                id: h.id,
                ahspId: h.ahsp_id,
                oldPrice: h.old_price ?? null,
                newPrice: h.new_price || 0,
                changeType: h.change_type || 'unknown',
                changeReason: h.change_reason || undefined,
                createdAt: h.created_at || new Date().toISOString()
            }))

            return { data: history, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch price history' }
        }
    },

    // ─────────────────── Clear All Data ───────────────────

    async clearAllData(): Promise<{ success: boolean; error: string | null }> {
        try {
            const client = assertSupabase()
            const filterValue = '1970-01-01Z'

            await client.from('ahsp_zone_prices').delete().gt('created_at', filterValue)
            await client.from('ahsp_price_history').delete().gt('created_at', filterValue)
            await client.from('ahsp_components').delete().gt('created_at', filterValue)
            await client.from('ahsp_items').delete().gt('created_at', filterValue)
            await client.from('resources').delete().gt('created_at', filterValue)

            return { success: true, error: null }
        } catch (err: unknown) {
            return { success: false, error: (err as Error).message || 'Failed to clear data' }
        }
    },
}
