import { assertSupabase } from '../lib/supabaseClient'
import type { FeatureConfig } from '../config/features/featureConfig'

export const featureConfigService = {
  getFeatureConfig: async (projectId: string) => {
    const client = assertSupabase()
    const { data, error } = await client
      .from('feature_configs')
      .select('config')
      .eq('project_id', projectId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error
    }
    
    return data ? (data.config as FeatureConfig) : null
  },

  createFeatureConfig: async (projectId: string, config: FeatureConfig) => {
    const client = assertSupabase()
    const { error } = await client.from('feature_configs').insert({
      project_id: projectId,
      config: config
    })
    if (error) throw error
  },

  updateFeatureConfig: async (projectId: string, config: FeatureConfig) => {
    const client = assertSupabase()
    const { error } = await client
      .from('feature_configs')
      .upsert({
        project_id: projectId,
        config: config,
        updated_at: new Date().toISOString()
      })
    if (error) throw error
  }
}
