/**
 * evmService.ts
 *
 * Centralized Earned Value Management (EVM) calculation engine.
 * Single source of truth for PV/EV/AC/SPI/CPI/EAC/ETC/VAC/SV/CV math.
 *
 * Used by: curvaSStore, dashboardService, CostForecastDashboard
 */

import type { PerformanceMetrics, CurvaSAnalysis } from '../types/curvaS'

// ─── Core EVM Calculation ───

export interface EVMInput {
    /** Total project budget (BAC = Budget at Completion) */
    totalBudget: number
    /** Actual Cost incurred to date */
    actualCost: number
    /** Actual progress percentage (0–100) */
    progressPercent: number
    /** Planned progress percentage (0–100), typically time-proportioned */
    plannedProgressPercent: number
}

/**
 * Compute core EVM metrics from budget, cost, and progress data.
 */
export function computeEVM(input: EVMInput): PerformanceMetrics {
    const { totalBudget, actualCost, progressPercent, plannedProgressPercent } = input

    const bac = Math.max(totalBudget, 0)
    const ac = Math.max(actualCost, 0)
    const ev = (progressPercent / 100) * bac
    const pv = (plannedProgressPercent / 100) * bac

    // Performance indices (guard against division by zero)
    const spi = pv > 0 ? ev / pv : 1
    const cpi = ac > 0 ? ev / ac : 1

    // Variances
    const sv = ev - pv  // Schedule Variance
    const cv = ev - ac  // Cost Variance

    // Forecasts
    const eac = cpi > 0 ? bac / cpi : bac  // Estimate at Completion
    const etc = Math.max(0, eac - ac)  // Estimate to Complete
    const vac = bac - eac  // Variance at Completion

    return {
        spi: parseFloat(spi.toFixed(4)),
        cpi: parseFloat(cpi.toFixed(4)),
        earnedValue: Math.round(ev),
        plannedValue: Math.round(pv),
        actualCost: Math.round(ac),
        sv: Math.round(sv),
        cv: Math.round(cv),
        eac: Math.round(eac),
        etc: Math.round(etc),
        vac: Math.round(vac),
    }
}

// ─── Forecast Calculation ───

export interface ForecastInput {
    /** Performance metrics (from computeEVM) */
    metrics: PerformanceMetrics
    /** Project start date (ISO string) */
    startDate: string
    /** Project end date (ISO string) */
    endDate: string
    /** Current progress percentage (0–100) */
    progressPercent: number
    /** Days elapsed from project start to now */
    daysElapsed: number
}

export interface ForecastResult {
    /** Estimated total project cost at completion */
    eac: number
    /** Estimated remaining cost */
    etc: number
    /** Budget variance at completion (positive = under budget) */
    vac: number
    /** Forecasted completion date (ISO string, or null if cannot predict) */
    forecastDate: string | null
    /** Forecasted total cost */
    forecastCost: number
    /** Confidence level based on data quality */
    confidence: 'high' | 'medium' | 'low'
}

/**
 * Compute project forecasts based on EVM metrics.
 */
export function computeForecasts(input: ForecastInput): ForecastResult {
    const { metrics, startDate, endDate, progressPercent, daysElapsed } = input

    const eac = metrics.eac ?? 0
    const etc = metrics.etc ?? 0
    const vac = metrics.vac ?? 0

    // Forecast completion date using progress rate
    let forecastDate: string | null = null
    if (progressPercent > 5 && daysElapsed > 0) {
        const progressRate = progressPercent / daysElapsed  // % per day
        const remainingProgress = 100 - progressPercent
        const daysToGo = progressRate > 0 ? Math.ceil(remainingProgress / progressRate) : 0

        if (daysToGo > 0) {
            const forecast = new Date()
            forecast.setDate(forecast.getDate() + daysToGo)
            forecastDate = forecast.toISOString().split('T')[0]
        }
    }

    // Confidence based on progress and data quality
    let confidence: ForecastResult['confidence'] = 'low'
    if (progressPercent >= 30) confidence = 'high'
    else if (progressPercent >= 15) confidence = 'medium'

    return {
        eac,
        etc,
        vac,
        forecastDate,
        forecastCost: eac,
        confidence,
    }
}

// ─── Health Classification ───

export type HealthStatus = 'healthy' | 'warning' | 'critical'

export interface HealthResult {
    /** Overall health status */
    status: HealthStatus
    /** Detailed project status */
    projectStatus: CurvaSAnalysis['status']
    /** Performance trend */
    trend: CurvaSAnalysis['trend']
    /** Actionable insights */
    insights: string[]
}

/**
 * Classify project health based on CPI and SPI values.
 */
export function classifyHealth(cpi: number, spi: number): HealthResult {
    // Project status classification
    let projectStatus: CurvaSAnalysis['status'] = 'on-track'
    if (cpi < 0.98) projectStatus = 'over-budget'
    else if (spi < 0.98) projectStatus = 'behind-schedule'
    else if (spi > 1.02) projectStatus = 'ahead-schedule'
    else if (cpi > 1.02) projectStatus = 'under-budget'

    // Overall health
    let status: HealthStatus = 'healthy'
    if (cpi < 0.85 || spi < 0.85) status = 'critical'
    else if (cpi < 0.95 || spi < 0.95) status = 'warning'

    // Trend
    const trend: CurvaSAnalysis['trend'] =
        spi > 1.01 || cpi > 1.01 ? 'improving' :
            spi < 0.99 || cpi < 0.99 ? 'declining' :
                'stable'

    // Generate insights
    const insights: string[] = []
    if (projectStatus === 'behind-schedule') {
        insights.push('Schedule behind plan. Accelerate critical tasks.')
    }
    if (projectStatus === 'over-budget') {
        insights.push('Cost overrun detected. Review procurement and resource usage.')
    }
    if (projectStatus === 'ahead-schedule') {
        insights.push('Ahead of schedule. Re-balance resources if needed.')
    }
    if (projectStatus === 'under-budget') {
        insights.push('Under budget. Consider risk allowances.')
    }

    // Additional granular insights
    if (cpi < 0.85) {
        insights.push(`Critical: CPI at ${cpi.toFixed(2)} — significant cost overrun. Immediate corrective action required.`)
    }
    if (spi < 0.85) {
        insights.push(`Critical: SPI at ${spi.toFixed(2)} — major schedule delay. Fast-tracking or crashing recommended.`)
    }
    if (cpi > 1.1 && spi > 1.1) {
        insights.push('Both cost and schedule performance excellent. Consider reducing contingency reserves.')
    }

    return { status, projectStatus, trend, insights }
}

// ─── Utility: Time-Based Planned Progress ───

/**
 * Calculate time-proportioned planned progress percentage.
 * Linear interpolation between start and end dates.
 */
export function calcPlannedProgressPercent(
    startDate: string,
    endDate: string,
    currentDate: Date = new Date()
): { percent: number; daysElapsed: number; totalDuration: number } {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDuration = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const daysElapsed = Math.max(0, Math.floor((currentDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const percent = Math.min(100, Math.max(0, (daysElapsed / totalDuration) * 100))

    return { percent, daysElapsed, totalDuration }
}

// ─── Labor Productivity Benchmarking (Phase 12) ───

export interface ProductivityResult {
    score: number // 1.0 = standard, < 1.0 = slow, > 1.0 = high performance
    status: 'efficient' | 'standard' | 'low'
    avgDailyVolume: number
    standardVolume: number
    variance: number
}

/**
 * Compare actual progress speed vs AHSP standards.
 * For now, using a standard baseline of 5% progress per week as standard.
 */
export async function analyzeProductivity(projectId: string): Promise<ProductivityResult> {
    const supabase = (await import('../lib/supabaseClient')).supabase
    if (!supabase) throw new Error('Supabase client not available')

    const { data: logs } = await supabase
        .from('progress_logs')
        .select('progress_percentage, updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(10)

    if (!logs || logs.length < 2) {
        return { score: 1.0, status: 'standard', avgDailyVolume: 0, standardVolume: 0, variance: 0 }
    }

    // Calculate avg daily progress increment
    const latest = logs[0]
    const oldest = logs[logs.length - 1]
    const dayDiff = Math.max(1, (new Date(latest.updated_at).getTime() - new Date(oldest.updated_at).getTime()) / (1000 * 3600 * 24))
    const totalProg = latest.progress_percentage - oldest.progress_percentage
    const avgDailyProg = totalProg / dayDiff

    const standardDailyProg = 0.7 // Assume 0.7% daily progress is standard (~5% per week)
    const score = avgDailyProg / standardDailyProg

    return {
        score: parseFloat(score.toFixed(2)),
        status: score > 1.1 ? 'efficient' : score < 0.9 ? 'low' : 'standard',
        avgDailyVolume: parseFloat(avgDailyProg.toFixed(2)),
        standardVolume: standardDailyProg,
        variance: parseFloat((avgDailyProg - standardDailyProg).toFixed(2))
    }
}
