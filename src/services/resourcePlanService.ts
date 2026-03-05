/**
 * resourcePlanService.ts
 * Task 43: Service layer for computing resource needs from RAB × AHSP.
 * Extracted from inline logic in ResourcePlan.tsx for reuse and testability.
 *
 * G11/G12 Fix: Added computeResourceNeedsFromRAP that uses RapItem[] (not RABItem[])
 * so ResourcePlan reads from the correct data source (RAP, not RAB).
 */

import type { RABItem } from '../types/rab'
import type { RapItem } from './rapService'
import type { AHSPComponent, AHSPItem, Resource, ResourceType } from '../types/ahsp'

// ── Types ─────────────────────────────────────────────────────
export interface ResourceNeed {
    resourceId: string
    resourceCode: string
    resourceName: string
    resourceType: ResourceType
    unit: string
    unitPrice: number
    totalVolume: number
    totalCost: number
}

export interface ResourcePlanStats {
    byType: Record<ResourceType, number>
    totalCost: number
    linkedCount: number
    totalRab: number
}

// ── Core computation ──────────────────────────────────────────

/**
 * Compute resource needs from RAB items × AHSP components × resources.
 * Returns sorted by totalCost descending.
 * @param ahspItems  Optional — used for code-based auto-matching when ahspItemId is not set on RAB item.
 */
export function computeResourceNeeds(
    rabItems: RABItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>,
    resources: Resource[],
    ahspItems?: AHSPItem[],
): ResourceNeed[] {
    const map = new Map<string, ResourceNeed>()

    // Build code → AHSP id map for auto-matching when ahspItemId is missing
    const ahspByCode = new Map<string, string>()
    if (ahspItems) {
        ahspItems.forEach(a => { if (a.code) ahspByCode.set(a.code, a.id) })
    }

    for (const rabItem of rabItems) {
        const volume = rabItem.volume || 0
        if (volume === 0) continue

        // Explicit link first, then fall back to item_code → AHSP code matching
        const ahspItemId =
            rabItem.ahspItemId ||
            rabItem.ahsp_item_id ||
            ahspByCode.get(rabItem.item_code || rabItem.itemCode || rabItem.code || '')

        if (!ahspItemId) continue

        const components = componentsByAHSP[ahspItemId] || []
        for (const comp of components) {
            if (!comp.resource && !comp.resourceId) continue
            const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!resource) continue

            const needed = comp.coefficient * volume
            const cost = needed * (resource.unitPrice || comp.unitPrice || 0)

            const existing = map.get(resource.id)
            if (existing) {
                existing.totalVolume += needed
                existing.totalCost += cost
            } else {
                map.set(resource.id, {
                    resourceId: resource.id,
                    resourceCode: resource.code,
                    resourceName: resource.name,
                    resourceType: resource.type,
                    unit: resource.unit,
                    unitPrice: resource.unitPrice || comp.unitPrice || 0,
                    totalVolume: needed,
                    totalCost: cost,
                })
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Compute summary statistics from resource needs.
 * @param ahspItems  Optional — used for code-based matching to accurately count linked items.
 */
export function computeResourceStats(
    needs: ResourceNeed[],
    rabItems: RABItem[],
    ahspItems?: AHSPItem[],
): ResourcePlanStats {
    const TYPE_ORDER: ResourceType[] = ['material', 'labor', 'equipment', 'subcontractor']

    const byType = TYPE_ORDER.reduce((acc, t) => {
        acc[t] = needs
            .filter(r => r.resourceType === t)
            .reduce((s, r) => s + r.totalCost, 0)
        return acc
    }, {} as Record<ResourceType, number>)

    const totalCost = needs.reduce((s, r) => s + r.totalCost, 0)

    // Build code → id map for auto-matching
    const codeMap = new Map<string, string>()
    if (ahspItems) {
        ahspItems.forEach(a => { if (a.code) codeMap.set(a.code, a.id) })
    }

    const linkedCount = rabItems.filter(i =>
        !!(i.ahspItemId || i.ahsp_item_id ||
            codeMap.get(i.item_code || i.itemCode || i.code || ''))
    ).length

    return { byType, totalCost, linkedCount, totalRab: rabItems.length }
}

// ── RAP-based variants (G11/G12 fix) ─────────────────────────

/**
 * Compute resource needs from RAP items × AHSP components × resources.
 * Uses RapItem.qty_budget as volume and RapItem.ahsp_id as AHSP key.
 * This is the authoritative function for ResourcePlan module.
 */
export function computeResourceNeedsFromRAP(
    rapItems: RapItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>,
    resources: Resource[],
): ResourceNeed[] {
    const map = new Map<string, ResourceNeed>()

    for (const rapItem of rapItems) {
        const volume = rapItem.qty_budget || 0
        if (volume === 0) continue

        const ahspId = rapItem.ahsp_id
        if (!ahspId) continue

        const components = componentsByAHSP[ahspId] || []
        for (const comp of components) {
            if (!comp.resource && !comp.resourceId) continue
            const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!resource) continue

            const needed = comp.coefficient * volume
            const cost = needed * (resource.unitPrice || comp.unitPrice || 0)

            const existing = map.get(resource.id)
            if (existing) {
                existing.totalVolume += needed
                existing.totalCost += cost
            } else {
                map.set(resource.id, {
                    resourceId: resource.id,
                    resourceCode: resource.code,
                    resourceName: resource.name,
                    resourceType: resource.type,
                    unit: resource.unit,
                    unitPrice: resource.unitPrice || comp.unitPrice || 0,
                    totalVolume: needed,
                    totalCost: cost,
                })
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Compute summary statistics from RAP-based resource needs.
 */
export function computeResourceStatsFromRAP(
    needs: ResourceNeed[],
    rapItems: RapItem[],
): ResourcePlanStats {
    const TYPE_ORDER: ResourceType[] = ['material', 'labor', 'equipment', 'subcontractor']

    const byType = TYPE_ORDER.reduce((acc, t) => {
        acc[t] = needs
            .filter(r => r.resourceType === t)
            .reduce((s, r) => s + r.totalCost, 0)
        return acc
    }, {} as Record<ResourceType, number>)

    const totalCost = needs.reduce((s, r) => s + r.totalCost, 0)
    const linkedCount = rapItems.filter(i => !!i.ahsp_id).length

    return { byType, totalCost, linkedCount, totalRab: rapItems.length }
}
