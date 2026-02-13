
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, AlertTriangle, TrendingUp, CheckCircle2, DollarSign, Clock } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { assertSupabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ProjectDialog } from '@/components/project/ProjectDialog'
import { toast } from 'sonner'
import { generateId } from '@/lib/idGenerator'

interface ActivityItem {
    type: string
    title: string
    desc: string
    date: string
}

// ... existing imports ...
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { Badge } from '@/components/ui/badge'

// Mock Data for v3 Visualization (Since DB might be empty)
const MOCK_CASHFLOW = [
    { week: 'W1', inflow: 500, outflow: 300, balance: 200 },
    { week: 'W2', inflow: 200, outflow: 400, balance: -200 }, // Defisit
    { week: 'W3', inflow: 800, outflow: 200, balance: 600 },
    { week: 'W4', inflow: 300, outflow: 300, balance: 0 },
]

const MOCK_WASTE = [
    { material: 'Semen', waste: 5.2, limit: 3 }, // Over limit
    { material: 'Besi', waste: 1.5, limit: 3 },
    { material: 'Pasir', waste: 2.8, limit: 5 },
]

export default function CommandCenter() {
    const { activeProjectId, addProject } = useProjectStore()
    const [stats, setStats] = useState({
        totalProjects: 0,
        criticalRisks: 3, // Mock active risks
        budgetHealth: 85,
        pendingApprovals: 5,
        deviasi: -7.5 // Mock Delay
    })
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)

    const handleCreateProject = async (projectData: any) => {
        try {
            const newProject = {
                ...projectData,
                id: projectData.id || generateId('proj'), // Ensure ID
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            addProject(newProject)
            toast.success(`Project "${newProject.name}" created successfully!`)
            setIsProjectDialogOpen(false)
        } catch (error) {
            toast.error("Failed to create project")
        }
    }

    // ... existing load stats logic ...

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Command Center (v3 Cockpit)</h1>
                    <p className="text-neutral-500">Executive Dashboard & Strategic Control Tower</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="px-4 py-1 text-sm bg-green-100 text-green-800 border-green-200">
                        System Status: ONLINE 🟢
                    </Badge>
                </div>
            </div>

            {/* KPI Grid - Top Level */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                        <div className="text-xs font-semibold text-blue-600 uppercase">Total Budget Utilized</div>
                        <div className="text-2xl font-bold mt-1">Rp 4.2M / 12M</div>
                        <div className="text-xs text-muted-foreground mt-1">35% Committed</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 border-l-4 border-l-red-500">
                    <CardContent className="pt-6">
                        <div className="text-xs font-semibold text-red-600 uppercase">Critical Risks</div>
                        <div className="text-2xl font-bold mt-1">{stats.criticalRisks} Items</div>
                        <div className="text-xs text-muted-foreground mt-1">Requires immediate attention</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-50 to-white dark:from-slate-900 border-l-4 border-l-yellow-500">
                    <CardContent className="pt-6">
                        <div className="text-xs font-semibold text-yellow-600 uppercase">Schedule Deviation</div>
                        <div className="text-2xl font-bold mt-1">{stats.deviasi}% (Late)</div>
                        <div className="text-xs text-muted-foreground mt-1">Est. Delay: 14 Days</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-slate-900 border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                        <div className="text-xs font-semibold text-green-600 uppercase">Cashflow (30 Days)</div>
                        <div className="text-2xl font-bold mt-1">+Rp 450jt</div>
                        <div className="text-xs text-muted-foreground mt-1">Safe Runway</div>
                    </CardContent>
                </Card>
            </div>

            {/* 4 QUADRANT LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Q1: FINANCIAL HEALTH (Cashflow Runway) */}
                <Card className="col-span-1 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            Financial Runway (Projection)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={MOCK_CASHFLOW}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} name="Cash In" />
                                    <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} name="Cash Out" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded text-xs text-red-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <strong>Alert:</strong> Projected deficit in Week 2 (-Rp 200jt). Prepare invoice #INV-003 immediately.
                        </div>
                    </CardContent>
                </Card>

                {/* Q2: OPERATION RISK (Heatmap List) */}
                <Card className="col-span-1 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Top Critical Risks (Active)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { title: "Cuaca Ekstrim (Hujan)", prob: "High", impact: "High", score: 25 },
                                { title: "Keterlambatan Beton (Vendor A)", prob: "Med", impact: "High", score: 15 },
                                { title: "Ijin Lingkungan (Warga)", prob: "Low", impact: "High", score: 12 },
                            ].map((risk, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                    <div>
                                        <div className="font-semibold text-sm">{risk.title}</div>
                                        <div className="flex gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px]">Prob: {risk.prob}</Badge>
                                            <Badge variant="outline" className="text-[10px]">Imp: {risk.impact}</Badge>
                                        </div>
                                    </div>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs ${risk.score >= 20 ? 'bg-red-600 animate-pulse' : risk.score >= 15 ? 'bg-orange-500' : 'bg-yellow-500'}`}>
                                        {risk.score}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Q3: SUPPLY CHAIN (Waste Detector) */}
                <Card className="col-span-1 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-orange-600" />
                            Supply Chain Alert (Waste Detector)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={MOCK_WASTE}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="material" type="category" width={80} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="waste" name="Act. Waste %" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                                    <Bar dataKey="limit" name="Max Limit %" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            *Bar Orange &gt; Grey berarti pemborosan material melebihi batas aman (Detect: Semen +2.2%).
                        </div>
                    </CardContent>
                </Card>

                {/* Q4: QUICK ACTIONS */}
                <Card className="bg-slate-950 text-white col-span-1 shadow-md flex flex-col justify-center">
                    <CardContent className="p-8 space-y-4">
                        <h3 className="text-xl font-bold mb-4">Command Actions</h3>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg">
                            <TrendingUp className="mr-2" /> View Detailed Reports
                        </Button>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="secondary" className="h-12">
                                Create PO
                            </Button>
                            <Button variant="secondary" className="h-12 bg-red-800 hover:bg-red-900 text-white border-none">
                                Log Incident
                            </Button>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-4">System v3.0 Ultra • 12ms Latency</p>
                    </CardContent>
                </Card>

                <ProjectDialog
                    open={isProjectDialogOpen}
                    onOpenChange={setIsProjectDialogOpen}
                    onSave={handleCreateProject}
                />
            </div>
        </div>
    )
}
