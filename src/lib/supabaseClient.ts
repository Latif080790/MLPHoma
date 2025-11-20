/**
 * supabaseClient.ts
 * Lightweight Supabase client scaffold. Replace env placeholders with actual values.
 * Future usage: authentication, team collaboration, persistence for AHSP/RAB/CPM snapshots.
 */
import { createClient } from '@supabase/supabase-js'

// IMPORTANT SECURITY NOTE:
// Do NOT expose the service role secret in client-side code.
// Use only the anon public key here. Service role belongs on a secure backend.

// Attempt to load from Node process env (injected by esbuild define)
const url = process.env.VITE_SUPABASE_URL || ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

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
  base_price?: number
  final_price?: number
  overhead_percentage?: number
  profit_percentage?: number
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
  return client.from('ahsp_items').upsert(row, { onConflict: 'id' })
}

// Batch upsert AHSP items
export async function batchUpsertAhsp(items: AhspItemRow[]) {
  if (!items.length) return { error: null }
  const client = assertSupabase()
  return client.from('ahsp_items').upsert(items, { onConflict: 'id' })
}

export async function fetchAhspItems() {
  const client = assertSupabase()
  return client.from('ahsp_items').select('*').order('updated_at', { ascending: false })
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
  return q.order('updated_at', { ascending: false })
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

// Projects
export async function fetchProjects() {
  const client = assertSupabase()
  return client.from('projects').select('*').order('updated_at', { ascending: false })
}

export async function upsertProject(project: any) {
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

