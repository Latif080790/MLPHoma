
import { supabase } from '../lib/supabaseClient'

export interface DashboardStats {
    totalBudget: number
    utilizedBudget: number
    criticalRisks: number
    overdueTasks: number
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
        const wasteAlerts: any[] = []

        if (rapItems) {
            rapItems.forEach((item: any) => {
                const budget = (item.qty_budget || 0) * (item.unit_price_budget || 0)
                const utilized = item.committed_cost || 0 // Use committed as "Utilized" for visibility
                totalBudget += budget
                utilizedBudget += utilized

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

        // PREDICTIVE COMPLETION (Burndown)
        // Simple logic: If we have completed X% in Y days, when will we reach 100%?
        let forecastedEndDate: string | null = null
        if (totalBudget > 0 && utilizedBudget > 0) {
            const projectStartDate = new Date() // Ideally fetch from project details
            projectStartDate.setDate(projectStartDate.getDate() - 30) // Simulate start 30 days ago
            const daysElapsed = 30
            const progress = (utilizedBudget / totalBudget)

            if (progress > 0.1) { // Only predict if >10% progress
                const totalDaysNeeded = daysElapsed / progress
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
            cashflow,
            wasteAlerts: wasteAlerts.slice(0, 5),
            activityFeed: activityFeed.slice(0, 5),
            upcomingTasks
        }
    },

    getEmptyStats(): DashboardStats {
        return {
            totalBudget: 0,
            utilizedBudget: 0,
            criticalRisks: 0,
            overdueTasks: 0,
            cashflow: [],
            wasteAlerts: [],
            activityFeed: [],
            upcomingTasks: []
        }
    }
}
