/**
 * costForecastStore.ts
 * Manages historical snapshots and predictive metrics for the forecasting dashboard.
 */
import { create } from 'zustand'
import { forecastingService, type ForecastProjections } from '../services/forecastingService'
import type { ProjectDailyMetric } from '../services/evmService'
import type { CostDashboardSnapshot } from '../services/costDashboardService'

interface ForecastState {
    history: ProjectDailyMetric[]
    projections: ForecastProjections | null
    loading: boolean
    error: string | null
    historyProjectId: string | null

    fetchHistory: (projectId: string) => Promise<void>
    generateSnapshot: () => Promise<void>

    snapshot: CostDashboardSnapshot | null
    snapshotLoading: boolean
    snapshotProjectId: string | null
    fetchSnapshot: (projectId: string) => Promise<void>
}

export const useForecastStore = create<ForecastState>((set, get) => ({
    history: [],
    projections: null,
    loading: false,
    error: null,
    historyProjectId: null,

    fetchHistory: async (projectId: string) => {
        set({ loading: true, error: null, historyProjectId: projectId })
        try {
            const history = await forecastingService.getHistory(projectId)
            const projections = await forecastingService.getTrendForecast(projectId)
            if (get().historyProjectId === projectId) {
                set({ history: history || [], projections, loading: false })
            } else {
                set({ loading: false })
            }
        } catch (err: unknown) {
            if (get().historyProjectId === projectId) {
                set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
            } else {
                set({ loading: false })
            }
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
    },

    snapshot: null,
    snapshotLoading: false,
    snapshotProjectId: null,
    fetchSnapshot: async (projectId: string) => {
        set({ snapshotLoading: true, snapshotProjectId: projectId })
        try {
            const { costDashboardService } = await import('../services/costDashboardService')
            const snapshot = await costDashboardService.getDashboardSnapshot(projectId)
            if (get().snapshotProjectId === projectId) {
                set({ snapshot, snapshotLoading: false })
            } else {
                set({ snapshotLoading: false })
            }
        } catch (err: unknown) {
            if (get().snapshotProjectId === projectId) {
                set({ error: (err as Error).message, snapshotLoading: false })
            } else {
                set({ snapshotLoading: false })
            }
        }
    },
}))
