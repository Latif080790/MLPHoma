/**
 * forecastingService.ts
 * AI-Driven Predictive Engine for Cost and Schedule.
 * Analyzes historical project_daily_metrics to project future outcomes.
 */
import { assertSupabase } from '../lib/supabaseClient'

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

        if (!history || history.length === 0) {
            return this.getFallbackForecast(bac)
        }

        const latest = history[0]
        const ev = Number(latest.ev)
        const ac = Number(latest.ac)
        const cpi = Number(latest.cpi) || 1
        const spi = Number(latest.spi) || 1

        // 3. Trend Analysis (SPI Slippage)
        const consecutiveSlippage = history.filter(m => Number(m.spi) < 0.9).length
        const isRedAlert = consecutiveSlippage >= 7

        // 4. Multi-Method EAC Projections
        const eacStandard = cpi > 0 ? bac / cpi : bac
        
        // Conservative: Weights CPI and SPI (The critical ratio method)
        const eacConservative = ac + (bac - ev) / (cpi * spi > 0 ? cpi * spi : 1)
        
        // Aggressive: Assumes remaining work stays strictly on budget
        const eacAggressive = ac + (bac - ev)

        // 5. Projected Completion Date
        let projectedCompletion = null
        if (spi > 0 && project?.end_date) {
            const remainingDays = Math.ceil((bac - ev) / (ev / (history.length || 1))) // simple velocity-based
            if (isFinite(remainingDays) && remainingDays > 0) {
                const forecast = new Date()
                forecast.setDate(forecast.getDate() + remainingDays)
                projectedCompletion = forecast.toISOString().split('T')[0]
            }
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
