import { assertSupabase } from '../lib/supabaseClient'

type RabRow = { final_total: number | null; cost_material: number | null; cost_labor: number | null; cost_equipment: number | null; cost_subcon: number | null; is_overhead: boolean | null }
type RapRow = { total_budget: number | null; actual_cost: number | null; committed_cost: number | null }
type MetricsRow = { pv: number; ev: number; ac: number; cpi: number; spi: number }

export interface CostTypeBreakdown {
  material: number
  labor: number
  equipment: number
  subcon: number
  overhead: number
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
    const [rabResult, rapResult] = await Promise.all([
      client.from('rab_items')
        .select('final_total, cost_material, cost_labor, cost_equipment, cost_subcon, is_overhead')
        .eq('project_id', projectId),
      client.from('rap_items')
        .select('total_budget, actual_cost, committed_cost')
        .eq('project_id', projectId),
    ])
    if (rabResult.error) throw rabResult.error
    if (rapResult.error) throw rapResult.error

    // project_daily_metrics may not exist or may lack RLS — treat as optional
    const metricsResult = await client.from('project_daily_metrics')
      .select('pv, ev, ac, cpi, spi')
      .eq('project_id', projectId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rabItems = (rabResult.data ?? []) as RabRow[]
    const rapItems = (rapResult.data ?? []) as RapRow[]
    const m = (!metricsResult.error && metricsResult.data) ? metricsResult.data as MetricsRow : null

    const rabTotal = rabItems.reduce((s, r) => s + Number(r.final_total || 0), 0)
    const breakdown: CostTypeBreakdown = {
      material:  rabItems.reduce((s, r) => s + Number(r.cost_material  || 0), 0),
      labor:     rabItems.reduce((s, r) => s + Number(r.cost_labor     || 0), 0),
      equipment: rabItems.reduce((s, r) => s + Number(r.cost_equipment || 0), 0),
      subcon:    rabItems.reduce((s, r) => s + Number(r.cost_subcon    || 0), 0),
      overhead:  rabItems.filter(r => r.is_overhead).reduce((s, r) => s + Number(r.final_total || 0), 0),
    }
    const rapPlanned      = rapItems.reduce((s, r) => s + Number(r.total_budget   || 0), 0)
    const actualCost      = rapItems.reduce((s, r) => s + Number(r.actual_cost    || 0), 0)
    const committedCost   = rapItems.reduce((s, r) => s + Number(r.committed_cost || 0), 0)
    // RAP-basis: remaining = planned execution budget minus actual and committed spend
    const remainingBudget = rapPlanned - actualCost - committedCost
    // Burn rate uses RAP execution budget as denominator (what the team actually has to spend).
    // Fall back to rabTotal when RAP hasn't been initialized yet (rapPlanned = 0).
    const burnBase = rapPlanned > 0 ? rapPlanned : rabTotal
    const burnRatePercent = burnBase > 0 ? parseFloat(((actualCost / burnBase) * 100).toFixed(2)) : 0

    return {
      rabTotal, rapPlanned, actualCost, committedCost, remainingBudget, burnRatePercent,
      costTypeBreakdown: breakdown,
      latestCpi: m ? Number(m.cpi) : null,
      latestSpi: m ? Number(m.spi) : null,
      latestPv:  m ? Number(m.pv)  : null,
      latestEv:  m ? Number(m.ev)  : null,
      latestAc:  m ? Number(m.ac)  : null,
    }
  },
}
