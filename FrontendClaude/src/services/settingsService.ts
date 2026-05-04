/**
 * settingsService.ts — Phase 10
 * 
 * Service layer for project configuration and master data management.
 * Enforces architectural boundaries by decoupling UI components from Supabase.
 */

import { assertSupabase } from "@/lib/supabaseClient"
import type { Project } from "@/store/projectStore"

export const settingsService = {
  /**
   * Fetch a single project's details directly from DB for accurate configuration.
   */
  async getProjectDetails(id: string) {
    const client = assertSupabase()
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update project metadata.
   */
  async updateProjectDetails(id: string, updates: Partial<Project>) {
    const client = assertSupabase()
    
    // Map cammelCase (store) to snake_case (DB) if needed
    // Note: The projects table uses snake_case for some fields, 
    // but the store uses camelCase.
    const dbUpdates: Record<string, any> = {
      name: updates.name,
      location: updates.location,
      budget: updates.budget,
      start_date: updates.startDate,
      end_date: updates.endDate,
      updated_at: new Date().toISOString()
    }

    // Remove undefined fields
    Object.keys(dbUpdates).forEach(key => 
      dbUpdates[key] === undefined && delete dbUpdates[key]
    )

    const { data, error } = await client
      .from('projects')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
