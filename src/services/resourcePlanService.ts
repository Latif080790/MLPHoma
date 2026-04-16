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
            const cost = needed * (comp.unitPrice || resource.unitPrice || 0)

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
                    unitPrice: comp.unitPrice || resource.unitPrice || 0,
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

// ── Audit Trail Types ─────────────────────────────────────────

/** One RAP item's contribution to a resource's total */
export interface ResourceTraceItem {
    rapItemId: string
    rapItemName: string
    wbsName?: string
    ahspCode?: string
    coefficient: number
    qty: number
    volumeContrib: number
    costContrib: number
}

/** ResourceNeed extended with drill-down audit trail */
export interface ResourceNeedWithTrace extends ResourceNeed {
    traceItems: ResourceTraceItem[]
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
            const cost = needed * (comp.unitPrice || resource.unitPrice || 0)

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
                    unitPrice: comp.unitPrice || resource.unitPrice || 0,
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

/**
 * Compute resource needs WITH full audit trail (drill-down per RAP item contribution).
 * Each ResourceNeedWithTrace.traceItems shows which RAP items contribute and how much.
 */
export function computeResourceNeedsFromRAPWithTrace(
    rapItems: RapItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>,
    resources: Resource[],
    ahspCodeMap?: Map<string, string>, // ahsp_id -> ahsp_code, for display
    wbsNameMap?: Map<string, string>,  // wbs_id -> wbs name, for display
): ResourceNeedWithTrace[] {
    const map = new Map<string, ResourceNeedWithTrace>()

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

            const effectivePrice = comp.unitPrice || resource.unitPrice || 0
            const needed = comp.coefficient * volume
            const cost = needed * effectivePrice

            const traceItem: ResourceTraceItem = {
                rapItemId: rapItem.id,
                rapItemName: rapItem.name || rapItem.id,
                wbsName: rapItem.wbs_id ? wbsNameMap?.get(rapItem.wbs_id) : undefined,
                ahspCode: ahspCodeMap?.get(ahspId),
                coefficient: comp.coefficient,
                qty: volume,
                volumeContrib: needed,
                costContrib: cost,
            }

            const existing = map.get(resource.id)
            if (existing) {
                existing.totalVolume += needed
                existing.totalCost += cost
                existing.traceItems.push(traceItem)
            } else {
                map.set(resource.id, {
                    resourceId: resource.id,
                    resourceCode: resource.code,
                    resourceName: resource.name,
                    resourceType: resource.type,
                    unit: resource.unit,
                    unitPrice: effectivePrice,
                    totalVolume: needed,
                    totalCost: cost,
                    traceItems: [traceItem],
                })
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Build month-keyed schedule with per-WBS traceability.
 * Returns Map<monthKey, { type breakdown, list of contributions }>
 */
export interface ScheduleMonthEntry {
    month: string
    label: string
    material: number
    labor: number
    equipment: number
    subcontractor: number
    total: number
    traces: Array<{
        rapItemId: string
        rapItemName: string
        wbsName?: string
        resourceName: string
        resourceType: ResourceType
        unit: string
        volumeContrib: number
        costContrib: number
    }>
}

export function computeArrivalScheduleWithTrace(
    rapItems: RapItem[],
    componentsByAHSP: Record<string, AHSPComponent[]>,
    resources: Resource[],
    taskByRabId: Map<string, { start: string; end: string; wbsName?: string }>,
    periodType: 'day' | 'week' | 'month' = 'month'
): ScheduleMonthEntry[] {
    const buckets = new Map<string, Omit<ScheduleMonthEntry, 'label'>>()

    for (const rapItem of rapItems) {
        const volume = rapItem.qty_budget || 0
        if (volume === 0) continue
        const task = rapItem.rab_item_id ? taskByRabId.get(rapItem.rab_item_id) : undefined
        if (!task) continue
        const ahspId = rapItem.ahsp_id
        if (!ahspId) continue

        const components = componentsByAHSP[ahspId] || []
        for (const comp of components) {
            if (!comp.resource && !comp.resourceId) continue
            const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!resource) continue

            const effectivePrice = comp.unitPrice || resource.unitPrice || 0
            const totalCost = comp.coefficient * volume * effectivePrice
            const totalVolume = comp.coefficient * volume

            const startDate = new Date(task.start)
            const endDate = new Date(task.end)
            const diffMs = endDate.getTime() - startDate.getTime()
            const totalDays = Math.max(1, Math.ceil(diffMs / 86400000))

            const costPerDay = totalCost / totalDays
            const volPerDay = totalVolume / totalDays

            for (let i = 0; i <= totalDays; i++) {
                const d = new Date(startDate)
                d.setDate(d.getDate() + i)
                if (d > endDate) break

                let key = ''
                if (periodType === 'day') {
                    key = d.toISOString().split('T')[0]
                } else if (periodType === 'week') {
                    const firstDayOfYear = new Date(d.getFullYear(), 0, 1)
                    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000
                    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
                    key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
                } else {
                    key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                }

                if (!buckets.has(key)) {
                    buckets.set(key, { month: key, material: 0, labor: 0, equipment: 0, subcontractor: 0, total: 0, traces: [] })
                }
                const b = buckets.get(key)!
                b[resource.type] = (b[resource.type] || 0) + costPerDay
                b.total += costPerDay

                // Only add trace once per item per bucket to avoid trace explosion if spanning many days
                const traceItem = b.traces.find(t => t.rapItemId === rapItem.id && t.resourceName === resource.name)
                if (traceItem) {
                    traceItem.costContrib += costPerDay
                    traceItem.volumeContrib += volPerDay
                } else {
                    b.traces.push({
                        rapItemId: rapItem.id,
                        rapItemName: rapItem.name || rapItem.id,
                        wbsName: task.wbsName,
                        resourceName: resource.name,
                        resourceType: resource.type,
                        unit: resource.unit,
                        volumeContrib: volPerDay,
                        costContrib: costPerDay,
                    })
                }
            }
        }
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, b]) => {
            let label = key
            if (periodType === 'month') {
                label = new Date(key + '-01').toLocaleDateString('id-ID', { year: '2-digit', month: 'short' })
            } else if (periodType === 'day') {
                label = new Date(key).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
            }
            return {
                ...b,
                label,
            }
        })
}
