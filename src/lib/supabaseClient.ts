/**
 * supabaseClient.ts
 * Lightweight Supabase client scaffold. Replace env placeholders with actual values.
 * Future usage: authentication, team collaboration, persistence for AHSP/RAB/CPM snapshots.
 */
import { createClient } from '@supabase/supabase-js'

// Environment variables (for Vite you can use import.meta.env.VITE_*)
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

// Guard: avoid creating client if missing config (dev mode fallback)
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : undefined

export function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

// Example placeholder API (adjust to actual tables once defined)
export async function saveAHSPItem(row: any) {
  const client = assertSupabase()
  return client.from('ahsp_items').upsert(row)
}

export async function fetchAHSPItems() {
  const client = assertSupabase()
  return client.from('ahsp_items').select('*').order('updated_at', { ascending: false })
}
