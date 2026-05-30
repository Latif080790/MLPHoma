/**
 * CostForecastDashboard.tsx
 * Enterprise-grade visualizer for predictive EAC and historical EVM trends.
 * Chart color spec: PV=blue(#3B82F6) dashed, EV=cyan(#22D3EE) solid, AC=orange(#F97316) solid.
 */
import React, { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader } from '@/components/patterns'
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
    Activity,
    CheckCircle2
} from 'lucide-react'
import { useForecastStore } from '@/store/costForecastStore'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/store/projectStore'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'

// Chart color tokens (per supplement spec)
const C_PV  = '#3B82F6'   // blue – Planned Value (BCWS), dashed
const C_EV  = '#22D3EE'   // cyan – Earned Value (BCWP), solid
const C_AC  = '#F97316'   // orange – Actual Cost (ACWP), solid
const C_EAC = '#F59E0B'   // amber – EAC projection, dashed

const CHART_GRID = 'rgba(255,255,255,0.05)'
const CHART_TICK = '#64748B'
const TOOLTIP_STYLE = {
    background: 'hsl(var(--card))',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#F1F5F9',
    fontSize: 12,
    fontFamily: 'DM Mono, monospace',
}

// ── KPI card (navy-native) ──────────────────────────────────────────────────
interface KpiCardProps {
    label: string
    value: string | number | null | undefined
    sub: string
    icon: React.ReactNode
    accent?: 'default' | 'cyan' | 'amber' | 'green' | 'red'
    isAlert?: boolean
}

function KpiCard({ label, value, sub, icon, accent = 'default', isAlert }: KpiCardProps) {
    const accentBorder = {
        default: 'border-border',
        cyan:    'border-[#22D3EE]/25',
        amber:   'border-amber-500/25',
        green:   'border-green-500/25',
        red:     'border-red-500/25 bg-red-500/[0.06]',
    }[accent]

    const valColor = {
        default: 'text-white',
        cyan:    'text-nl-cyan',
        amber:   'text-amber-400',
        green:   'text-green-400',
        red:     'text-red-400',
    }[accent]

    return (
        <div className={`relative overflow-hidden rounded-xl border ${accentBorder} bg-card p-4`}>
            <div className="absolute right-3 top-3 opacity-[0.07] pointer-events-none">
                <div className="h-10 w-10 [&_svg]:h-10 [&_svg]:w-10">{icon}</div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={`mt-1 font-mono text-xl font-bold ${valColor}`}>
                {value ?? '—'}
            </p>
            {isAlert === true && (
                <div className="mt-1 flex items-center gap-1 text-red-400">
                    <AlertTriangle size={12} /><span className="text-xs font-bold uppercase">RED ALERT</span>
                </div>
            )}
            {isAlert === false && (
                <div className="mt-1 flex items-center gap-1 text-green-400">
                    <CheckCircle2 size={12} /><span className="text-xs font-medium">STABLE</span>
                </div>
            )}
            {isAlert === undefined && (
                <p className="mt-1 text-xs text-white/30">{sub}</p>
            )}
        </div>
    )
}

export default function CostForecastDashboard() {
    const activeProjectId = useProjectStore(s => s.activeProjectId)
    const activeProjectName = useProjectStore(s => activeProjectId ? s.projects[activeProjectId]?.name || 'Project' : 'Project')
    const { history, projections, loading, fetchHistory, generateSnapshot } = useForecastStore(
        useShallow(s => ({ history: s.history, projections: s.projections, loading: s.loading, fetchHistory: s.fetchHistory, generateSnapshot: s.generateSnapshot }))
    )

    useEffect(() => {
        if (activeProjectId) fetchHistory(activeProjectId)
    }, [activeProjectId, fetchHistory])

    // Realtime: auto-refresh when a new EVM snapshot is inserted
    useEffect(() => {
        if (!supabase || !activeProjectId) return
        const channel = supabase
            .channel(`forecast-metrics-${activeProjectId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'project_daily_metrics',
                filter: `project_id=eq.${activeProjectId}`,
            }, () => { fetchHistory(activeProjectId) })
            .subscribe()
        return () => { void supabase?.removeChannel(channel) }
    }, [activeProjectId, fetchHistory])

    const chartData = useMemo(() => {
        return history.map(m => ({
            date: format(new Date(m.snapshot_date), 'dd/MM'),
            PV: Number(m.pv),
            EV: Number(m.ev),
            AC: Number(m.ac),
        }))
    }, [history])

    if (!activeProjectId) return (
        <div className="p-8 text-center text-muted-foreground font-medium">
            Pilih proyek aktif untuk melihat Cost Forecast.
        </div>
    )

    const vac = projections?.varianceAtCompletion
    const vacColor = vac != null && vac < 0 ? 'text-red-400' : 'text-green-400'

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={[{
                        label: 'EVM',
                        level: projections?.isRedAlert ? 'critical' : 'good',
                        value: projections?.isRedAlert ? 'ALERT' : 'OK',
                    }]}
                />
            }
            header={
                <WorkspaceHeader
                    title="Cost Forecast EVM"
                    subtitle="Estimate at Completion (EAC) berdasarkan snapshot EVM harian"
                    primaryAction={{
                        label: loading ? 'Mengambil...' : 'Generate Snapshot',
                        icon: <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />,
                        onClick: () => generateSnapshot(),
                    }}
                />
            }
        >
            {/* EAC Projection cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard
                    label="EAC Standard"
                    value={projections?.eacStandard?.toLocaleString('id-ID')}
                    sub="Berbasis CPI saat ini"
                    icon={<TrendingUp />}
                    accent="default"
                />
                <KpiCard
                    label="EAC Konservatif"
                    value={projections?.eacConservative?.toLocaleString('id-ID')}
                    sub="CPI × SPI weighted"
                    icon={<FileWarning />}
                    accent="amber"
                />
                <KpiCard
                    label="EAC Agresif"
                    value={projections?.eacAggressive?.toLocaleString('id-ID')}
                    sub="Sisa pekerjaan di RAB"
                    icon={<BarChart3 />}
                    accent="green"
                />
                <KpiCard
                    label="Estimasi Selesai"
                    value={projections?.projectedCompletion || '—'}
                    sub="Berdasarkan velocity task"
                    icon={<CalendarClock />}
                    accent="default"
                />
                <KpiCard
                    label="Status EVM"
                    value={projections != null ? (projections.isRedAlert ? 'RED ALERT' : 'NORMAL') : '—'}
                    sub=""
                    icon={<Activity />}
                    accent={projections?.isRedAlert ? 'red' : 'green'}
                    isAlert={projections != null ? projections.isRedAlert : undefined}
                />
            </div>

            {/* Chart grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">

                {/* PV / EV / AC Area Chart */}
                <div className="lg:col-span-8 rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            EVM Performance History
                        </h3>
                        <div className="flex items-center gap-3">
                            {[
                                { color: C_PV, label: 'PV', dashed: true },
                                { color: C_EV, label: 'EV', dashed: false },
                                { color: C_AC, label: 'AC', dashed: false },
                            ].map(({ color, label, dashed }) => (
                                <span key={label} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                                    <span
                                        className="inline-block h-px w-5"
                                        style={{
                                            background: color,
                                            borderTop: dashed ? `2px dashed ${color}` : undefined,
                                            height: dashed ? 0 : 2,
                                        }}
                                    />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradEV" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={C_EV} stopOpacity={0.08} />
                                        <stop offset="95%" stopColor={C_EV} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradAC" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={C_AC} stopOpacity={0.06} />
                                        <stop offset="95%" stopColor={C_AC} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontFamily: 'DM Mono, monospace', fill: CHART_TICK }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontFamily: 'DM Mono, monospace', fill: CHART_TICK }}
                                    tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                                    width={52}
                                />
                                <Tooltip
                                    contentStyle={TOOLTIP_STYLE}
                                    formatter={(v: number) => v.toLocaleString('id-ID')}
                                />
                                {/* PV — blue dashed */}
                                <Line
                                    type="monotone"
                                    dataKey="PV"
                                    stroke={C_PV}
                                    strokeWidth={2}
                                    strokeDasharray="6 3"
                                    dot={false}
                                />
                                {/* EV — cyan solid + area */}
                                <Area
                                    type="monotone"
                                    dataKey="EV"
                                    stroke={C_EV}
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#gradEV)"
                                    dot={false}
                                />
                                {/* AC — orange solid + area */}
                                <Area
                                    type="monotone"
                                    dataKey="AC"
                                    stroke={C_AC}
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#gradAC)"
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right: Predictive Alerts + VAC summary */}
                <div className="lg:col-span-4 flex flex-col gap-4">

                    {/* Alert panel */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
                        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                            <History size={13} className="text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Predictive Alerts
                            </span>
                        </div>
                        <div className="p-4">
                            {projections?.isRedAlert ? (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] p-3 space-y-2">
                                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase">
                                        <AlertTriangle size={13} />
                                        SCHEDULE SLIPPAGE
                                    </div>
                                    <p className="text-xs text-red-300/80 leading-relaxed">
                                        {projections.alertReason}
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-7 text-xs border-red-500/30 text-red-400 bg-transparent hover:bg-red-500/10"
                                    >
                                        Buat Rencana Mitigasi
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 opacity-50">
                                    <CheckCircle2 size={32} className="text-green-400" />
                                    <p className="text-xs text-muted-foreground text-center">
                                        Semua metrik dalam batas varian normal.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* VAC + Risk Confidence */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Variance at Completion (VAC)
                            </p>
                            <p className={`font-mono text-base font-bold ${vacColor}`}>
                                {vac != null ? vac.toLocaleString('id-ID') : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Risk Confidence
                            </p>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
                                    <div className="h-full rounded-full bg-nl-cyan" style={{ width: '85%' }} />
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">85%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* EAC Methods Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border/60 px-5 py-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Metode Proyeksi EAC
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border/60">
                                {['Metode', 'EAC', 'VAC', 'Keterangan'].map(h => (
                                    <th key={h} className="px-5 py-2.5 text-left font-semibold uppercase tracking-widest text-white/30">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { method: 'EAC Standard', eac: projections?.eacStandard, note: 'BAC / CPI' },
                                { method: 'EAC Konservatif', eac: projections?.eacConservative, note: 'BAC / (CPI × SPI)' },
                                { method: 'EAC Agresif', eac: projections?.eacAggressive, note: 'AC + (BAC − EV)' },
                            ].map(row => {
                                const rowVac = row.eac != null && projections ? projections.varianceAtCompletion : null
                                return (
                                    <tr key={row.method} className="border-b border-border/40 hover:bg-muted/20">
                                        <td className="px-5 py-3 text-foreground/80 font-medium">{row.method}</td>
                                        <td className="px-5 py-3 font-mono text-foreground/90">
                                            {row.eac != null ? row.eac.toLocaleString('id-ID') : '—'}
                                        </td>
                                        <td className={`px-5 py-3 font-mono ${rowVac != null && rowVac < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {rowVac != null ? rowVac.toLocaleString('id-ID') : '—'}
                                        </td>
                                        <td className="px-5 py-3 font-mono text-white/30">{row.note}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageShell>
    )
}

