/**
 * resourcePlanService.ts
 * Task 43: Service layer for computing resource needs from RAB × AHSP.
 * Extracted from inline logic in ResourcePlan.tsx for reuse and testability.
 *
 * G11/G12 Fix: Added computeResourceNeedsFromRAP that uses RapItem[] (not RABItem[])
 * so ResourcePlan reads from the correct data source (RAP, not RAB).
 */

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

        // Compute AHSP-selling-price total for this item, then scale to RAP budget
        // so resource costs reflect execution cost (unit_price_budget), not AHSP selling price
        const ahspSellingTotal = components.reduce((sum, comp) => {
            const res = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!res) return sum
            return sum + comp.coefficient * (comp.unitPrice || res.unitPrice || 0)
        }, 0)
        const rapBudgetPerUnit = rapItem.unit_price_budget || 0
        const costScaling = ahspSellingTotal > 0 && rapBudgetPerUnit > 0
            ? rapBudgetPerUnit / ahspSellingTotal
            : 1

        for (const comp of components) {
            if (!comp.resource && !comp.resourceId) continue
            const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!resource) continue

            const rawPrice = comp.unitPrice || resource.unitPrice || 0
            const scaledPrice = rawPrice * costScaling
            const needed = comp.coefficient * volume
            const cost = needed * scaledPrice

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
                    unitPrice: scaledPrice,
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

        // Scale AHSP component prices to RAP budget (unit_price_budget) level
        // so that Σ(resource costs for this item) = rapItem.total_budget (RAP cost, not AHSP selling price)
        const ahspSellingTotal = components.reduce((sum, comp) => {
            const res = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!res) return sum
            return sum + comp.coefficient * (comp.unitPrice || res.unitPrice || 0)
        }, 0)
        const rapBudgetPerUnit = rapItem.unit_price_budget || 0
        const costScaling = ahspSellingTotal > 0 && rapBudgetPerUnit > 0
            ? rapBudgetPerUnit / ahspSellingTotal
            : 1

        for (const comp of components) {
            if (!comp.resource && !comp.resourceId) continue
            const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
            if (!resource) continue

            const rawPrice = comp.unitPrice || resource.unitPrice || 0
            const effectivePrice = rawPrice * costScaling
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

/**
 * Returns the ISO 8601 week key (e.g. "2024-W03") for a UTC date.
 * Uses the standard algorithm: week 1 is the week containing the first Thursday.
 * This must match the decoder in ResourcePlan.tsx getPeriodStartDate('week').
 */
function toISOWeekKey(d: Date): string {
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dayNum = utc.getUTCDay() || 7  // Sunday = 7
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)  // shift to Thursday of the same week
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
    const weekNum = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${utc.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
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
            // Inclusive day count: Jan1..Jan5 = 5 days, Jan1..Jan1 = 1 day
            const totalDays = Math.max(1, Math.round(diffMs / 86400000) + 1)

            const costPerDay = totalCost / totalDays
            const volPerDay = totalVolume / totalDays

            for (let i = 0; i < totalDays; i++) {
                const d = new Date(startDate)
                d.setUTCDate(d.getUTCDate() + i)

                let key = ''
                if (periodType === 'day') {
                    key = d.toISOString().split('T')[0]
                } else if (periodType === 'week') {
                    key = toISOWeekKey(d)
                } else {
                    key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
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
