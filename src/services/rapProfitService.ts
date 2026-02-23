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

export interface EquipmentCostEntry {
    resourceId: string
    logDate: string
    status: string
    hoursUsed: number
    rentCost: number
}

export interface ProjectProfitSummary {
    targetProfitPct: number
    totalRab: number
    totalRapBudget: number
    totalActualCost: number       // RAP actual + equipment
    totalCommittedCost: number
    totalEquipmentCost: number    // From tools_usage_logs
    totalRapActualOnly: number    // RAP actual_cost only (excl equipment)
    projectedProfit: number       // RAB - (actual + committed remaining)
    projectedProfitPct: number
    items: ProfitHealthItem[]
    equipmentBreakdown: EquipmentCostEntry[]
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
            .select('id, rab_item_id, qty_budget')
            .eq('project_id', projectId)

        if (error) throw error

        let updatedCount = 0

        for (const rap of (rapItems || [])) {
            if (!rap.rab_item_id) continue

            // Get linked RAB item's owner price
            const { data: rabItem } = await client
                .from('rab_items')
                .select('final_total, volume, unit_price')
                .eq('id', rap.rab_item_id)
                .single()

            if (!rabItem) continue

            const rabTotal = Number(rabItem.final_total || 0)
            const rapBudget = rabTotal * multiplier

            // Calculate necessary unit_price_budget to achieve rapBudget
            // rap_items.total_budget = qty_budget * unit_price_budget (Generated)
            const qty = Number(rap.qty_budget) || 1
            const unitPriceBudget = rapBudget / qty

            const { error: updateErr } = await client
                .from('rap_items')
                .update({ unit_price_budget: unitPriceBudget })
                .eq('id', rap.id)

            if (!updateErr) updatedCount++
        }

        return updatedCount
    },

    /**
     * Fetch total equipment/tools rent cost from tools_usage_logs.
     */
    async getEquipmentCosts(projectId: string): Promise<{ total: number; breakdown: EquipmentCostEntry[] }> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('tools_usage_logs')
            .select('resource_id, log_date, status, hours_used, rent_cost')
            .eq('project_id', projectId)

        if (error || !data) {
            console.warn('[rapProfit] getEquipmentCosts error:', error?.message)
            return { total: 0, breakdown: [] }
        }

        const breakdown: EquipmentCostEntry[] = data.map((d: any) => ({
            resourceId: d.resource_id || '',
            logDate: d.log_date || '',
            status: d.status || 'UNKNOWN',
            hoursUsed: Number(d.hours_used || 0),
            rentCost: Number(d.rent_cost || 0),
        }))

        const total = breakdown.reduce((sum, e) => sum + e.rentCost, 0)
        return { total, breakdown }
    },

    /**
     * Get comprehensive profit health dashboard data.
     * Now includes equipment costs from tools_usage_logs in totalActualCost.
     */
    async getProfitHealth(projectId: string): Promise<ProjectProfitSummary> {
        const client = assertSupabase()

        const profitPct = await this.getTargetProfitPct(projectId)

        // Fetch equipment costs in parallel with RAP items
        const equipmentPromise = this.getEquipmentCosts(projectId)

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
                rab_items ( final_total )
            `)
            .eq('project_id', projectId)

        const equipment = await equipmentPromise

        if (error) {
            console.warn('[rapProfit] getProfitHealth error:', error.message)
            return {
                targetProfitPct: profitPct,
                totalRab: 0,
                totalRapBudget: 0,
                totalActualCost: equipment.total,
                totalCommittedCost: 0,
                totalEquipmentCost: equipment.total,
                totalRapActualOnly: 0,
                projectedProfit: 0,
                projectedProfitPct: 0,
                items: [],
                equipmentBreakdown: equipment.breakdown,
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

        // Include equipment costs in overall actual cost
        const totalEquipmentCost = equipment.total
        const totalRapActualOnly = totalActualCost
        totalActualCost += totalEquipmentCost

        const projectedProfit = totalRab - totalActualCost - (totalCommittedCost - totalRapActualOnly)
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
            totalEquipmentCost,
            totalRapActualOnly,
            projectedProfit,
            projectedProfitPct,
            items,
            equipmentBreakdown: equipment.breakdown,
            warningCount,
            criticalCount,
        }
    },
}
