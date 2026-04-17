import { assertSupabase } from '../lib/supabaseClient'

export const projectService = {
  fetchProjects: async () => {
    const client = assertSupabase()
    const { data, error } = await client.from('projects').select('*')
    if (error) throw error
    return { data, error: null }
  },
  
  freezeProjectBaseline: async (projectId: string, snapshotName: string = 'Initial Baseline') => {
    const client = assertSupabase()
    const { error } = await client.rpc('freeze_project_baseline', {
      p_project_id: projectId,
      p_snapshot_name: snapshotName
    })
    if (error) throw error
  }
}
