/**
 * costForecastStore.ts
 * Manages historical snapshots and predictive metrics for the forecasting dashboard.
 */
import { create } from 'zustand'
import { forecastingService, type ForecastProjections } from '../services/forecastingService'
import type { ProjectDailyMetric } from '../services/evmService'

interface ForecastState {
    history: ProjectDailyMetric[]
    projections: ForecastProjections | null
    loading: boolean
    error: string | null
    
    fetchHistory: (projectId: string) => Promise<void>
    generateSnapshot: () => Promise<void>
}

export const useForecastStore = create<ForecastState>((set, get) => ({
    history: [],
    projections: null,
    loading: false,
    error: null,

    fetchHistory: async (projectId: string) => {
        set({ loading: true, error: null })
        try {
            // 1. Fetch metrics history for charting
            const history = await forecastingService.getHistory(projectId)

            // 2. Fetch projections
            const projections = await forecastingService.getTrendForecast(projectId)

            set({ history: history || [], projections, loading: false })
        } catch (err: unknown) {
            set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
        }
    },

    generateSnapshot: async () => {
        set({ loading: true })
        try {
            await forecastingService.generateSnapshot()
        } catch (err: unknown) {
            set({ error: err instanceof Error ? err.message : 'Unknown error' })
        } finally {
            set({ loading: false })
        }
    }
}))
