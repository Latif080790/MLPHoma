/**
 * resourcePlanService.ts
 * Task 43: Service layer for computing resource needs from RAB × AHSP.
 * Extracted from inline logic in ResourcePlan.tsx for reuse and testability.
 */

import type { RABItem } from '../types/rab'
import type { AHSPComponent, Resource, ResourceType } from '../types/ahsp'

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
 */
export function computeResourceNeeds(
    rabItems: RABItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>,
    resources: Resource[],
): ResourceNeed[] {
    const map = new Map<string, ResourceNeed>()

    for (const rabItem of rabItems) {
        const volume = rabItem.volume || 0
        if (volume === 0) continue

        // Look for AHSP link
        const ahspItemId = rabItem.ahspItemId || rabItem.ahsp_item_id
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
 */
export function computeResourceStats(
    needs: ResourceNeed[],
    rabItems: RABItem[],
): ResourcePlanStats {
    const TYPE_ORDER: ResourceType[] = ['material', 'labor', 'equipment', 'subcontractor']

    const byType = TYPE_ORDER.reduce((acc, t) => {
        acc[t] = needs
            .filter(r => r.resourceType === t)
            .reduce((s, r) => s + r.totalCost, 0)
        return acc
    }, {} as Record<ResourceType, number>)

    const totalCost = needs.reduce((s, r) => s + r.totalCost, 0)
    const linkedCount = rabItems.filter(i => !!(i.ahspItemId || i.ahsp_item_id)).length

    return { byType, totalCost, linkedCount, totalRab: rabItems.length }
}
