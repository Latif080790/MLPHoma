
import React, { useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { CalendarClock, GanttChartSquare, ListTodo, TrendingUp, AlertTriangle, FlaskConical, Boxes } from 'lucide-react'
import WBS from '../WBS'
import Timeline from '../Timeline'
import CurvaS from '../CurvaS'
import Progress from '../Progress'
import RiskRegister from '@/components/risk/RiskRegister'
import { useProjectStore } from '@/store/projectStore'
import { EmptyState } from '@/components/common/EmptyState'
import { TimelineScenarioPanel } from '@/components/modules/TimelineScenarioPanel'
import { ResourceUsageDialog } from '@/components/progress/ResourceUsageDialog'
import { DailyProgressBoard } from '@/components/progress/DailyProgressBoard'
import { ClipboardCheck } from 'lucide-react'

export default function ScheduleOps() {
    const { activeProjectId } = useProjectStore()
    const [resourceOpen, setResourceOpen] = React.useState(false)

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Please select a project to view schedule." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<CalendarClock size={18} />}
                title="Schedule & Operations"
                description="Integrated project planning, execution, and risk management."
            />

            <ResourceUsageDialog open={resourceOpen} onOpenChange={setResourceOpen} projectId={activeProjectId} />

            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50 mb-6 backdrop-blur-sm">
                    <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <GanttChartSquare size={14} /> Timeline (Gantt)
                    </TabsTrigger>
                    <TabsTrigger value="wbs" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
                        <ListTodo size={14} /> WBS Structure
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
                        <Timeline />
                    </div>
                </TabsContent>

                <TabsContent value="wbs" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-0 min-h-[500px]">
                        <WBS />
                    </div>
                </TabsContent>

                <TabsContent value="progress" className="outline-none">
                    <Card className="border-none shadow-none bg-transparent">
                        <DailyProgressBoard />
                        <div className="mt-6">
                            <Progress />
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="curvas" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <CurvaS />
                    </div>
                </TabsContent>

                <TabsContent value="risk" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <RiskRegister projectId={activeProjectId} />
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
                                <p className="mt-4 text-[11px] text-slate-400 italic">
                                    Mencatat pemakaian alat (HM/Shift) dan distribusi tenaga kerja secara spesifik.
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="scenario" className="outline-none">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
                        <TimelineScenarioPanel projectId={activeProjectId} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
