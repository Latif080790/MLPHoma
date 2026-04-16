import { supabase } from '../lib/supabaseClient'
import type { RABVersion } from '../types/rabVersion'

/**
 * rabVersionService.ts
 * 
 * Service layer for RAB Versioning operations.
 * Separates data access from state management.
 */

export const rabVersionService = {
  /**
   * Fetch all versions for a project
   */
  async fetchVersions(projectId: string): Promise<RABVersion[]> {
    if (!supabase) throw new Error('Supabase not initialized')

    const { data, error } = await supabase
      .from('rab_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: true })

    if (error) throw new Error(error.message)

    return (data || []).map(row => ({
      id: row.id,
      projectId: row.project_id,
      version: row.version,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      description: row.description,
      changeType: row.change_type,
      changes: JSON.parse(row.changes),
      snapshot: JSON.parse(row.snapshot),
      status: row.status,
      tags: row.tags || []
    }))
  },

  /**
   * Create a new RAB version
   */
  async createVersion(version: RABVersion): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')

    const { error } = await supabase.from('rab_versions').insert({
      id: version.id,
      project_id: version.projectId,
      version: version.version,
      created_by: version.createdBy,
      created_by_name: version.createdByName,
      description: version.description,
      change_type: version.changeType,
      changes: JSON.stringify(version.changes),
      snapshot: JSON.stringify(version.snapshot),
      status: version.status,
      tags: version.tags,
      created_at: version.createdAt
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')

    const { error } = await supabase
      .from('rab_versions')
      .delete()
      .eq('id', versionId)

    if (error) throw new Error(error.message)
  }
}
