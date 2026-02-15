/**
 * tkdnService.ts
 * CRUD service for TKDN (Tingkat Komponen Dalam Negeri) data.
 * All DB access goes through assertSupabase() for consistent error handling.
 */

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import type { TKDNItem, TKDNSummary, TKDNCategoryBreakdown, TKDNCategory, TKDNCreateInput, TKDNUpdateInput } from '../types/tkdn'

const CATEGORIES: TKDNCategory[] = ['material', 'labor', 'equipment', 'service']

/**
 * Map a DB row to our TKDNItem type.
 */
function mapRow(row: any): TKDNItem {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    category: row.category,
    origin: row.origin,
    unit: row.unit,
    quantity: row.quantity,
    unit_price: row.unit_price,
    total_value: row.total_value,
    supplier: row.supplier,
    country_of_origin: row.country_of_origin,
    hs_code: row.hs_code,
    rab_item_id: row.rab_item_id,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const tkdnService = {
  /**
   * Fetch all TKDN items for a project.
   */
  async getItems(projectId: string): Promise<TKDNItem[]> {
    const client = assertSupabase()
    const { data, error } = await client
      .from('tkdn_items')
      .select('*')
      .eq('project_id', projectId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapRow)
  },

  /**
   * Create a new TKDN item.
   */
  async createItem(input: TKDNCreateInput): Promise<TKDNItem> {
    const client = assertSupabase()
    const id = generateId('tkdn')
    const total_value = input.quantity * input.unit_price

    const { data, error } = await client
      .from('tkdn_items')
      .insert({
        id,
        project_id: input.project_id,
        name: input.name,
        category: input.category,
        origin: input.origin,
        unit: input.unit,
        quantity: input.quantity,
        unit_price: input.unit_price,
        total_value,
        supplier: input.supplier || null,
        country_of_origin: input.country_of_origin || null,
        hs_code: input.hs_code || null,
        rab_item_id: input.rab_item_id || null,
        notes: input.notes || null,
      })
      .select()
      .single()

    if (error) throw error
    return mapRow(data)
  },

  /**
   * Update an existing TKDN item.
   */
  async updateItem(id: string, updates: TKDNUpdateInput): Promise<TKDNItem> {
    const client = assertSupabase()

    // Recalculate total_value if quantity or unit_price changed
    const payload: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    if (updates.quantity != null && updates.unit_price != null) {
      payload.total_value = updates.quantity * updates.unit_price
    }

    const { data, error } = await client
      .from('tkdn_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return mapRow(data)
  },

  /**
   * Delete a TKDN item.
   */
  async deleteItem(id: string): Promise<void> {
    const client = assertSupabase()
    const { error } = await client
      .from('tkdn_items')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Calculate TKDN summary for a project.
   * Pure computation from fetched items — no extra DB call.
   */
  calculateSummary(items: TKDNItem[], targetPercentage: number = 40): TKDNSummary {
    const domestic = items.filter(i => i.origin === 'domestic')
    const imported = items.filter(i => i.origin === 'imported')

    const totalDomestic = domestic.reduce((s, i) => s + i.total_value, 0)
    const totalImported = imported.reduce((s, i) => s + i.total_value, 0)
    const grandTotal = totalDomestic + totalImported

    const tkdnPercentage = grandTotal > 0 ? (totalDomestic / grandTotal) * 100 : 0

    const byCategory: TKDNCategoryBreakdown[] = CATEGORIES.map(cat => {
      const catItems = items.filter(i => i.category === cat)
      const catDomestic = catItems.filter(i => i.origin === 'domestic').reduce((s, i) => s + i.total_value, 0)
      const catImported = catItems.filter(i => i.origin === 'imported').reduce((s, i) => s + i.total_value, 0)
      const catTotal = catDomestic + catImported
      return {
        category: cat,
        domestic_value: catDomestic,
        imported_value: catImported,
        total_value: catTotal,
        tkdn_percentage: catTotal > 0 ? (catDomestic / catTotal) * 100 : 0,
        item_count: catItems.length,
      }
    })

    return {
      project_id: items[0]?.project_id ?? '',
      total_domestic: totalDomestic,
      total_imported: totalImported,
      tkdn_percentage: Math.round(tkdnPercentage * 100) / 100,
      by_category: byCategory,
      target_percentage: targetPercentage,
      meets_target: tkdnPercentage >= targetPercentage,
      calculated_at: new Date().toISOString(),
    }
  },
}
