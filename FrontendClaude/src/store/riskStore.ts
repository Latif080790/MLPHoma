
import { create } from 'zustand'
import { Risk } from '../types/risk'
import { riskService } from '../services/riskService'

interface RiskState {
    risks: Risk[]
    loading: boolean
    error: string | null

    fetchRisks: (projectId: string) => Promise<void>
    createRisk: (risk: Partial<Risk>) => Promise<void>
    updateRisk: (id: string, updates: Partial<Risk>) => Promise<void>
    deleteRisk: (id: string) => Promise<void>
}

export const useRiskStore = create<RiskState>((set) => ({
    risks: [],
    loading: false,
    error: null,

    fetchRisks: async (projectId: string) => {
        set({ loading: true, error: null })
        try {
            const data = await riskService.getRisks(projectId)
            set({ risks: data, loading: false })
        } catch (err: unknown) {
            set({ error: (err as Error).message, loading: false })
        }
    },

    createRisk: async (risk: Partial<Risk>) => {
        set({ loading: true, error: null })
        try {
            const newRisk = await riskService.createRisk(risk)
            // Optimistic updatish - simplified to just re-fetch for now or append
            // If we had the full object returned with joins, we could append.
            // But getRisks has joins. So let's refetch or append safely.
            // Append requires matching the shape.

            const completeRisk = {
                ...newRisk,
                wbs_name: '' // Placeholder until refresh
            }

            set(state => ({
                risks: [completeRisk, ...state.risks],
                loading: false
            }))
        } catch (err: unknown) {
            set({ error: (err as Error).message, loading: false })
            throw err
        }
    },

    updateRisk: async (id: string, updates: Partial<Risk>) => {
        try {
            await riskService.updateRisk(id, updates)
            set(state => ({
                risks: state.risks.map(r => r.id === id ? { ...r, ...updates } : r)
            }))
        } catch (err: unknown) {
            set({ error: (err as Error).message })
            throw err
        }
    },

    deleteRisk: async (id: string) => {
        try {
            await riskService.deleteRisk(id)
            set(state => ({
                risks: state.risks.filter(r => r.id !== id)
            }))
        } catch (err: unknown) {
            set({ error: (err as Error).message })
        }
    }
}))
