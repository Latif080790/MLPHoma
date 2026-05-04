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
 
import React, { Suspense, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CalendarClock, GanttChartSquare, ListTodo, TrendingUp, AlertTriangle, FlaskConical, Boxes, BarChart2, Eye } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import ModulePageState from '@/components/common/ModulePageState'
import { lazyRetry } from '@/lib/lazyRetry'

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader } from '@/components/patterns'
import { usePresence } from '@/hooks/usePresence'
import { PresenceAvatars } from '@/components/common/PresenceAvatars'
import { useAuthStore } from '@/store/authStore'
import { CPMWorkerStatus } from '@/components/charts/CPMWorkerStatus'

const WBS = lazyRetry(() => import('../WBS'))
const Timeline = lazyRetry(() => import('../Timeline'))
const CurvaS = lazyRetry(() => import('../CurvaS'))
const Progress = lazyRetry(() => import('../Progress'))
const RiskRegister = lazyRetry(() => import('@/components/risk/RiskRegister'))
const TimelineScenarioPanel = lazyRetry(() => import('@/components/modules/TimelineScenarioPanel').then((m) => ({ default: m.TimelineScenarioPanel })))
const ResourceUsageDialog = lazyRetry(() => import('@/components/progress/ResourceUsageDialog').then((m) => ({ default: m.ResourceUsageDialog })))
const DailyProgressBoard = lazyRetry(() => import('@/components/progress/DailyProgressBoard').then((m) => ({ default: m.DailyProgressBoard })))
const CriticalPathGantt = lazyRetry(() => import('@/components/charts/CriticalPathGantt').then((m) => ({ default: m.CriticalPathGantt })))

function TabFallback() {
    return <div className="p-[var(--padding-md)] text-[var(--font-size-13)] text-[hsl(var(--color-text-tertiary))]">Loading module...</div>
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
    const { isCPMCalculating, getTasks } = useTimelineStore()
    const taskCount = activeProjectId ? (getTasks(activeProjectId)?.length || 0) : 0

    const [resourceOpen, setResourceOpen] = React.useState(false)
    const [searchParams] = useSearchParams()
    
    const [mode, setMode] = React.useState<ScheduleMode>(() => {
        return searchParams.has('taskId') ? 'plan' : 'plan'
    })
    const [activeTab, setActiveTab] = React.useState(() => {
        return searchParams.has('taskId') ? 'timeline' : 'timeline'
    })
    const [srStatus, setSrStatus] = React.useState('')

    // Real-time Presence
    const { peers } = usePresence(activeProjectId ?? null, `Schedule: ${mode}/${activeTab}`)
    const otherPeers = peers.filter(p => p.user_id !== useAuthStore.getState().user?.id)

    // When mode changes, auto-select first tab of that mode

    const handleModeChange = React.useCallback((newMode: string) => {
        setMode(newMode as ScheduleMode)
        const firstTab = newMode === 'plan' ? 'timeline' : newMode === 'track' ? 'progress' : 'curvas'
        setActiveTab(firstTab)
        setSrStatus(`Switched to ${newMode} mode.`)
    }, [])

    React.useEffect(() => {
        const tabLabel =
            activeTab === 'timeline' ? 'timeline gantt' :
                activeTab === 'wbs' ? 'WBS structure' :
                    activeTab === 'cpm' ? 'critical path' :
                        activeTab === 'progress' ? 'site progress' :
                            activeTab === 'curvas' ? 'curva-s' :
                                activeTab === 'risk' ? 'risk and issues' :
                                    activeTab === 'resource' ? 'resource entry' : 'what-if scenario'
        setSrStatus(`Opened ${tabLabel} tab.`)
    }, [activeTab])

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
                    projectName={useProjectStore.getState().projects[activeProjectId]?.name || 'Project'}
                    syncStatus="synced"
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
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <Suspense fallback={null}>
                <ResourceUsageDialog open={resourceOpen} onOpenChange={setResourceOpen} projectId={activeProjectId} />
            </Suspense>

            {/* Sub-tabs within the mode */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-2 py-1">
                        {currentTabs.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setActiveTab(tab.value)}
                                className={`flex shrink-0 items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--font-size-12)] font-[var(--font-weight-medium)] transition-colors duration-[var(--motion-duration-fast)] ${
                                    activeTab === tab.value
                                        ? 'bg-[hsl(var(--color-surface-panel))] text-[hsl(var(--color-text-primary))] shadow-[var(--shadow-xs)]'
                                        : 'text-[hsl(var(--color-text-tertiary))] hover:text-[hsl(var(--color-text-secondary))]'
                                }`}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {mode === 'plan' && (
                        <div className="hidden lg:block animate-in fade-in slide-in-from-top-2 duration-500">
                            <CPMWorkerStatus 
                                isCalculating={isCPMCalculating} 
                                taskCount={taskCount} 
                                lastDurationMs={isCPMCalculating ? 0 : 42} 
                            />
                        </div>
                    )}
                </div>

                {/* ─── Plan Mode Tabs ─────────────────────────────────────────── */}
                <TabsContent value="timeline" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-0 min-h-[500px]">
                        <Suspense fallback={<TabFallback />}>
                            <Timeline />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="wbs" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-0 min-h-[500px]">
                        <Suspense fallback={<TabFallback />}>
                            <WBS />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="cpm" className="outline-none">
                    <Suspense fallback={<TabFallback />}>
                        <CriticalPathGantt />
                    </Suspense>
                </TabsContent>

                {/* ─── Track Mode Tabs ────────────────────────────────────────── */}
                <TabsContent value="progress" className="outline-none">
                    <Card className="border-none shadow-none bg-transparent">
                        <Suspense fallback={<TabFallback />}>
                            <DailyProgressBoard />
                        </Suspense>
                        <div className="mt-[var(--space-6)]">
                            <Suspense fallback={<TabFallback />}>
                                <Progress />
                            </Suspense>
                        </div>
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
                        <Suspense fallback={<TabFallback />}>
                            <CurvaS />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="risk" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)]">
                        <Suspense fallback={<TabFallback />}>
                            <RiskRegister projectId={activeProjectId} />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="scenario" className="outline-none">
                    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-subtle))] bg-[hsl(var(--color-surface-panel))] shadow-[var(--shadow-sm)] overflow-hidden p-[var(--padding-md)]">
                        <Suspense fallback={<TabFallback />}>
                            <TimelineScenarioPanel projectId={activeProjectId} />
                        </Suspense>
                    </div>
                </TabsContent>
            </Tabs>
        </PageShell>
    )
}
