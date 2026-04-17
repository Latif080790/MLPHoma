import { assertSupabase } from '../lib/supabaseClient'
import type { RABApproval } from '../types/rabApproval'

export const rabApprovalService = {
  createApproval: async (approval: RABApproval) => {
    const supabase = assertSupabase()
    const { error } = await supabase
      .from('rab_approvals')
      .insert({
        id: approval.id,
        project_id: approval.projectId,
        rab_version_id: approval.rabVersionId,
        status: approval.status,
        submitted_at: approval.submittedAt.toISOString(),
        submitted_by: approval.submittedBy,
        submitted_by_name: approval.submittedByName,
        current_step: approval.currentStep,
        approval_chain: approval.approvalChain,
        created_at: approval.createdAt.toISOString(),
        updated_at: approval.updatedAt.toISOString()
      })

    if (error) throw error
  },

  updateApprovalStatus: async (
    approvalId: string, 
    status: RABApproval['status'], 
    currentStep: number, 
    approvalChain: RABApproval['approvalChain'], 
    rejectionReason?: string
  ) => {
    const supabase = assertSupabase()
    
    // Build update payload dynamically
    const payload: any = {
      status,
      current_step: currentStep,
      approval_chain: approvalChain,
      updated_at: new Date().toISOString()
    }
    
    if (rejectionReason !== undefined) {
      payload.rejection_reason = rejectionReason
    }

    const { error } = await supabase
      .from('rab_approvals')
      .update(payload)
      .eq('id', approvalId)

    if (error) throw error
  },

  getApprovalsByProject: async (projectId: string) => {
    const supabase = assertSupabase()
    const { data, error } = await supabase
      .from('rab_approvals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }
}
