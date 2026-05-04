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
  tkdnScore: number
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
  details?: Record<string, unknown>
}

// ─── Internal row types ──────────────────────────────────────────────────────
type RabRow = { final_total: number | null }
type RapRow = { total_budget: number | null; actual_cost: number | null; committed_cost: number | null }
type ProgressRow = { progress: number | null }
type TaskRow = { id: string; name: string; end_date: string; progress: number | null; wbs_id?: string | null }
type MemberRow = { id: string; user_id: string; project_role?: string | null; assigned_at: string }
type AuditRow = { id: string; action: string; entity_type?: string | null; entity_id?: string | null; user_name?: string | null; created_at: string; details?: Record<string, unknown> | null }

// ─── Service ─────────────────────────────────────────────────────────────────

export const projectOverviewService = {
  /**
   * getProjectKPIs
   * Returns budget breakdown: RAB total, RAP total, actual cost, committed, remaining, progress
   */
  async getProjectKPIs(projectId: string): Promise<ProjectKPIs> {
    const client = assertSupabase()

    // RAB total (sum of rab_items final_total for this project)
    const { data: rabData } = await client
      .from('rab_items')
      .select('final_total')
      .eq('project_id', projectId)

    const rabTotal = (rabData || []).reduce((sum: number, r: RabRow) => sum + (r.final_total || 0), 0)

    // RAP items (total_budget + actual_cost)
    const { data: rapData } = await client
      .from('rap_items')
      .select('total_budget, actual_cost, committed_cost')
      .eq('project_id', projectId)

    const rapTotal = (rapData || []).reduce((sum: number, r: RapRow) => sum + (r.total_budget || 0), 0)
    const actualCost = (rapData || []).reduce((sum: number, r: RapRow) => sum + (r.actual_cost || 0), 0)
    const committedCost = (rapData || []).reduce((sum: number, r: RapRow) => sum + (r.committed_cost || 0), 0)
    const remainingBudget = rabTotal - actualCost

    // Overall progress from timeline_tasks
    const { data: tasks } = await client
      .from('timeline_tasks')
      .select('progress')
      .eq('project_id', projectId)

    const progressPercent = tasks && tasks.length > 0
      ? Math.round(tasks.reduce((s: number, t: ProgressRow) => s + (t.progress || 0), 0) / tasks.length)
      : 0

    // Fetch TKDN Score via RPC
    const { data: tkdnData } = await client.rpc('rpc_compute_project_tkdn', { p_project_id: projectId })
    const tkdnScore = (tkdnData as any)?.tkdn_score || 0

    return { rabTotal, rapTotal, actualCost, committedCost, remainingBudget, progressPercent, tkdnScore }
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
   * Returns tasks with start_date >= today, ordered by nearest first.
   */
  async getUpcomingMilestones(projectId: string, limit = 5): Promise<TaskSummary[]> {
    const client = assertSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await client
      .from('timeline_tasks')
      .select('id, name, end_date, progress, wbs_id')
      .eq('project_id', projectId)
      .gte('end_date', today)
      .order('end_date', { ascending: true })
      .limit(limit)

    if (error) {
      console.warn('[projectOverview] getUpcomingMilestones error:', error.message)
      return []
    }

    const now = new Date()
    return (data || []).map((t: TaskRow) => {
      const taskDate = new Date(t.end_date)
      const diffMs = taskDate.getTime() - now.getTime()
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: t.id,
        name: t.name,
        endDate: t.end_date,
        progress: t.progress || 0,
        wbsCode: t.wbs_id || undefined,
        daysUntilDue,
      }
    })
  },

  /**
   * getOverdueTasks
   * Returns tasks with start_date < today AND progress < 100.
   */
  async getOverdueTasks(projectId: string, limit = 5): Promise<TaskSummary[]> {
    const client = assertSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await client
      .from('timeline_tasks')
      .select('id, name, end_date, progress, wbs_id')
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
    return (data || []).map((t: TaskRow) => {
      const taskDate = new Date(t.end_date)
      const diffMs = taskDate.getTime() - now.getTime()
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: t.id,
        name: t.name,
        endDate: t.end_date,
        progress: t.progress || 0,
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
      .select('id, user_id, project_role, assigned_at')
      .eq('project_id', projectId)

    if (error) {
      console.warn('[projectOverview] getTeamMembers error:', error.message)
      return []
    }

    const userIds = (data || [])
      .map((row: MemberRow) => row.user_id)
      .filter((id: string | null | undefined): id is string => typeof id === 'string' && id.length > 0)

    const profileMap = new Map<string, { full_name?: string; email?: string }>()
    if (userIds.length > 0) {
      const uniqueUserIds = Array.from(new Set(userIds))
      const { data: profilesData, error: profileError } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uniqueUserIds)

      if (profileError) {
        console.warn('[projectOverview] getTeamMembers profiles error:', profileError.message)
      } else {
        for (const profile of profilesData || []) {
          profileMap.set(profile.id, {
            full_name: profile.full_name || undefined,
            email: profile.email || undefined,
          })
        }
      }
    }

    return (data || []).map((row: MemberRow) => ({
      id: row.id,
      userId: row.user_id,
      role: row.project_role || 'user',
      assignedAt: row.assigned_at,
      fullName: profileMap.get(row.user_id)?.full_name || undefined,
      email: profileMap.get(row.user_id)?.email || undefined,
    }))
  },

  /**
   * getRecentActivity
   * Queries audit_logs for entries related to this project.
   * Matches on entity_id = projectId OR details->>project_id = projectId.
   */
  async getRecentActivity(projectId: string, limit = 10): Promise<ActivityEntry[]> {
    const client = assertSupabase()

    const fetchSize = Math.max(limit * 5, 50)
    const { data, error } = await client
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, user_name, created_at, details')
      .order('created_at', { ascending: false })
      .limit(fetchSize)

    if (error) {
      console.warn('[projectOverview] getRecentActivity error:', error.message)
      return []
    }

    const filtered = (data || []).filter((row: AuditRow) => {
      const detailsProjectId = row?.details?.project_id
      return row.entity_id === projectId || detailsProjectId === projectId
    })

    // Deduplicate
    const seen = new Set<string>()
    const merged: ActivityEntry[] = []
    for (const row of filtered) {
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
