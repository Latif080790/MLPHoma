
import React, { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { CalendarClock, GanttChartSquare, ListTodo, TrendingUp, AlertTriangle, FlaskConical, Boxes } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import ModulePageState from '@/components/common/ModulePageState'
import { lazyRetry } from '@/lib/lazyRetry'

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
    return <div className="p-4 text-sm text-slate-500">Loading module...</div>
}

export default function ScheduleOps() {
    const { activeProjectId } = useProjectStore()
    const [resourceOpen, setResourceOpen] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState('timeline')
    const [srStatus, setSrStatus] = React.useState('')

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

    return (
        <div className="space-y-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <ModuleHeader
                icon={<CalendarClock size={18} />}
                title="Schedule & Operations"
                description="Integrated project planning, execution, and risk management."
                accent="indigo"
            />

            <Suspense fallback={null}>
                <ResourceUsageDialog open={resourceOpen} onOpenChange={setResourceOpen} projectId={activeProjectId} />
            </Suspense>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50 mb-6 backdrop-blur-sm">
                    <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <GanttChartSquare size={14} /> Timeline (Gantt)
                    </TabsTrigger>
                    <TabsTrigger value="wbs" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <ListTodo size={14} /> WBS Structure
                    </TabsTrigger>
                    <TabsTrigger value="cpm" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <AlertTriangle size={14} /> Critical Path
                    </TabsTrigger>
                    <TabsTrigger value="progress" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <TrendingUp size={14} /> Site Progress
                    </TabsTrigger>
                    <TabsTrigger value="curvas" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <TrendingUp size={14} className="rotate-180" /> Curva-S
                    </TabsTrigger>
                    <TabsTrigger value="risk" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <AlertTriangle size={14} /> Risk & Issues
                    </TabsTrigger>
                    <TabsTrigger value="resource" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <Boxes size={14} /> Resource Entry
                    </TabsTrigger>
                    <TabsTrigger value="scenario" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <FlaskConical size={14} /> What-If
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-0 min-h-[500px]">
                        <Suspense fallback={<TabFallback />}>
                            <Timeline />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="wbs" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-0 min-h-[500px]">
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

                <TabsContent value="progress" className="outline-none">
                    <Card className="border-none shadow-none bg-transparent">
                        <Suspense fallback={<TabFallback />}>
                            <DailyProgressBoard />
                        </Suspense>
                        <div className="mt-6">
                            <Suspense fallback={<TabFallback />}>
                                <Progress />
                            </Suspense>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="curvas" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <Suspense fallback={<TabFallback />}>
                            <CurvaS />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="risk" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <Suspense fallback={<TabFallback />}>
                            <RiskRegister projectId={activeProjectId} />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="resource" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4 min-h-[400px]">
                        <div className="text-center py-12">
                            <Boxes className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                            <h3 className="text-lg font-bold">Resource Logistics & Tooling</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-6">
                                Log equipment usage and labor distribution here to feed the Portfolio Heatmap.
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 max-w-sm mx-auto">
                                <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider font-bold">Input Center</p>
                                <button
                                    onClick={() => setResourceOpen(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition-all active:scale-95"
                                >
                                    <Boxes size={18} /> New Resource Log
                                </button>
                                <p className="mt-4 text-xs text-slate-400 italic">
                                    Mencatat pemakaian alat (HM/Shift) dan distribusi tenaga kerja secara spesifik.
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="scenario" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <Suspense fallback={<TabFallback />}>
                            <TimelineScenarioPanel projectId={activeProjectId} />
                        </Suspense>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
