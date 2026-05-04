
import { assertSupabase } from '../lib/supabaseClient'

export interface PHIResult {
    score: number           // 0 - 100
    rating: 'CRITICAL' | 'STABLE' | 'OPTIMAL'
    factors: {
        financial: number     // weight 25%
        schedule: number      // weight 25%
        risk: number          // weight 20%
        integrity: number     // weight 15%
        compliance: number    // weight 15%
    }
}

export const phiService = {
    /**
     * Calculate composite PHI score for a project
     */
    async calculatePHI(projectId: string, metrics: {
        cpi: number,
        spi: number,
        criticalRisks: number,
        activeAlerts: number
    }): Promise<PHIResult> {
        const supabase = assertSupabase()

        // 1. Evidence Integrity Factor (15%)
        // % of progress logs that have both photo and GPS
        const { count: totalLogs } = await supabase
            .from('progress_logs')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)

        const { count: verifiedLogs } = await supabase
            .from('progress_logs')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .not('evidence_url', 'is', null)
            .not('gps_coordinates', 'is', null)

        const integrityScore = totalLogs ? (verifiedLogs || 0) / totalLogs * 100 : 100

        // 2. Financial Factor (25%)
        // Normalized CPI: 1.0 = 100, 0.8 = 60, >1.0 = 100
        const financialScore = Math.min(100, Math.max(0, metrics.cpi * 100))

        // 3. Schedule Factor (25%)
        // Normalized SPI: 1.0 = 100, <1.0 decreases score
        const scheduleScore = Math.min(100, Math.max(0, metrics.spi * 100))

        // 4. Risk Factor (20%)
        // Penalize based on critical risks
        const riskScore = Math.max(0, 100 - (metrics.criticalRisks * 20) - (metrics.activeAlerts * 5))

        // 5. Compliance Factor (15%) - Placeholder for now
        const complianceScore = 95

        // Final weighted score
        const score = (
            (financialScore * 0.25) +
            (scheduleScore * 0.25) +
            (riskScore * 0.20) +
            (integrityScore * 0.15) +
            (complianceScore * 0.15)
        )

        return {
            score: Math.round(score),
            rating: score > 85 ? 'OPTIMAL' : score > 65 ? 'STABLE' : 'CRITICAL',
            factors: {
                financial: Math.round(financialScore),
                schedule: Math.round(scheduleScore),
                risk: Math.round(riskScore),
                integrity: Math.round(integrityScore),
                compliance: Math.round(complianceScore)
            }
        }
    }
}
