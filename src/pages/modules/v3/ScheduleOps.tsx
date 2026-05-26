/**
 * ScheduleOps v2.tsx
 * Integrated project planning, execution, and risk management.
 * 
 * REDESIGNED with enterprise design system:
 *   L1: GlobalContextBar -> project context  
 *   L2: ModeSwitch -> 3-mode: Plan | Track | Analyze 
 *   L3: WorkspaceHeader -> title + active mode description + actions
 *   L6: Tab Content -> lazy-loaded submodules within each mode
 */
 
import React, { Suspense, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { CalendarClock, GanttChartSquare, ListTodo, TrendingUp, AlertTriangle, FlaskConical, Boxes, BarChart2 } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import ModulePageState from '@/components/common/ModulePageState'
import { lazyRetry } from '@/lib/lazyRetry'

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { usePresence } from '@/hooks/usePresence'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { PresenceAvatars } from '@/components/common/PresenceAvatars'
import { useAuthStore } from '@/store/authStore'
import { CPMWorkerStatus } from '@/components/charts/CPMWorkerStatus'

const WBS = lazyRetry(() => import('../WBS'))
const CostForecastDashboard = lazyRetry(() => import('./CostForecastDashboard'))
const RiskRegister = lazyRetry(() => import('@/components/risk/RiskRegister'))
const TimelineScenarioPanel = lazyRetry(() => import('@/components/modules/TimelineScenarioPanel').then((m) => ({ default: m.TimelineScenarioPanel })))
const ResourceUsageDialog = lazyRetry(() => import('@/components/progress/ResourceUsageDialog').then((m) => ({ default: m.ResourceUsageDialog })))
const DailyProgressBoard = lazyRetry(() => import('@/components/progress/DailyProgressBoard').then((m) => ({ default: m.DailyProgressBoard })))
const CriticalPathGantt = lazyRetry(() => import('@/components/charts/CriticalPathGantt').then((m) => ({ default: m.CriticalPathGantt })))

function TabFallback({ minHeight = 420 }: { minHeight?: number }) {
    return (
        <div
            style={{ minHeight }}
            className="animate-pulse space-y-3 p-4"
            aria-busy="true"
            aria-label="Loading module"
        >
            <div className="h-8 w-1/3 rounded-md bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-2/3 rounded-md bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-1/2 rounded-md bg-slate-100 dark:bg-slate-800" />
            <div className="mt-6 h-64 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
    )
}

// ─── Mode Configuration ─────────────────────────────────────────────────────
const MODE_OPTIONS = [
    { value: 'plan', label: 'Plan', icon: <GanttChartSquare className="h-3.5 w-3.5" /> },
    { value: 'track', label: 'Track', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { value: 'analyze', label: 'Analyze', icon: <BarChart2 className="h-3.5 w-3.5" /> },
]

const MODE_DESCRIPTIONS: Record<string, string> = {
    plan: 'Timeline, WBS, and scheduling management',
    track: 'Site progress tracking & daily operations',
    analyze: 'Curva-S, risk analysis, and what-if scenarios',
}

type ScheduleMode = 'plan' | 'track' | 'analyze'

// ─── Sub-tab config per mode ────────────────────────────────────────────────
const PLAN_TABS = [
    { value: 'timeline', label: 'Timeline (Gantt)', icon: <GanttChartSquare size={14} /> },
    { value: 'wbs', label: 'WBS Structure', icon: <ListTodo size={14} /> },
    { value: 'cpm', label: 'Critical Path', icon: <AlertTriangle size={14} /> },
]

const TRACK_TABS = [
    { value: 'progress', label: 'Site Progress', icon: <TrendingUp size={14} /> },
    { value: 'resource', label: 'Resource Entry', icon: <Boxes size={14} /> },
]

const ANALYZE_TABS = [
    { value: 'curvas', label: 'Curva-S', icon: <TrendingUp size={14} className="rotate-180" /> },
    { value: 'risk', label: 'Risk & Issues', icon: <AlertTriangle size={14} /> },
    { value: 'scenario', label: 'What-If', icon: <FlaskConical size={14} /> },
]

export default function ScheduleOps() {
    const { activeProjectId } = useProjectStore()
    // B.7: use reactive selector instead of getState() in JSX
    const activeProjectName = useProjectStore(s => activeProjectId ? (s.projects[activeProjectId]?.name || 'Project') : 'Project')
    const { isCPMCalculating, getTasks } = useTimelineStore()
    const { handleAsync } = useErrorHandler()
    const taskCount = activeProjectId ? (getTasks(activeProjectId)?.length || 0) : 0
    const completedCount = activeProjectId
        ? (getTasks(activeProjectId)?.filter(t => t.status === 'completed').length || 0)
        : 0
    const overdueCount = activeProjectId
        ? (getTasks(activeProjectId)?.filter(t => t.status !== 'completed' && t.endDate < new Date().toISOString().slice(0, 10)).length || 0)
        : 0

    const [resourceOpen, setResourceOpen] = React.useState(false)
    const [searchParams, setSearchParams] = useSearchParams()

    // B.5: persist mode + activeTab to URL params
    const [mode, setMode] = React.useState<ScheduleMode>(() => {
        const m = searchParams.get('mode')
        return (m === 'plan' || m === 'track' || m === 'analyze') ? m : 'plan'
    })
    const [activeTab, setActiveTab] = React.useState(() => {
        return searchParams.get('tab') || (searchParams.has('taskId') ? 'timeline' : 'timeline')
    })
    const [srStatus, setSrStatus] = React.useState('')

    // B.8: track actual CPM calculation duration
    const [cpmDuration, setCpmDuration] = React.useState(0)
    const cpmStartRef = React.useRef<number | null>(null)
    React.useEffect(() => {
        if (isCPMCalculating) {
            cpmStartRef.current = performance.now()
        } else if (cpmStartRef.current !== null) {
            setCpmDuration(Math.round(performance.now() - cpmStartRef.current))
            cpmStartRef.current = null
        }
    }, [isCPMCalculating])

    // Real-time Presence
    const { peers } = usePresence(activeProjectId ?? null, `Schedule: ${mode}/${activeTab}`)
    const otherPeers = peers.filter(p => p.user_id !== useAuthStore.getState().user?.id)

    const handleModeChange = React.useCallback((newMode: string) => {
        const m = newMode as ScheduleMode
        const firstTab = m === 'plan' ? 'timeline' : m === 'track' ? 'progress' : 'curvas'
        setMode(m)
        setActiveTab(firstTab)
        setSrStatus(`Switched to ${newMode} mode.`)
        // B.5: sync to URL
        setSearchParams(prev => { prev.set('mode', newMode); prev.set('tab', firstTab); return prev }, { replace: true })
    }, [setSearchParams])

    const handleTabChange = React.useCallback((tab: string) => {
        setActiveTab(tab)
        // B.5: sync to URL
        setSearchParams(prev => { prev.set('tab', tab); return prev }, { replace: true })
        const tabLabel =
            tab === 'timeline' ? 'timeline gantt' :
                tab === 'wbs' ? 'WBS structure' :
                    tab === 'cpm' ? 'critical path' :
                        tab === 'progress' ? 'site progress' :
                            tab === 'curvas' ? 'curva-s' :
                                tab === 'risk' ? 'risk and issues' :
                                    tab === 'resource' ? 'resource entry' : 'what-if scenario'
        setSrStatus(`Opened ${tabLabel} tab.`)
    }, [setSearchParams])

    // B.9: SummaryStrip items
    const summaryItems = useMemo(() => [
        {
            label: 'Total Tasks',
            value: taskCount,
            status: taskCount > 0 ? 'success' as const : 'warning' as const,
        },
        {
            label: 'Completed',
            value: completedCount,
            status: completedCount === taskCount && taskCount > 0 ? 'success' as const : 'info' as const,
        },
        {
            label: 'Overdue',
            value: overdueCount,
            status: overdueCount === 0 ? 'success' as const : 'warning' as const,
        },
    ], [taskCount, completedCount, overdueCount])

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<CalendarClock size={18} />}
                title="Schedule & Operations"
                description="Integrated project planning, execution, and risk management."
                variant="empty"
                message="Please select a project to view schedule operations."
            />
        )
    }

    const currentTabs = mode === 'plan' ? PLAN_TABS : mode === 'track' ? TRACK_TABS : ANALYZE_TABS

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'Tasks',
                            level: taskCount === 0 ? 'warning' : overdueCount > 0 ? 'warning' : 'good',
                            value: `${completedCount}/${taskCount}`,
                        },
                        ...(overdueCount > 0 ? [{ label: 'Overdue', level: 'critical' as const, value: String(overdueCount) }] : []),
                        { label: 'CPM', level: isCPMCalculating ? 'warning' as const : 'good' as const, value: isCPMCalculating ? 'Running' : 'Ready' },
                    ]}
                />
            }
            navigation={
                <ModeSwitch
                    options={MODE_OPTIONS}
                    value={mode}
                    onChange={handleModeChange}
                />
            }
            header={
                <WorkspaceHeader
                    title="Schedule & Operations"
                    subtitle={MODE_DESCRIPTIONS[mode]}
                    extraContent={
                        otherPeers.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                <PresenceAvatars users={otherPeers} />
                            </div>
                        )
                    }
                    primaryAction={
                        mode === 'track' ? {
                            label: 'Resource Log',
                            icon: <Boxes className="h-3.5 w-3.5" />,
                            onClick: () => setResourceOpen(true)
                        } : undefined
                    }
                />
            }
            summary={
                <SummaryStrip items={summaryItems} variant="chips" />
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <Suspense fallback={null}>
                <ResourceUsageDialog open={resourceOpen} onOpenChange={setResourceOpen} projectId={activeProjectId} />
            </Suspense>

            {/* Sub-tabs within the mode — B.4: Radix TabsList/TabsTrigger for keyboard nav */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="flex items-center justify-between mb-4">
                    {/* B.4: proper Radix tabs for keyboard accessibility */}
                    <TabsList className="flex h-auto items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-2 py-1">
                        {currentTabs.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="flex shrink-0 items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--font-size-12)] font-[var(--font-weight-medium)] data-[state=active]:bg-[hsl(var(--color-surface-panel))] data-[state=active]:text-[hsl(var(--color-text-primary))] data-[state=active]:shadow-[var(--shadow-xs)] data-[state=inactive]:text-[hsl(var(--color-text-tertiary))]"
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* B.8: show actual CPM duration (not hardcoded 42ms) */}
                    {mode === 'plan' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                            <CPMWorkerStatus 
                                isCalculating={isCPMCalculating} 
                                taskCount={taskCount} 
                                lastDurationMs={cpmDuration} 
                            />
                        </div>
                    )}
                </div>

                {/* B.10: ErrorBoundary per TabsContent */}
                {/* ─── Plan Mode Tabs ─────────────────────────────────────────── */}
                <TabsContent value="timeline" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-0 min-h-[500px]">
                        <ErrorBoundary errorMessage="Timeline failed to render">
                            <Suspense fallback={<TabFallback minHeight={500} />}>
                                <CriticalPathGantt />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </TabsContent>

                <TabsContent value="wbs" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-0 min-h-[500px]">
                        <ErrorBoundary errorMessage="WBS failed to render">
                            <Suspense fallback={<TabFallback minHeight={500} />}>
                                <WBS />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </TabsContent>

                <TabsContent value="cpm" className="outline-none">
                    <ErrorBoundary errorMessage="Critical Path analysis failed to render">
                        <Suspense fallback={<TabFallback minHeight={400} />}>
                            <CriticalPathGantt />
                        </Suspense>
                    </ErrorBoundary>
                </TabsContent>

                {/* ─── Track Mode Tabs ────────────────────────────────────────── */}
                <TabsContent value="progress" className="outline-none">
                    <Card className="border-none shadow-none bg-transparent">
                        <ErrorBoundary errorMessage="Daily Progress Board failed to render">
                            <Suspense fallback={<TabFallback minHeight={200} />}>
                                <DailyProgressBoard />
                            </Suspense>
                        </ErrorBoundary>
                    </Card>
                </TabsContent>

                <TabsContent value="resource" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)] min-h-[400px]">
                        <div className="text-center py-12">
                            <Boxes className="mx-auto h-12 w-12 text-[hsl(var(--color-text-disabled))] mb-[var(--space-4)]" />
                            <h3 className="text-lg font-[var(--font-weight-bold)]">Resource Logistics & Tooling</h3>
                            <p className="text-[hsl(var(--color-text-tertiary))] max-w-sm mx-auto mb-[var(--space-6)] text-[var(--font-size-13)]">
                                Log equipment usage and labor distribution here to feed the Portfolio Heatmap.
                            </p>
                            <div className="bg-[hsl(var(--color-surface-subtle))] p-[var(--padding-lg)] rounded-[var(--radius-lg)] border border-dashed border-[hsl(var(--color-border-default))] max-w-sm mx-auto">
                                <p className="text-[var(--font-size-11)] text-[hsl(var(--color-text-disabled))] mb-[var(--space-4)] uppercase tracking-[var(--letter-spacing-wide)] font-[var(--font-weight-bold)]">Input Center</p>
                                <button
                                    type="button"
                                    onClick={() => setResourceOpen(true)}
                                    className="flex w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[hsl(var(--brand-primary-500))] px-[var(--space-4)] py-[var(--space-3)] text-[var(--font-size-13)] font-[var(--font-weight-bold)] text-white hover:bg-[hsl(var(--brand-primary-600))] shadow-[var(--shadow-md)] transition-all active:scale-95"
                                >
                                    <Boxes size={18} /> New Resource Log
                                </button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ─── Analyze Mode Tabs ──────────────────────────────────────── */}
                <TabsContent value="curvas" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)]">
                        <ErrorBoundary errorMessage="Curva-S failed to render">
                            <Suspense fallback={<TabFallback minHeight={420} />}>
                                <CostForecastDashboard />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </TabsContent>

                <TabsContent value="risk" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)]">
                        <ErrorBoundary errorMessage="Risk Register failed to render">
                            <Suspense fallback={<TabFallback minHeight={360} />}>
                                <RiskRegister projectId={activeProjectId} />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </TabsContent>

                <TabsContent value="scenario" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)]">
                        <ErrorBoundary errorMessage="What-If scenario panel failed to render">
                            <Suspense fallback={<TabFallback minHeight={360} />}>
                                <TimelineScenarioPanel projectId={activeProjectId} />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </TabsContent>
            </Tabs>
        </PageShell>
    )
}
