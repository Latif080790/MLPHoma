import { assertSupabase } from '../lib/supabaseClient'
import type { RABItem } from '../types/rab'

/**
 * Map a raw Supabase DB row to a RABItem domain object.
 * Centralises snake_case → camelCase conversion and numeric coercions.
 */
export function mapDbRowToRabItem(row: Record<string, unknown>, existing?: RABItem): RABItem {
  return {
    ...existing,
    id: row.id as string,
    projectId: row.project_id as string,
    item_code: row.ahsp_code as string | undefined,
    code: row.ahsp_code as string | undefined,
    ahsp_code: row.ahsp_code as string | undefined,
    ahsp_id: row.ahsp_id as string | undefined,
    ahspItemId: row.ahsp_id as string | undefined,
    name: row.name as string | undefined,
    item_name: row.name as string | undefined,
    unit: row.unit as string | undefined,
    volume: Number(row.volume || 0),
    unit_price: Number(row.unit_price || 0),
    cost_material: Number(row.cost_material || 0),
    cost_labor: Number(row.cost_labor || 0),
    cost_equipment: Number(row.cost_equipment || 0),
    cost_subcon: Number(row.cost_subcon || 0),
    markup_percentage: Number(row.markup_percentage || 0),
    weight_percentage: Number(row.weight_percentage || 0),
    finalTotal: Number(row.final_total || 0),
    final_total: Number(row.final_total || 0),
    finalPrice: Number(row.final_total || 0),
    snapshot_price: row.snapshot_price as number | undefined,
    is_overhead: row.is_overhead as boolean | undefined,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  } as RABItem
}

/**
 * Pure business logic: classify RAB items into Pareto A/B/C categories.
 * A = top 80% of cumulative cost, B = next 15%, C = remainder.
 */
export function calculatePareto(items: RABItem[]): (RABItem & { paretoClass: 'A' | 'B' | 'C' })[] {
  if (!items.length) return []

  const sorted = [...items].sort(
    (a, b) =>
      (b.finalTotal || Number(b.total_price) || 0) -
      (a.finalTotal || Number(a.total_price) || 0)
  )

  const totalCost = sorted.reduce(
    (sum, item) => sum + (item.finalTotal || Number(item.total_price) || 0),
    0
  )
  let runningTotal = 0

  return sorted.map((item) => {
    const cost = item.finalTotal || Number(item.total_price) || 0
    runningTotal += cost
    const cumPercent = totalCost > 0 ? (runningTotal / totalCost) * 100 : 0

    let paretoClass: 'A' | 'B' | 'C' = 'C'
    if (cumPercent <= 80) paretoClass = 'A'
    else if (cumPercent <= 95) paretoClass = 'B'

    return { ...item, paretoClass }
  })
}

/**
 * Service to handle RAB core data operations using Supabase.
 */
export const rabService = {
  fetchRabItems: async (projectId?: string): Promise<RABItem[]> => {
    const client = assertSupabase()
    let query = client.from('rab_items').select('*')
    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query
    if (error) throw error
    if (!data) return []

    return data.map((row) => mapDbRowToRabItem(row as Record<string, unknown>))
  },
}

