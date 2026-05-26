/**
 * baselineService.ts
 *
 * RAB Baseline Snapshot Engine.
 * Freezes the current RAB state as a baseline when project execution begins.
 * Supports comparison between baseline and current items to detect variance.
 *
 * Storage: Supabase (rab_baselines table) — persistent across devices/sessions
 */

import { useRabStore } from '../store/rabStore'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { useAuthStore } from '../store/authStore'
import { assertSupabase } from '../lib/supabaseClient'

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

// ─── Service ───

export const baselineService = {

    /**
     * Freeze the current RAB as baseline for a project.
     * Only one baseline per project (upserts previous).
     */
    async freezeBaseline(projectId: string, name?: string): Promise<BaselineSnapshot> {
        const client = assertSupabase()
        const rabItems = useRabStore.getState().getItems(projectId)

        const baselineItems: BaselineItem[] = rabItems.map(item => ({
            id: item.id,
            name: item.name || item.item_name || '',
            unit: item.unit || '-',
            volume: item.volume || 0,
            unitPrice: item.unit_price || 0,
            totalPrice: (item.volume || 0) * (item.unit_price || 0),
            category: String(item.category || ''),
            code: item.code,
            isOverhead: item.is_overhead,
        }))

        const totalCost = baselineItems.reduce((sum, i) => sum + i.totalPrice, 0)
        const now = new Date().toISOString()

        const snapshot: BaselineSnapshot = {
            id: generateId('bsl'),
            projectId,
            name: name || `Baseline ${new Date().toLocaleDateString('id-ID')}`,
            frozenAt: now,
            itemCount: baselineItems.length,
            totalCost,
            items: baselineItems,
        }

        const { error } = await client
            .from('rab_baselines')
            .upsert({
                id: snapshot.id,
                project_id: projectId,
                name: snapshot.name,
                frozen_at: now,
                item_count: snapshot.itemCount,
                total_cost: totalCost,
                items: baselineItems,
                updated_at: now,
            }, { onConflict: 'project_id' })

        if (error) throw error

        // Log audit
        const { user, profile } = useAuthStore.getState()
        await auditService.log({
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
    async getBaseline(projectId: string): Promise<BaselineSnapshot | null> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('rab_baselines')
            .select('*')
            .eq('project_id', projectId)
            .maybeSingle()

        if (error) {
            console.warn('[baseline] getBaseline error:', error.message)
            return null
        }
        if (!data) return null

        return {
            id: data.id,
            projectId: data.project_id,
            name: data.name,
            frozenAt: data.frozen_at,
            itemCount: data.item_count,
            totalCost: data.total_cost,
            items: (data.items as BaselineItem[]) || [],
        }
    },

    /**
     * Check if a project has a frozen baseline.
     */
    async hasBaseline(projectId: string): Promise<boolean> {
        const client = assertSupabase()
        const { count } = await client
            .from('rab_baselines')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
        return (count ?? 0) > 0
    },

    /**
     * Compare current RAB items against the frozen baseline.
     */
    async compareToBaseline(projectId: string): Promise<BaselineComparison | null> {
        const baseline = await this.getBaseline(projectId)
        if (!baseline) return null

        const currentItems = useRabStore.getState().getItems(projectId)
        const variances: BaselineVariance[] = []

        const baselineMap = new Map(baseline.items.map(i => [i.id, i]))
        const currentMap = new Map(currentItems.map(i => [i.id, i]))

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
            const isUnchanged = Math.abs(totalChange) < 1

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
     * Delete the baseline for a project.
     */
    async deleteBaseline(projectId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('rab_baselines')
            .delete()
            .eq('project_id', projectId)
        if (error) throw error
    },
}
