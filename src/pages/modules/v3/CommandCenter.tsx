import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, AlertTriangle, TrendingUp, DollarSign, Clock, Layout, Search, Filter, ShieldCheck, Zap } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { dashboardService, DashboardStats } from '@/services/dashboardService'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { ApprovalInbox } from '@/components/dashboard/ApprovalInbox'
import { CriticalPathWarningPanel } from '@/components/dashboard/CriticalPathWarningPanel'

export default function CommandCenter() {
    const { activeProjectId, projects } = useProjectStore()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(false)

    // Load Data
    useEffect(() => {
        if (activeProjectId) {
            setLoading(true)
            dashboardService.getProjectStats(activeProjectId)
                .then(setStats)
                .catch(() => toast.error("Failed to load dashboard data"))
                .finally(() => setLoading(false))
        }
    }, [activeProjectId])

    const activeProject = projects[activeProjectId || '']

    if (!activeProjectId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-full">
                    <Layout className="h-12 w-12 text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Command Center Offline</h2>
                <p className="text-slate-500 max-w-md text-center">
                    Select a project from the sidebar to initialize the Head-Up Display (HUD) and view real-time telemetry.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* 1. HUD HEADER: Ticker & Status */}
            <div className="flex items-center justify-between bg-slate-950 text-white p-3 rounded-lg border border-slate-800 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs font-mono text-blue-400 animate-pulse">
                        <Activity size={14} /> LIVE FEED
                    </div>
                    <div className="h-4 w-px bg-slate-800" />
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 overflow-hidden">
                        <span className="text-emerald-500">SYS_OPTIMAL</span>
                        <span>::</span>
                        <span>Connected to Supabase Region: SG-1</span>
                        <span>::</span>
                        <span>Sync Latency: 42ms</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-[10px]">
                        v3.2.0-STABLE
                    </Badge>
                </div>
            </div>

            {/* 2. BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">

                {/* A. PRIMARY KPI: CPI/SPI (Large Block) */}
                <Card className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-white shadow-xl relative overflow-hidden group">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Performance Index</h3>
                            <div className="flex items-end gap-2">
                                <span className={`text-4xl font-mono font-bold ${(stats?.cpi || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                    CPI {(stats?.cpi || 0).toFixed(2)}
                                </span>
                                <span className="text-sm text-slate-500 mb-1.5 font-mono">/ SPI {(stats?.spi || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 mt-4">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">Cost Variance</div>
                                <div className="text-sm font-mono text-slate-300">
                                    {(stats?.cpi || 0) >= 1 ? '+' : ''}{(((stats?.cpi || 1) - 1) * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div className="h-6 w-px bg-slate-800" />
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase">Schedule Var</div>
                                <div className="text-sm font-mono text-slate-300">
                                    {(stats?.spi || 0) >= 1 ? '+' : ''}{(((stats?.spi || 1) - 1) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* B. SAFETY / RISKS (Alert Block) */}
                <Card className={`md:col-span-1 border-l-4 shadow-sm ${(stats?.criticalRisks || 0) > 0
                    ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/10'
                    : 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
                    }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>Risk Radar</span>
                            {(stats?.criticalRisks || 0) > 0 ? <AlertTriangle size={16} className="text-red-500" /> : <ShieldCheck size={16} className="text-emerald-500" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {stats?.criticalRisks || 0}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Critical issues requiring immediate mitigation.</p>
                    </CardContent>
                </Card>

                {/* C. EQUIPMENT UTILIZATION (Mini Chart) */}
                <Card className="md:col-span-1 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" />
                            Auto-Rent Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {/* Short format currency */}
                            Rp {(stats?.equipmentCost || 0) > 1000000
                                ? `${((stats?.equipmentCost || 0) / 1000000).toFixed(1)}M`
                                : (stats?.equipmentCost || 0).toLocaleString()}
                        </div>
                        <div className="h-[60px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[{ val: stats?.equipmentCost || 0 }]}>
                                    <Bar dataKey="val" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* D. FINANCIAL FLOW (Wide Chart) */}
                <Card className="md:col-span-3 md:row-span-2 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <DollarSign size={16} className="text-emerald-600" />
                                Macro Cashflow Projection
                            </CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-[10px]">Weekly</Badge>
                                <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800">Monthly</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats?.cashflow || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
                                    <XAxis
                                        dataKey="week"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--popover))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="inflow"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorInflow)"
                                        name="Projected Inflow"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="outflow"
                                        stroke="#ef4444"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorOutflow)"
                                        name="Est. Outflow"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* E. ACTIVITY FEED (Terminal Style) */}
                <Card className="md:col-span-1 md:row-span-2 bg-slate-950 border-slate-800 text-slate-300 shadow-xl flex flex-col">
                    <CardHeader className="py-3 border-b border-slate-800">
                        <CardTitle className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                            LOG: ACTIVITY_STREAM
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                        <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700">
                            {stats?.activityFeed?.map((item, i) => (
                                <div key={i} className="flex gap-2 opacity-90 hover:opacity-100 transition-opacity">
                                    <span className="text-slate-600">[{format(new Date(item.date), 'HH:mm')}]</span>
                                    <span className={
                                        item.type === 'RISK' ? 'text-red-400' :
                                            item.type === 'PO' ? 'text-blue-400' : 'text-slate-300'
                                    }>
                                        {item.type === 'RISK' && 'CRITICAL: '}
                                        {item.message}
                                    </span>
                                </div>
                            ))}
                            {(!stats?.activityFeed || stats.activityFeed.length === 0) && (
                                <div className="text-slate-600 italic">-- No recent events --</div>
                            )}
                            {/* Cursor blink effect */}
                            <div className="h-4 w-2 bg-blue-500 animate-pulse mt-2" />
                        </div>
                    </CardContent>
                </Card>
                {/* F. APPROVAL INBOX (Full Width) */}
                <div className="md:col-span-2">
                    <ApprovalInbox />
                </div>

                {/* G. CRITICAL PATH WARNING PANEL */}
                <div className="md:col-span-4">
                    <CriticalPathWarningPanel
                        projectId={activeProjectId}
                        maxAlerts={5}
                    />
                </div>


            </div>
        </div>
    )
}

