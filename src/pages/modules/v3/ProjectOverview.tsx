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
  const cards = [
    { label: 'RAB Total', value: kpis.rabTotal, icon: DollarSign, color: 'text-blue-600' },
    { label: 'RAP Total', value: kpis.rapTotal, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Actual Cost', value: kpis.actualCost, icon: TrendingDown, color: 'text-orange-600' },
    { label: 'Committed', value: kpis.committedCost, icon: DollarSign, color: 'text-indigo-600' },
    { label: 'Remaining', value: kpis.remainingBudget, icon: DollarSign, color: kpis.remainingBudget < 0 ? 'text-red-600' : 'text-green-600' },
  ]

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-lg font-bold">{formatIDR(c.value)}</div>
            {c.label === 'Remaining' && c.value < 0 && (
              <Badge variant="destructive" className="mt-1 text-xs">Over Budget</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Section: Progress Bar ──────────────────────────────────────────────────
function ProgressSection({ value }: { value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-600" /> Overall Progress
          </span>
          <span className="text-sm font-bold">{value}%</span>
        </div>
        <Progress value={value} className="h-2" />
      </CardContent>
    </Card>
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

  const loadData = useCallback(async (projectId: string) => {
    setLoading(true)
    try {
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
    } catch (err) {
      console.error('Failed to load project overview data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeProjectId) {
      loadData(activeProjectId)
    }
  }, [activeProjectId, loadData])

  // ─── Guard: No active project ─────────────────────────────────────────────
  if (!activeProjectId || !activeProject) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon={<ClipboardList size={18} />}
          title="Project Overview"
          description="Operational overview of the active project."
        />
        <div className="text-center py-16 border rounded-xl bg-muted/10">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Active Project Selected</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Select a project from the Projects page to view its overview dashboard.
          </p>
          <Button onClick={() => navigate('/projects')}>
            Go to Projects <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (loading && !kpis) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon={<ClipboardList size={18} />}
          title="Project Overview"
          description={activeProject.name}
        />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-6 w-28 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className={i === 0 ? 'lg:col-span-2' : ''}>
              <CardContent className="pt-6 pb-4 px-4">
                <div className="h-4 w-32 bg-muted animate-pulse rounded mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header with project info */}
      <ModuleHeader
        icon={<ClipboardList size={18} />}
        title="Project Overview"
        description={`${activeProject.name}${activeProject.clientName ? ` — ${activeProject.clientName}` : ''}`}
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
          </div>
        </CardContent>
      </Card>

      {/* Section 1: KPI Cards */}
      {kpis && <KPISection kpis={kpis} />}

      {/* Section 1b: Progress */}
      {kpis && <ProgressSection value={kpis.progressPercent} />}

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
