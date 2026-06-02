
import { assertSupabase } from '../lib/supabaseClient'

export type AnomalyType =
    | 'COST_OVERRUN'
    | 'FROZEN_PROGRESS'
    | 'ORPHAN_COST'
    | 'PRICE_SPIKE'
    | 'SUPPLIER_DELAY'
    | 'SCOPE_CREEP'
    | 'CASH_BURN_RATE'

export interface Anomaly {
    id: string
    type: AnomalyType
    severity: 'CRITICAL' | 'WARNING'
    description: string
    suggestedAction: string
    metadata?: Record<string, unknown>
}

type RapItemRow = {
    id: string
    qty_budget?: number
    unit_price_budget?: number
    actual_cost?: number
    ahsp_items?: { name?: string } | Array<{ name?: string }>
}

type PurchaseOrderItemRow = {
    description?: string
    unit_price?: number
}

type RabItemRow = {
    name?: string
    unit_price?: number
}

export const anomalyService = {
    async detectAnomalies(projectId: string): Promise<Anomaly[]> {
        const supabase = assertSupabase()
        const anomalies: Anomaly[] = []

        // ── 1. COST OVERRUN ──────────────────────────────────────────────────
        const { data: rapItems } = await supabase
            .from('rap_items')
            .select('id, qty_budget, unit_price_budget, actual_cost, ahsp_items(name)')
            .eq('project_id', projectId)

        rapItems?.forEach((item: RapItemRow) => {
            const budget = (item.qty_budget || 0) * (item.unit_price_budget || 0)
            const actual = item.actual_cost || 0
            if (budget > 0 && actual > budget * 1.25) {
                const matName = Array.isArray(item.ahsp_items) ? item.ahsp_items[0]?.name : item.ahsp_items?.name
                anomalies.push({
                    id: `cost-${item.id}`,
                    type: 'COST_OVERRUN',
                    severity: 'CRITICAL',
                    description: `${matName || 'Item'} is 25%+ over budget.`,
                    suggestedAction: 'Review RAP allocations and check for stock leakage.',
                })
            }
        })

        // ── 2. FROZEN PROGRESS ───────────────────────────────────────────────
        const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
        const { data: recentLogs } = await supabase
            .from('progress_logs')
            .select('date')
            .eq('project_id', projectId)
            .gte('date', fiveDaysAgo)

        if (!recentLogs || recentLogs.length === 0) {
            anomalies.push({
                id: 'frozen-project',
                type: 'FROZEN_PROGRESS',
                severity: 'WARNING',
                description: 'No progress logs reported in the last 5 days.',
                suggestedAction: 'Contact Site Manager for status update.',
            })
        }

        // ── 3. ORPHAN COST ───────────────────────────────────────────────────
        const { data: project } = await supabase
            .from('projects')
            .select('budget, start_date, end_date')
            .eq('id', projectId)
            .single()

        const { data: costItems } = await supabase
            .from('rap_items')
            .select('actual_cost')
            .eq('project_id', projectId)

        const totalActual = costItems?.reduce((sum: number, i: { actual_cost?: number }) => sum + (i.actual_cost || 0), 0) || 0
        const budgetTotal = Number(project?.budget || 0)

        const { data: tasks } = await supabase
            .from('timeline_tasks')
            .select('progress')
            .eq('project_id', projectId)

        const avgProgress = tasks && tasks.length > 0
            ? tasks.reduce((sum: number, t: { progress?: number }) => sum + (t.progress || 0), 0) / tasks.length
            : 0

        const costBurn = budgetTotal > 0 ? totalActual / budgetTotal : 0

        if ((costBurn > 0.4 && avgProgress < 10) || (costBurn > 0.7 && avgProgress < 40)) {
            anomalies.push({
                id: `orphan-cost-${projectId}`,
                type: 'ORPHAN_COST',
                severity: 'CRITICAL',
                description: `High cost burn (${(costBurn * 100).toFixed(1)}%) with low progress (${avgProgress.toFixed(1)}%).`,
                suggestedAction: 'Audit field expenses and verify progress evidence integrity.',
            })
        }

        // ── 4. PRICE SPIKE ───────────────────────────────────────────────────
        // Compare PO item unit prices vs RAB budget unit prices (>20% spike)
        const { data: poItems } = await supabase
            .from('purchase_order_items')
            .select('description, unit_price, purchase_orders!inner(project_id)')
            .eq('purchase_orders.project_id', projectId)

        const { data: rabItems } = await supabase
            .from('rab_items')
            .select('name, unit_price')
            .eq('project_id', projectId)

        if (poItems && rabItems) {
            const rabPriceMap: Record<string, number> = {}
            rabItems.forEach((r: RabItemRow) => {
                if (r.name) rabPriceMap[r.name.toLowerCase()] = Number(r.unit_price || 0)
            })

            poItems.forEach((po: PurchaseOrderItemRow) => {
                const itemName = po.description || ''
                const key = itemName.toLowerCase()
                const budgetPrice = rabPriceMap[key]
                const poPrice = Number(po.unit_price || 0)
                if (budgetPrice > 0 && poPrice > budgetPrice * 1.2) {
                    const pct = (((poPrice - budgetPrice) / budgetPrice) * 100).toFixed(1)
                    anomalies.push({
                        id: `price-spike-${key}`,
                        type: 'PRICE_SPIKE',
                        severity: 'WARNING',
                        description: `${itemName}: PO price ${pct}% above RAB budget (Rp ${poPrice.toLocaleString('id-ID')} vs Rp ${budgetPrice.toLocaleString('id-ID')}).`,
                        suggestedAction: 'Negotiate with vendor or seek alternative supplier.',
                        metadata: { item: itemName, poPrice, budgetPrice },
                    })
                }
            })
        }

        // ── 5. SUPPLIER DELAY ────────────────────────────────────────────────
        // POs with status ORDERED older than 14 days with no GRN
        const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()
        const { data: stalePOs } = await supabase
            .from('purchase_orders')
            .select('id, po_number, vendor_name, created_at')
            .eq('project_id', projectId)
            .eq('status', 'ORDERED')
            .lte('created_at', fourteenDaysAgo)

        if (stalePOs && stalePOs.length > 0) {
            const { data: grnPoIds } = await supabase
                .from('goods_receipts')
                .select('purchase_order_id')
                .in('purchase_order_id', stalePOs.map((p: { id: string }) => p.id))

            const receivedIds = new Set((grnPoIds || []).map((g: { purchase_order_id: string }) => g.purchase_order_id))
            stalePOs.forEach((po: { id: string; po_number?: string; vendor_name?: string; created_at: string }) => {
                if (!receivedIds.has(po.id)) {
                    const daysLate = Math.round((Date.now() - new Date(po.created_at).getTime()) / 86400000) - 14
                    anomalies.push({
                        id: `supplier-delay-${po.id}`,
                        type: 'SUPPLIER_DELAY',
                        severity: daysLate > 7 ? 'CRITICAL' : 'WARNING',
                        description: `PO ${po.po_number || po.id} from ${po.vendor_name || 'vendor'} has no goods receipt after ${daysLate + 14} days.`,
                        suggestedAction: 'Contact vendor for delivery status. Consider escalating to procurement manager.',
                        metadata: { poId: po.id, daysLate },
                    })
                }
            })
        }

        // ── 6. SCOPE CREEP ───────────────────────────────────────────────────
        // RAB items created after project start_date without a linked change order
        const startDate = project?.start_date
        if (startDate) {
            const { data: lateRabItems } = await supabase
                .from('rab_items')
                .select('id, name, created_at')
                .eq('project_id', projectId)
                .gt('created_at', startDate)

            const { data: changeOrders } = await supabase
                .from('change_orders')
                .select('id')
                .eq('project_id', projectId)
                .eq('status', 'APPROVED')

            const { data: allRabItems } = await supabase
                .from('rab_items')
                .select('id')
                .eq('project_id', projectId)

            const totalItems = allRabItems?.length || 0
            const lateCount = lateRabItems?.length || 0
            const hasApprovedCO = (changeOrders?.length || 0) > 0

            if (totalItems > 0 && lateCount / totalItems > 0.1 && !hasApprovedCO) {
                anomalies.push({
                    id: `scope-creep-${projectId}`,
                    type: 'SCOPE_CREEP',
                    severity: 'WARNING',
                    description: `${lateCount} RAB items (${((lateCount / totalItems) * 100).toFixed(0)}% of total) added after project start with no approved change order.`,
                    suggestedAction: 'Review scope additions and raise a formal Change Order for approval.',
                    metadata: { lateCount, totalItems },
                })
            }
        }

        // ── 7. CASH BURN RATE ────────────────────────────────────────────────
        // Weekly actual spend vs planned burn rate (budget / planned_weeks)
        if (budgetTotal > 0 && project?.start_date && project?.end_date) {
            const start = new Date(project.start_date)
            const end = new Date(project.end_date)
            const totalWeeks = Math.max(1, (end.getTime() - start.getTime()) / (7 * 86400000))
            const plannedWeeklyBurn = budgetTotal / totalWeeks

            // Actual spend in last 4 weeks
            const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString()
            const { data: recentInvoices } = await supabase
                .from('invoices')
                .select('total_amount')
                .eq('project_id', projectId)
                .gte('created_at', fourWeeksAgo)
                .eq('status', 'PAID')

            const recentSpend = (recentInvoices || []).reduce((sum: number, inv: { total_amount?: number }) => sum + Number(inv.total_amount || 0), 0)
            const actualWeeklyBurn = recentSpend / 4

            if (actualWeeklyBurn > plannedWeeklyBurn * 1.3 && recentSpend > 0) {
                const overage = (((actualWeeklyBurn - plannedWeeklyBurn) / plannedWeeklyBurn) * 100).toFixed(1)
                anomalies.push({
                    id: `cash-burn-${projectId}`,
                    type: 'CASH_BURN_RATE',
                    severity: 'CRITICAL',
                    description: `Weekly cash burn Rp ${actualWeeklyBurn.toLocaleString('id-ID')} is ${overage}% above planned rate of Rp ${plannedWeeklyBurn.toLocaleString('id-ID')}.`,
                    suggestedAction: 'Review payment schedule and defer non-critical payments to align with cash flow plan.',
                    metadata: { actualWeeklyBurn, plannedWeeklyBurn },
                })
            }
        }

        return anomalies
    },
}
