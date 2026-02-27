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
import { GenerateReportDialog } from '@/components/dashboard/GenerateReportDialog'
import { FileDown } from 'lucide-react'
import { MRPAlertPanel } from '@/components/supply/MRPAlertPanel'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { ApprovalQueueWidget } from '@/components/dashboard/ApprovalQueueWidget'

import { useNavigate } from 'react-router-dom'

export default function CommandCenter() {
    const navigate = useNavigate()
    const { activeProjectId, projects } = useProjectStore()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [portfolioStats, setPortfolioStats] = useState<any>(null)
    const [isPortfolioMode, setIsPortfolioMode] = useState(false)
    const [loading, setLoading] = useState(false)

    // Load Data
    useEffect(() => {
        setLoading(true)
        if (isPortfolioMode) {
            dashboardService.getPortfolioStats()
                .then(setPortfolioStats)
                .catch(() => toast.error("Failed to load portfolio data"))
                .finally(() => setLoading(false))
        } else if (activeProjectId) {
            dashboardService.getProjectStats(activeProjectId)
                .then(setStats)
                .catch(() => toast.error("Failed to load project data"))
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [activeProjectId, isPortfolioMode])

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
            <div className="flex flex-col gap-2 bg-slate-950 text-white p-3 rounded-lg border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs font-mono text-blue-400 animate-pulse">
                            <Activity size={14} /> {isPortfolioMode ? 'PORTFOLIO HUD' : 'PROJECT HUD'}
                        </div>
                        <div className="h-4 w-px bg-slate-800" />
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2 overflow-hidden whitespace-nowrap">
                            <span className="text-emerald-500">SYS_OPTIMAL</span>
                            <span>::</span>
                            <span>Latency: 42ms</span>
                            <span>::</span>
                            <span className="text-blue-400">Mode: {isPortfolioMode ? 'Consolidated Telemetry' : 'Deep Dive'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Report Generator */}
                        {!isPortfolioMode && activeProject && stats && (
                            <GenerateReportDialog projectId={activeProjectId} projectName={activeProject.name} stats={stats}>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-mono border-slate-700 text-slate-400 hover:text-white bg-slate-900">
                                    <FileDown className="mr-2 h-3 w-3" /> EXPORT REPORT
                                </Button>
                            </GenerateReportDialog>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 text-xs font-mono border border-slate-700 ${isPortfolioMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-white'}`}
                            onClick={() => setIsPortfolioMode(!isPortfolioMode)}
                        >
                            {isPortfolioMode ? 'EXIT PORTFOLIO' : 'ENTER PORTFOLIO'}
                        </Button>
                        <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-xs">
                            v3.2.0-STABLE
                        </Badge>
                    </div>
                </div>

                {/* MARQUEE TICKER */}
                <div className="h-6 bg-black/40 rounded border border-slate-800/50 overflow-hidden flex items-center">
                    <div className="bg-red-600/20 text-red-500 px-2 py-0.5 text-xs font-bold border-r border-red-500/30 flex items-center gap-1 z-10 uppercase">
                        <AlertTriangle size={10} /> Alerts
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <div className="animate-marquee whitespace-nowrap text-xs font-mono text-slate-400 flex items-center gap-8 pl-4">
                            {isPortfolioMode ? (
                                <>
                                    <span>CRITICAL: {portfolioStats?.globalAlertCounts?.CRITICAL || 0} alerts across {portfolioStats?.totalProjects || 0} projects</span>
                                    <span>::</span>
                                    <span>TOP RISK: {portfolioStats?.topGlobalRisks?.[0]?.description || 'None detected'} ({portfolioStats?.topGlobalRisks?.[0]?.projectName})</span>
                                    <span>::</span>
                                    <span>LIQUIDITY: avg CPI {(portfolioStats?.avgCpi || 1).toFixed(2)}</span>
                                </>
                            ) : (
                                <>
                                    <span>SYSTEM: Monitoring {activeProject?.name || 'Active Project'}</span>
                                    <span>::</span>
                                    <span>ALERTS: {stats?.alertCounts?.CRITICAL || 0} Critical / {stats?.alertCounts?.MODERATE || 0} Moderate</span>
                                    <span>::</span>
                                    <span>HEALTH: SPI {(stats?.spi || 1).toFixed(2)} / CPI {(stats?.cpi || 1).toFixed(2)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">

                {/* A. PRIMARY KPI: CPI/SPI (Large Block) */}
                <Card className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {isPortfolioMode ? 'Portfolio Avg Performance' : 'Project Health Index (PHI)'}
                            </h3>
                            <div className="flex items-end gap-6">
                                <div className="flex items-end gap-2">
                                    <span className={`text-4xl font-mono font-bold ${(isPortfolioMode ? portfolioStats?.avgPhi || 0 : stats?.phi?.score || 0) >= 85 ? 'text-emerald-400' : (isPortfolioMode ? portfolioStats?.avgPhi || 0 : stats?.phi?.score || 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                        {isPortfolioMode ? Math.round(portfolioStats?.avgPhi || 0) : stats?.phi?.score || 0}
                                    </span>
                                    <span className="text-sm text-slate-500 mb-1.5 font-mono">
                                        / 100
                                    </span>
                                </div>
                                <div className="h-10 w-px bg-slate-800" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 uppercase">Rating</span>
                                    <Badge variant="outline" className={`text-xs uppercase ${(isPortfolioMode ? portfolioStats?.avgPhi || 0 : stats?.phi?.score || 0) >= 85 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (isPortfolioMode ? portfolioStats?.avgPhi || 0 : stats?.phi?.score || 0) >= 70 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                        }`}>
                                        {isPortfolioMode ? (portfolioStats?.avgPhi >= 85 ? 'OPTIMAL' : portfolioStats?.avgPhi >= 70 ? 'STABLE' : 'CRITICAL') : stats?.phi?.rating || 'UNKNOWN'}
                                    </Badge>
                                </div>
                                <div className="ml-auto">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs font-mono text-slate-500 hover:text-white border border-slate-800 hover:bg-blue-600 transition-all uppercase tracking-tighter"
                                        onClick={() => navigate('/strategy-simulation')}
                                    >
                                        Analyze Impact
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 mt-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase">
                                    {isPortfolioMode ? 'Avg CPI' : 'CPI'}
                                </div>
                                <div className={`text-sm font-mono font-bold ${(isPortfolioMode ? portfolioStats?.avgCpi || 0 : stats?.cpi || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {(isPortfolioMode ? portfolioStats?.avgCpi || 0 : stats?.cpi || 0).toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">
                                    {isPortfolioMode ? 'Avg SPI' : 'SPI'}
                                </div>
                                <div className={`text-sm font-mono font-bold ${(isPortfolioMode ? portfolioStats?.avgSpi || 0 : stats?.spi || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {(isPortfolioMode ? portfolioStats?.avgSpi || 0 : stats?.spi || 0).toFixed(2)}
                                </div>
                            </div>
                            <div className="h-6 w-px bg-slate-800" />
                            <div>
                                <div className="text-xs text-slate-500 uppercase">
                                    {isPortfolioMode ? 'Active Projects' : 'Cost Variance'}
                                </div>
                                <div className="text-sm font-mono text-slate-300">
                                    {isPortfolioMode ? portfolioStats?.totalProjects || 0 : (
                                        <>
                                            {(stats?.cpi || 0) >= 1 ? '+' : ''}{(((stats?.cpi || 1) - 1) * 100).toFixed(1)}%
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="h-6 w-px bg-slate-800" />
                            <div>
                                <div className="text-xs text-slate-500 uppercase">
                                    {isPortfolioMode ? 'Total Budget' : 'Schedule Var'}
                                </div>
                                <div className="text-sm font-mono text-slate-300">
                                    {isPortfolioMode ? `Rp ${((portfolioStats?.totalBudget || 0) / 1000000000).toFixed(1)}B` : (
                                        <>
                                            {(stats?.spi || 0) >= 1 ? '+' : ''}{(((stats?.spi || 1) - 1) * 100).toFixed(1)}%
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* B. SAFETY / RISKS (Alert Block) */}
                <Card className={`md:col-span-1 border-l-4 shadow-sm ${(isPortfolioMode ? portfolioStats?.globalAlertCounts?.CRITICAL || 0 : stats?.criticalRisks || 0) > 0
                    ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/10'
                    : 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
                    }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>{isPortfolioMode ? 'Global Risks' : 'Risk Radar'}</span>
                            {(isPortfolioMode ? portfolioStats?.globalAlertCounts?.CRITICAL || 0 : stats?.criticalRisks || 0) > 0 ? <AlertTriangle size={16} className="text-red-500" /> : <ShieldCheck size={16} className="text-emerald-500" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isPortfolioMode ? portfolioStats?.globalAlertCounts?.CRITICAL || 0 : stats?.criticalRisks || 0}
                        </div>
                        <div className="mt-2 space-y-1">
                            {isPortfolioMode ? (
                                portfolioStats?.topGlobalRisks?.slice(0, 3).map((risk: any, i: number) => (
                                    <div key={i} className="text-xs text-red-600 dark:text-red-400 truncate font-medium flex items-center gap-1">
                                        <div className="h-1 w-1 bg-red-500 rounded-full" />
                                        [{risk.projectName}] {risk.description}
                                    </div>
                                ))
                            ) : (
                                stats?.topRisks?.slice(0, 2).map((risk, i) => (
                                    <div key={i} className="text-xs text-red-600 dark:text-red-400 truncate font-medium flex items-center gap-1">
                                        <div className="h-1 w-1 bg-red-500 rounded-full" />
                                        {risk.description}
                                    </div>
                                ))
                            )}
                            {((isPortfolioMode ? !portfolioStats?.topGlobalRisks?.length : !stats?.topRisks?.length)) && (
                                <p className="text-xs text-slate-500">No open critical risks.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* C. SCHEDULE ALERTS */}
                <Card className="md:col-span-1 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <Clock size={16} className="text-amber-500" />
                            {isPortfolioMode ? 'Global Health' : 'Schedule Health'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <div className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                                {isPortfolioMode ? portfolioStats?.globalAlertCounts?.CRITICAL || 0 : stats?.alertCounts?.CRITICAL || 0}
                            </div>
                            <div className="text-xs text-red-500 font-bold mb-1 uppercase">Critical</div>
                        </div>
                        <div className="mt-2 flex gap-1">
                            <Badge variant="outline" className="text-xs h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                {isPortfolioMode ? portfolioStats?.globalAlertCounts?.MODERATE || 0 : stats?.alertCounts?.MODERATE || 0} MOD
                            </Badge>
                            <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                {isPortfolioMode ? portfolioStats?.globalAlertCounts?.MINOR || 0 : stats?.alertCounts?.MINOR || 0} MIN
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* D. STRATEGIC ANOMALIES (Phase 13) */}
                <Card className="md:col-span-1 shadow-sm border-slate-200 dark:border-slate-800 bg-slate-900 text-white">
                    <CardHeader className="pb-2 border-b border-slate-800/10 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Zap size={12} className="text-yellow-400" /> Strategic Anomalies
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-500 hover:text-white"
                            onClick={() => navigate('/portfolio-resources')}
                            title="Resource Heatmap"
                        >
                            <Activity size={12} />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2 min-h-[80px] flex flex-col justify-center">
                        {isPortfolioMode ? (
                            <div className="text-xs text-slate-500 italic text-center">
                                Analyzing global pattern drift...
                            </div>
                        ) : stats?.anomalies && stats.anomalies.length > 0 ? (
                            stats.anomalies.map((anno, idx) => (
                                <div key={idx} className="p-1.5 rounded border border-red-500/20 bg-red-500/5">
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <AlertTriangle size={8} className="text-red-500" />
                                        <span className="text-xs font-bold text-red-500 uppercase">{anno.type}</span>
                                    </div>
                                    <div className="text-xs text-slate-300 leading-tight">{anno.description}</div>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-emerald-500 font-mono text-center flex flex-col items-center gap-1">
                                <Activity size={14} className="animate-pulse" />
                                SYSTEMS OPTIMAL
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* E. FINANCIAL FLOW (Wide Chart) */}
                <Card className="md:col-span-3 md:row-span-2 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <DollarSign size={16} className="text-emerald-600" />
                                {isPortfolioMode ? 'Portfolio Aggregate Cashflow' : 'Macro Cashflow Projection'}
                            </CardTitle>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">Weekly</Badge>
                                <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800">Monthly</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={isPortfolioMode ? [] : (stats?.cashflow || [])} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    {isPortfolioMode ? (
                                        <text x="50%" y="50%" textAnchor="middle" fill="#94a3b8" fontSize="12" fontStyle="italic">
                                            Consolidation of multi-project cashflow in progress...
                                        </text>
                                    ) : (
                                        <>
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
                                            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" name="Projected Inflow" />
                                            <Area type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" name="Est. Outflow" />
                                        </>
                                    )}
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
                {/* F. APPROVAL INBOX & MRP ALERTS (Side by Side) */}
                <div className="md:col-span-2">
                    <ApprovalQueueWidget projectId={activeProjectId} />
                </div>
                <div className="md:col-span-2">
                    <ApprovalInbox />
                </div>
                <div className="md:col-span-2">
                    <MRPAlertPanel compact />
                </div>

                {/* G. CRITICAL PATH WARNING PANEL */}
                <div className="md:col-span-4">
                    <CriticalPathWarningPanel
                        projectId={activeProjectId}
                        maxAlerts={5}
                    />
                </div>

                {/* H. AUDIT TRAIL (Recent Activity) */}
                <div className="md:col-span-4">
                    <AuditLogViewer compact title="Recent Activity" />
                </div>


            </div>
        </div>
    )
}

