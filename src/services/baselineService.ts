/**
 * baselineService.ts
 *
 * RAB Baseline Snapshot Engine.
 * Freezes the current RAB state as a baseline when project execution begins.
 * Supports comparison between baseline and current items to detect variance.
 *
 * Storage: localStorage (project-scoped)
 */

import { useRabStore } from '../store/rabStore'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { useAuthStore } from '../store/authStore'

// ─── Types ───

export interface BaselineSnapshot {
    id: string
    projectId: string
    name: string
    /** ISO timestamp when baseline was frozen */
    frozenAt: string
    /** Number of items in baseline */
    itemCount: number
    /** Total estimated cost at freeze */
    totalCost: number
    /** Frozen RAB items */
    items: BaselineItem[]
}

export interface BaselineItem {
    id: string
    name: string
    unit: string
    volume: number
    unitPrice: number
    totalPrice: number
    category: string
    code?: string
    isOverhead?: boolean
}

export interface BaselineVariance {
    itemId: string
    name: string
    /** Baseline values */
    baselineVolume: number
    baselineUnitPrice: number
    baselineTotal: number
    /** Current values */
    currentVolume: number
    currentUnitPrice: number
    currentTotal: number
    /** Variance */
    volumeChange: number
    priceChange: number
    totalChange: number
    totalChangePercent: number
    /** Status */
    status: 'unchanged' | 'increased' | 'decreased' | 'new' | 'removed'
}

export interface BaselineComparison {
    baseline: BaselineSnapshot
    totalBaseline: number
    totalCurrent: number
    totalVariance: number
    variancePercent: number
    items: BaselineVariance[]
    addedCount: number
    removedCount: number
    changedCount: number
    unchangedCount: number
}

// ─── Storage ───

const STORAGE_KEY = 'mlphoma:baselines'

function loadBaselines(): Record<string, BaselineSnapshot> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveBaselines(baselines: Record<string, BaselineSnapshot>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baselines))
}

// ─── Service ───

export const baselineService = {

    /**
     * Freeze the current RAB as baseline for a project.
     * Only one baseline per project (overwrites previous).
     */
    freezeBaseline(projectId: string, name?: string): BaselineSnapshot {
        const rabItems = useRabStore.getState().getItems(projectId)

        const baselineItems: BaselineItem[] = rabItems.map(item => ({
            id: item.id,
            name: item.name || item.item_name || '',
            unit: item.unit || '-',
            volume: item.volume || 0,
            unitPrice: item.unit_price || 0,
            totalPrice: (item.volume || 0) * (item.unit_price || 0),
            category: item.category || '',
            code: item.code,
            isOverhead: item.is_overhead,
        }))

        const totalCost = baselineItems.reduce((sum, i) => sum + i.totalPrice, 0)

        const snapshot: BaselineSnapshot = {
            id: generateId('bsl'),
            projectId,
            name: name || `Baseline ${new Date().toLocaleDateString('id-ID')}`,
            frozenAt: new Date().toISOString(),
            itemCount: baselineItems.length,
            totalCost,
            items: baselineItems,
        }

        // Save
        const baselines = loadBaselines()
        baselines[projectId] = snapshot
        saveBaselines(baselines)

        // Log audit
        const { user, profile } = useAuthStore.getState()
        auditService.log({
            userId: user?.id,
            userName: profile?.full_name || user?.email,
            action: 'SNAPSHOT',
            entity: 'rab_baseline',
            entityType: 'PROJECT',
            entityId: projectId,
            details: {
                baselineId: snapshot.id,
                name: snapshot.name,
                itemCount: snapshot.itemCount,
                totalCost,
            },
        })

        return snapshot
    },

    /**
     * Get the frozen baseline for a project.
     */
    getBaseline(projectId: string): BaselineSnapshot | null {
        const baselines = loadBaselines()
        return baselines[projectId] || null
    },

    /**
     * Compare current RAB items against the frozen baseline.
     */
    compareToBaseline(projectId: string): BaselineComparison | null {
        const baseline = this.getBaseline(projectId)
        if (!baseline) return null

        const currentItems = useRabStore.getState().getItems(projectId)
        const variances: BaselineVariance[] = []

        // Map baseline items by ID for quick lookup
        const baselineMap = new Map(baseline.items.map(i => [i.id, i]))
        const currentMap = new Map(currentItems.map(i => [i.id, i]))

        // Check baseline items (changed or removed)
        for (const bItem of baseline.items) {
            const cItem = currentMap.get(bItem.id)

            if (!cItem) {
                variances.push({
                    itemId: bItem.id,
                    name: bItem.name,
                    baselineVolume: bItem.volume,
                    baselineUnitPrice: bItem.unitPrice,
                    baselineTotal: bItem.totalPrice,
                    currentVolume: 0,
                    currentUnitPrice: 0,
                    currentTotal: 0,
                    volumeChange: -bItem.volume,
                    priceChange: -bItem.unitPrice,
                    totalChange: -bItem.totalPrice,
                    totalChangePercent: -100,
                    status: 'removed',
                })
                continue
            }

            const currentTotal = (cItem.volume || 0) * (cItem.unit_price || 0)
            const totalChange = currentTotal - bItem.totalPrice
            const totalChangePercent = bItem.totalPrice !== 0
                ? (totalChange / bItem.totalPrice) * 100
                : (currentTotal > 0 ? 100 : 0)

            const isUnchanged = Math.abs(totalChange) < 1 // ±Rp 1 tolerance

            variances.push({
                itemId: bItem.id,
                name: bItem.name,
                baselineVolume: bItem.volume,
                baselineUnitPrice: bItem.unitPrice,
                baselineTotal: bItem.totalPrice,
                currentVolume: cItem.volume || 0,
                currentUnitPrice: cItem.unit_price || 0,
                currentTotal,
                volumeChange: (cItem.volume || 0) - bItem.volume,
                priceChange: (cItem.unit_price || 0) - bItem.unitPrice,
                totalChange,
                totalChangePercent,
                status: isUnchanged ? 'unchanged' : totalChange > 0 ? 'increased' : 'decreased',
            })
        }

        // Check for new items (in current but not in baseline)
        for (const cItem of currentItems) {
            if (!baselineMap.has(cItem.id)) {
                const currentTotal = (cItem.volume || 0) * (cItem.unit_price || 0)
                variances.push({
                    itemId: cItem.id,
                    name: cItem.name || cItem.item_name || '',
                    baselineVolume: 0,
                    baselineUnitPrice: 0,
                    baselineTotal: 0,
                    currentVolume: cItem.volume || 0,
                    currentUnitPrice: cItem.unit_price || 0,
                    currentTotal,
                    volumeChange: cItem.volume || 0,
                    priceChange: cItem.unit_price || 0,
                    totalChange: currentTotal,
                    totalChangePercent: 100,
                    status: 'new',
                })
            }
        }

        const totalBaseline = baseline.totalCost
        const totalCurrent = variances.reduce((sum, v) => sum + v.currentTotal, 0)
        const totalVariance = totalCurrent - totalBaseline

        return {
            baseline,
            totalBaseline,
            totalCurrent,
            totalVariance,
            variancePercent: totalBaseline !== 0
                ? (totalVariance / totalBaseline) * 100
                : 0,
            items: variances,
            addedCount: variances.filter(v => v.status === 'new').length,
            removedCount: variances.filter(v => v.status === 'removed').length,
            changedCount: variances.filter(v => v.status === 'increased' || v.status === 'decreased').length,
            unchangedCount: variances.filter(v => v.status === 'unchanged').length,
        }
    },

    /**
     * Check if a project has a frozen baseline.
     */
    hasBaseline(projectId: string): boolean {
        return !!this.getBaseline(projectId)
    },

    /**
     * Delete the baseline for a project.
     */
    deleteBaseline(projectId: string): void {
        const baselines = loadBaselines()
        delete baselines[projectId]
        saveBaselines(baselines)
    },
}
