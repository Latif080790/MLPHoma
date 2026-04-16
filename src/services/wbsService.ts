import { supabase } from '../lib/supabaseClient'
import { syncWBSItem, syncWBSItems, syncDelete } from '../lib/supabaseSyncService'
import type { WBSItem } from '../types/wbs'

/**
 * wbsService.ts
 * 
 * Service layer for WBS operations.
 * Separates data access from state management.
 */

export const wbsService = {
  /**
   * Fetch all WBS items for a project
   */
  async fetchItems(projectId: string): Promise<WBSItem[]> {
    if (!supabase) throw new Error('Supabase not initialized')

    const { data, error } = await supabase
      .from('wbs_items')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)

    type WBSRow = { 
      id: string; 
      project_id: string; 
      code: string; 
      name: string; 
      description?: string; 
      level: number; 
      parent_id: string | null; 
      sort_order: number; 
      qc_status?: string; 
      progress?: number; 
      created_at: string; 
      updated_at: string 
    }

    return ((data || []) as WBSRow[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      code: row.code || '',
      name: row.name,
      description: row.description,
      level: row.level ?? 1,
      parentId: row.parent_id ?? null,
      sortOrder: row.sort_order ?? 0,
      qc_status: (row.qc_status as WBSItem['qc_status']) ?? 'NOT_REQUIRED',
      progress: row.progress ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  /**
   * Delete all WBS items for a project (used before import)
   */
  async clearProjectWBS(projectId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')
    
    const { error } = await supabase
      .from('wbs_items')
      .delete()
      .eq('project_id', projectId)

    if (error) throw new Error(error.message)
  },

  /**
   * Unlink a WBS node from all connected entities (RAB, Timeline, etc.)
   */
  async unlinkWBSNode(wbsItemId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')
    
    const { error } = await supabase.rpc('rpc_unlink_wbs_node', { 
      p_wbs_item_id: wbsItemId 
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Single item sync wrapper
   */
  syncItem(item: WBSItem): void {
    syncWBSItem(item)
  },

  /**
   * Multiple items sync wrapper
   */
  syncItems(items: WBSItem[], projectId: string): void {
    syncWBSItems(items, projectId)
  },

  /**
   * Delete item sync wrapper
   */
  syncDelete(id: string): void {
    syncDelete('wbs_items', id)
  }
}
