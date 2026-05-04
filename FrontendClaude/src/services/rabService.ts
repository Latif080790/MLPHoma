import { assertSupabase } from '../lib/supabaseClient'
import type { RABItem } from '../types/rab'

/**
 * Service to handle RAB core data operations using Supabase.
 */
export const rabService = {
  fetchRabItems: async (projectId?: string) => {
    const client = assertSupabase()
    let query = client.from('rab_items').select('*')
    if (projectId) query = query.eq('project_id', projectId)
    
    const { data, error } = await query
    if (error) throw error
    // Typecast to conform with any expected RABItem shape
    return data as any[]
  }
}
