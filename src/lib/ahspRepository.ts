/**
 * ahspRepository.ts
 *
 * Data-access layer for AHSP module. Extracts all Supabase direct calls
 * from the monolithic ahspStore.ts into a clean, testable repository.
 *
 * All methods return { data, error } tuples for standardized handling.
 */

import { assertSupabase, fetchResources as sbFetchResources, fetchAhspItems as sbFetchAhspItems, bulkImportAHSPDirect } from './supabaseClient'
import { normalizeResourceType } from './resourceTypeUtils'
import type { AhspItemRow, ResourceRow, AhspComponentRow } from './supabaseClient'
import { syncAHSPItem, syncResource, syncResources, syncAHSPComponent, syncDelete, syncAHSPItemsWithComponents } from './supabaseSyncService'
import { db } from './db' // Import browser-safe IndexedDB instance
import type {

    Resource,
    AHSPItem,
    AHSPComponent,
    ResourceUnit,
    PriceHistory,
    Zone,
    AhspZonePrice
} from '../types/ahsp'

// ─── Row-to-Model Mappers ───

function mapResourceRow(r: ResourceRow): Resource {
    return {
        id: r.id,
        code: r.code,
        name: r.name,
        type: normalizeResourceType(r.type),
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
        subcategory: item.subcategory || '',
        currentVersion: (item as unknown as { current_version?: number }).current_version ?? 1,
        createdAt: item.created_at,
        updatedAt: item.updated_at
    } as AHSPItem
}

function mapComponentRow(comp: AhspComponentRow & { resource: ResourceRow | null }): AHSPComponent {
    // Normalize the stored type (DB may hold 'MATERIAL'/'LABOR'/'EQUIPMENT'/'SUBCON')
    // to the lowercase ResourceType the app + validation schemas expect. Without this,
    // copying these components (e.g. SNI template → new AHSP) fails enum validation.
    const normalizedType = normalizeResourceType(comp.type)
    return {
        id: comp.id,
        ahspId: comp.ahsp_id,
        type: normalizedType,
        resourceId: comp.resource_id,
        coefficient: comp.coefficient,
        unit: comp.unit as ResourceUnit,
        unitPrice: comp.unit_price,
        subtotal: comp.subtotal,
        sortOrder: comp.sort_order ?? 0,
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
            // STEP 1: Try Local Dexie Cache First for near-instant response
            const localResources = await db.resources.toArray()
            if (localResources.length > 0) {
                // Background Sync to ensure freshness (don't await)
                this.syncResourcesBackground().catch(() => { /* background sync — non-fatal */ })
                return { data: localResources, error: null }
            }

            // STEP 2: Fallback to Supabase if local is empty
            const allResources: Resource[] = []
            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await sbFetchResources(batchSize, offset)
                if (error) throw error

                const rows = (data as ResourceRow[]) || []
                if (rows.length === 0) break

                const mapped = rows.map(mapResourceRow)
                allResources.push(...mapped)
                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            // STEP 3: Cache in Dexie for future use
            if (allResources.length > 0) {
                await db.resources.bulkPut(allResources)
            }

            return { data: allResources, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch resources' }
        }
    },

    /** Background fetch to keep IndexedDB fresh */
    async syncResourcesBackground() {
        let offset = 0
        const batchSize = 1000
        let hasMore = true
        while (hasMore) {
            const { data, error } = await sbFetchResources(batchSize, offset)
            if (error || !data) break
            const mapped = (data as ResourceRow[]).map(mapResourceRow)
            await db.resources.bulkPut(mapped)
            offset += batchSize
            if (data.length < batchSize) hasMore = false
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
            // STEP 1: Try Local Dexie Cache First
            const localItems = await db.ahsp.toArray()
            if (localItems.length > 0) {
                // Background Sync
                this.syncAHSPItemsBackground().catch(() => { /* background sync — non-fatal */ })
                return { data: localItems, error: null }
            }

            const allItems: AHSPItem[] = []
            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await sbFetchAhspItems(batchSize, offset)
                if (error) throw error

                const rows = (data as AhspItemRow[]) || []
                if (rows.length === 0) break

                const mapped = rows.map(mapAhspItemRow)
                allItems.push(...mapped)
                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            // STEP 2: Cache in Dexie
            if (allItems.length > 0) {
                await db.ahsp.bulkPut(allItems)
            }

            return { data: allItems, error: null }
        } catch (err: unknown) {
            return { data: [], error: (err as Error).message || 'Failed to fetch AHSP items' }
        }
    },

    async syncAHSPItemsBackground() {
        let offset = 0
        const batchSize = 1000
        let hasMore = true
        while (hasMore) {
            const { data, error } = await sbFetchAhspItems(batchSize, offset)
            if (error || !data) break
            const mapped = (data as AhspItemRow[]).map(mapAhspItemRow)
            await db.ahsp.bulkPut(mapped)
            offset += batchSize
            if (data.length < batchSize) hasMore = false
        }
    },


    async fetchCreationLogs(ahspIds: string[]): Promise<Map<string, { creation_mode: string; source_reference: string | null }>> {
        const logMap = new Map<string, { creation_mode: string; source_reference: string | null }>()

        if (ahspIds.length === 0) return logMap

        try {
            const client = assertSupabase()
            // Keep the .in(...) id list short: prefixed text ids (~40 chars each) make
            // a GET URL that can exceed server limits (→ 400) at 500/batch. 150 keeps
            // the URL well under typical limits.
            const LOG_BATCH_SIZE = 150

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
        db.ahsp.put(item).catch(() => { /* cache write — non-fatal */ })
        syncAHSPItem(item)
    },

    syncAHSPItemsWithComponents(items: AHSPItem[], components: AHSPComponent[]) {
        db.ahsp.bulkPut(items).catch(() => { /* cache write — non-fatal */ })
        db.components.bulkPut(components).catch(() => { /* cache write — non-fatal */ })
        return syncAHSPItemsWithComponents(items, components)
    },

    deleteAHSPItem(id: string) {
        db.ahsp.delete(id).catch(() => { /* cache delete — non-fatal */ })
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
            // STEP 1: Try Dexie cache first for instant load
            const localComponents = ahspId
                ? await db.components.where('ahspId').equals(ahspId).toArray()
                : await db.components.toArray()

            if (localComponents.length > 0) {
                const componentsByAHSP: Record<string, AHSPComponent[]> = {}
                localComponents.forEach(comp => {
                    if (!componentsByAHSP[comp.ahspId]) componentsByAHSP[comp.ahspId] = []
                    componentsByAHSP[comp.ahspId].push(comp)
                })
                // Sort by sortOrder within each group
                Object.keys(componentsByAHSP).forEach(id => {
                    componentsByAHSP[id].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || 0)
                })
                // Background sync to keep cache fresh (non-blocking)
                this.syncComponentsBackground(ahspId).catch(() => { /* non-fatal */ })
                return { data: componentsByAHSP, error: null }
            }

            // STEP 2: Fallback to Supabase if cache is empty
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
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true })

                if (ahspId) query = query.eq('ahsp_id', ahspId)

                const { data, error } = await query
                if (error) throw error

                const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[]) || []
                if (rows.length === 0) break

                rows.forEach(row => {
                    const component = mapComponentRow(row)
                    if (!componentsByAHSP[row.ahsp_id]) componentsByAHSP[row.ahsp_id] = []
                    componentsByAHSP[row.ahsp_id].push(component)
                })

                offset += batchSize
                if (rows.length < batchSize) hasMore = false
            }

            // STEP 3: Cache results in Dexie for future loads
            const allComponents = Object.values(componentsByAHSP).flat()
            if (allComponents.length > 0) {
                await db.components.bulkPut(allComponents)
            }

            return { data: componentsByAHSP, error: null }
        } catch (err: unknown) {
            return { data: {}, error: (err as Error).message || 'Failed to fetch components' }
        }
    },

    async syncComponentsBackground(ahspId?: string) {
        try {
            const client = assertSupabase()
            let offset = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                let query = client
                    .from('ahsp_components')
                    .select(`*, resource:resources(*)`)
                    .range(offset, offset + batchSize - 1)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true })

                if (ahspId) query = query.eq('ahsp_id', ahspId)

                const { data, error } = await query
                if (error || !data) break

                const mapped = (data as (AhspComponentRow & { resource: ResourceRow | null })[]).map(mapComponentRow)
                await db.components.bulkPut(mapped)
                offset += batchSize
                if (data.length < batchSize) hasMore = false
            }
        } catch {
            // Background sync — non-fatal
        }
    },

    /**
     * Batch-fetch components for multiple AHSP ids in a single query.
     * Replaces N individual fetchComponents() calls in ResourcePlan.
     */
    async fetchComponentsBatch(ahspIds: string[]): Promise<{ data: Record<string, AHSPComponent[]>; error: string | null }> {
        if (!ahspIds.length) return { data: {}, error: null }
        try {
            // STEP 1: Try Dexie cache
            const cachedComponents = await db.components
                .where('ahspId')
                .anyOf(ahspIds)
                .toArray()

            if (cachedComponents.length > 0) {
                const componentsByAHSP: Record<string, AHSPComponent[]> = {}
                cachedComponents.forEach(comp => {
                    if (!componentsByAHSP[comp.ahspId]) componentsByAHSP[comp.ahspId] = []
                    componentsByAHSP[comp.ahspId].push(comp)
                })

                // Check if any requested ahspIds are missing from cache
                const missingIds = ahspIds.filter(id => !componentsByAHSP[id])

                if (missingIds.length > 0) {
                    // Fetch missing IDs from Supabase
                    const client = assertSupabase()
                    const { data, error } = await client
                        .from('ahsp_components')
                        .select(`*, resource:resources(*)`)
                        .in('ahsp_id', missingIds)
                        .order('sort_order', { ascending: true })
                        .order('created_at', { ascending: true })

                    if (!error && data) {
                        const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[])
                        rows.forEach(row => {
                            const component = mapComponentRow(row)
                            if (!componentsByAHSP[row.ahsp_id]) componentsByAHSP[row.ahsp_id] = []
                            componentsByAHSP[row.ahsp_id].push(component)
                        })
                        // Cache the newly fetched components
                        const newComps = rows.map(mapComponentRow)
                        if (newComps.length > 0) {
                            await db.components.bulkPut(newComps)
                        }
                    }
                }

                Object.keys(componentsByAHSP).forEach(id => {
                    componentsByAHSP[id].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                })
                return { data: componentsByAHSP, error: null }
            }

            // STEP 2: Fallback to Supabase
            const client = assertSupabase()
            const componentsByAHSP: Record<string, AHSPComponent[]> = {}

            // Use .in() filter — single round-trip for all ids
            const { data, error } = await client
                .from('ahsp_components')
                .select(`*, resource:resources(*)`)
                .in('ahsp_id', ahspIds)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true })

            if (error) throw error

            const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[]) || []
            rows.forEach(row => {
                const component = mapComponentRow(row)
                if (!componentsByAHSP[row.ahsp_id]) componentsByAHSP[row.ahsp_id] = []
                componentsByAHSP[row.ahsp_id].push(component)
            })

            // STEP 3: Cache in Dexie
            const allComps = Object.values(componentsByAHSP).flat()
            if (allComps.length > 0) {
                await db.components.bulkPut(allComps)
            }

            return { data: componentsByAHSP, error: null }
        } catch (err: unknown) {
            return { data: {}, error: (err as Error).message || 'Failed to batch-fetch components' }
        }
    },

    syncComponent(component: AHSPComponent) {
        db.components.put(component).catch(() => { /* cache write — non-fatal */ })
        syncAHSPComponent(component)
    },

    deleteComponent(id: string) {
        db.components.delete(id).catch(() => { /* cache delete — non-fatal */ })
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

    async insertPriceHistory(record: {
        ahspId: string
        zoneId?: string | null
        oldPrice: number | null
        newPrice: number
        overheadPercentage?: number | null
        profitPercentage?: number | null
        priceMaterial?: number | null
        priceLabor?: number | null
        priceEquipment?: number | null
        priceSubcon?: number | null
        versionNumber?: number | null
        changeType?: string
        changeReason?: string | null
        changeNote?: string | null
    }): Promise<{ error: string | null }> {
        try {
            const client = assertSupabase()
            const { error } = await client.from('ahsp_price_history').insert({
                ahsp_id: record.ahspId,
                zone_id: record.zoneId ?? null,
                old_price: record.oldPrice,
                new_price: record.newPrice,
                overhead_percentage: record.overheadPercentage ?? null,
                profit_percentage: record.profitPercentage ?? null,
                price_material: record.priceMaterial ?? null,
                price_labor: record.priceLabor ?? null,
                price_equipment: record.priceEquipment ?? null,
                price_subcon: record.priceSubcon ?? null,
                version_number: record.versionNumber ?? null,
                change_type: record.changeType ?? 'UPDATE',
                change_reason: record.changeReason ?? null,
                change_note: record.changeNote ?? null,
            })
            if (error) throw error
            return { error: null }
        } catch (err: unknown) {
            return { error: (err as Error).message || 'Failed to insert price history' }
        }
    },

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
