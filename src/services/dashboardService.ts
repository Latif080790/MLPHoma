
import { supabase } from '../lib/supabaseClient'
import { differenceInDays, parseISO } from 'date-fns'

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
        const wasteAlerts: any[] = []

        if (rapItems) {
            rapItems.forEach((item: any) => {
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
            .limit(5)

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

        const upcomingTasks = upcomingTasksData?.map((t: any) => ({
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

        const activityFeed: any[] = []

        if (recentPOs && recentPOs.length > 0) {
            // Add POs to Activity Feed and check for Price Anomalies
            recentPOs.slice(0, 5).forEach((po: any) => {
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
            recentPOs.slice(0, 4).forEach((po: any, idx: number) => {
                if (cashflow[idx]) {
                    cashflow[idx].outflow = po.total_amount / 1000000
                    cashflow[idx].inflow = (po.total_amount * 1.2) / 1000000
                    cashflow[idx].balance = cashflow[idx].inflow - cashflow[idx].outflow
                }
            })
        }

        // EARNED VALUE ANALYSIS
        // EV = % complete * BAC (Budget at Completion)
        // PV = planned % * BAC (time-proportioned budget)
        // AC = actual cost incurred
        // CPI = EV / AC, SPI = EV / PV
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
                allTasks.reduce((sum: number, t: any) => sum + (t.progress || 0), 0) / allTasks.length
            )
        }

        // Fetch project dates for EVM calculation
        const { data: projectData } = await supabase
            .from('projects')
            .select('start_date, end_date')
            .eq('id', projectId)
            .single()

        if (totalBudget > 0) {
            const earnedValue = (overallProgress / 100) * totalBudget // EV
            const ac = actualCostTotal > 0 ? actualCostTotal : utilizedBudget // AC fallback to committed

            // Derive schedule duration from actual project dates
            const now = new Date()
            const projectStart = projectData?.start_date ? parseISO(projectData.start_date) : new Date(now.getTime() - 30 * 86400000)
            const projectEnd = projectData?.end_date ? parseISO(projectData.end_date) : new Date(now.getTime() + 150 * 86400000)
            const daysElapsed = Math.max(1, differenceInDays(now, projectStart))
            const totalDuration = Math.max(1, differenceInDays(projectEnd, projectStart))
            const plannedPercent = Math.min(daysElapsed / totalDuration, 1)
            const plannedValue = plannedPercent * totalBudget // PV

            if (ac > 0) cpi = parseFloat((earnedValue / ac).toFixed(2))
            if (plannedValue > 0) spi = parseFloat((earnedValue / plannedValue).toFixed(2))

            // Forecasted end date (EAC-based)
            if (overallProgress > 5) { // Only predict if >5% progress
                const totalDaysNeeded = daysElapsed / (overallProgress / 100)
                const remainingDays = totalDaysNeeded - daysElapsed
                const forecastDate = new Date()
                forecastDate.setDate(forecastDate.getDate() + remainingDays)
                forecastedEndDate = forecastDate.toISOString().split('T')[0]
            }
        }

        if (activeRisks) {
            activeRisks.slice(0, 2).forEach((risk: any) => {
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

        return {
            totalBudget,
            utilizedBudget,
            criticalRisks: criticalRisks || 0,
            overdueTasks: overdueTasks || 0,
            cpi,
            spi,
            overallProgress,
            forecastedEndDate,
            cashflow,
            wasteAlerts: wasteAlerts.slice(0, 5),
            activityFeed: activityFeed.slice(0, 5),
            upcomingTasks,
            equipmentCost // Result
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
            cashflow: [],
            wasteAlerts: [],
            activityFeed: [],
            upcomingTasks: [],
            equipmentCost: 0
        }
    }
}
