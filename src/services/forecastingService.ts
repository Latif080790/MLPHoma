/**
 * forecastingService.ts
 * AI-Driven Predictive Engine for Cost and Schedule.
 * Analyzes historical project_daily_metrics to project future outcomes.
 */
import { assertSupabase } from '../lib/supabaseClient'
import type { ProjectDailyMetric } from './evmService'

export interface ForecastProjections {
    eacStandard: number   // BAC / CPI
    eacConservative: number // AC + (BAC - EV) / (CPI * 0.8 + SPI * 0.2)
    eacAggressive: number // AC + (BAC - EV)
    projectedCompletion: string | null
    varianceAtCompletion: number
    isRedAlert: boolean
    alertReason?: string
}

export const forecastingService = {
    /**
     * Get historical metrics for a specific project.
     */
    async getHistory(projectId: string): Promise<ProjectDailyMetric[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('project_daily_metrics')
            .select('*')
            .eq('project_id', projectId)
            .order('snapshot_date', { ascending: true })

        if (error) throw error
        return data || []
    },

    /**
     * Trigger backend RPC to generate snapshots for all projects.
     */
    async generateSnapshot(): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase.rpc('rpc_snapshot_all_projects')
        if (error) throw error
    },


    /**
     * Get trend-based forecasts for a specific project.
     */
    async getTrendForecast(projectId: string): Promise<ForecastProjections> {
        const supabase = assertSupabase()

        // 1. Fetch project basis (BAC)
        const { data: project } = await supabase
            .from('projects')
            .select('budget, start_date, end_date')
            .eq('id', projectId)
            .single()

        const bac = Number(project?.budget || 0)

        // 2. Fetch historical metrics (last 14 snapshots)
        const { data: history } = await supabase
            .from('project_daily_metrics')
            .select('*')
            .eq('project_id', projectId)
            .order('snapshot_date', { ascending: false })
            .limit(14)

        if (!history || history.length === 0 || bac === 0) {
            return this.getFallbackForecast(bac)
        }

        const latest = history[0]
        const ev = Number(latest.ev)
        const ac = Number(latest.ac)
        const cpi = Number(latest.cpi) || 1
        const spi = Number(latest.spi) || 1

        // 3. Trend Analysis — count consecutive check-ins (newest first) with SPI < 0.9
        // history is ordered descending so [0] = most recent; break on first non-slip.
        let consecutiveSlippage = 0
        for (const m of history) {
            if (Number(m.spi) < 0.9) consecutiveSlippage++
            else break
        }
        const isRedAlert = consecutiveSlippage >= 7

        // 4. Multi-Method EAC Projections
        const eacStandard = cpi > 0 ? bac / cpi : bac

        // Conservative: Weights CPI and SPI (The critical ratio method)
        const eacConservative = ac + (bac - ev) / Math.max(cpi * spi, 0.1)

        // Aggressive: Assumes remaining work stays strictly on budget
        const eacAggressive = ac + (bac - ev)

        // 5. Projected Completion Date (SPI-adjusted)
        // Formula: projected_duration = planned_duration / SPI
        // If SPI < 1, project is running slower → takes longer than planned
        let projectedCompletion = null
        if (spi > 0 && project?.start_date && project?.end_date) {
            const startDate = new Date(project.start_date)
            const endDate = new Date(project.end_date)
            const plannedDays = Math.max(1, Math.round(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            ))
            const projectedDays = Math.ceil(plannedDays / spi)
            const projected = new Date(startDate)
            projected.setDate(projected.getDate() + projectedDays)
            projectedCompletion = projected.toISOString().split('T')[0]
        }

        return {
            eacStandard: Math.round(eacStandard),
            eacConservative: Math.round(eacConservative),
            eacAggressive: Math.round(eacAggressive),
            projectedCompletion,
            varianceAtCompletion: Math.round(bac - eacStandard),
            isRedAlert,
            alertReason: isRedAlert ? `SPI has dropped below 0.90 for ${consecutiveSlippage} consecutive check-ins.` : undefined
        }
    },

    getFallbackForecast(bac: number): ForecastProjections {
        return {
            eacStandard: bac,
            eacConservative: bac,
            eacAggressive: bac,
            projectedCompletion: null,
            varianceAtCompletion: 0,
            isRedAlert: false
        }
    },

    /**
     * Generate prescriptive corrective actions based on project health drift.
     */
    getMitigationSuggestions(spi: number, cpi: number): string[] {
        const suggestions: string[] = []

        if (spi < 0.9) {
            suggestions.push("Critical: Fast-track the Critical Path by parallelizing non-dependent WBS nodes.")
            suggestions.push("Schedule Recovery: Consider 'crashing' (adding resources) to bottleneck tasks.")
        } else if (spi < 1.0) {
            suggestions.push("Monitor performance closely: minor schedule slippage detected.")
        }

        if (cpi < 0.9) {
            suggestions.push("Cost Containment: Audit material usage and scrap rates.")
            suggestions.push("Subcontractor Review: Evaluate if Subcon Opname matches actual field progress.")
        } else if (cpi < 1.0) {
            suggestions.push("Budget optimization: minor cost variance observed.")
        }

        if (spi < 0.8 && cpi < 0.8) {
            suggestions.push("Force Halt/Audit: Significant drift in both cost and schedule. Re-baseline required.")
        }

        if (suggestions.length === 0) {
            suggestions.push("Performance optimal. Maintain current resource allocation.")
        }

        return suggestions
    }
}
