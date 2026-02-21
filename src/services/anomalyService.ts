
import { assertSupabase } from '../lib/supabaseClient'

export interface Anomaly {
    id: string
    type: 'COST_OVERRUN' | 'FROZEN_PROGRESS' | 'ORPHAN_COST'
    severity: 'CRITICAL' | 'WARNING'
    description: string
    suggestedAction: string
    metadata?: any
}

export const anomalyService = {
    /**
     * Detect anomalies for a specific project
     */
    async detectAnomalies(projectId: string): Promise<Anomaly[]> {
        const supabase = assertSupabase()
        const anomalies: Anomaly[] = []

        // 1. COST OVERRUN (Black Hole Detection)
        const { data: rapItems } = await supabase
            .from('rap_items')
            .select('id, qty_budget, unit_price_budget, actual_cost, ahsp_items(name)')
            .eq('project_id', projectId)

        rapItems?.forEach((item: any) => {
            const budget = (item.qty_budget || 0) * (item.unit_price_budget || 0)
            const actual = item.actual_cost || 0

            if (budget > 0 && actual > budget * 1.25) {
                const matName = Array.isArray(item.ahsp_items) ? item.ahsp_items[0]?.name : item.ahsp_items?.name
                anomalies.push({
                    id: `cost-${item.id}`,
                    type: 'COST_OVERRUN',
                    severity: 'CRITICAL',
                    description: `${matName || 'Item'} is 25%+ over budget.`,
                    suggestedAction: 'Review RAP allocations and check for stock leakage.'
                })
            }
        })

        // 2. FROZEN PROGRESS (Active Timeline tasks with no movement)
        const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]

        // Check for progress logs in last 5 days
        const { data: recentLogs } = await supabase
            .from('progress_logs')
            .select('date')
            .eq('project_id', projectId)
            .gte('date', fiveDaysAgo)

        if (!recentLogs || recentLogs.length === 0) {
            anomalies.push({
                id: `frozen-project`,
                type: 'FROZEN_PROGRESS',
                severity: 'WARNING',
                description: 'No progress logs reported in the last 5 days.',
                suggestedAction: 'Contact Site Manager for status update.'
            })
        }

        // 3. ORPHAN COST (High actual cost without progress improvement)
        const { data: project } = await supabase
            .from('projects')
            .select('budget')
            .eq('id', projectId)
            .single()

        const { data: costItems } = await supabase
            .from('rap_items')
            .select('actual_cost')
            .eq('project_id', projectId)

        const totalActual = costItems?.reduce((sum, i) => sum + (i.actual_cost || 0), 0) || 0
        const budgetTotal = project?.budget || 0

        const { data: tasks } = await supabase
            .from('timeline_tasks')
            .select('progress')
            .eq('project_id', projectId)

        const avgProgress = tasks && tasks.length > 0
            ? tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length
            : 0

        const costBurn = budgetTotal > 0 ? totalActual / budgetTotal : 0

        if ((costBurn > 0.4 && avgProgress < 10) || (costBurn > 0.7 && avgProgress < 40)) {
            anomalies.push({
                id: `orphan-cost-${projectId}`,
                type: 'ORPHAN_COST',
                severity: 'CRITICAL',
                description: `High cost burn (${(costBurn * 100).toFixed(1)}%) with low progress (${avgProgress.toFixed(1)}%).`,
                suggestedAction: 'Audit field expenses and verify progress evidence integrity.'
            })
        }

        return anomalies
    }
}
