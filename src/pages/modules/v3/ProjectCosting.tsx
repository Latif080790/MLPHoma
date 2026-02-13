
import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import AHSP from '../AHSP' // Sibling in parent modules dir
import RAB from '../RAB'
import RAP from '../RAP'

export default function ProjectCosting() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Project Costing</h1>
            </div>

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
