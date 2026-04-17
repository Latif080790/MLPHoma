import { supabase } from '../lib/supabaseClient'
import { syncTimelineTask, syncTimelineTasks, syncDelete } from '../lib/supabaseSyncService'
import type { TimelineTask } from '../store/timelineStore'
import type { TimelineProgressEvidence } from '../types/progressEvidence'

/**
 * timelineService.ts
 * 
 * Service layer for Timeline/Gantt operations.
 * Separates data access from state management.
 */

export const timelineService = {
  /**
   * Fetch all tasks for a project
   */
  async fetchTasks(projectId: string): Promise<TimelineTask[]> {
    if (!supabase) throw new Error('Supabase not initialized')

    const { data, error } = await supabase
      .from('timeline_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true })

    if (error) throw new Error(error.message)

    type TaskRow = {
      id: string; 
      project_id: string; 
      name: string; 
      description?: string
      start_date: string; 
      end_date: string; 
      duration: number; 
      progress: number
      status: string; 
      priority: string; 
      wbs_id?: string; 
      rab_id?: string
      dependencies?: string | null; 
      assigned_resources?: string[]
      baseline_start_date?: string; 
      baseline_end_date?: string
      created_at: string; 
      updated_at: string
      progress_evidence?: TimelineProgressEvidence
    }

    return ((data || []) as TaskRow[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      duration: row.duration,
      progress: Number(row.progress ?? 0),
      progressEvidence: row.progress_evidence,
      status: (row.status as TimelineTask['status']) || 'not_started',
      priority: (row.priority as TimelineTask['priority']) || 'medium',
      wbsId: row.wbs_id,
      rabId: row.rab_id,
      dependencies: (() => {
        try { 
          return typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : (row.dependencies ?? []) 
        } catch { 
          return [] 
        }
      })(),
      assignedResources: row.assigned_resources ?? [],
      baselineStartDate: row.baseline_start_date,
      baselineEndDate: row.baseline_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  /**
   * Clear all tasks for a project from Supabase
   */
  async clearTasks(projectId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')
    
    const { error } = await supabase
      .from('timeline_tasks')
      .delete()
      .eq('project_id', projectId)

    if (error) throw new Error(error.message)
  },

  /**
   * Single task sync wrapper
   */
  syncTask(task: TimelineTask): void {
    syncTimelineTask(task)
  },

  /**
   * Multiple tasks sync wrapper
   */
  syncTasks(tasks: TimelineTask[], projectId: string): void {
    syncTimelineTasks(tasks, projectId)
  },

  /**
   * Delete task sync wrapper
   */
  syncDelete(id: string): void {
    syncDelete('timeline_tasks', id)
  },

  /**
   * Upload progress photo
   */
  async uploadProgressPhoto(file: File, path: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not initialized')
    const fileName = `${path}/${crypto.randomUUID()}-${file.name}`
    const { data, error } = await supabase.storage.from('progress-evidence').upload(fileName, file)
    if (error) throw new Error(error.message)
    const { data: { publicUrl } } = supabase.storage.from('progress-evidence').getPublicUrl(data.path)
    return publicUrl
  },

  /**
   * Update task progress directly
   */
  async updateTaskProgress(projectId: string, taskId: string, progress: number): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized')
    const { error } = await supabase
      .from('timeline_tasks')
      .update({ progress, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('project_id', projectId)
    
    if (error) throw new Error(error.message)
  }
}
