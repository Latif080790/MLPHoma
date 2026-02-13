
import React, { useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { CalendarClock, GanttChartSquare, ListTodo, TrendingUp, AlertTriangle } from 'lucide-react'
import WBS from '../WBS'
import Timeline from '../Timeline'
import CurvaS from '../CurvaS'
import Progress from '../Progress'
import RiskRegister from '@/components/risk/RiskRegister'
import { useProjectStore } from '@/store/projectStore'
import { EmptyState } from '@/components/common/EmptyState'

export default function ScheduleOps() {
    const { activeProjectId } = useProjectStore()

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Please select a project to view schedule." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<CalendarClock size={18} />}
                title="Schedule & Operations"
                description="Integrated project planning, execution, and risk management."
            />

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
                        <Progress />
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
            </Tabs>
        </div>
    )
}
