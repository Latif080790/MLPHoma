/**
 * ahspService.ts
 *
 * Business logic layer for AHSP module.
 * Orchestrates between the repository (data access), calculation worker,
 * and the store (UI state). Pure orchestration — no Supabase calls, no Zustand set().
 */

import { calculateAHSPPrice as calcAHSPPriceSync } from '../lib/calculationService'
import { runCalculation } from '../hooks/useCalculationWorker'
import type {
    AHSPItem,
    AHSPComponent,
    Resource,
    ResourceType,
} from '../types/ahsp'
import type { AhspItemRow, ResourceRow, AhspComponentRow } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { normalizeImportType, toDbResourceType } from '../lib/resourceTypeUtils'
import { ahspRepository } from '../lib/ahspRepository'
import { assertSupabase } from '../lib/supabaseClient'

/**
 * Calculate AHSP price for a single item in a Web Worker.
 */
export async function calculateAHSPPriceInWorker(
    ahspItem: AHSPItem,
    components: AHSPComponent[]
) {
    const payload = {
        ahspId: ahspItem.id,
        components: components.map(c => ({
            coefficient: c.coefficient,
            unitPrice: c.unitPrice,
            type: c.type,
        })),
        overheadPercent: ahspItem.overheadPercentage,
        profitPercent: ahspItem.profitPercentage
    }

    return runCalculation('calculateAHSPPrice', payload)
}

/**
 * Calculate AHSP price for a single item — uses main-thread calculation
 * for responsiveness on single-item updates.
 */
export function calculateSingleAHSPPrice(
    ahspItem: AHSPItem,
    components: AHSPComponent[]
) {
    return calcAHSPPriceSync({
        components: components.map(c => ({
            coefficient: c.coefficient,
            unitPrice: c.unitPrice,
            type: c.type,
        })),
        overheadPercent: ahspItem.overheadPercentage,
        profitPercent: ahspItem.profitPercentage
    })
}

/**
 * Recalculate ALL AHSP prices in a Web Worker (off main thread).
 * Returns an array of { ahspId, result } for the store to apply.
 */
export async function recalculateAllInWorker(
    ahspItems: AHSPItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>
) {
    const payload = {
        items: ahspItems.map(item => ({
            ahspId: item.id,
            components: (componentsByAHSP[item.id] || []).map(c => ({
                coefficient: c.coefficient,
                unitPrice: c.unitPrice,
                type: c.type,
            })),
            overheadPercent: item.overheadPercentage,
            profitPercent: item.profitPercentage,
        }))
    }

    try {
        const results = await runCalculation<Array<{
            ahspId: string
            result: {
                componentBreakdown: { breakdown: { material: number; labor: number; equipment: number; subcontractor: number }; subtotal: number }
                priceBreakdown: { basePrice: number; finalPrice: number }
            }
        }>>('recalculateAll', payload)

        return results
    } catch (error) {
        // Fallback: calculate on main thread if worker fails
        console.warn('[ahspService] Worker recalculation failed, falling back to main thread:', error)
        return ahspItems.map(item => ({
            ahspId: item.id,
            result: calculateSingleAHSPPrice(item, componentsByAHSP[item.id] || [])
        }))
    }
}

/**
 * Prepare import data — transforms raw import items into domain models.
 */
type AhspImportItem = Partial<AHSPItem> & { components?: Array<{ code?: string; name?: string; price?: number; unitPrice?: number; category?: string; type?: string; unit?: string; coefficient?: number }> }

export function prepareImportData(
    items: AhspImportItem[],
    existingResources: Resource[]
) {
    const newItems: AHSPItem[] = []
    const allNewComponents: AHSPComponent[] = []
    const allNewResources: Resource[] = []
    const resourceMap = new Map<string, string>()

    items.forEach(item => {
        const newItemId = generateId('ahsp')
        const newItem: AHSPItem = {
            ...item,
            id: newItemId,
            code: item.code || '',
            name: item.name || '',
            unit: (item.unit || 'unit') as import('../types/ahsp').ResourceUnit,
            category: item.category || '',
            basePrice: item.basePrice || 0,
            finalPrice: item.finalPrice || 0,
            isActive: item.isActive !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        newItems.push(newItem)

        if (item.components && Array.isArray(item.components)) {
            item.components.forEach((comp) => {
                const type = normalizeImportType(comp.category || comp.type || 'material')

                const resCode = comp.code || generateId('res-code').substring(0, 8)
                let resourceId = resourceMap.get(resCode)

                if (!resourceId) {
                    const existingRes = existingResources.find(r => r.code === resCode)
                    if (existingRes) {
                        resourceId = existingRes.id
                    } else {
                        const resPrice = Number(comp.price || comp.unitPrice || 0)
                        const validResPrice = isNaN(resPrice) ? 0 : resPrice

                        resourceId = `res-${resCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
                        allNewResources.push({
                            id: resourceId,
                            code: resCode,
                            name: comp.name || 'Unknown Resource',
                            type,
                            unit: (comp.unit || 'unit') as import('../types/ahsp').ResourceUnit,
                            unitPrice: validResPrice,
                            isActive: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        })
                        resourceMap.set(resCode, resourceId)
                    }
                }

                const price = Number(comp.price || comp.unitPrice || 0)
                const validPrice = isNaN(price) ? 0 : price
                const coeff = Number(comp.coefficient || 0)
                const validCoeff = isNaN(coeff) ? 0 : coeff

                allNewComponents.push({
                    id: generateId('comp'),
                    ahspId: newItemId,
                    resourceId: resourceId!,
                    type,
                    coefficient: validCoeff,
                    unit: (comp.unit || 'unit') as import('../types/ahsp').ResourceUnit,
                    unitPrice: validPrice,
                    subtotal: validCoeff * validPrice,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            })
        }
    })

    // Group components and calculate split costs
    const componentsByAHSP: Record<string, AHSPComponent[]> = {}
    newItems.forEach(item => {
        const itemComponents = allNewComponents.filter(c => c.ahspId === item.id)
        componentsByAHSP[item.id] = itemComponents

        item.price_material = itemComponents.filter(c => c.type === 'material').reduce((sum, c) => sum + c.subtotal, 0)
        item.price_labor = itemComponents.filter(c => c.type === 'labor').reduce((sum, c) => sum + c.subtotal, 0)
        item.price_equipment = itemComponents.filter(c => c.type === 'equipment').reduce((sum, c) => sum + c.subtotal, 0)
        item.price_subcon = itemComponents
            .filter(c => ((c.type as string) === 'subcontractor' || (c.type as string) === 'subcon'))
            .reduce((sum, c) => sum + c.subtotal, 0)
    })

    return { newItems, allNewResources, allNewComponents, componentsByAHSP }
}

/**
 * Initialize a new AHSP Item with defaults.
 */
export function initializeAHSPItem(
    data: Partial<AHSPItem>,
    defaults: { overhead: number, profit: number }
): AHSPItem {
    return {
        ...data,
        id: data.id || generateId('ahsp'),
        code: data.code || '',
        name: data.name || '',
        unit: (data.unit || 'unit') as import('../types/ahsp').ResourceUnit,
        category: data.category || '',
        subcategory: data.subcategory ?? '',
        basePrice: data.basePrice ?? 0,
        finalPrice: data.finalPrice ?? 0,
        isActive: data.isActive ?? true,
        overheadPercentage: data.overheadPercentage ?? defaults.overhead,
        profitPercentage: data.profitPercentage ?? defaults.profit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        price_material: data.price_material ?? 0,
        price_labor: data.price_labor ?? 0,
        price_equipment: data.price_equipment ?? 0,
        price_subcon: data.price_subcon ?? 0,
    }
}

/**
 * Initialize a new AHSP Component with defaults.
 */
export function initializeAHSPComponent(
    ahspId: string,
    data: Partial<AHSPComponent>,
    resources: Resource[] = []
): AHSPComponent {
    const resource = resources.find(r => r.id === data.resourceId)
    const coeff = Number(data.coefficient || 0)
    const unitPrice = data.unitPrice ?? resource?.unitPrice ?? 0
    const unit = data.unit ?? resource?.unit ?? 'unit'

    return {
        ...data,
        id: generateId('comp'),
        ahspId,
        type: (data.type || 'material') as import('../types/ahsp').ResourceType,
        resourceId: data.resourceId || '',
        unit: (unit || 'unit') as import('../types/ahsp').ResourceUnit,
        unitPrice,
        coefficient: coeff,
        subtotal: coeff * unitPrice,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
}

/**
 * Convert domain models to Supabase row format for bulk import.
 */
export function toSupabaseRows(
    items: AHSPItem[],
    resources: Resource[],
    components: AHSPComponent[]
): {
    ahspRows: AhspItemRow[]
    resourceRows: ResourceRow[]
    componentRows: AhspComponentRow[]
} {
    const ahspRows: AhspItemRow[] = items.map(item => ({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        category: item.category || 'Imported',
        subcategory: item.subcategory || '',
        base_price: item.basePrice,
        final_price: item.finalPrice,
        overhead_percentage: item.overheadPercentage || 0,
        profit_percentage: item.profitPercentage || 0,
        price_material: item.price_material || 0,
        price_labor: item.price_labor || 0,
        price_equipment: item.price_equipment || 0,
        price_subcon: item.price_subcon || 0,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
    }))

    const resourceRows: ResourceRow[] = resources.map(res => ({
        id: res.id,
        code: res.code,
        name: res.name,
        type: toDbResourceType(res.type),
        unit: res.unit,
        unit_price: res.unitPrice,
        is_active: true,
        created_at: res.createdAt,
        updated_at: res.updatedAt,
    }))

    const componentRows: AhspComponentRow[] = components.map(comp => ({
        id: comp.id,
        ahsp_id: comp.ahspId,
        resource_id: comp.resourceId,
        type: toDbResourceType(comp.type),
        coefficient: comp.coefficient,
        unit: comp.unit,
        unit_price: comp.unitPrice,
        subtotal: comp.subtotal,
        created_at: comp.createdAt,
        updated_at: comp.updatedAt,
    }))

    return { ahspRows, resourceRows, componentRows }
}

/**
 * AHSP Service - Data Orchestration Methods
 */
export const ahspDataService = {
    async fetchAllResources() {
        return ahspRepository.fetchAllResources()
    },

    async fetchAllAHSPItems() {
        const { data: allItems, error } = await ahspRepository.fetchAllAHSPItems()
        if (error) return { data: [], error }

        const logByAhspId = await ahspRepository.fetchCreationLogs(allItems.map(i => i.id))
        const itemsWithLogs: AHSPItem[] = allItems.map((item) => {
            const log = logByAhspId.get(item.id)
            if (!log) return item
            return {
                ...item,
                creationMode: log.creation_mode as 'sni' | 'custom' | 'historical',
                sourceReference: log.source_reference || undefined,
            }
        })
        return { data: itemsWithLogs, error: null }
    },

    async addResource(resource: Partial<Resource>) {
        const newResource: Resource = {
            id: generateId('res'),
            code: resource.code || '',
            name: resource.name || '',
            type: resource.type || 'material',
            unit: resource.unit || 'm',
            unitPrice: resource.unitPrice || 0,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...resource
        }
        ahspRepository.syncResource(newResource)
        return newResource
    },

    async deleteResource(id: string, componentsByAHSP: Record<string, AHSPComponent[]>) {
        const isUsed = Object.values(componentsByAHSP)
            .flat()
            .some(component => component.resourceId === id)

        if (isUsed) {
            throw new Error('Cannot delete resource that is used in AHSP components')
        }
        ahspRepository.deleteResource(id)
    },

    async updateAHSPItemWithHistory(id: string, updates: Partial<AHSPItem>, oldItem?: AHSPItem, skipSync = false) {
        const updatedItem = {
            ...oldItem,
            ...updates,
            updatedAt: new Date().toISOString(),
            currentVersion: (oldItem?.currentVersion ?? 1) + 1,
        } as AHSPItem

        if (!skipSync) {
            ahspRepository.syncAHSPItem(updatedItem)
        }

        // Version History Record (Async)
        void (async () => {
            try {
                const client = assertSupabase()
                await client
                    .from('ahsp_items')
                    .update({ current_version: updatedItem.currentVersion ?? 1 })
                    .eq('id', id)

                await ahspRepository.insertPriceHistory({
                    ahspId: id,
                    zoneId: null,
                    oldPrice: oldItem?.basePrice ?? null,
                    newPrice: updatedItem.basePrice,
                    overheadPercentage: updatedItem.overheadPercentage ?? null,
                    profitPercentage: updatedItem.profitPercentage ?? null,
                    priceMaterial: updatedItem.price_material ?? null,
                    priceLabor: updatedItem.price_labor ?? null,
                    priceEquipment: updatedItem.price_equipment ?? null,
                    priceSubcon: updatedItem.price_subcon ?? null,
                    versionNumber: updatedItem.currentVersion ?? 1,
                    changeType: 'UPDATE',
                })
            } catch (err) {
                console.warn('[AHSP] Version history sync failed:', err)
            }
        })()

        return updatedItem
    },

    async saveCreationLog(log: {
        ahsp_id: string
        creation_mode: 'sni' | 'custom' | 'historical'
        source_reference?: string
        created_by?: string
        metadata?: unknown
    }) {
        const client = assertSupabase()
        const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        return client.from('ahsp_creation_logs').insert({
            id,
            ...log,
            created_at: new Date().toISOString()
        })
    }
}
