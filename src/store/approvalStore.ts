/**
 * approvalStore.ts
 * Zustand store for Approval Workflow state management.
 */

import { create } from 'zustand'
import { approvalService } from '../services/approvalService'
import type { ApprovalRequest, CreateApprovalInput } from '../types/approval'

interface ApprovalState {
    approvals: ApprovalRequest[]
    pendingApprovals: ApprovalRequest[]
    pendingCount: number
    loading: boolean
    error: string | null

    // Actions
    fetchApprovals: (projectId: string) => Promise<void>
    fetchPendingApprovals: (projectId?: string) => Promise<void>
    fetchPendingCount: (projectId?: string) => Promise<void>
    createApproval: (input: CreateApprovalInput) => Promise<ApprovalRequest>
    approve: (approvalId: string, approverId: string, approverName: string, notes?: string) => Promise<void>
    reject: (approvalId: string, approverId: string, approverName: string, reason: string) => Promise<void>
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
    approvals: [],
    pendingApprovals: [],
    pendingCount: 0,
    loading: false,
    error: null,

    fetchApprovals: async (projectId: string) => {
        set({ loading: true, error: null })
        try {
            const data = await approvalService.getApprovals(projectId)
            set({ approvals: data, loading: false })
        } catch (err: any) {
            set({ error: err.message, loading: false })
        }
    },

    fetchPendingApprovals: async (projectId?: string) => {
        set({ loading: true, error: null })
        try {
            const data = await approvalService.getPendingApprovals(projectId)
            set({ pendingApprovals: data, pendingCount: data.length, loading: false })
        } catch (err: any) {
            set({ error: err.message, loading: false })
        }
    },

    fetchPendingCount: async (projectId?: string) => {
        try {
            const count = await approvalService.getPendingCount(projectId)
            set({ pendingCount: count })
        } catch (err: any) {
            console.warn('Failed to fetch pending count:', err)
        }
    },

    createApproval: async (input: CreateApprovalInput) => {
        set({ loading: true, error: null })
        try {
            const approval = await approvalService.createApproval(input)
            set(state => ({
                pendingApprovals: [approval, ...state.pendingApprovals],
                pendingCount: state.pendingCount + 1,
                loading: false,
            }))
            return approval
        } catch (err: any) {
            set({ error: err.message, loading: false })
            throw err
        }
    },

    approve: async (approvalId: string, approverId: string, approverName: string, notes?: string) => {
        set({ loading: true, error: null })
        try {
            const updated = await approvalService.approve(approvalId, approverId, approverName, notes)
            set(state => ({
                approvals: state.approvals.map(a => a.id === approvalId ? updated : a),
                pendingApprovals: state.pendingApprovals.filter(a => a.id !== approvalId),
                pendingCount: Math.max(0, state.pendingCount - 1),
                loading: false,
            }))
        } catch (err: any) {
            set({ error: err.message, loading: false })
            throw err
        }
    },

    reject: async (approvalId: string, approverId: string, approverName: string, reason: string) => {
        set({ loading: true, error: null })
        try {
            const updated = await approvalService.reject(approvalId, approverId, approverName, reason)
            set(state => ({
                approvals: state.approvals.map(a => a.id === approvalId ? updated : a),
                pendingApprovals: state.pendingApprovals.filter(a => a.id !== approvalId),
                pendingCount: Math.max(0, state.pendingCount - 1),
                loading: false,
            }))
        } catch (err: any) {
            set({ error: err.message, loading: false })
            throw err
        }
    },
}))
