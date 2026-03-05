/**
 * ProjectOverview.tsx
 * Operational overview of the currently active project.
 * Shows 6 sections: KPI breakdown, Timeline, Risks, Team, Activity, Quick Links.
 *
 * Differentiator from CommandCenter:
 *  - KPIs: full budget comparison table (RAB vs RAP vs Actual vs Remaining)
 *  - Timeline: per-task detail with assignee, WBS, days-until-due
 *  - Risk: individual risk rows with scores, not just a count
 *  - Team: EXCLUSIVE — not in Command Center
 *  - Activity: full audit trail with entity types
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ModuleHeader } from '../../../components/modules/ModuleHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Progress } from '../../../components/ui/progress'
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
} from 'lucide-react'
import { useProjectStore, type Project } from '../../../store/projectStore'
import {
  projectOverviewService,
  type ProjectKPIs,
  type TaskSummary,
  type TeamMember,
  type ActivityEntry,
} from '../../../services/projectOverviewService'
import type { Risk } from '../../../types/risk'
import { formatIDR } from '../../../lib/utils'
import { format } from 'date-fns'
import { ProjectSettingsDialog } from '../../../components/project/ProjectSettingsDialog'
import { Settings2 } from 'lucide-react'
import { useErrorHandler } from '../../../hooks/useErrorHandler'
import ModulePageState from '../../../components/common/ModulePageState'

// ─── Helper: risk score color ───────────────────────────────────────────────
function riskScoreColor(score: number) {
  if (score >= 15) return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
  if (score >= 7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
  return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
}

// ─── Helper: days badge ─────────────────────────────────────────────────────
function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge variant="destructive" className="text-xs">{Math.abs(days)}d overdue</Badge>
  }
  if (days <= 3) {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 text-xs">{days}d left</Badge>
  }
  return <Badge variant="secondary" className="text-xs">{days}d left</Badge>
}

// ─── Section: KPI Cards ─────────────────────────────────────────────────────
function KPISection({ kpis }: { kpis: ProjectKPIs }) {
  const utilPct = kpis.rabTotal > 0 ? (kpis.actualCost / kpis.rabTotal) * 100 : 0
  const overBudget = kpis.remainingBudget < 0

  const cards: Array<{
    label: string
    value: string
    sub?: string
    icon: React.ElementType
    accent: string
    badge?: React.ReactNode
    bar?: number
  }> = [
    {
      label: 'RAB Total',
      value: formatIDR(kpis.rabTotal),
      sub: 'Baseline Budget',
      icon: DollarSign,
      accent: 'border-t-blue-500',
    },
    {
      label: 'RAP Total',
      value: formatIDR(kpis.rapTotal),
      sub: 'Working Estimate',
      icon: TrendingUp,
      accent: 'border-t-emerald-500',
      bar: kpis.rabTotal > 0 ? (kpis.rapTotal / kpis.rabTotal) * 100 : 0,
    },
    {
      label: 'Actual Cost',
      value: formatIDR(kpis.actualCost),
      sub: `${utilPct.toFixed(1)}% of RAB`,
      icon: TrendingDown,
      accent: utilPct > 100 ? 'border-t-red-500' : utilPct > 80 ? 'border-t-amber-500' : 'border-t-orange-400',
      bar: utilPct,
    },
    {
      label: 'Committed',
      value: formatIDR(kpis.committedCost),
      sub: 'PO + Contracts',
      icon: Calculator,
      accent: 'border-t-indigo-500',
    },
    {
      label: 'Remaining',
      value: formatIDR(Math.abs(kpis.remainingBudget)),
      sub: overBudget ? 'OVER BUDGET' : 'Budget Left',
      icon: Wallet,
      accent: overBudget ? 'border-t-red-500' : 'border-t-green-500',
      badge: overBudget ? (
        <Badge variant="destructive" className="text-xs px-1 py-0">▲ OVER</Badge>
      ) : undefined,
    },
    {
      label: 'Progress',
      value: `${kpis.progressPercent}%`,
      sub: 'Overall Complete',
      icon: BarChart3,
      accent:
        kpis.progressPercent >= 80 ? 'border-t-emerald-500' :
        kpis.progressPercent >= 50 ? 'border-t-sky-500' : 'border-t-slate-400',
      bar: kpis.progressPercent,
    },
  ]

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className={`border-t-2 ${c.accent}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <c.icon className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tabular-nums">{c.value}</span>
              {c.badge}
            </div>
            {c.sub && (
              <div className={`text-xs mt-0.5 ${
                c.label === 'Remaining' && overBudget ? 'text-red-500 font-semibold' : 'text-muted-foreground'
              }`}>{c.sub}</div>
            )}
            {c.bar !== undefined && (
              <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    c.bar > 100 ? 'bg-red-500' : c.bar > 80 ? 'bg-amber-400' : 'bg-current opacity-60'
                  }`}
                  style={{ width: `${Math.min(c.bar, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
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
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-600" /> Timeline Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overdue */}
        {overdue.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Overdue Tasks</h4>
            <div className="space-y-2">
              {overdue.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-l-2 border-red-500 pl-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{t.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {t.wbsCode && <span>WBS: {t.wbsCode}</span>}
                      {t.assignee && <span>• {t.assignee}</span>}
                      <span>• Due: {t.endDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <Progress value={t.progress} className="h-1.5 w-16" />
                    <span className="text-xs w-8 text-right">{t.progress}%</span>
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
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Upcoming</h4>
            <div className="space-y-2">
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-l-2 border-emerald-500 pl-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{t.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {t.wbsCode && <span>WBS: {t.wbsCode}</span>}
                      {t.assignee && <span>• {t.assignee}</span>}
                      <span>• Due: {t.endDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <Progress value={t.progress} className="h-1.5 w-16" />
                    <span className="text-xs w-8 text-right">{t.progress}%</span>
                    <DaysBadge days={t.daysUntilDue} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !overdue.length && (
            <p className="text-sm text-muted-foreground text-center py-4">No timeline tasks found</p>
          )
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/schedule')}>
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" /> Top Risks & Issues
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No open risks</p>
        ) : (
          risks.map((risk) => (
            <div key={risk.id} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{risk.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{risk.category}</Badge>
                  {risk.owner && <span className="text-xs text-muted-foreground">Owner: {risk.owner}</span>}
                </div>
              </div>
              <Badge className={`text-xs flex-shrink-0 ${riskScoreColor(risk.risk_score)}`}>
                {risk.probability}×{risk.impact}={risk.risk_score}
              </Badge>
            </div>
          ))
        )}
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/change-management')}>
          View All Risks <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Section: Team Members ──────────────────────────────────────────────────
function TeamSection({ members }: { members: TeamMember[] }) {
  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    user: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" /> Team Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No team members assigned</p>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const initials = (m.fullName || m.email || '?')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.fullName || 'Unknown'}</p>
                    {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                  </div>
                  <Badge className={`text-xs ${roleColors[m.role] || roleColors.user}`}>
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
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-600" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity recorded</p>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div className="h-2 w-2 rounded-full bg-cyan-500 mt-2 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.action}</span>
                    {a.entityType && (
                      <Badge variant="outline" className="text-xs">{a.entityType}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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
    { label: 'Costing', icon: Calculator, path: '/costing', color: 'text-emerald-600' },
    { label: 'Schedule', icon: CalendarClock, path: '/schedule', color: 'text-indigo-600' },
    { label: 'Supply Chain', icon: Truck, path: '/supply-chain', color: 'text-orange-600' },
    { label: 'Finance', icon: Wallet, path: '/finance', color: 'text-teal-600' },
    { label: 'Documents', icon: FolderOpen, path: '/documents', color: 'text-slate-600' },
    { label: 'Change Mgmt', icon: FileDiff, path: '/change-management', color: 'text-rose-600' },
  ]

  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-gray-600" /> Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button
              key={link.path}
              variant="outline"
              size="sm"
              onClick={() => navigate(link.path)}
              className="gap-2"
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

// ─── Main Page Component ────────────────────────────────────────────────────

export default function ProjectOverview() {
  const { handleAsync } = useErrorHandler()
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
      console.error('Failed to load project overview data')
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

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
      {/* Header with project info */}
      <ModuleHeader
        icon={<ClipboardList size={18} />}
        title="Project Overview"
        description={`${activeProject.name}${activeProject.clientName ? ` — ${activeProject.clientName}` : ''}`}
        accent="blue"
      />

      {/* Project Info Banner */}
      <Card className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Project:</span>{' '}
              <span className="font-semibold">{activeProject.name}</span>
            </div>
            {activeProject.code && (
              <div>
                <span className="text-muted-foreground">Code:</span>{' '}
                <span className="font-medium">{activeProject.code}</span>
              </div>
            )}
            {activeProject.status && (
              <div>
                <Badge variant="outline">{activeProject.status}</Badge>
              </div>
            )}
            {activeProject.location && (
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{activeProject.location}</span>
              </div>
            )}
            {activeProject.startDate && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Start:</span>{' '}
                <span className="font-medium">{activeProject.startDate}</span>
                {activeProject.endDate && <span className="text-muted-foreground"> — {activeProject.endDate}</span>}
              </div>
            )}
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-sky-700 hover:text-sky-800 hover:bg-sky-100"
                onClick={() => setShowSettings(true)}
              >
                <Settings2 size={14} />
                Project Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProjectSettingsDialog
        projectId={activeProjectId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* Section 1: Compact 6-Card KPI Row (P1.3.1) */}
      {kpis && <KPISection kpis={kpis} />}

      {/* Section 2+3: Timeline + Risks (3-column grid) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <TimelineSection upcoming={upcoming} overdue={overdue} />
        <RiskSection risks={risks} />
      </div>

      {/* Section 4: Team Members (standalone) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <TeamSection members={team} />
      </div>

      {/* Section 5: Recent Activity (full-width) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <ActivitySection activities={activities} />
      </div>

      {/* Section 6: Quick Links (full-width) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <QuickLinksSection />
      </div>
    </div>
  )
}
