import { supabase } from '../lib/supabaseClient'
import { computeEVM, computeForecasts, calcPlannedProgressPercent } from './evmService'
import { scheduleAlertService } from './scheduleAlertService'
import { phiService, PHIResult } from './phiService'
import { anomalyService, Anomaly } from './anomalyService'

// ─── Local row types ──────────────────────────────────────────────────────────
type RapAhspItem = { qty_budget: number | null; unit_price_budget: number | null; committed_cost: number | null; actual_cost: number | null; ahsp_items: { name: string } | { name: string }[] | null }
type DashRiskRow = { id: string; description: string; risk_score: number | null; status: string; created_at?: string }
type DashPoRow = { id: string; po_number: string; total_amount: number; created_at: string; status: string }
type DashProgressRow = { progress: number | null }
type DashTaskRow = { id: string; name: string; end_date: string; progress: number | null }
type GlobalRiskRow = { id: string; description: string; risk_score: number | null; projects?: { name: string } | null }
type WasteAlert = { material: string; waste: number; limit: number; message?: string }

export interface DashboardStats {
    totalBudget: number
    utilizedBudget: number
    criticalRisks: number
    overdueTasks: number
    // Earned Value metrics
    cpi: number | null   // Cost Performance Index = EV / AC
    spi: number | null   // Schedule Performance Index = EV / PV
    overallProgress: number // 0-100
    forecastedEndDate: string | null
    phi: PHIResult | null // Project Health Index (Phase 13)
    anomalies: Anomaly[] // Phase 13
    cashflow: {
        week: string
        inflow: number
        outflow: number
        balance: number
    }[]
    wasteAlerts: {
        material: string
        waste: number // Percentage over budget
        limit: number // Hardcoded threshold for now
    }[]
    activityFeed: {
        id: string
        type: 'RISK' | 'PO' | 'Milestone'
        message: string
        date: string
        status: string
    }[]
    upcomingTasks: {
        id: string
        name: string
        date: string
        progress: number
    }[]
    equipmentCost: number // New Field for Automation Data
    alertCounts: {
        CRITICAL: number
        MODERATE: number
        MINOR: number
    }
    topRisks: {
        id: string
        description: string
        score: number
    }[]
}

export const dashboardService = {
    async getProjectStats(projectId: string): Promise<DashboardStats> {
        if (!projectId || !supabase) return this.getEmptyStats()

        // 1. Budget Stats (RAP)
        const { data: rapItems } = await supabase
            .from('rap_items')
            .select('qty_budget, unit_price_budget, committed_cost, actual_cost, ahsp_items(name)')
            .eq('project_id', projectId)

        let totalBudget = 0
        let utilizedBudget = 0
        let actualCostTotal = 0
        const wasteAlerts: WasteAlert[] = []

        if (rapItems) {
            rapItems.forEach((item: RapAhspItem) => {
                const budget = (item.qty_budget || 0) * (item.unit_price_budget || 0)
                const utilized = item.committed_cost || 0 // Use committed as "Utilized" for visibility
                const actual = item.actual_cost || 0
                totalBudget += budget
                utilizedBudget += utilized
                actualCostTotal += actual

                // Waste Detection (Over Budget Items)
                if (utilized > budget && budget > 0) {
                    const variance = ((utilized - budget) / budget) * 100
                    if (variance > 5) { // Only show significant waste (>5%)
                        // specific handling for array or object return from supabase join
                        const matName = Array.isArray(item.ahsp_items)
                            ? item.ahsp_items[0]?.name
                            : item.ahsp_items?.name

                        wasteAlerts.push({
                            material: matName || 'Unknown Item',
                            waste: parseFloat(variance.toFixed(1)),
                            limit: 0
                        })
                    }
                }
            })
        }

        // 1.5. Equipment Rent Stats (Automation Data)
        const { data: toolLogs } = await supabase
            .from('tools_usage_logs')
            .select('rent_cost')
            .eq('project_id', projectId)

        let equipmentCost = 0
        if (toolLogs) {
            equipmentCost = toolLogs.reduce((sum, log) => sum + (log.rent_cost || 0), 0)
        }

        // Add Equipment Cost to Utilized Budget (Real-time view)
        utilizedBudget += equipmentCost
        actualCostTotal += equipmentCost

        // 2. Risk Stats
        const { count: criticalRisks, data: activeRisks } = await supabase
            .from('risks')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId)
            .gte('risk_score', 15)
            .eq('status', 'OPEN')
            .order('risk_score', { ascending: false })
            .limit(5)

        const topRisks = activeRisks?.map((r: DashRiskRow) => ({
            id: r.id,
            description: r.description,
            score: r.risk_score
        })) || []

        // 3. Schedule Stats (Overdue & Upcoming)
        const today = new Date().toISOString().split('T')[0]
        const { count: overdueTasks } = await supabase
            .from('timeline_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .lt('progress', 100)
            .lt('end_date', today)

        const { data: upcomingTasksData } = await supabase
            .from('timeline_tasks')
            .select('id, name, end_date, progress')
            .eq('project_id', projectId)
            .gte('end_date', today)
            .order('end_date', { ascending: true })
            .limit(5)

        const upcomingTasks = upcomingTasksData?.map((t: DashTaskRow) => ({
            id: t.id,
            name: t.name,
            date: t.end_date,
            progress: t.progress
        })) || []

        // 4. Cashflow (Simple Approximation from POs)
        const { data: recentPOs } = await supabase
            .from('purchase_orders')
            .select('id, po_number, total_amount, created_at, status')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(10)

        // Transform POs into "Outflow" for the chart
        const cashflow = [
            { week: 'W1', inflow: 0, outflow: 0, balance: 0 },
            { week: 'W2', inflow: 0, outflow: 0, balance: 0 },
            { week: 'W3', inflow: 0, outflow: 0, balance: 0 },
            { week: 'W4', inflow: 0, outflow: 0, balance: 0 },
        ]

        const activityFeed: DashboardStats['activityFeed'] = []

        if (recentPOs && recentPOs.length > 0) {
            // Add POs to Activity Feed and check for Price Anomalies
            recentPOs.slice(0, 5).forEach((po: DashPoRow) => {
                activityFeed.push({
                    id: po.id,
                    type: 'PO',
                    message: `PO #${po.po_number} Created`,
                    date: po.created_at,
                    status: po.status
                })

                // ANOMALY DETECTION (Price Spike)
                // In a real scenario, we'd check PO Items vs AHSP Base Price
                // Here we simulate it based on total amount for demonstration if items aren't joined
                // For a proper implementation, we'd need to fetch PO Items + Linked AHSP
                if (po.total_amount > 100000000) { // arbitrary threshold for now
                    wasteAlerts.push({
                        material: `High Value PO: ${po.po_number}`,
                        waste: 0,
                        limit: 0,
                        message: "Requires Manager Approval"
                    })
                }
            })

            // Distribute last 4 POs into the chart just to show movement
            recentPOs.slice(0, 4).forEach((po: DashPoRow, idx: number) => {
                if (cashflow[idx]) {
                    cashflow[idx].outflow = po.total_amount / 1000000
                    cashflow[idx].inflow = (po.total_amount * 1.2) / 1000000
                    cashflow[idx].balance = cashflow[idx].inflow - cashflow[idx].outflow
                }
            })
        }

        // EARNED VALUE ANALYSIS (delegated to evmService)
        let cpi: number | null = null
        let spi: number | null = null
        let overallProgress = 0
        let forecastedEndDate: string | null = null

        // Compute overall progress from timeline tasks
        const { data: allTasks } = await supabase
            .from('timeline_tasks')
            .select('progress')
            .eq('project_id', projectId)

        if (allTasks && allTasks.length > 0) {
            overallProgress = Math.round(
                allTasks.reduce((sum: number, t: DashProgressRow) => sum + (t.progress || 0), 0) / allTasks.length
            )
        }

        // Fetch project dates for EVM calculation
        const { data: projectData } = await supabase
            .from('projects')
            .select('start_date, end_date')
            .eq('id', projectId)
            .single()

        if (totalBudget > 0) {
            const startDate = projectData?.start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
            const endDate = projectData?.end_date || new Date(Date.now() + 150 * 86400000).toISOString().split('T')[0]

            const { percent: plannedPercent, daysElapsed } = calcPlannedProgressPercent(startDate, endDate)

            const metrics = computeEVM({
                totalBudget,
                actualCost: actualCostTotal > 0 ? actualCostTotal : utilizedBudget,
                progressPercent: overallProgress,
                plannedProgressPercent: plannedPercent,
            })

            cpi = parseFloat(metrics.cpi.toFixed(2))
            spi = parseFloat(metrics.spi.toFixed(2))

            // Forecast using evmService
            const forecasts = computeForecasts({
                metrics,
                startDate,
                endDate,
                progressPercent: overallProgress,
                daysElapsed,
            })
            forecastedEndDate = forecasts.forecastDate

            // IMPROVED CASHFLOW Projection (Task 3)
            // Divide remaining budget over the next 4 weeks based on current velocity
            const remainingBudget = totalBudget - utilizedBudget
            const weeklyOutflow = remainingBudget / 8 // simple spread over 2 months

            for (let i = 0; i < 4; i++) {
                cashflow[i].outflow = parseFloat((weeklyOutflow / 1000000).toFixed(2))
                cashflow[i].inflow = parseFloat(((weeklyOutflow * 1.1) / 1000000).toFixed(2))
                cashflow[i].balance = cashflow[i].inflow - cashflow[i].outflow
            }
        }

        // 5. Schedule Alerts Integration (Task 2)
        const alertCounts = await scheduleAlertService.getAlertCounts(projectId)
        const projectAlerts = await scheduleAlertService.getProjectAlerts(projectId)

        // Add Top Alerts to Activity Feed
        projectAlerts.slice(0, 3).forEach(alert => {
            activityFeed.push({
                id: alert.id,
                type: 'RISK', // reuse RISK type for red accent in terminal
                message: `ALERT: ${alert.taskName} is ${alert.daysBehind}d behind`,
                date: alert.detectedAt,
                status: alert.severity
            })
        })

        if (activeRisks) {
            activeRisks.slice(0, 2).forEach((risk: DashRiskRow) => {
                activityFeed.push({
                    id: risk.id,
                    type: 'RISK',
                    message: `Risk: ${risk.description?.substring(0, 20)}...`,
                    date: risk.created_at || new Date().toISOString(),
                    status: risk.status
                })
            })
        }

        // Sort feed by date
        activityFeed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        // 6. PHI CALCULATION (Phase 13)
        const phi = await phiService.calculatePHI(projectId, {
            cpi: cpi || 1.0,
            spi: spi || 1.0,
            criticalRisks: criticalRisks || 0,
            activeAlerts: alertCounts.CRITICAL || 0
        })

        // 7. ANOMALY DETECTION (Phase 13)
        const anomalies = await anomalyService.detectAnomalies(projectId)

        return {
            totalBudget,
            utilizedBudget,
            criticalRisks: criticalRisks || 0,
            overdueTasks: overdueTasks || 0,
            cpi,
            spi,
            overallProgress,
            forecastedEndDate,
            phi,
            anomalies,
            cashflow,
            wasteAlerts: wasteAlerts.slice(0, 5),
            activityFeed: activityFeed.slice(0, 5),
            upcomingTasks,
            equipmentCost, // Result
            alertCounts,
            topRisks
        }
    },

    getEmptyStats(): DashboardStats {
        return {
            totalBudget: 0,
            utilizedBudget: 0,
            criticalRisks: 0,
            overdueTasks: 0,
            cpi: null,
            spi: null,
            overallProgress: 0,
            forecastedEndDate: null,
            phi: null,
            anomalies: [],
            cashflow: [],
            wasteAlerts: [],
            activityFeed: [],
            upcomingTasks: [],
            equipmentCost: 0,
            alertCounts: { CRITICAL: 0, MODERATE: 0, MINOR: 0 },
            topRisks: []
        }
    },

    async getPortfolioStats(): Promise<{
        totalProjects: number
        totalBudget: number
        utilizedBudget: number
        avgCpi: number
        avgSpi: number
        avgPhi: number // Phase 13
        globalAlertCounts: { CRITICAL: number; MODERATE: number; MINOR: number }
        topGlobalRisks: { id: string; description: string; score: number; projectName: string }[]
    }> {
        if (!supabase) return {
            totalProjects: 0, totalBudget: 0, utilizedBudget: 0, avgCpi: 1, avgSpi: 1, avgPhi: 100,
            globalAlertCounts: { CRITICAL: 0, MODERATE: 0, MINOR: 0 }, topGlobalRisks: []
        }

        const { data: projects } = await supabase.from('projects').select('id, name')
        if (!projects) return {
            totalProjects: 0, totalBudget: 0, utilizedBudget: 0, avgCpi: 1, avgSpi: 1, avgPhi: 100,
            globalAlertCounts: { CRITICAL: 0, MODERATE: 0, MINOR: 0 }, topGlobalRisks: []
        }

        let totalBudget = 0
        let totalUtilized = 0
        let cpiSum = 0
        let spiSum = 0
        let phiSum = 0
        let projectsWithData = 0
        const globalAlerts = { CRITICAL: 0, MODERATE: 0, MINOR: 0 }

        // Aggregate stats per project
        await Promise.all(projects.map(async (p) => {
            const stats = await this.getProjectStats(p.id)
            totalBudget += stats.totalBudget
            totalUtilized += stats.utilizedBudget
            if (stats.cpi !== null && stats.spi !== null) {
                cpiSum += stats.cpi
                spiSum += stats.spi
                phiSum += stats.phi?.score || 0
                projectsWithData++
            }
            globalAlerts.CRITICAL += stats.alertCounts.CRITICAL
            globalAlerts.MODERATE += stats.alertCounts.MODERATE
            globalAlerts.MINOR += stats.alertCounts.MINOR
        }))

        // Global Risks Fetch
        const { data: topRisks } = await supabase
            .from('risks')
            .select('id, description, risk_score, projectName:project_id(name)')
            .eq('status', 'OPEN')
            .order('risk_score', { ascending: false })
            .limit(5)

        const topGlobalRisks = topRisks?.map((r: GlobalRiskRow) => ({
            id: r.id,
            description: r.description,
            score: r.risk_score,
            projectName: r.projects?.name || 'Unknown'
        })) || []

        return {
            totalProjects: projects.length,
            totalBudget,
            utilizedBudget: totalUtilized,
            avgCpi: projectsWithData > 0 ? cpiSum / projectsWithData : 1,
            avgSpi: projectsWithData > 0 ? spiSum / projectsWithData : 1,
            avgPhi: projectsWithData > 0 ? phiSum / projectsWithData : 100,
            globalAlertCounts: globalAlerts,
            topGlobalRisks
        }
    }
}
