/**
 * ProjectOverview v2.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Operational overview of the currently active project — REDESIGNED with
 * enterprise design system patterns (PageShell, GlobalContextBar, SummaryStrip,
 * WorkspaceHeader, AlertStrip).
 *
 * Page Anatomy (per Design System Rules v1):
 *   L1: GlobalContextBar → project context, sync, health
 *   L3: WorkspaceHeader  → title, settings action
 *   L4: SummaryStrip     → 6 KPI metrics (compact-cards variant)
 *       AlertStrip       → exception/blockers summary
 *   L6: Main Grid        → Timeline, Risks, Team, Activity, Quick Links
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ClipboardList,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  AlertTriangle,
  Users,
  Activity,
  ArrowRight,
  Calculator,
  Truck,
  Wallet,
  FolderOpen,
  FileDiff,
  Clock,
  ExternalLink,
  BarChart3,
  Settings2,
} from 'lucide-react'
import { useProjectStore, type Project } from '@/store/projectStore'
import {
  projectOverviewService,
  type ProjectKPIs,
  type TaskSummary,
  type TeamMember,
  type ActivityEntry,
} from '@/services/projectOverviewService'
import type { Risk } from '@/types/risk'
import { formatIDR } from '@/lib/utils'
import { format } from 'date-fns'
import { ProjectSettingsDialog } from '@/components/project/ProjectSettingsDialog'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import ModulePageState from '@/components/common/ModulePageState'
import { toast } from 'sonner'

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip, AlertStrip } from '@/components/patterns'
import type { } from '@/components/patterns/SummaryStrip'

// ─── Helper: risk score color ───────────────────────────────────────────────
function riskScoreColor(score: number) {
  if (score >= 15) return 'bg-[hsl(var(--color-status-danger-bg))] text-[hsl(var(--color-status-danger-fg))]'
  if (score >= 7) return 'bg-[hsl(var(--color-status-warning-bg))] text-[hsl(var(--color-status-warning-fg))]'
  return 'bg-[hsl(var(--color-status-success-bg))] text-[hsl(var(--color-status-success-fg))]'
}

// ─── Helper: days badge ─────────────────────────────────────────────────────
function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge variant="destructive" className="text-[var(--font-size-11)]">{Math.abs(days)}d overdue</Badge>
  }
  if (days <= 3) {
    return <Badge className="bg-[hsl(var(--color-status-warning-bg))] text-[hsl(var(--color-status-warning-fg))] text-[var(--font-size-11)]">{days}d left</Badge>
  }
  return <Badge variant="secondary" className="text-[var(--font-size-11)]">{days}d left</Badge>
}

// ─── Section: Timeline Summary ──────────────────────────────────────────────
function TimelineSection({
  upcoming,
  overdue,
}: {
  upcoming: TaskSummary[]
  overdue: TaskSummary[]
}) {
  const navigate = useNavigate()

  return (
    <Card className="col-span-1 lg:col-span-2 border-[hsl(var(--color-border-subtle))]">
      <CardHeader className="pb-[var(--space-3)]">
        <CardTitle className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] flex items-center gap-[var(--space-2)]">
          <CalendarClock className="h-4 w-4 text-[hsl(var(--color-category-schedule))]" /> Timeline Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-[var(--space-4)]">
        {/* Overdue */}
        {overdue.length > 0 && (
          <div>
            <h4 className="text-[var(--font-size-11)] font-[var(--font-weight-semibold)] text-[hsl(var(--color-status-danger-fg))] uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--space-2)]">Overdue Tasks</h4>
            <div className="space-y-[var(--space-2)]">
              {overdue.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-l-2 border-[hsl(var(--color-status-danger-border))] pl-[var(--space-3)] py-[var(--space-1)]">
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--font-size-13)] font-[var(--font-weight-medium)] truncate block">{t.name}</span>
                    <div className="flex items-center gap-[var(--space-2)] text-[var(--font-size-11)] text-[hsl(var(--color-text-tertiary))] mt-[var(--space-1)]">
                      {t.wbsCode && <span>WBS: {t.wbsCode}</span>}
                      {t.assignee && <span>• {t.assignee}</span>}
                      <span>• Due: {t.endDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)] ml-[var(--space-2)] flex-shrink-0">
                    <Progress value={t.progress} className="h-1.5 w-16" />
                    <span className="text-[var(--font-size-11)] w-8 text-right">{t.progress}%</span>
                    <DaysBadge days={t.daysUntilDue} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 ? (
          <div>
            <h4 className="text-[var(--font-size-11)] font-[var(--font-weight-semibold)] text-[hsl(var(--color-status-success-fg))] uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--space-2)]">Upcoming</h4>
            <div className="space-y-[var(--space-2)]">
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-l-2 border-[hsl(var(--color-status-success-border))] pl-[var(--space-3)] py-[var(--space-1)]">
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--font-size-13)] font-[var(--font-weight-medium)] truncate block">{t.name}</span>
                    <div className="flex items-center gap-[var(--space-2)] text-[var(--font-size-11)] text-[hsl(var(--color-text-tertiary))] mt-[var(--space-1)]">
                      {t.wbsCode && <span>WBS: {t.wbsCode}</span>}
                      {t.assignee && <span>• {t.assignee}</span>}
                      <span>• Due: {t.endDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)] ml-[var(--space-2)] flex-shrink-0">
                    <Progress value={t.progress} className="h-1.5 w-16" />
                    <span className="text-[var(--font-size-11)] w-8 text-right">{t.progress}%</span>
                    <DaysBadge days={t.daysUntilDue} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !overdue.length && (
            <p className="text-[var(--font-size-13)] text-[hsl(var(--color-text-tertiary))] text-center py-[var(--space-4)]">No timeline tasks found</p>
          )
        )}

        <Button variant="outline" size="sm" className="w-full text-[var(--font-size-12)]" onClick={() => navigate('/schedule')}>
          View Full Schedule <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Section: Risks ─────────────────────────────────────────────────────────
function RiskSection({ risks }: { risks: Risk[] }) {
  const navigate = useNavigate()

  return (
    <Card className="border-[hsl(var(--color-border-subtle))]">
      <CardHeader className="pb-[var(--space-3)]">
        <CardTitle className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] flex items-center gap-[var(--space-2)]">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--color-category-risk))]" /> Top Risks & Issues
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-[var(--space-2)]">
        {risks.length === 0 ? (
          <p className="text-[var(--font-size-13)] text-[hsl(var(--color-text-tertiary))] text-center py-[var(--space-4)]">No open risks</p>
        ) : (
          risks.map((risk) => (
            <div key={risk.id} className="flex items-start justify-between gap-[var(--space-2)] py-[var(--space-1)] border-b border-[hsl(var(--color-border-subtle))] last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[var(--font-size-13)] font-[var(--font-weight-medium)] truncate">{risk.description}</p>
                <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
                  <Badge variant="outline" className="text-[var(--font-size-11)]">{risk.category}</Badge>
                  {risk.owner && <span className="text-[var(--font-size-11)] text-[hsl(var(--color-text-tertiary))]">Owner: {risk.owner}</span>}
                </div>
              </div>
              <Badge className={`text-[var(--font-size-11)] flex-shrink-0 ${riskScoreColor(risk.risk_score)}`}>
                {risk.probability}×{risk.impact}={risk.risk_score}
              </Badge>
            </div>
          ))
        )}
        <Button variant="outline" size="sm" className="w-full mt-[var(--space-2)] text-[var(--font-size-12)]" onClick={() => navigate('/change-management')}>
          View All Risks <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Section: Team Members ──────────────────────────────────────────────────
function TeamSection({ members }: { members: TeamMember[] }) {
  const roleColors: Record<string, string> = {
    admin: 'bg-[hsl(var(--color-status-danger-bg))] text-[hsl(var(--color-status-danger-fg))]',
    manager: 'bg-[hsl(var(--color-status-info-bg))] text-[hsl(var(--color-status-info-fg))]',
    user: 'bg-[hsl(var(--color-surface-subtle))] text-[hsl(var(--color-text-secondary))]',
    viewer: 'bg-[hsl(var(--color-surface-subtle))] text-[hsl(var(--color-text-tertiary))]',
  }

  return (
    <Card className="border-[hsl(var(--color-border-subtle))]">
      <CardHeader className="pb-[var(--space-3)]">
        <CardTitle className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] flex items-center gap-[var(--space-2)]">
          <Users className="h-4 w-4 text-[hsl(var(--color-category-equipment))]" /> Team Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-[var(--font-size-13)] text-[hsl(var(--color-text-tertiary))] text-center py-[var(--space-4)]">No team members assigned</p>
        ) : (
          <div className="space-y-[var(--space-3)]">
            {members.map((m) => {
              const initials = (m.fullName || m.email || '?')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div key={m.id} className="flex items-center gap-[var(--space-3)]">
                  <div className="h-8 w-8 rounded-[var(--radius-full)] bg-gradient-to-br from-[hsl(var(--brand-secondary-500))] to-[hsl(var(--brand-indigo-500))] text-white flex items-center justify-center text-[var(--font-size-11)] font-[var(--font-weight-bold)] flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--font-size-13)] font-[var(--font-weight-medium)] truncate">{m.fullName || 'Unknown'}</p>
                    {m.email && <p className="text-[var(--font-size-11)] text-[hsl(var(--color-text-tertiary))] truncate">{m.email}</p>}
                  </div>
                  <Badge className={`text-[var(--font-size-11)] ${roleColors[m.role] || roleColors.user}`}>
                    {m.role}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Recent Activity ───────────────────────────────────────────────
function ActivitySection({ activities }: { activities: ActivityEntry[] }) {
  return (
    <Card className="col-span-1 lg:col-span-3 border-[hsl(var(--color-border-subtle))]">
      <CardHeader className="pb-[var(--space-3)]">
        <CardTitle className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] flex items-center gap-[var(--space-2)]">
          <Activity className="h-4 w-4 text-[hsl(var(--brand-cyan-500))]" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-[var(--font-size-13)] text-[hsl(var(--color-text-tertiary))] text-center py-[var(--space-4)]">No recent activity recorded</p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-[var(--space-3)] py-[var(--space-2)] border-b border-[hsl(var(--color-border-subtle))] last:border-0">
                <div className="h-2 w-2 rounded-[var(--radius-full)] bg-[hsl(var(--brand-cyan-500))] mt-2 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[var(--space-2)] flex-wrap">
                    <span className="text-[var(--font-size-13)] font-[var(--font-weight-medium)]">{a.action}</span>
                    {a.entityType && (
                      <Badge variant="outline" className="text-[var(--font-size-11)]">{a.entityType}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-[var(--space-2)] text-[var(--font-size-11)] text-[hsl(var(--color-text-tertiary))] mt-[var(--space-1)]">
                    {a.userName && <span>{a.userName}</span>}
                    <span>• {formatActivityDate(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatActivityDate(iso: string): string {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm')
  } catch {
    return iso
  }
}

// ─── Section: Quick Links ───────────────────────────────────────────────────
function QuickLinksSection() {
  const navigate = useNavigate()
  const links = [
    { label: 'Costing', icon: Calculator, path: '/costing', color: 'text-[hsl(var(--color-category-finance))]' },
    { label: 'Schedule', icon: CalendarClock, path: '/schedule', color: 'text-[hsl(var(--color-category-schedule))]' },
    { label: 'Supply Chain', icon: Truck, path: '/supply-chain', color: 'text-[hsl(var(--color-category-labor))]' },
    { label: 'Finance', icon: Wallet, path: '/finance', color: 'text-[hsl(var(--brand-teal-500))]' },
    { label: 'Documents', icon: FolderOpen, path: '/documents', color: 'text-[hsl(var(--color-category-document))]' },
    { label: 'Change Mgmt', icon: FileDiff, path: '/change-management', color: 'text-[hsl(var(--color-category-risk))]' },
  ]

  return (
    <Card className="col-span-1 lg:col-span-3 border-[hsl(var(--color-border-subtle))]">
      <CardHeader className="pb-[var(--space-3)]">
        <CardTitle className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] flex items-center gap-[var(--space-2)]">
          <ExternalLink className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" /> Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {links.map((link) => (
            <Button
              key={link.path}
              variant="outline"
              size="sm"
              onClick={() => navigate(link.path)}
              className="gap-[var(--space-2)] text-[var(--font-size-12)]"
            >
              <link.icon className={`h-4 w-4 ${link.color}`} />
              {link.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page Component (Redesigned with Enterprise Patterns) ──────────────

export default function ProjectOverview() {
  const { handleAsync } = useErrorHandler()
  const navigate = useNavigate()
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projectsMap = useProjectStore((s) => s.projects)
  const activeProject: Project | undefined = activeProjectId ? projectsMap[activeProjectId] : undefined

  // Data states
  const [kpis, setKpis] = useState<ProjectKPIs | null>(null)
  const [upcoming, setUpcoming] = useState<TaskSummary[]>([])
  const [overdue, setOverdue] = useState<TaskSummary[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [srStatus, setSrStatus] = useState('')

  const loadData = useCallback(async (projectId: string) => {
    setSrStatus('Loading project overview metrics...')
    setLoading(true)
    const loaded = await handleAsync(async () => {
      const [kpiData, upcomingData, overdueData, riskData, teamData, activityData] =
        await Promise.allSettled([
          projectOverviewService.getProjectKPIs(projectId),
          projectOverviewService.getUpcomingMilestones(projectId, 5),
          projectOverviewService.getOverdueTasks(projectId, 5),
          projectOverviewService.getTopRisks(projectId, 5),
          projectOverviewService.getTeamMembers(projectId),
          projectOverviewService.getRecentActivity(projectId, 10),
        ])

      if (kpiData.status === 'fulfilled') setKpis(kpiData.value)
      if (upcomingData.status === 'fulfilled') setUpcoming(upcomingData.value)
      if (overdueData.status === 'fulfilled') setOverdue(overdueData.value)
      if (riskData.status === 'fulfilled') setRisks(riskData.value)
      if (teamData.status === 'fulfilled') setTeam(teamData.value)
      if (activityData.status === 'fulfilled') setActivities(activityData.value)
      return true
    }, 'data.sync_failed')

    if (!loaded) {
      toast.error('Failed to load project overview data')
      setSrStatus('Failed to load project overview metrics.')
    } else {
      setSrStatus('Project overview metrics loaded.')
    }

    setLoading(false)
  }, [handleAsync])

  useEffect(() => {
    if (activeProjectId) {
      queueMicrotask(() => {
        loadData(activeProjectId)
      })
    }
  }, [activeProjectId, loadData])

  // ─── Guard: No active project ─────────────────────────────────────────────
  if (!activeProjectId || !activeProject) {
    return (
      <ModulePageState
        icon={<ClipboardList size={18} />}
        title="Project Overview"
        description="Operational overview of the active project."
        variant="empty"
        message="Select a project from the Projects page to view overview metrics."
      />
    )
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (loading && !kpis) {
    return (
      <ModulePageState
        icon={<ClipboardList size={18} />}
        title="Project Overview"
        description={activeProject.name}
        variant="loading"
        message="Loading project overview metrics..."
      />
    )
  }

  // ─── Build KPI summary items ──────────────────────────────────────────────
  const utilPct = kpis && kpis.rabTotal > 0 ? (kpis.actualCost / kpis.rabTotal) * 100 : 0
  const overBudget = kpis ? kpis.remainingBudget < 0 : false

  const summaryItems = kpis ? [
    {
      label: 'RAB Total',
      value: formatIDR(kpis.rabTotal),
      status: 'neutral' as const,
    },
    {
      label: 'RAP Total',
      value: formatIDR(kpis.rapTotal),
      delta: kpis.rabTotal > 0 ? `${((kpis.rapTotal / kpis.rabTotal) * 100).toFixed(0)}% of RAB` : undefined,
      trend: kpis.rapTotal <= kpis.rabTotal ? 'neutral' as const : 'up' as const,
      status: 'info' as const,
    },
    {
      label: 'Actual Cost',
      value: formatIDR(kpis.actualCost),
      delta: `${utilPct.toFixed(1)}% utilized`,
      trend: utilPct > 90 ? 'up' as const : 'neutral' as const,
      status: utilPct > 100 ? 'danger' as const : utilPct > 80 ? 'warning' as const : 'neutral' as const,
    },
    {
      label: 'Remaining',
      value: formatIDR(Math.abs(kpis.remainingBudget)),
      delta: overBudget ? 'OVER BUDGET' : undefined,
      trend: overBudget ? 'down' as const : 'neutral' as const,
      status: overBudget ? 'danger' as const : 'success' as const,
    },
    {
      label: 'Progress',
      value: `${kpis.progressPercent}%`,
      status: kpis.progressPercent >= 80 ? 'success' as const : kpis.progressPercent >= 50 ? 'info' as const : 'neutral' as const,
    },
    {
      label: 'TKDN',
      value: `${kpis.tkdnScore}%`,
      status: kpis.tkdnScore >= 40 ? 'success' as const : kpis.tkdnScore >= 25 ? 'warning' as const : 'danger' as const,
    },
  ] : []

  // ─── Build health items for context bar ───────────────────────────────────
  const healthItems = kpis ? [
    {
      label: 'Progress',
      level: (kpis.progressPercent >= 80 ? 'good' : kpis.progressPercent >= 50 ? 'warning' : 'critical') as 'good' | 'warning' | 'critical',
      value: `${kpis.progressPercent}%`,
    },
    ...(overBudget ? [{
      label: 'Budget',
      level: 'critical' as const,
      value: 'Over',
    }] : []),
  ] : []

  // ─── Main Render with Enterprise Patterns ─────────────────────────────────
  return (
    <PageShell
      contextBar={
        <GlobalContextBar
          projectName={activeProject.name}
          packageName={activeProject.code || undefined}
          versionLabel={activeProject.status || undefined}
          syncStatus="synced"
          healthItems={healthItems}
          actions={[
            {
              label: 'Settings',
              icon: <Settings2 className="h-3 w-3" />,
              onClick: () => setShowSettings(true),
            },
          ]}
        />
      }
      header={
        <WorkspaceHeader
          title="Project Overview"
          subtitle={`${activeProject.name}${activeProject.clientName ? ` — ${activeProject.clientName}` : ''}${activeProject.location ? ` · ${activeProject.location}` : ''}`}
          primaryAction={{
            label: 'Export',
            icon: <ExternalLink className="h-3.5 w-3.5" />,
            onClick: () => { /* export handler */ },
          }}
          secondaryActions={[
            {
              label: 'Schedule',
              icon: <CalendarClock className="h-3.5 w-3.5" />,
              onClick: () => navigate('/schedule'),
            },
          ]}
          overflowActions={[
            {
              label: 'Project Settings',
              icon: <Settings2 className="h-3.5 w-3.5" />,
              onClick: () => setShowSettings(true),
            },
          ]}
        />
      }
      summary={
        summaryItems.length > 0 ? (
          <SummaryStrip items={summaryItems} variant="compact-cards" />
        ) : undefined
      }
      alert={
        overdue.length > 0 ? (
          <AlertStrip
            severity="warning"
            message={`${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue — immediate attention required`}
            action={{ label: 'View Schedule', onClick: () => navigate('/schedule') }}
          />
        ) : undefined
      }
    >
      {/* Accessibility status */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

      {/* Settings dialog */}
      <ProjectSettingsDialog
        projectId={activeProjectId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* Main Content Grid */}
      <div className="space-y-[var(--space-4)]">
        {/* Timeline + Risks */}
        <div className="grid gap-[var(--space-4)] grid-cols-1 lg:grid-cols-3">
          <TimelineSection upcoming={upcoming} overdue={overdue} />
          <RiskSection risks={risks} />
        </div>

        {/* Team Members */}
        <div className="grid gap-[var(--space-4)] grid-cols-1 lg:grid-cols-3">
          <TeamSection members={team} />
        </div>

        {/* Recent Activity */}
        <div className="grid gap-[var(--space-4)] grid-cols-1 lg:grid-cols-3">
          <ActivitySection activities={activities} />
        </div>

        {/* Quick Links */}
        <div className="grid gap-[var(--space-4)] grid-cols-1 lg:grid-cols-3">
          <QuickLinksSection />
        </div>
      </div>
    </PageShell>
  )
}
