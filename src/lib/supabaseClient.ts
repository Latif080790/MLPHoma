/**
 * supabaseClient.ts
 * Lightweight Supabase client scaffold. Replace env placeholders with actual values.
 * Future usage: authentication, team collaboration, persistence for AHSP/RAB/CPM snapshots.
 */
import { createClient } from '@supabase/supabase-js'

// IMPORTANT SECURITY NOTE:
// Do NOT expose the service role secret in client-side code.
// Use only the anon public key here. Service role belongs on a secure backend.

// Load from Vite environment variables (prefixed with VITE_)
const url = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (url && anonKey) ? createClient(url, anonKey) : undefined

export function assertSupabase() {
  if (!supabase) throw new Error('Supabase not initialized: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  return supabase
}

// Types (adjust to actual table schemas)
export interface AhspItemRow {
  id: string
  code: string
  name: string
  description?: string
  unit: string
  category: string
  subcategory?: string
  base_price?: number
  final_price?: number
  price_material?: number
  price_labor?: number
  price_equipment?: number
  price_subcon?: number
  overhead_percentage?: number
  profit_percentage?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface ResourceRow {
  id: string
  code: string
  name: string
  type: string
  unit: string
  unit_price: number
  created_at?: string
  updated_at?: string
  is_active?: boolean
  supplier?: string
  specifications?: string
}

export interface AhspPriceHistoryRow {
  id: string
  ahsp_id: string
  old_price: number | null
  new_price: number
  change_type: string
  change_reason?: string
  created_at?: string
}

export interface AhspComponentRow {
  id: string
  ahsp_id: string
  resource_id: string
  type: string
  coefficient: number
  unit: string
  unit_price: number
  subtotal: number
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface RabItemRow {
  id: string
  project_id: string
  ahsp_code?: string
  name?: string
  unit?: string
  volume?: number
  unit_price?: number
  final_total?: number
  created_at?: string
  updated_at?: string
}

// Upsert single AHSP item
export async function upsertAhspItem(row: AhspItemRow) {
  const client = assertSupabase()
  return client.from('ahsp_items').upsert(row, { onConflict: 'code' })
}

// Batch upsert AHSP items
export async function batchUpsertAhsp(items: AhspItemRow[]) {
  if (!items.length) return { error: null }
  const client = assertSupabase()
  return client.from('ahsp_items').upsert(items, { onConflict: 'code' })
}

export async function batchUpsertResources(items: ResourceRow[]) {
  if (!items.length) return { error: null }
  const client = assertSupabase()
  return client.from('resources').upsert(items, { onConflict: 'code' })
}

export async function batchUpsertAhspComponents(items: AhspComponentRow[]) {
  if (!items.length) return { error: null }
  const client = assertSupabase()
  return client.from('ahsp_components').upsert(items, { onConflict: 'id' })
}

/**
 * Direct bulk import for large AHSP datasets
 * Bypasses localStorage sync queue - inserts directly to Supabase
 * Use for imports > 100 items to avoid localStorage quota issues
 */
export async function bulkImportAHSPDirect(
  items: AhspItemRow[],
  resources: ResourceRow[],
  components: AhspComponentRow[]
): Promise<{ success: boolean; error?: string }> {
  if (!items.length) return { success: true }

  const client = assertSupabase()

  try {
    // Step 1: Insert resources first (if any)
    if (resources.length > 0) {
      const { error: resourceError } = await client
        .from('resources')
        .upsert(resources, { onConflict: 'code' })

      if (resourceError) {
        throw new Error(`Failed to insert resources: ${resourceError.message}`)
      }
    }

    // Step 2: Insert AHSP items (parent records)
    const { error: itemsError } = await client
      .from('ahsp_items')
      .upsert(items, { onConflict: 'code' })

    if (itemsError) {
      throw new Error(`Failed to insert AHSP items: ${itemsError.message}`)
    }

    // Step 3: Insert components (child records)
    if (components.length > 0) {
      // Split into batches of 500 to avoid request size limits
      const batchSize = 500
      for (let i = 0; i < components.length; i += batchSize) {
        const batch = components.slice(i, i + batchSize)
        const { error: componentError } = await client
          .from('ahsp_components')
          .upsert(batch, { onConflict: 'id' })

        if (componentError) {
          throw new Error(`Failed to insert components batch ${i / batchSize + 1}: ${componentError.message}`)
        }
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during bulk import'
    }
  }
}

export async function fetchAhspItems(limit = 1000, offset = 0) {
  const client = assertSupabase()
  return client
    .from('ahsp_items')
    .select('*')
    .range(offset, offset + limit - 1)
    .order('code', { ascending: true })
}

/**
 * Get total count of AHSP items in database
 */
export async function getAhspCount() {
  const client = assertSupabase()
  return client
    .from('ahsp_items')
    .select('*', { count: 'exact', head: true })
}

export async function upsertRabItems(rows: RabItemRow[]) {
  if (!rows.length) return { error: null }
  const client = assertSupabase()
  return client.from('rab_items').upsert(rows, { onConflict: 'id' })
}

export async function fetchRabItems(projectId?: string) {
  const client = assertSupabase()
  let q = client.from('rab_items').select('*')
  if (projectId) q = q.eq('project_id', projectId)
  return q
}

// Delete AHSP item by ID
export async function deleteAhspItem(id: string) {
  const client = assertSupabase()
  return client.from('ahsp_items').delete().eq('id', id)
}

// Delete RAB item by ID
export async function deleteRabItem(id: string) {
  const client = assertSupabase()
  return client.from('rab_items').delete().eq('id', id)
}

// Delete all RAB items for a project
export async function deleteRabItemsByProject(projectId: string) {
  const client = assertSupabase()
  return client.from('rab_items').delete().eq('project_id', projectId)
}

// Delete AHSP component by ID
export async function deleteAhspComponent(id: string) {
  const client = assertSupabase()
  return client.from('ahsp_components').delete().eq('id', id)
}

// Delete resource by ID
export async function deleteResource(id: string) {
  const client = assertSupabase()
  return client.from('resources').delete().eq('id', id)
}

// Projects
export async function fetchProjects() {
  const client = assertSupabase()
  return client.from('projects').select('*')
}

export async function upsertProject(project: Record<string, unknown>) {
  const client = assertSupabase()
  // Map camelCase to snake_case if needed, or assume table uses snake_case
  // For now, let's assume the table columns match the object keys or we map them here.
  // But to be safe, let's map common fields.
  const row = {
    id: project.id,
    name: project.name,
    code: project.code,
    client_name: project.clientName,
    location: project.location,
    start_date: project.startDate,
    end_date: project.endDate,
    budget: project.budget,
    status: project.status,
    user_id: project.userId,
    payment_terms: project.paymentTerms,
    meta: project.meta,
    updated_at: new Date().toISOString(),
  }
  return client.from('projects').upsert(row, { onConflict: 'id' })
}

export async function deleteProject(id: string) {
  const client = assertSupabase()
  return client.from('projects').delete().eq('id', id)
}

export interface MaterialRequestRow {
  id: string
  project_id: string
  wbs_id?: string
  item_name: string
  unit?: string
  quantity_requested: number
  date_required?: string
  status: string
  requested_by?: string
  notes?: string
  created_at?: string
}

export interface PurchaseOrderRow {
  id: string
  project_id: string
  po_number: string
  vendor_name?: string
  status: string
  total_amount: number
  created_by?: string
  approved_by?: string
  approved_at?: string
  created_at?: string
}

export interface PoItemRow {
  id: string
  po_id: string
  rap_item_id?: string
  item_name?: string
  quantity: number
  unit_price: number
  total_price?: number // Generated
  created_at?: string
}

export interface InventoryTransactionRow {
  id: string
  project_id: string
  wbs_id?: string
  material_name: string
  transaction_type: string // IN, OUT, TRANSFER, RETURN
  quantity: number
  unit?: string
  reference_doc?: string
  created_at?: string
}

// Supply Chain Operations

// Material Requests
export async function fetchMaterialRequests(projectId: string) {
  const client = assertSupabase()
  return client.from('material_requests')
    .select(`
      *,
      wbs_items ( name, code )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
}

export async function upsertMaterialRequest(row: Partial<MaterialRequestRow>) {
  const client = assertSupabase()
  return client.from('material_requests').upsert(row).select().single()
}

// Purchase Orders
export async function fetchPurchaseOrders(projectId: string) {
  const client = assertSupabase()
  return client.from('purchase_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
}

export async function upsertPurchaseOrder(row: Partial<PurchaseOrderRow>) {
  const client = assertSupabase()
  return client.from('purchase_orders').upsert(row).select().single()
}

export async function fetchPoItems(poId: string) {
  const client = assertSupabase()
  return client.from('po_items')
    .select(`
      *,
      rap_items ( 
        id, 
        rab_items ( name ) 
      )
    `)
    .eq('po_id', poId)
}

export async function upsertPoItem(row: Partial<PoItemRow>) {
  const client = assertSupabase()
  return client.from('po_items').upsert(row).select().single()
}

export async function deletePoItem(id: string) {
  const client = assertSupabase()
  return client.from('po_items').delete().eq('id', id)
}

// Inventory
export async function fetchInventoryTransactions(projectId: string) {
  const client = assertSupabase()
  return client.from('inventory_transactions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
}

export async function upsertInventoryTransaction(row: Partial<InventoryTransactionRow>) {
  const client = assertSupabase()
  return client.from('inventory_transactions').upsert(row).select().single()
}
export async function fetchResources(limit = 1000, offset = 0) {
  const client = assertSupabase()
  return client
    .from('resources')
    .select('*')
    .range(offset, offset + limit - 1)
    .order('code', { ascending: true })
}

/**
 * Get total count of resources in database
 */
export async function getResourceCount() {
  const client = assertSupabase()
  return client
    .from('resources')
    .select('*', { count: 'exact', head: true })
}

/**
 * Save AHSP creation log
 * Tracks how AHSP was created (SNI/Custom/Historical)
 */
export async function saveCreationLog(log: {
  ahsp_id: string
  creation_mode: 'sni' | 'custom' | 'historical'
  source_reference?: string
  created_by?: string
  metadata?: unknown
}) {
  const client = assertSupabase()
  const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  return client.from('ahsp_creation_logs').insert({
    id,
    ...log,
    created_at: new Date().toISOString()
  })
}

/**
 * Get creation log for an AHSP item
 */
export async function getCreationLog(ahspId: string) {
  const client = assertSupabase()
  return client
    .from('ahsp_creation_logs')
    .select('*')
    .eq('ahsp_id', ahspId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}
