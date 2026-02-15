/**
 * projectOverviewService.ts
 * Aggregates per-project data for the Project Overview page.
 * All queries go through assertSupabase() service layer.
 *
 * Sections served:
 *  - KPI budget breakdown (RAB vs RAP vs Actual vs Remaining)
 *  - Top risks (delegates to riskService)
 *  - Upcoming milestones & overdue tasks
 *  - Team members (project_members + profiles join)
 *  - Recent activity (audit_logs)
 */

import { assertSupabase } from '../lib/supabaseClient'
import { riskService } from './riskService'
import type { Risk } from '../types/risk'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProjectKPIs {
  rabTotal: number
  rapTotal: number
  actualCost: number
  committedCost: number
  remainingBudget: number
  progressPercent: number
}

export interface TaskSummary {
  id: string
  name: string
  endDate: string
  progress: number
  assignee?: string
  wbsCode?: string
  daysUntilDue: number // negative = overdue
}

export interface TeamMember {
  id: string
  userId: string
  role: string
  assignedAt: string
  fullName?: string
  email?: string
}

export interface ActivityEntry {
  id: string
  action: string
  entityType?: string
  entityId?: string
  userName?: string
  createdAt: string
  details?: Record<string, any>
}

// ─── Service ────────────────────────────────────────────────────────────────

export const projectOverviewService = {
  /**
   * getProjectKPIs
   * Returns budget breakdown: RAB total, RAP total, actual cost, committed, remaining, progress
   */
  async getProjectKPIs(projectId: string): Promise<ProjectKPIs> {
    const client = assertSupabase()

    // RAB total (sum of rab_items total_price for this project)
    const { data: rabData } = await client
      .from('rab_items')
      .select('total_price')
      .eq('project_id', projectId)

    const rabTotal = (rabData || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0)

    // RAP items (committed + actual)
    const { data: rapData } = await client
      .from('rap_items')
      .select('amount, actual_cost')
      .eq('project_id', projectId)

    const rapTotal = (rapData || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0)
    const actualCost = (rapData || []).reduce((sum: number, r: any) => sum + (r.actual_cost || 0), 0)
    const committedCost = rapTotal // committed = RAP amount
    const remainingBudget = rabTotal - actualCost

    // Overall progress from timeline_tasks
    const { data: tasks } = await client
      .from('timeline_tasks')
      .select('progress')
      .eq('project_id', projectId)

    const progressPercent = tasks && tasks.length > 0
      ? Math.round(tasks.reduce((s: number, t: any) => s + (t.progress || 0), 0) / tasks.length)
      : 0

    return { rabTotal, rapTotal, actualCost, committedCost, remainingBudget, progressPercent }
  },

  /**
   * getTopRisks
   * Delegates to riskService and filters out CLOSED risks, returns top N by score.
   */
  async getTopRisks(projectId: string, limit = 5): Promise<Risk[]> {
    try {
      const all = await riskService.getRisks(projectId)
      return all.filter((r) => r.status !== 'CLOSED').slice(0, limit)
    } catch {
      return []
    }
  },

  /**
   * getUpcomingMilestones
   * Returns tasks with end_date >= today, ordered by nearest first.
   */
  async getUpcomingMilestones(projectId: string, limit = 5): Promise<TaskSummary[]> {
    const client = assertSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await client
      .from('timeline_tasks')
      .select('id, name, end_date, progress, assignee, wbs_id')
      .eq('project_id', projectId)
      .gte('end_date', today)
      .order('end_date', { ascending: true })
      .limit(limit)

    if (error) {
      console.warn('[projectOverview] getUpcomingMilestones error:', error.message)
      return []
    }

    const now = new Date()
    return (data || []).map((t: any) => {
      const endDate = new Date(t.end_date)
      const diffMs = endDate.getTime() - now.getTime()
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: t.id,
        name: t.name,
        endDate: t.end_date,
        progress: t.progress || 0,
        assignee: t.assignee || undefined,
        wbsCode: t.wbs_id || undefined,
        daysUntilDue,
      }
    })
  },

  /**
   * getOverdueTasks
   * Returns tasks with end_date < today AND progress < 100.
   */
  async getOverdueTasks(projectId: string, limit = 5): Promise<TaskSummary[]> {
    const client = assertSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await client
      .from('timeline_tasks')
      .select('id, name, end_date, progress, assignee, wbs_id')
      .eq('project_id', projectId)
      .lt('end_date', today)
      .lt('progress', 100)
      .order('end_date', { ascending: true })
      .limit(limit)

    if (error) {
      console.warn('[projectOverview] getOverdueTasks error:', error.message)
      return []
    }

    const now = new Date()
    return (data || []).map((t: any) => {
      const endDate = new Date(t.end_date)
      const diffMs = endDate.getTime() - now.getTime()
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: t.id,
        name: t.name,
        endDate: t.end_date,
        progress: t.progress || 0,
        assignee: t.assignee || undefined,
        wbsCode: t.wbs_id || undefined,
        daysUntilDue,
      }
    })
  },

  /**
   * getTeamMembers
   * Queries project_members joined with profiles for name/email.
   */
  async getTeamMembers(projectId: string): Promise<TeamMember[]> {
    const client = assertSupabase()

    const { data, error } = await client
      .from('project_members')
      .select(`
        id,
        user_id,
        project_role,
        assigned_at,
        profiles ( full_name, email )
      `)
      .eq('project_id', projectId)

    if (error) {
      console.warn('[projectOverview] getTeamMembers error:', error.message)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      role: row.project_role || 'user',
      assignedAt: row.assigned_at,
      fullName: row.profiles?.full_name || undefined,
      email: row.profiles?.email || undefined,
    }))
  },

  /**
   * getRecentActivity
   * Queries audit_logs for entries related to this project.
   * Matches on entity_id = projectId OR details->>project_id = projectId.
   */
  async getRecentActivity(projectId: string, limit = 10): Promise<ActivityEntry[]> {
    const client = assertSupabase()

    // Primary query: entity_id matches projectId
    const { data: byEntity } = await client
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, user_name, created_at, details')
      .eq('entity_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Secondary query: details->project_id matches (different entity)
    const { data: byDetails } = await client
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, user_name, created_at, details')
      .filter('details->>project_id', 'eq', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Merge & deduplicate
    const seen = new Set<string>()
    const merged: ActivityEntry[] = []
    for (const row of [...(byEntity || []), ...(byDetails || [])]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      merged.push({
        id: row.id,
        action: row.action || 'unknown',
        entityType: row.entity_type || undefined,
        entityId: row.entity_id || undefined,
        userName: row.user_name || undefined,
        createdAt: row.created_at,
        details: row.details || undefined,
      })
    }

    // Sort by createdAt desc and limit
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return merged.slice(0, limit)
  },
}
