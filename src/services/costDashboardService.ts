import { assertSupabase } from '../lib/supabaseClient'

export interface CostTypeBreakdown {
  material: number; labor: number; equipment: number; subcon: number; overhead: number
}

export interface CostDashboardSnapshot {
  rabTotal: number
  rapPlanned: number
  actualCost: number
  committedCost: number
  remainingBudget: number
  burnRatePercent: number
  costTypeBreakdown: CostTypeBreakdown
  latestCpi: number | null
  latestSpi: number | null
  latestPv: number | null
  latestEv: number | null
  latestAc: number | null
}

export const costDashboardService = {
  async getDashboardSnapshot(projectId: string): Promise<CostDashboardSnapshot> {
    const client = assertSupabase()
    const [rabResult, rapResult, metricsResult] = await Promise.all([
      client.from('rab_items')
        .select('final_total, cost_material, cost_labor, cost_equipment, cost_subcon, is_overhead')
        .eq('project_id', projectId),
      client.from('rap_items')
        .select('total_budget, actual_cost, committed_cost')
        .eq('project_id', projectId),
      client.from('project_daily_metrics')
        .select('pv, ev, ac, cpi, spi')
        .eq('project_id', projectId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (rabResult.error) throw rabResult.error
    if (rapResult.error) throw rapResult.error

    const rabItems = rabResult.data ?? []
    const rapItems = rapResult.data ?? []
    const m = metricsResult.data ?? null

    const rabTotal = rabItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.final_total || 0), 0)
    const breakdown: CostTypeBreakdown = {
      material:  rabItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.cost_material  || 0), 0),
      labor:     rabItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.cost_labor     || 0), 0),
      equipment: rabItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.cost_equipment || 0), 0),
      subcon:    rabItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.cost_subcon    || 0), 0),
      overhead:  rabItems.filter((r: Record<string, unknown>) => r.is_overhead).reduce((s: number, r: Record<string, unknown>) => s + Number(r.final_total || 0), 0),
    }
    const rapPlanned      = rapItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.total_budget   || 0), 0)
    const actualCost      = rapItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.actual_cost    || 0), 0)
    const committedCost   = rapItems.reduce((s: number, r: Record<string, unknown>) => s + Number(r.committed_cost || 0), 0)
    const remainingBudget = rapPlanned - actualCost - committedCost
    const burnRatePercent = rabTotal > 0 ? parseFloat(((actualCost / rabTotal) * 100).toFixed(2)) : 0

    return {
      rabTotal, rapPlanned, actualCost, committedCost, remainingBudget, burnRatePercent,
      costTypeBreakdown: breakdown,
      latestCpi: m ? Number((m as Record<string, unknown>).cpi) : null,
      latestSpi: m ? Number((m as Record<string, unknown>).spi) : null,
      latestPv:  m ? Number((m as Record<string, unknown>).pv)  : null,
      latestEv:  m ? Number((m as Record<string, unknown>).ev)  : null,
      latestAc:  m ? Number((m as Record<string, unknown>).ac)  : null,
    }
  },
}
