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

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Plus, Info, MessageSquare, Layout } from 'lucide-react'

export default function CommandCenter() {
    const { projects, activeProjectId, addProject, setActiveProject } = useProjectStore()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    const projectList = Object.values(projects)
    const activeProject = projects[activeProjectId || ''] || null

    useEffect(() => {
        const loadStats = async () => {
            if (!activeProjectId) {
                // Load global aggregate stats if no project selected
                setStats({
                    totalBudget: projectList.reduce((sum, p) => sum + (p.budget || 0), 0),
                    utilizedBudget: 0, // Need global service for this, but let's mock for now
                    criticalRisks: 0,
                    overdueTasks: 0,
                    cashflow: [],
                    wasteAlerts: [],
                    activityFeed: [],
                    upcomingTasks: []
                })
                return
            }
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
    }, [activeProjectId, projects])

    const handleCreateProject = async (projectData: any) => {
        try {
            const newProject = {
                ...projectData,
                id: projectData.id || generateId('proj'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            addProject(newProject)
            setActiveProject(newProject.id)
            toast.success(`Project "${newProject.name}" created successfully!`)
            setIsProjectDialogOpen(false)
            setIsSheetOpen(false)
        } catch (error) {
            toast.error("Failed to create project")
        }
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
        <div className="relative min-h-[calc(100vh-8rem)] space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {activeProject ? activeProject.name : "Command Center (Global)"}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {activeProject ? "Project Dashboard & Strategic Control Tower" : "Portfolio Performance & Strategic Overview"}
                    </p>
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
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Portfolio Budget</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
                            {stats ? formatCurrency(stats.totalBudget) : "Rp 0"}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {activeProject ? "Total Project Budget" : "Accumulated Portfolio Value"}
                        </div>
                        <div className="w-full bg-blue-100 dark:bg-blue-900/30 h-1.5 rounded-full mt-3">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${budgetPercent}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-red-600 uppercase tracking-wider">Active Alerts</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{stats?.criticalRisks || 0}</div>
                        <div className="text-xs text-red-600/80 mt-1 font-medium">Critical Issues Locked</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Tasks</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{stats?.overdueTasks || 0}</div>
                        <div className="text-xs text-amber-600/80 mt-1 font-medium">Attention Required</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Projects Count</div>
                        <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
                            {projectList.length}
                        </div>
                        <div className="text-xs text-emerald-600/80 mt-1 font-medium">Managed Entities</div>
                    </CardContent>
                </Card>

                {/* 2. MAIN CHARTS (Row 2 & 3) */}
                <Card className="col-span-1 md:col-span-2 row-span-2 shadow-sm border-border/50 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Macro Cashflow Projection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {activeProjectId ? (
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
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 space-y-4">
                                <Layout className="h-12 w-12 opacity-20" />
                                <p className="text-sm">Select a project to view specific cashflow analysis.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-1 row-span-2 shadow-sm border-border/50 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-5 w-5 text-blue-500" />
                            Recent Pulse
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-2">
                        <div className="space-y-4 max-h-[320px] overflow-y-auto px-2">
                            {stats?.activityFeed && stats.activityFeed.length > 0 ? (
                                stats.activityFeed.map((item) => (
                                    <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-dashed last:border-0 border-slate-100 dark:border-slate-800">
                                        <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${item.type === 'RISK' ? 'bg-red-500' :
                                            item.type === 'PO' ? 'bg-blue-500' : 'bg-slate-500'
                                            }`} />
                                        <div className="space-y-0.5 min-w-0">
                                            <p className="text-sm font-medium leading-tight text-slate-900 dark:text-slate-100 truncate">
                                                {item.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {format(new Date(item.date || new Date()), 'dd MMM yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center space-y-2">
                                    <MessageSquare className="h-8 w-8 opacity-20" />
                                    <span>No recent activity detected</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 row-span-2 shadow-sm border-border/50 bg-slate-50/50 dark:bg-slate-900/50">
                    <CardHeader className="border-b bg-white dark:bg-slate-800/50 border-border/40 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-5 w-5 text-purple-500" />
                            Upcoming Deadlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="space-y-3">
                            {stats?.upcomingTasks && stats.upcomingTasks.length > 0 ? (
                                stats.upcomingTasks.map((task) => (
                                    <div key={task.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-semibold truncate max-w-[120px]" title={task.name}>{task.name}</span>
                                            <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold uppercase">{format(new Date(task.date), 'MMM dd')}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${task.progress}%` }} />
                                        </div>
                                        <div className="text-[9px] text-right mt-1 text-slate-400 font-mono">{task.progress}% COMPLETED</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center space-y-2">
                                    <Clock className="h-8 w-8 opacity-10" />
                                    <span>Portfolio timeline is clear.</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. ROW 3 (Quick Actions & Waste) */}
                <Card className="col-span-1 md:col-span-2 shadow-sm border border-orange-100 dark:border-orange-900/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-400">
                            <AlertTriangle className="h-4 w-4" />
                            Portfolio Waste Detector
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[140px] w-full">
                            {stats?.wasteAlerts && stats.wasteAlerts.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={stats.wasteAlerts} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="material" type="category" width={80} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="waste" name="Over Budget %" fill="#f97316" radius={[0, 4, 4, 0]} barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
                                    <span className="text-xs font-medium uppercase tracking-widest text-emerald-600/60">Portfolio Efficiency Optimal</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 bg-slate-900 text-white shadow-lg overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-500/20 transition-colors" />
                    <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <h3 className="text-lg font-bold mb-1 tracking-tight">Executive Intelligence</h3>
                            <p className="text-slate-400 text-sm mb-4">Strategic lifecycle management operations</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="secondary" className="w-full justify-start font-bold bg-white/10 hover:bg-white/20 border-white/5" onClick={() => setIsProjectDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4 text-blue-400" /> New Project
                            </Button>
                            <Button variant="secondary" className="w-full justify-start font-bold bg-white/5 hover:bg-white/10 border-white/5 text-slate-300">
                                <Users className="mr-2 h-4 w-4" /> Team Portfolio
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FLOATING ACTION BUTTON (Right Bottom) */}
            <div className="fixed bottom-8 right-8 z-50">
                <Button
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in slide-in-from-bottom-10"
                    onClick={() => setIsSheetOpen(true)}
                >
                    <Layout className="h-6 w-6 text-white" />
                </Button>
            </div>

            {/* RIGHT SIDE NAVBAR (SHEET) */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="w-[380px] sm:w-[500px] bg-slate-50 dark:bg-slate-950 border-l border-border/40 p-0">
                    <div className="h-full flex flex-col">
                        <SheetHeader className="p-6 bg-white dark:bg-slate-900 border-b">
                            <SheetTitle className="flex items-center gap-2">
                                <Info className="h-5 w-5 text-blue-600" /> Executive Sidepanel
                            </SheetTitle>
                            <SheetDescription>
                                Command & Control inputs for strategic oversight.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Section: Quick Project Switch/Create */}
                            <section className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project Management</h4>
                                <div className="space-y-2">
                                    <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700" onClick={() => setIsProjectDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" /> Create New Project
                                    </Button>
                                    <div className="pt-2">
                                        <p className="text-xs text-slate-500 mb-3">Recently Accessed Projects</p>
                                        <div className="space-y-1">
                                            {projectList.slice(0, 5).map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => { setActiveProject(p.id); setIsSheetOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm flex items-center justify-between ${activeProjectId === p.id ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600'}`}
                                                >
                                                    <span className="truncate">{p.name}</span>
                                                    {activeProjectId === p.id && <Badge variant="outline" className="text-[8px] bg-blue-500 text-white border-0 h-4">ACTIVE</Badge>}
                                                </button>
                                            ))}
                                            {projectList.length === 0 && (
                                                <p className="text-center py-4 text-xs text-slate-400 italic">No projects found</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Portfolio Stats (Mini Dashboard) */}
                            <section className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Strategic Portfolio Stats</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Total Budget</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(projectList.reduce((sum, p) => sum + (p.budget || 0), 0))}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Active Projects</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{projectList.length}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Section: System Health */}
                            <section className="bg-blue-600/5 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <Info className="h-4 w-4" />
                                    <span className="text-sm font-bold">System Recommendation</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    You have {projectList.length} total projects.
                                    {projectList.length > 0 ? " Ensure your 'Master Data' is synchronized for accurate costing analysis." : " Start by creating your first project to unlock deeper analytics."}
                                </p>
                            </section>
                        </div>

                        <div className="p-6 border-t bg-white dark:bg-slate-900 text-[10px] text-slate-500 font-mono text-center">
                            ESTIMATOR PRO v3.0 // STITCH_CORE_READY
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <ProjectDialog
                open={isProjectDialogOpen}
                onOpenChange={setIsProjectDialogOpen}
                onSave={handleCreateProject}
            />
        </div>
    )
}

