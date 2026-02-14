
import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Calculator } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useProjectStore } from '@/store/projectStore'
import AHSP from '../AHSP' // Sibling in parent modules dir
import RAB from '../RAB'
import RAP from '../RAP'

export default function ProjectCosting() {
    const { activeProjectId } = useProjectStore()

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view costing data." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<Calculator size={18} />}
                title="Project Costing"
                description="AHSP master data, RAB estimation, and RAP budget control."
            />

            <Tabs defaultValue="rab" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ahsp">AHSP (Master Data)</TabsTrigger>
                    <TabsTrigger value="rab">RAB (Estimation)</TabsTrigger>
                    <TabsTrigger value="rap">RAP (Budget & Control)</TabsTrigger>
                </TabsList>
                <TabsContent value="ahsp">
                    <Card>
                        <CardContent className="pt-6">
                            <AHSP />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="rab">
                    <Card>
                        <CardContent className="pt-6">
                            <RAB />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="rap">
                    <Card>
                        <CardContent className="pt-6">
                            <RAP />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
