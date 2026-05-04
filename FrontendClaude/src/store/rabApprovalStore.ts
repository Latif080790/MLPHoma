/**
 * RAB Approval Store
 * State management for approval workflow
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { rabApprovalService } from '../services/rabApprovalService'
import { toast } from 'sonner'
import { generateId } from '../lib/idGenerator'
import type {
  RABApprovalStore,
  RABApproval,
  ApprovalAction,
  ApprovalHistoryEntry,
  ApprovalTemplate,
  ApprovalChain,
} from '../types/rabApproval'

/**
 * Default approval templates
 */
const DEFAULT_TEMPLATES: ApprovalTemplate[] = [
  {
    id: 'fast-track',
    name: 'Fast Track',
    description: 'Quick approval for minor changes (1 level)',
    category: 'fast-track',
    icon: 'Zap',
    defaultSteps: [
      { stepNumber: 1, approverRole: 'Project Manager', requiredRole: 'pm' }
    ]
  },
  {
    id: 'standard',
    name: 'Standard Approval',
    description: 'Standard 2-level approval process',
    category: 'standard',
    icon: 'CheckCircle',
    defaultSteps: [
      { stepNumber: 1, approverRole: 'Project Manager', requiredRole: 'pm' },
      { stepNumber: 2, approverRole: 'Director', requiredRole: 'director' }
    ]
  },
  {
    id: 'detailed',
    name: 'Detailed Review',
    description: 'Comprehensive 3-level approval',
    category: 'detailed',
    icon: 'Shield',
    defaultSteps: [
      { stepNumber: 1, approverRole: 'Project Manager', requiredRole: 'pm' },
      { stepNumber: 2, approverRole: 'Cost Control Manager', requiredRole: 'cost_manager' },
      { stepNumber: 3, approverRole: 'Director', requiredRole: 'director' }
    ]
  }
]

/**
 * Create approval store
 */
export const useRABApprovalStore = create<RABApprovalStore>()(
  devtools(
    persist(
      (set, get) => ({
        approvals: {},
        history: {},
        templates: DEFAULT_TEMPLATES,
        loading: {
          approvals: false,
          submission: false,
          action: false
        },

        /**
         * Submit RAB for approval
         */
        submitForApproval: async (projectId: string, rabVersionId: string, chainTemplate: string) => {
          set((state) => ({
            loading: { ...state.loading, submission: true }
          }))

          try {
            // Find template
            const template = get().templates.find(t => t.id === chainTemplate)
            if (!template) {
              throw new Error('Invalid approval template')
            }

            // Create approval chain
            const approvalChain: ApprovalChain = {
              id: generateId(),
              name: template.name,
              description: template.description,
              steps: template.defaultSteps.map(step => ({
                stepNumber: step.stepNumber,
                approverRole: step.approverRole,
                status: 'pending' as const,
                isCurrent: step.stepNumber === 1
              })),
              allowParallel: false,
              requireAll: true
            }

            const approvalId = generateId()
            const now = new Date()

            // Create approval record
            const approval: RABApproval = {
              id: approvalId,
              projectId,
              rabVersionId,
              versionNumber: 1, // TODO: Get from version store
              status: 'pending',
              submittedAt: now,
              submittedBy: 'current-user-id', // TODO: Get from auth
              submittedByName: 'Current User', // TODO: Get from auth
              currentStep: 1,
              approvalChain,
              createdAt: now,
              updatedAt: now
            }

            // Save to Supabase
            await rabApprovalService.createApproval(approval)


            // Create history entry
            const historyEntry: ApprovalHistoryEntry = {
              id: generateId(),
              approvalId,
              stepNumber: 0,
              action: 'submitted',
              userId: approval.submittedBy,
              userName: approval.submittedByName,
              comments: 'Submitted for approval',
              timestamp: now
            }

            // Update state
            set((state) => ({
              approvals: {
                ...state.approvals,
                [approvalId]: approval
              },
              history: {
                ...state.history,
                [approvalId]: [historyEntry]
              },
              loading: { ...state.loading, submission: false }
            }))

            toast.success('RAB submitted for approval')
            return approvalId
          } catch (error) {
            toast.error('Failed to submit for approval')
            set((state) => ({
              loading: { ...state.loading, submission: false }
            }))
            throw error
          }
        },

        /**
         * Approve current step
         */
        approve: async (action: ApprovalAction) => {
          set((state) => ({
            loading: { ...state.loading, action: true }
          }))

          try {
            const approval = get().approvals[action.approvalId]
            if (!approval) {
              throw new Error('Approval not found')
            }

            // Update current step
            const updatedChain = { ...approval.approvalChain }
            const currentStepIndex = updatedChain.steps.findIndex(s => s.stepNumber === approval.currentStep)
            
            if (currentStepIndex === -1) {
              throw new Error('Current step not found')
            }

            updatedChain.steps[currentStepIndex] = {
              ...updatedChain.steps[currentStepIndex],
              status: 'approved',
              approverId: action.approverId,
              approverName: action.approverName,
              comments: action.comments,
              actionDate: new Date(),
              isCurrent: false
            }

            // Determine if there's a next step
            const isLastStep = approval.currentStep === updatedChain.steps.length
            const newStatus = isLastStep ? 'approved' : 'pending'
            const newCurrentStep = isLastStep ? approval.currentStep : approval.currentStep + 1

            // Mark next step as current if exists
            if (!isLastStep) {
              updatedChain.steps[currentStepIndex + 1].isCurrent = true
            }

            const updatedApproval: RABApproval = {
              ...approval,
              status: newStatus,
              currentStep: newCurrentStep,
              approvalChain: updatedChain,
              updatedAt: new Date()
            }

            // Update Supabase
            await rabApprovalService.updateApprovalStatus(
              action.approvalId,
              updatedApproval.status,
              updatedApproval.currentStep,
              updatedApproval.approvalChain
            )


            // Create history entry
            const historyEntry: ApprovalHistoryEntry = {
              id: generateId(),
              approvalId: action.approvalId,
              stepNumber: approval.currentStep,
              action: 'approved',
              userId: action.approverId,
              userName: action.approverName,
              comments: action.comments,
              timestamp: new Date()
            }

            // Update state
            set((state) => ({
              approvals: {
                ...state.approvals,
                [action.approvalId]: updatedApproval
              },
              history: {
                ...state.history,
                [action.approvalId]: [...(state.history[action.approvalId] || []), historyEntry]
              },
              loading: { ...state.loading, action: false }
            }))

            toast.success(isLastStep ? 'RAB fully approved!' : 'Step approved, moving to next approver')
          } catch (error) {
            toast.error('Failed to approve')
            set((state) => ({
              loading: { ...state.loading, action: false }
            }))
            throw error
          }
        },

        /**
         * Reject current step
         */
        reject: async (action: ApprovalAction) => {
          set((state) => ({
            loading: { ...state.loading, action: true }
          }))

          try {
            const approval = get().approvals[action.approvalId]
            if (!approval) {
              throw new Error('Approval not found')
            }

            // Update current step
            const updatedChain = { ...approval.approvalChain }
            const currentStepIndex = updatedChain.steps.findIndex(s => s.stepNumber === approval.currentStep)

            if (currentStepIndex === -1) {
              throw new Error('Current step not found')
            }

            updatedChain.steps[currentStepIndex] = {
              ...updatedChain.steps[currentStepIndex],
              status: 'rejected',
              approverId: action.approverId,
              approverName: action.approverName,
              comments: action.comments,
              actionDate: new Date(),
              isCurrent: false
            }

            const updatedApproval: RABApproval = {
              ...approval,
              status: 'rejected',
              rejectionReason: action.comments,
              approvalChain: updatedChain,
              updatedAt: new Date()
            }

            // Update Supabase
            await rabApprovalService.updateApprovalStatus(
              action.approvalId,
              updatedApproval.status,
              updatedApproval.currentStep,
              updatedApproval.approvalChain,
              updatedApproval.rejectionReason
            )


            // Create history entry
            const historyEntry: ApprovalHistoryEntry = {
              id: generateId(),
              approvalId: action.approvalId,
              stepNumber: approval.currentStep,
              action: 'rejected',
              userId: action.approverId,
              userName: action.approverName,
              comments: action.comments,
              timestamp: new Date()
            }

            // Update state
            set((state) => ({
              approvals: {
                ...state.approvals,
                [action.approvalId]: updatedApproval
              },
              history: {
                ...state.history,
                [action.approvalId]: [...(state.history[action.approvalId] || []), historyEntry]
              },
              loading: { ...state.loading, action: false }
            }))

            toast.error('RAB rejected')
          } catch (error) {
            toast.error('Failed to reject')
            set((state) => ({
              loading: { ...state.loading, action: false }
            }))
            throw error
          }
        },

        /**
         * Cancel approval process
         */
        cancelApproval: async (approvalId: string, reason: string) => {
          try {
            const approval = get().approvals[approvalId]
            if (!approval) {
              throw new Error('Approval not found')
            }

            const updatedApproval: RABApproval = {
              ...approval,
              status: 'cancelled',
              rejectionReason: reason,
              updatedAt: new Date()
            }

            // Update Supabase
            await rabApprovalService.updateApprovalStatus(
              approvalId,
              'cancelled',
              updatedApproval.currentStep,
              updatedApproval.approvalChain,
              reason
            )


            // Create history entry
            const historyEntry: ApprovalHistoryEntry = {
              id: generateId(),
              approvalId,
              stepNumber: approval.currentStep,
              action: 'cancelled',
              userId: approval.submittedBy,
              userName: approval.submittedByName,
              comments: reason,
              timestamp: new Date()
            }

            // Update state
            set((state) => ({
              approvals: {
                ...state.approvals,
                [approvalId]: updatedApproval
              },
              history: {
                ...state.history,
                [approvalId]: [...(state.history[approvalId] || []), historyEntry]
              }
            }))

            toast.info('Approval cancelled')
          } catch (error) {
            console.error('Failed to cancel approval:', error)
            toast.error('Failed to cancel approval')
            throw error
          }
        },

        /**
         * Get approvals for project
         */
        getApprovalsByProject: (projectId: string) => {
          return Object.values(get().approvals).filter(a => a.projectId === projectId)
        },

        /**
         * Get approval by ID
         */
        getApproval: (approvalId: string) => {
          return get().approvals[approvalId]
        },

        /**
         * Get approval history
         */
        getApprovalHistory: (approvalId: string) => {
          return get().history[approvalId] || []
        },

        /**
         * Fetch approvals from Supabase
         */
        fetchApprovals: async (projectId: string) => {
          set((state) => ({
            loading: { ...state.loading, approvals: true }
          }))

          try {
            const data = await rabApprovalService.getApprovalsByProject(projectId)

            const approvals: Record<string, RABApproval> = {}
            data?.forEach((row: Record<string, unknown>) => {
              const rowId = row.id as string
              approvals[rowId] = {
                id: rowId,
                projectId: row.project_id as string,
                rabVersionId: row.rab_version_id as string,
                versionNumber: 1, // TODO: Get from join
                status: row.status as RABApproval['status'],
                submittedAt: new Date(row.submitted_at as string),
                submittedBy: row.submitted_by as string,
                submittedByName: row.submitted_by_name as string,
                currentStep: row.current_step as number,
                rejectionReason: row.rejection_reason as string | undefined,
                approvalChain: row.approval_chain as RABApproval['approvalChain'],
                createdAt: new Date(row.created_at as string),
                updatedAt: new Date(row.updated_at as string)
              }
            })

            set((state) => ({
              approvals: { ...state.approvals, ...approvals },
              loading: { ...state.loading, approvals: false }
            }))
          } catch (error) {
            console.error('Failed to fetch approvals:', error)
            toast.error('Failed to load approvals')
            set((state) => ({
              loading: { ...state.loading, approvals: false }
            }))
          }
        },

        /**
         * Load templates
         */
        loadTemplates: () => {
          set({ templates: DEFAULT_TEMPLATES })
        }
      }),
      {
        name: 'rab-approval-store',
        partialize: (state) => ({
          approvals: state.approvals,
          history: state.history
        })
      }
    ),
    { name: 'RABApprovalStore' }
  )
)
