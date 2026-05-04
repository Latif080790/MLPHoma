/**
 * RAB Approval Types
 * Type definitions for the approval workflow system
 */

/**
 * Approval status enum
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/**
 * Approval step in the chain
 */
export interface ApprovalStep {
  /** Step number (1-based) */
  stepNumber: number
  /** Role or title of approver */
  approverRole: string
  /** ID of approver user */
  approverId?: string
  /** Name of approver */
  approverName?: string
  /** Email of approver */
  approverEmail?: string
  /** Status of this step */
  status: ApprovalStatus
  /** Comments from approver */
  comments?: string
  /** When this step was acted upon */
  actionDate?: Date
  /** Is this the current active step */
  isCurrent: boolean
}

/**
 * Complete approval chain configuration
 */
export interface ApprovalChain {
  /** Chain ID */
  id: string
  /** Chain name/template */
  name: string
  /** Description */
  description?: string
  /** Ordered list of steps */
  steps: ApprovalStep[]
  /** Allow parallel approvals at same step */
  allowParallel?: boolean
  /** Require all steps or just one at each level */
  requireAll?: boolean
}

/**
 * RAB Approval record
 */
export interface RABApproval {
  /** Approval record ID */
  id: string
  /** Associated project */
  projectId: string
  /** RAB version being approved */
  rabVersionId: string
  /** Version number */
  versionNumber: number
  /** Overall status */
  status: ApprovalStatus
  /** When submitted */
  submittedAt: Date
  /** Who submitted */
  submittedBy: string
  /** Submitter name */
  submittedByName: string
  /** Current step in chain */
  currentStep: number
  /** Reason for rejection (if rejected) */
  rejectionReason?: string
  /** The approval chain */
  approvalChain: ApprovalChain
  /** Created at */
  createdAt: Date
  /** Updated at */
  updatedAt: Date
}

/**
 * Approval action input
 */
export interface ApprovalAction {
  /** Approval ID */
  approvalId: string
  /** Action: approve or reject */
  action: 'approve' | 'reject'
  /** Comments */
  comments?: string
  /** Approver ID */
  approverId: string
  /** Approver name */
  approverName: string
}

/**
 * Approval history entry
 */
export interface ApprovalHistoryEntry {
  /** Entry ID */
  id: string
  /** Approval ID */
  approvalId: string
  /** Step number */
  stepNumber: number
  /** Action taken */
  action: 'submitted' | 'approved' | 'rejected' | 'cancelled'
  /** User who took action */
  userId: string
  /** User name */
  userName: string
  /** Comments */
  comments?: string
  /** Timestamp */
  timestamp: Date
}

/**
 * Approval template for quick setup
 */
export interface ApprovalTemplate {
  /** Template ID */
  id: string
  /** Template name */
  name: string
  /** Description */
  description: string
  /** Default steps */
  defaultSteps: Array<{
    stepNumber: number
    approverRole: string
    requiredRole?: string
  }>
  /** Icon for UI */
  icon?: string
  /** Category */
  category: 'standard' | 'fast-track' | 'detailed' | 'custom'
}

/**
 * Zustand store interface
 */
export interface RABApprovalStore {
  /** All approvals by ID */
  approvals: Record<string, RABApproval>
  /** Approval history */
  history: Record<string, ApprovalHistoryEntry[]>
  /** Available templates */
  templates: ApprovalTemplate[]
  /** Loading states */
  loading: {
    approvals: boolean
    submission: boolean
    action: boolean
  }
  
  // Actions
  /** Submit RAB for approval */
  submitForApproval: (projectId: string, rabVersionId: string, chainTemplate: string) => Promise<string>
  /** Approve current step */
  approve: (action: ApprovalAction) => Promise<void>
  /** Reject current step */
  reject: (action: ApprovalAction) => Promise<void>
  /** Cancel approval process */
  cancelApproval: (approvalId: string, reason: string) => Promise<void>
  /** Get approvals for project */
  getApprovalsByProject: (projectId: string) => RABApproval[]
  /** Get approval by ID */
  getApproval: (approvalId: string) => RABApproval | undefined
  /** Get approval history */
  getApprovalHistory: (approvalId: string) => ApprovalHistoryEntry[]
  /** Fetch from Supabase */
  fetchApprovals: (projectId: string) => Promise<void>
  /** Load templates */
  loadTemplates: () => void
}
