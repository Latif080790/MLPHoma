/**
 * shadowCurveService.ts
 *
 * Shadow S-Curve Engine.
 * Generates a third "shadow" cumulative curve showing the original plan
 * adjusted by approved CCO/VO cost and schedule impacts.
 *
 * The shadow line represents: "What the plan SHOULD look like now
 * after incorporating all approved Change Orders."
 */

import { useCurvaSStore } from '../store/curvaSStore'
import { useChangeOrderStore } from '../store/changeOrderStore'
import type { ChangeOrder } from '../types/change-order'

// ─── Types ───

export interface ShadowCurvePoint {
    date: string
    /** Original planned progress */
    plannedProgress: number
    /** Original planned cost */
    plannedCost: number
    /** Actual progress */
    actualProgress: number
    /** Actual cost */
    actualCost: number
    /** Shadow (CCO-adjusted) planned progress */
    shadowProgress: number
    /** Shadow (CCO-adjusted) planned cost */
    shadowCost: number
}

export interface ShadowCurveSummary {
    /** Total cost adjustment from approved CCOs */
    totalCostDelta: number
    /** Total schedule adjustment from approved CCOs (days) */
    totalScheduleDelta: number
    /** Number of approved CCOs factored in */
    approvedCcoCount: number
    /** Deviation between original plan and shadow (cost %) */
    planDeviationPercent: number
}

// ─── Service ───

export const shadowCurveService = {

    /**
     * Calculate the shadow S-curve by overlaying approved CCO impacts
     * onto the original planned curve.
     *
     * Logic:
     * 1. Take original planned curve data points
     * 2. Sum all approved CCO cost_impact and schedule_impact_days
     * 3. Redistribute cost delta proportionally across remaining plan dates
     * 4. Shift progress targets to account for schedule extension
     */
    calculateShadowCurve(projectId: string): {
        points: ShadowCurvePoint[]
        summary: ShadowCurveSummary
    } {
        // Get existing curve data
        const dataPoints = useCurvaSStore.getState().getDataPoints(projectId)

        // Get approved CCOs
        const allOrders = useChangeOrderStore.getState().orders as ChangeOrder[]
        const approvedCCOs = allOrders.filter(
            o => o.project_id === projectId && o.status === 'APPROVED'
        )

        // Calculate totals
        const totalCostDelta = approvedCCOs.reduce((sum, o) => sum + (o.cost_impact || 0), 0)
        const totalScheduleDelta = approvedCCOs.reduce((sum, o) => sum + (o.schedule_impact_days || 0), 0)

        if (dataPoints.length === 0) {
            return {
                points: [],
                summary: {
                    totalCostDelta,
                    totalScheduleDelta,
                    approvedCcoCount: approvedCCOs.length,
                    planDeviationPercent: 0,
                },
            }
        }

        // Get total planned cost (last point)
        const lastPoint = dataPoints[dataPoints.length - 1]
        const totalPlannedCost = lastPoint.plannedCost || 1

        // Schedule adjustment: extend the planned progress targets
        // If schedule extends by N days over M total months, slow progress proportionally
        const totalDays = dataPoints.length > 1
            ? daysBetween(dataPoints[0].date, dataPoints[dataPoints.length - 1].date)
            : 30
        const scheduleStretchFactor = totalDays > 0
            ? totalDays / (totalDays + totalScheduleDelta)
            : 1

        // Generate shadow points
        const points: ShadowCurvePoint[] = dataPoints.map((dp) => {
            // Shadow cost: original planned + proportional delta
            const progressFraction = dp.plannedProgress / 100
            const shadowCost = dp.plannedCost + (totalCostDelta * progressFraction)

            // Shadow progress: stretched to account for schedule extension
            // Earlier milestones are achieved slower because of added scope
            const shadowProgress = Math.min(100, dp.plannedProgress * scheduleStretchFactor)

            return {
                date: dp.date,
                plannedProgress: dp.plannedProgress,
                plannedCost: dp.plannedCost,
                actualProgress: dp.actualProgress,
                actualCost: dp.actualCost,
                shadowProgress: Math.round(shadowProgress * 100) / 100,
                shadowCost: Math.round(shadowCost),
            }
        })

        const planDeviationPercent = totalPlannedCost > 0
            ? (totalCostDelta / totalPlannedCost) * 100
            : 0

        return {
            points,
            summary: {
                totalCostDelta,
                totalScheduleDelta,
                approvedCcoCount: approvedCCOs.length,
                planDeviationPercent: Math.round(planDeviationPercent * 100) / 100,
            },
        }
    },

    /**
     * Get just the summary without full curve calculation.
     */
    getSummary(projectId: string): ShadowCurveSummary {
        const allOrders = useChangeOrderStore.getState().orders as ChangeOrder[]
        const approvedCCOs = allOrders.filter(
            o => o.project_id === projectId && o.status === 'APPROVED'
        )

        const totalCostDelta = approvedCCOs.reduce((sum, o) => sum + (o.cost_impact || 0), 0)
        const totalScheduleDelta = approvedCCOs.reduce((sum, o) => sum + (o.schedule_impact_days || 0), 0)

        const dataPoints = useCurvaSStore.getState().getDataPoints(projectId)
        const totalPlannedCost = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].plannedCost : 0

        return {
            totalCostDelta,
            totalScheduleDelta,
            approvedCcoCount: approvedCCOs.length,
            planDeviationPercent: totalPlannedCost > 0
                ? Math.round((totalCostDelta / totalPlannedCost) * 10000) / 100
                : 0,
        }
    },
}

// ─── Helpers ───

function daysBetween(d1: string, d2: string): number {
    const start = new Date(d1).getTime()
    const end = new Date(d2).getTime()
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
}
