/**
 * tkdnService.ts
 * CRUD service for TKDN (Tingkat Komponen Dalam Negeri) data.
 * All DB access goes through assertSupabase() for consistent error handling.
 */

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import type { TKDNItem, TKDNSummary, TKDNCategoryBreakdown, TKDNCategory, TKDNCreateInput, TKDNUpdateInput } from '../types/tkdn'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// ─── Local row types ──────────────────────────────────────────────────────────
type TkdnDbRow = {
  id: string; project_id: string; name: string; category: TKDNCategory; origin: string;
  unit: string; quantity: number; unit_price: number; total_value: number;
  supplier: string | null; country_of_origin: string | null; hs_code: string | null;
  rab_item_id: string | null; notes: string | null; created_at: string; updated_at: string;
}
type RapItemForTkdn = { id: string; description: string | null; quantity: number | null; unit: string | null; price: number | null; category: string | null; total_price: number | null }
type TkdnDoc = jsPDF & { autoTable: (opts: Record<string, unknown>) => void }

const CATEGORIES: TKDNCategory[] = ['material', 'labor', 'equipment', 'service']

/**
 * Map a DB row to our TKDNItem type.
 */
function mapRow(row: TkdnDbRow): TKDNItem {
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

    if (error) {
      console.warn('[tkdn] getItems error:', error.message)
      return []
    }
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
    const payload: TKDNUpdateInput & { updated_at: string; total_value?: number } = {
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

  /**
   * Import items from RAP to TKDN.
   * Maps RAP items to TKDN categories based on their type.
   */
  async importFromRAP(projectId: string): Promise<number> {
    const client = assertSupabase()

    // 1. Fetch RAP items
    const { data: rapItems, error: rapError } = await client
      .from('rap_items')
      .select('id, description, quantity, unit, price, category, total_price')
      .eq('project_id', projectId)

    if (rapError) throw rapError
    if (!rapItems || rapItems.length === 0) return 0

    // 2. Map distinct RAP items to TKDN inputs
    const newItems: TKDNItem[] = rapItems.map((r: RapItemForTkdn) => {
      let tkdnCategory: TKDNCategory = 'material' // default
      const desc = (r.description || '').toLowerCase()

      // Simple heuristic mapping
      if (r.category === 'MATERIAL' || desc.includes('material') || desc.includes('besi') || desc.includes('beton')) {
        tkdnCategory = 'material'
      } else if (r.category === 'LABOR' || desc.includes('upah') || desc.includes('tenaga') || desc.includes('mandor')) {
        tkdnCategory = 'labor'
      } else if (r.category === 'EQUIPMENT' || desc.includes('sewa') || desc.includes('alat')) {
        tkdnCategory = 'equipment'
      } else if (r.category === 'SUBCONTRACT' || desc.includes('jasa') || desc.includes('subkon')) {
        tkdnCategory = 'service'
      }

      return {
        id: generateId('tkdn'),
        project_id: projectId,
        name: r.description || 'Unnamed Item',
        category: tkdnCategory,
        origin: 'domestic', // default to domestic for compliance optimism
        unit: r.unit || 'ls',
        quantity: r.quantity || 1,
        unit_price: r.price || 0,
        total_value: r.total_price || 0,
        rab_item_id: r.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    // 3. Batch insert
    if (newItems.length > 0) {
      const { error: insertError } = await client
        .from('tkdn_items')
        .insert(newItems)
      if (insertError) throw insertError
    }

    return newItems.length
  },

  /**
   * Generate TKDN Compliance PDF Report
   */
  async generatePDF(summary: TKDNSummary, items: TKDNItem[]): Promise<void> {
    const doc = new jsPDF()
    const h = doc as TkdnDoc
    const now = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })

    // Header
    doc.setFontSize(18)
    doc.text('Laporan Capaian TKDN', 105, 20, { align: 'center' })
    doc.setFontSize(12)
    doc.text(`Proyek ID: ${summary.project_id}`, 105, 28, { align: 'center' })
    doc.text(`Tanggal Laporan: ${now}`, 105, 34, { align: 'center' })

    // Summary Box
    doc.setLineWidth(0.5)
    doc.rect(14, 45, 182, 35)

    doc.setFontSize(10)
    doc.text(`Total Nilai Proyek: Rp ${summary.by_category.reduce((s, c) => s + c.total_value, 0).toLocaleString('id-ID')}`, 20, 55)
    doc.text(`Komponen Dalam Negeri (KDN): Rp ${summary.total_domestic.toLocaleString('id-ID')}`, 20, 62)
    doc.text(`Komponen Impor (KLN): Rp ${summary.total_imported.toLocaleString('id-ID')}`, 20, 69)

    doc.setFontSize(14)
    doc.setTextColor(summary.meets_target ? 0 : 200, summary.meets_target ? 100 : 0, 0)
    doc.text(`Capaian TKDN: ${summary.tkdn_percentage.toFixed(2)}%`, 190, 62, { align: 'right' })
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Target Minimal: ${summary.target_percentage}%`, 190, 69, { align: 'right' })
    doc.setTextColor(0) // reset color

    // Category Breakdown Table
    const breakdownData = summary.by_category.map(c => [
      c.category.toUpperCase(),
      `Rp ${c.domestic_value.toLocaleString('id-ID')}`,
      `Rp ${c.imported_value.toLocaleString('id-ID')}`,
      `Rp ${c.total_value.toLocaleString('id-ID')}`,
      `${c.tkdn_percentage.toFixed(2)}%`
    ])

      ; h.autoTable({
        startY: 90,
        head: [['Kategori', 'KDN (Rp)', 'KLN (Rp)', 'Total (Rp)', '% TKDN']],
        body: breakdownData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        foot: [['TOTAL',
          `Rp ${summary.total_domestic.toLocaleString('id-ID')}`,
          `Rp ${summary.total_imported.toLocaleString('id-ID')}`,
          `Rp ${(summary.total_domestic + summary.total_imported).toLocaleString('id-ID')}`,
          `${summary.tkdn_percentage.toFixed(2)}%`
        ]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      })

    // Detailed Item List (limit to first 100 items to avoid huge PDF for now)
    doc.addPage()
    doc.text('Rincian Item (Top 100)', 14, 20)

    const itemData = items.slice(0, 100).map(i => [
      i.name.substring(0, 30),
      i.category,
      i.origin,
      `Rp ${i.total_value.toLocaleString('id-ID')}`
    ])

      ; h.autoTable({
        startY: 25,
        head: [['Nama Item', 'Kategori', 'Asal', 'Nilai Total']],
        body: itemData,
        theme: 'striped',
        styles: { fontSize: 8 },
      })

    // Save
    doc.save(`TKDN_Report_${summary.project_id}_${new Date().toISOString().split('T')[0]}.pdf`)
  },
}
