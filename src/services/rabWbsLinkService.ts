import { assertSupabase } from '../lib/supabaseClient'
import type { RabWbsLinkRow } from '../types/rabWbsLink'

export const rabWbsLinkService = {
  getLinks: async (projectId: string) => {
    const supabase = assertSupabase()
    const { data, error } = await supabase.rpc('rpc_get_rab_wbs_links', { p_project_id: projectId })
    if (error) throw error
    return (data || []) as RabWbsLinkRow[]
  },

  addLink: async (rabItemId: string, wbsItemId: string, allocationPct: number) => {
    const supabase = assertSupabase()
    const { data, error } = await supabase.rpc('rpc_add_rab_wbs_link', {
      p_rab_item_id: rabItemId,
      p_wbs_item_id: wbsItemId,
      p_allocation_pct: allocationPct,
    })
    if (error) throw error
    return data
  },

  removeLink: async (rabItemId: string, wbsItemId: string) => {
    const supabase = assertSupabase()
    const { error } = await supabase.rpc('rpc_remove_rab_wbs_link', {
      p_rab_item_id: rabItemId,
      p_wbs_item_id: wbsItemId,
    })
    if (error) throw error
  },

  updateAllocation: async (rabItemId: string, wbsItemId: string, allocationPct: number) => {
    const supabase = assertSupabase()
    const { error } = await supabase.rpc('rpc_update_rab_wbs_allocation', {
      p_rab_item_id: rabItemId,
      p_wbs_item_id: wbsItemId,
      p_allocation_pct: allocationPct,
    })
    if (error) throw error
  },

  unlinkWbsNode: async (wbsItemId: string) => {
    const supabase = assertSupabase()
    const { error } = await supabase.rpc('rpc_unlink_wbs_node', { p_wbs_item_id: wbsItemId })
    if (error) throw error
  },

  /**
   * Set mapping_status and mapping_confidence on an existing link.
   * Used after auto-generation to mark links as 'auto' for review.
   */
  updateMappingStatus: async (
    rabItemId: string,
    wbsItemId: string,
    mappingStatus: 'auto' | 'reviewed' | 'manual' | 'rejected',
    mappingConfidence = 100,
  ) => {
    const supabase = assertSupabase()
    const { error } = await supabase
      .from('rab_wbs_links')
      .update({ mapping_status: mappingStatus, mapping_confidence: mappingConfidence })
      .eq('rab_item_id', rabItemId)
      .eq('wbs_item_id', wbsItemId)
    if (error) console.warn('[rabWbsLink] updateMappingStatus:', error.message)
  },
}
