import { create } from 'zustand'
import { featureConfigService } from '../services/featureConfigService'
import { generateDefaultFeatureConfig } from '../lib/featureDefaults'
import type { FeatureConfig } from '../config/features/featureConfig'
import { toast } from 'sonner'

interface FeatureConfigState {
  configs: Record<string, FeatureConfig>
  loading: boolean
  error: string | null

  fetchConfig: (projectId: string) => Promise<FeatureConfig>
  updateConfig: (projectId: string, updates: Partial<FeatureConfig>) => Promise<void>
  resetToDefaults: (projectId: string) => Promise<void>
}

export const useFeatureConfigStore = create<FeatureConfigState>((set, get) => ({
  configs: {},
  loading: false,
  error: null,

  fetchConfig: async (projectId: string) => {
    set({ loading: true, error: null })
    try {
      let config = await featureConfigService.getFeatureConfig(projectId)

      if (!config) {
        // Initialize with defaults if not exists
        config = generateDefaultFeatureConfig(projectId)
        await featureConfigService.createFeatureConfig(projectId, config)
      }

      set(state => ({
        configs: { ...state.configs, [projectId]: config },
        loading: false
      }))
      return config
    } catch (err: any) {
      set({ error: err.message, loading: false })
      toast.error('Failed to load feature configuration')
      throw err
    }
  },

  updateConfig: async (projectId: string, updates: Partial<FeatureConfig>) => {
    const current = get().configs[projectId]
    if (!current) return

    const newConfig = { ...current, ...updates }
    
    // Optimistic update
    set(state => ({
      configs: { ...state.configs, [projectId]: newConfig }
    }))

    try {
      await featureConfigService.updateFeatureConfig(projectId, newConfig)
    } catch (err: any) {
      // Rollback
      set(state => ({
        configs: { ...state.configs, [projectId]: current }
      }))
      toast.error('Failed to save configuration')
    }
  },

  resetToDefaults: async (projectId: string) => {
    const defaultConfig = generateDefaultFeatureConfig(projectId)
    await get().updateConfig(projectId, defaultConfig)
    toast.success('Configuration reset to defaults')
  }
}))
