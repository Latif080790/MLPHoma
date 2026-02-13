
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Activity, AlertTriangle, TrendingUp, CheckCircle2, DollarSign, Clock } from 'lucide-react'
import { useProjectStore } from '../../../store/projectStore'
import { assertSupabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'
// Link removed
import { Button } from '../../../components/ui/button'

interface ActivityItem {
    type: string
    title: string
    desc: string
    date: string
}

export default function CommandCenter() {
    const { activeProjectId } = useProjectStore()
    const [stats, setStats] = useState({
        totalProjects: 0,
        criticalRisks: 0,
        budgetHealth: 100, // percentage
        pendingApprovals: 0,
    })
    const [activities, setActivities] = useState<ActivityItem[]>([])
    // const [cashflow, setCashflow] = useState<any[]>([]) 

    useEffect(() => {
        loadGlobalStats()
        if (activeProjectId) {
            loadProjectStats(activeProjectId)
        }
    }, [activeProjectId])

    async function loadGlobalStats() {
        const client = assertSupabase()
        const { count } = await client.from('projects').select('*', { count: 'exact', head: true })
        setStats(prev => ({ ...prev, totalProjects: count || 0 }))
    }

    async function loadProjectStats(projectId: string) {
        const client = assertSupabase()

        // 1. Critical Risks (Score >= 15)
        const { count: riskCount } = await client
            .from('risks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('risk_score', 15)
            .neq('status', 'CLOSED')

        // 2. Pending Approvals (POs + VOs + MRs)
        const { count: poCount } = await client.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'PENDING_APPROVAL')
        const { count: voCount } = await client.from('change_orders').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'PENDING_APPROVAL')
        const { count: mrCount } = await client.from('material_requests').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'PENDING')

        // 3. Transactions for Activity Feed
        const { data: recentRisks } = await client.from('risks').select('description, created_at, created_by').eq('project_id', projectId).order('created_at', { ascending: false }).limit(3)
        const { data: recentVOs } = await client.from('change_orders').select('title, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(3)

        const feed: ActivityItem[] = [
            ...(recentRisks || []).map((r: any) => ({ type: 'Risk', title: 'New Risk Logged', desc: r.description, date: r.created_at })),
            ...(recentVOs || []).map((v: any) => ({ type: 'VO', title: 'Change Order Created', desc: v.title, date: v.created_at }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

        setActivities(feed)

        // 4. Budget Calculation (Simplified)
        const { data: project } = await client.from('projects').select('budget').eq('id', projectId).single()
        const { data: pos } = await client.from('purchase_orders').select('total_amount').eq('project_id', projectId).neq('status', 'REJECTED')

        const totalCommitted = pos?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0
        const budget = project?.budget || 1
        const health = Math.max(0, Math.min(100, ((budget - totalCommitted) / budget) * 100))

        setStats(prev => ({
            ...prev,
            criticalRisks: riskCount || 0,
            pendingApprovals: (poCount || 0) + (voCount || 0) + (mrCount || 0),
            budgetHealth: Math.round(health)
        }))
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
                    <p className="text-neutral-500">Executive Dashboard & Project Health</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-neutral-500">
                        {activeProjectId ? format(new Date(), 'EEEE, dd MMM yyyy') : 'All Projects View'}
                    </span>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Active Projects</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProjects}</div>
                        <p className="text-xs text-muted-foreground">Portfolio Overview</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical Risks</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${stats.criticalRisks > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.criticalRisks > 0 ? 'text-red-500' : ''}`}>{stats.criticalRisks}</div>
                        <p className="text-xs text-muted-foreground">High impact items (Score 15+)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Budget Remaining</CardTitle>
                        <DollarSign className={`h-4 w-4 ${stats.budgetHealth < 20 ? 'text-red-500' : 'text-green-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.budgetHealth < 20 ? 'text-red-500' : 'text-green-500'}`}>{stats.budgetHealth}%</div>
                        <p className="text-xs text-muted-foreground">Of total budget avail</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                        <p className="text-xs text-muted-foreground">MRs, POs, VOs requiring action</p>
                    </CardContent>
                </Card>
            </div>

            {/* Widgets */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Cashflow Projection</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md bg-neutral-50/50">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Chart Component Placeholder (Requires Chart.js/Recharts)
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {activities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent activity.</p>
                            ) : activities.map((act, i) => (
                                <div key={i} className="flex items-center">
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{act.title}</p>
                                        <p className="text-sm text-muted-foreground">{act.desc}</p>
                                    </div>
                                    <div className="ml-auto font-medium text-xs text-muted-foreground">
                                        {format(new Date(act.date), 'dd MMM HH:mm')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-blue-950 text-white">
                    <CardHeader><CardTitle className="text-white">Quick Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center text-sm opacity-90 hover:opacity-100 cursor-pointer p-2 rounded hover:bg-white/10">
                            <span>Create New Project</span> <TrendingUp size={14} />
                        </div>
                        <div className="flex justify-between items-center text-sm opacity-90 hover:opacity-100 cursor-pointer p-2 rounded hover:bg-white/10">
                            <span>Review Pending POs</span> <CheckCircle2 size={14} />
                        </div>
                        <div className="flex justify-between items-center text-sm opacity-90 hover:opacity-100 cursor-pointer p-2 rounded hover:bg-white/10">
                            <span>Log Safety Incident</span> <AlertTriangle size={14} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
