import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, AlertTriangle, TrendingUp, CheckCircle2, DollarSign, Clock, Users } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { assertSupabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ProjectDialog } from '@/components/project/ProjectDialog'
import { toast } from 'sonner'
import { generateId } from '@/lib/idGenerator'
import { dashboardService, DashboardStats } from '@/services/dashboardService'

// ... existing imports ...
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { Badge } from '@/components/ui/badge'

export default function CommandCenter() {
    const { activeProjectId, addProject } = useProjectStore()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)

    useEffect(() => {
        const loadStats = async () => {
            if (!activeProjectId) return
            setLoading(true)
            try {
                const data = await dashboardService.getProjectStats(activeProjectId)
                setStats(data)
            } catch (error) {
                console.error("Failed to load dashboard stats", error)
                toast.error("Failed to refresh command center data")
            } finally {
                setLoading(false)
            }
        }
        loadStats()
    }, [activeProjectId])

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

    if (!activeProjectId) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                    <Activity className="h-12 w-12 text-slate-400" />
                </div>
                <h2 className="text-xl font-semibold">No Project Selected</h2>
                <p className="text-muted-foreground max-w-sm">
                    Select a project from the sidebar or create a new one to view the Command Center.
                </p>
                <Button onClick={() => setIsProjectDialogOpen(true)}>
                    Create New Project
                </Button>
                <ProjectDialog
                    open={isProjectDialogOpen}
                    onOpenChange={setIsProjectDialogOpen}
                    onSave={handleCreateProject}
                />
            </div>
        )
    }

    const formatCurrency = (val: number) => {
        if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}M`
        if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)}jt`
        return `Rp ${val.toLocaleString()}`
    }

    const budgetPercent = stats && stats.totalBudget > 0
        ? ((stats.utilizedBudget / stats.totalBudget) * 100).toFixed(0)
        : "0"

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Command Center</h1>
                    <p className="text-slate-500 dark:text-slate-400">Executive Dashboard & Strategic Control Tower</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="glass">
                        Refresh <Activity className="ml-2 h-3 w-3" />
                    </Button>
                    <Badge variant="outline" className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Online 🟢
                    </Badge>
                </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)]">

                {/* 1. KPI CARDS (Top Row) */}
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Budget Health</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
                            {stats ? `${budgetPercent}%` : "Loading..."}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {stats ? `${formatCurrency(stats.utilizedBudget)} / ${formatCurrency(stats.totalBudget)}` : "..."}
                        </div>
                        <div className="w-full bg-blue-100 dark:bg-blue-900/30 h-1.5 rounded-full mt-3">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${budgetPercent}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-red-600 uppercase tracking-wider">Critical Risks</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{stats?.criticalRisks || 0}</div>
                        <div className="text-xs text-red-600/80 mt-1 font-medium">Requires Action</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Overdue Tasks</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{stats?.overdueTasks || 0}</div>
                        <div className="text-xs text-amber-600/80 mt-1 font-medium">Schedule Impact</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cashflow (Proj)</div>
                        <div className="text-xl font-bold mt-2 text-slate-900 dark:text-white">
                            {stats && stats.cashflow.length > 0 ? formatCurrency((stats.cashflow[0].balance || 0) * 1000000) : "Rp 0"}
                        </div>
                        <div className="text-xs text-emerald-600/80 mt-1 font-medium">Net Value</div>
                    </CardContent>
                </Card>

                {/* 2. MAIN CHARTS (Row 2 & 3) */}
                <Card className="col-span-1 md:col-span-2 row-span-2 shadow-sm border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Financial Runway (Cash In vs Out)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats?.cashflow || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Inflow (Est)" />
                                    <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Outflow (PO)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-1 row-span-2 shadow-sm border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-5 w-5 text-blue-500" />
                            Activity Feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.activityFeed && stats.activityFeed.length > 0 ? (
                                stats.activityFeed.map((item) => (
                                    <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-dashed last:border-0 border-slate-100 dark:border-slate-800">
                                        <div className={`mt-0.5 h-2 w-2 rounded-full ${item.type === 'RISK' ? 'bg-red-500' :
                                                item.type === 'PO' ? 'bg-blue-500' : 'bg-slate-500'
                                            }`} />
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium leading-none text-slate-900 dark:text-slate-100">
                                                {item.message}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(item.date), 'dd MMM HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-sm text-muted-foreground">No recent activity</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 row-span-2 shadow-sm border-border/50 bg-slate-50/50 dark:bg-slate-900/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-5 w-5 text-purple-500" />
                            Upcoming Tasks
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats?.upcomingTasks && stats.upcomingTasks.length > 0 ? (
                                stats.upcomingTasks.map((task) => (
                                    <div key={task.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-medium truncate max-w-[120px]" title={task.name}>{task.name}</span>
                                            <span className="text-[10px] text-slate-400">{format(new Date(task.date), 'MMM dd')}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${task.progress}%` }} />
                                        </div>
                                        <div className="text-[10px] text-right mt-1 text-slate-500">{task.progress}%</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-sm text-muted-foreground">No upcoming tasks</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. ROW 3 (Quick Actions & Waste) */}
                <Card className="col-span-1 md:col-span-2 shadow-sm border border-orange-100 dark:border-orange-900/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-orange-700 dark:text-orange-400">
                            <AlertTriangle className="h-5 w-5" />
                            Supply Chain Waste Detector
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[140px] w-full">
                            {stats?.wasteAlerts && stats.wasteAlerts.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={stats.wasteAlerts} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="material" type="category" width={80} tick={{ fontSize: 11 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="waste" name="Over Budget %" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                                    <span className="text-sm">Supply chain is optimized (Runway Clear)</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 bg-slate-900 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/20 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                    <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <h3 className="text-lg font-bold mb-1">Quick Actions</h3>
                            <p className="text-slate-400 text-sm mb-4">Manage project lifecycle</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="secondary" className="w-full justify-start" onClick={() => setIsProjectDialogOpen(true)}>
                                <TrendingUp className="mr-2 h-4 w-4 text-blue-500" /> New Project
                            </Button>
                            <Button variant="secondary" className="w-full justify-start hover:bg-slate-800 text-slate-200">
                                <Users className="mr-2 h-4 w-4" /> Team
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>

            <ProjectDialog
                open={isProjectDialogOpen}
                onOpenChange={setIsProjectDialogOpen}
                onSave={handleCreateProject}
            />
        </div>
    )
}
