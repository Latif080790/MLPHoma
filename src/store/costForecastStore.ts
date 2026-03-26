/**
 * costForecastStore.ts
 * Manages historical snapshots and predictive metrics for the forecasting dashboard.
 */
import { create } from 'zustand'
import { assertSupabase } from '../lib/supabaseClient'
import { forecastingService, type ForecastProjections } from '../services/forecastingService'

interface ForecastState {
    history: any[]
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
            const supabase = assertSupabase()
            
            // 1. Fetch metrics history for charting
            const { data: history, error: hError } = await supabase
                .from('project_daily_metrics')
                .select('*')
                .eq('project_id', projectId)
                .order('snapshot_date', { ascending: true })

            if (hError) throw hError

            // 2. Fetch projections
            const projections = await forecastingService.getTrendForecast(projectId)

            set({ history: history || [], projections, loading: false })
        } catch (err: any) {
            set({ error: err.message, loading: false })
        }
    },

    generateSnapshot: async () => {
        set({ loading: true })
        try {
            const supabase = assertSupabase()
            const { error } = await supabase.rpc('rpc_snapshot_all_projects')
            if (error) throw error
        } catch (err: any) {
            set({ error: err.message })
        } finally {
            set({ loading: false })
        }
    }
}))
