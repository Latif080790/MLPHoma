/**
 * rapProfitService.ts
 * FASE 3.3: RAP "Profit First" Logic
 *
 * The masterplan specifies that RAP should use a "Profit First" approach:
 * - Project defines target_profit_pct (e.g., 15%)
 * - RAP budget per item = RAB price × (1 - target_profit_pct / 100)
 * - If actual_cost ≈ RAP budget → margin preserved
 * - If actual_cost > RAP budget → warning (margin erosion)
 * - RAP dashboard shows real-time profit health per WBS
 *
 * Uses project.target_profit_pct set in Settings → Project Configuration.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { notificationService } from './notificationService'

// ---------- Types ----------

export interface ProfitHealthItem {
    wbsId: string
    wbsName: string
    rabTotal: number          // Owner's estimate
    rapBudget: number         // Internal budget (RAB × (1 - profit%))
    actualCost: number
    committedCost: number
    profitTarget: number      // Expected profit = RAB - RAP
    profitActual: number      // Actual profit = RAB - actual_cost
    profitPctActual: number   // Actual profit %
    healthStatus: 'healthy' | 'warning' | 'critical' | 'loss'
}

export interface ProjectProfitSummary {
    targetProfitPct: number
    totalRab: number
    totalRapBudget: number
    totalActualCost: number
    totalCommittedCost: number
    projectedProfit: number       // RAB - (actual + committed remaining)
    projectedProfitPct: number
    items: ProfitHealthItem[]
    warningCount: number
    criticalCount: number
}

// ---------- Service ----------

export const rapProfitService = {

    /**
     * Get the project's target profit percentage.
     * Defaults to 10% if not configured.
     */
    async getTargetProfitPct(projectId: string): Promise<number> {
        const client = assertSupabase()
        const { data } = await client
            .from('projects')
            .select('target_profit_pct')
            .eq('id', projectId)
            .single()

        return Number(data?.target_profit_pct) || 10
    },

    /**
     * Set the project's target profit percentage
     */
    async setTargetProfitPct(projectId: string, pct: number): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('projects')
            .update({ target_profit_pct: pct })
            .eq('id', projectId)

        if (error) throw error
    },

    /**
     * Initialize or recalculate RAP items based on Profit First approach.
     * RAP budget = RAB price × (1 - profitPct / 100)
     */
    async recalculateWithProfitFirst(projectId: string): Promise<number> {
        const client = assertSupabase()

        const profitPct = await this.getTargetProfitPct(projectId)
        const multiplier = 1 - (profitPct / 100)

        // Get all RAP items with their RAB reference
        const { data: rapItems, error } = await client
            .from('rap_items')
            .select('id, rab_item_id, total_budget')
            .eq('project_id', projectId)

        if (error) throw error

        let updatedCount = 0

        for (const rap of (rapItems || [])) {
            if (!rap.rab_item_id) continue

            // Get linked RAB item's owner price
            const { data: rabItem } = await client
                .from('rab_items')
                .select('total_price, final_total, volume, unit_price')
                .eq('id', rap.rab_item_id)
                .single()

            if (!rabItem) continue

            const rabTotal = Number(rabItem.total_price || rabItem.final_total || 0)
            const rapBudget = rabTotal * multiplier

            const { error: updateErr } = await client
                .from('rap_items')
                .update({ total_budget: rapBudget })
                .eq('id', rap.id)

            if (!updateErr) updatedCount++
        }

        return updatedCount
    },

    /**
     * Get comprehensive profit health dashboard data.
     */
    async getProfitHealth(projectId: string): Promise<ProjectProfitSummary> {
        const client = assertSupabase()

        const profitPct = await this.getTargetProfitPct(projectId)

        // Get RAP items with WBS and RAB info
        const { data: rapItems, error } = await client
            .from('rap_items')
            .select(`
                id,
                wbs_id,
                rab_item_id,
                total_budget,
                actual_cost,
                committed_cost,
                wbs_items ( name, code ),
                rab_items ( total_price, final_total )
            `)
            .eq('project_id', projectId)

        if (error) {
            console.warn('[rapProfit] getProfitHealth error:', error.message)
            return {
                targetProfitPct: profitPct,
                totalRab: 0,
                totalRapBudget: 0,
                totalActualCost: 0,
                totalCommittedCost: 0,
                projectedProfit: 0,
                projectedProfitPct: 0,
                items: [],
                warningCount: 0,
                criticalCount: 0,
            }
        }

        const items: ProfitHealthItem[] = []
        let totalRab = 0
        let totalRapBudget = 0
        let totalActualCost = 0
        let totalCommittedCost = 0
        let warningCount = 0
        let criticalCount = 0

        for (const rap of (rapItems || [])) {
            const wbs = (rap as any).wbs_items
            const rab = (rap as any).rab_items
            const rabTotal = Number(rab?.total_price || rab?.final_total || 0)
            const rapBudget = Number(rap.total_budget || 0)
            const actualCost = Number(rap.actual_cost || 0)
            const committedCost = Number(rap.committed_cost || 0)

            const profitTarget = rabTotal - rapBudget
            const profitActual = rabTotal - actualCost
            const profitPctActual = rabTotal > 0 ? (profitActual / rabTotal) * 100 : 0

            let healthStatus: ProfitHealthItem['healthStatus'] = 'healthy'
            if (profitPctActual < 0) {
                healthStatus = 'loss'
                criticalCount++
            } else if (profitPctActual < profitPct * 0.5) {
                healthStatus = 'critical'
                criticalCount++
            } else if (profitPctActual < profitPct * 0.8) {
                healthStatus = 'warning'
                warningCount++
            }

            items.push({
                wbsId: rap.wbs_id || '',
                wbsName: wbs?.name || 'Unlinked',
                rabTotal,
                rapBudget,
                actualCost,
                committedCost,
                profitTarget,
                profitActual,
                profitPctActual,
                healthStatus,
            })

            totalRab += rabTotal
            totalRapBudget += rapBudget
            totalActualCost += actualCost
            totalCommittedCost += committedCost
        }

        const projectedProfit = totalRab - totalActualCost - (totalCommittedCost - totalActualCost)
        const projectedProfitPct = totalRab > 0 ? (projectedProfit / totalRab) * 100 : 0

        // Auto-notify if profit margin is eroding
        if (projectedProfitPct < profitPct * 0.7 && items.length > 0) {
            try {
                await notificationService.notifyByRole(projectId, 'manager', {
                    type: 'BUDGET_WARNING',
                    title: `⚠️ Profit Margin Erosion: ${projectedProfitPct.toFixed(1)}%`,
                    message: `Target profit ${profitPct}% namun projected hanya ${projectedProfitPct.toFixed(1)}%. ${criticalCount} item kritis. Review RAP segera.`,
                    severity: projectedProfitPct < 0 ? 'critical' : 'warning',
                    projectId,
                    metadata: { projectedProfitPct, criticalCount },
                })
            } catch (e) {
                console.warn('Notification failed:', e)
            }
        }

        return {
            targetProfitPct: profitPct,
            totalRab,
            totalRapBudget,
            totalActualCost,
            totalCommittedCost,
            projectedProfit,
            projectedProfitPct,
            items,
            warningCount,
            criticalCount,
        }
    },
}
