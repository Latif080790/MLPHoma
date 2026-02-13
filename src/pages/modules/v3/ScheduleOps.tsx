import React, { useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs'
import { Card, CardContent } from '../../../../components/ui/card'
import WBS from '../../WBS' // Adjust path if needed, assuming relative to this file? 
// Actually original file imported from '../WBS' which means parent dir. 
// Let's check imports in original file.
// Original: import WBS from '../WBS' (in src/pages/modules/v3/ScheduleOps.tsx -> src/pages/modules/WBS)
// Wait, if ScheduleOps is in v3, then '../WBS' is src/pages/modules/WBS. Correct.
import Timeline from '../../Timeline'
import CurvaS from '../../CurvaS'
import Progress from '../../Progress'
import RiskRegister from '../../../../components/risk/RiskRegister'
import { useProjectStore } from '../../../../store/projectStore'
import { EmptyState } from '../../../../components/common/EmptyState'

export default function ScheduleOps() {
    const { activeProjectId } = useProjectStore()

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Please select a project." />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule & Operations</h1>
                    <p className="text-neutral-500">Integrated WBS, Timeline, Progress, and Risk Management.</p>
                </div>
            </div>

            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="wbs">WBS Structure</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline (Gantt)</TabsTrigger>
                    <TabsTrigger value="progress">Site Progress</TabsTrigger>
                    <TabsTrigger value="curvas">Curva-S Analysis</TabsTrigger>
                    <TabsTrigger value="risk">Risk & Issues</TabsTrigger>
                </TabsList>
                <TabsContent value="wbs">
                    <Card>
                        <CardContent className="pt-6">
                            <WBS />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="timeline">
                    <Card>
                        <CardContent className="pt-6">
                            <Timeline />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="progress">
                    <Card>
                        <CardContent className="pt-6">
                            <Progress />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="curvas">
                    <Card>
                        <CardContent className="pt-6">
                            <CurvaS />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="risk">
                    <Card>
                        <CardContent className="pt-6">
                            <RiskRegister projectId={activeProjectId} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

