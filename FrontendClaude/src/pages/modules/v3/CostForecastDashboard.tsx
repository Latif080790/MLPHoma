/**
 * CostForecastDashboard.tsx
 * Enterprise-grade visualizer for predictive EAC and historical EVM trends.
 */
import React, { useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader } from '@/components/patterns'
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    AreaChart, Area
} from 'recharts'
import { 
    TrendingUp, 
    AlertTriangle, 
    CalendarClock, 
    CircleDollarSign,
    RefreshCw,
    BarChart3,
    History,
    FileWarning,
    Activity
} from 'lucide-react'
import { useForecastStore } from '@/store/costForecastStore'
import { useProjectStore } from '@/store/projectStore'
import { format } from 'date-fns'

export default function CostForecastDashboard() {
    const activeProjectId = useProjectStore(s => s.activeProjectId)
    const { history, projections, loading, fetchHistory, generateSnapshot } = useForecastStore()

    useEffect(() => {
        if (activeProjectId) fetchHistory(activeProjectId)
    }, [activeProjectId, fetchHistory])

    const chartData = useMemo(() => {
        return history.map(m => ({
            date: format(new Date(m.snapshot_date), 'dd/MM'),
            PV: Number(m.pv),
            EV: Number(m.ev),
            AC: Number(m.ac)
        }))
    }, [history])

    if (!activeProjectId) return (
        <div className="p-8 text-center text-slate-400 font-medium">Please select a project to view forecasts.</div>
    )

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={useProjectStore.getState().projects[activeProjectId || '']?.name || 'Project'}
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'Alert',
                            level: projections?.isRedAlert ? 'critical' : 'good',
                            value: projections?.isRedAlert ? 'RED' : 'OK',
                        },
                    ]}
                />
            }
            header={
                <WorkspaceHeader
                    title="Predictive Cost & Schedule Control"
                    subtitle="AI-driven Estimate at Completion (EAC) using daily EVM snapshots"
                    primaryAction={{
                        label: 'Capture Snapshot',
                        icon: <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />,
                        onClick: () => generateSnapshot(),
                    }}
                />
            }
        >

            {/* TOP METRICS (EAC Projections) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-indigo-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
                        <TrendingUp size={48} className="text-indigo-600" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-slate-400">Standard EAC</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-mono font-black text-indigo-700">
                            {projections?.eacStandard.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 font-bold">Based on current CPI efficiency</p>
                    </CardContent>
                </Card>

                <Card className="border-amber-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
                        <FileWarning size={48} className="text-amber-600" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-slate-400">Conservative EAC</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-mono font-black text-amber-700">
                            {projections?.eacConservative.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 font-bold">CPI x SPI weighted penalty</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
                        <CalendarClock size={48} className="text-slate-600" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-slate-400">Forecasted Finish</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-mono font-black text-slate-700">
                            {projections?.projectedCompletion || '---'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 font-bold">Based on current task velocity</p>
                    </CardContent>
                </Card>

                <Card className={`shadow-sm relative overflow-hidden group ${projections?.isRedAlert ? 'border-red-200 bg-red-50/30' : 'border-emerald-100'}`}>
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
                        <Activity size={48} className={projections?.isRedAlert ? 'text-red-600' : 'text-emerald-600'} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-slate-400">Health Alert</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {projections?.isRedAlert ? (
                            <div className="flex items-center gap-2 text-red-600">
                                <AlertTriangle size={20} />
                                <span className="text-lg font-black uppercase tracking-tighter">RED ALERT</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-emerald-600">
                                <Badge className="bg-emerald-500 hover:bg-emerald-600">STABLE</Badge>
                                <span className="text-lg font-black">NORMAL</span>
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1 font-bold">Governance Status</p>
                    </CardContent>
                </Card>
            </div>

            {/* PERFORMANCE TREND CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-8 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                             EVM Performance history
                             <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">PV</Badge>
                                <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">EV</Badge>
                                <Badge variant="outline" className="text-xs border-slate-500 text-slate-600">AC</Badge>
                             </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorEV" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}}
                                        tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                                    />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                        formatter={(v: any) => v.toLocaleString()}
                                    />
                                    <Area type="monotone" dataKey="PV" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPV)" />
                                    <Area type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEV)" />
                                    <Line type="monotone" dataKey="AC" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                             <History size={12} /> Predictive Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <div className="divide-y divide-slate-100">
                            {projections?.isRedAlert ? (
                                <div className="p-4 bg-red-50/50 space-y-2">
                                    <div className="flex items-center gap-2 text-red-700 font-black text-xs">
                                        <AlertTriangle size={14} /> SCHEDULE SLIPPAGE DETECTED
                                    </div>
                                    <p className="text-xs text-red-600/80 leading-relaxed font-semibold">
                                        {projections.alertReason}
                                    </p>
                                    <Button size="sm" variant="outline" className="w-full text-xs h-7 bg-white border-red-200 text-red-700 font-bold hover:bg-red-50">
                                        Suggest Mitigation Plan
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-8 text-center space-y-3 opacity-60">
                                    <ShieldCheck size={40} className="mx-auto text-emerald-300" />
                                    <p className="text-xs font-bold text-slate-500">All Metrics within variance limits.</p>
                                </div>
                            )}
                            
                            {/* Summary Insights */}
                            <div className="p-4 space-y-4">
                                <div className="space-y-1.5">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Variance at Completion (VAC)</div>
                                    <div className={`text-sm font-mono font-bold ${projections?.varianceAtCompletion && projections.varianceAtCompletion < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {projections?.varianceAtCompletion.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Risk Confidence</div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 w-[85%]" />
                                        </div>
                                        <span className="text-xs font-black text-slate-500">85%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageShell>
    )
}

function ShieldCheck({ size, className }: { size: number, className: string }) {
    return <CircleDollarSign size={size} className={className} />
}
