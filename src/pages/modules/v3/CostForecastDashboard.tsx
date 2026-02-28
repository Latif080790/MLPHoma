/**
 * CostForecastDashboard.tsx
 *
 * Dedicated EVM Cost Control & Forecast dashboard.
 * Displays: EVM gauges, S-Curve chart, cost breakdown by WBS, and forecast panel.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Target,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    BarChart3,
    Minus,
} from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useRapStore } from '@/store/rapStore'
import useCurvaSStore from '@/store/curvaSStore'
import { dashboardService } from '@/services/dashboardService'
import { computeEVM, computeForecasts, classifyHealth, calcPlannedProgressPercent } from '@/services/evmService'
import CurvaSChart from '@/components/charts/CurvaSChart'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'

// ─── Helpers ───

function formatCurrency(amount: number): string {
    if (Math.abs(amount) >= 1_000_000_000) {
        return `Rp ${(amount / 1_000_000_000).toFixed(2)}B`
    }
    if (Math.abs(amount) >= 1_000_000) {
        return `Rp ${(amount / 1_000_000).toFixed(2)}M`
    }
    if (Math.abs(amount) >= 1_000) {
        return `Rp ${(amount / 1_000).toFixed(1)}K`
    }
    return `Rp ${amount.toLocaleString('id-ID')}`
}

function getIndexColor(value: number): string {
    if (value >= 1.05) return 'text-emerald-400'
    if (value >= 0.95) return 'text-blue-400'
    if (value >= 0.85) return 'text-amber-400'
    return 'text-red-400'
}

function getIndexBg(value: number): string {
    if (value >= 1.05) return 'bg-emerald-500/10 border-emerald-500/30'
    if (value >= 0.95) return 'bg-blue-500/10 border-blue-500/30'
    if (value >= 0.85) return 'bg-amber-500/10 border-amber-500/30'
    return 'bg-red-500/10 border-red-500/30'
}

function getHealthBadge(status: string) {
    switch (status) {
        case 'healthy':
            return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">HEALTHY</Badge>
        case 'warning':
            return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">WARNING</Badge>
        case 'critical':
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs">CRITICAL</Badge>
        default:
            return <Badge variant="outline" className="text-xs">N/A</Badge>
    }
}

// ─── Metric Card Component ───

function MetricCard({
    label,
    value,
    format = 'currency',
    trend,
    icon: Icon,
    subtitle,
}: {
    label: string
    value: number | null
    format?: 'currency' | 'index' | 'percent'
    trend?: 'up' | 'down' | 'neutral'
    icon: React.ElementType
    subtitle?: string
}) {
    const displayValue = value === null || value === undefined
        ? '—'
        : format === 'currency'
            ? formatCurrency(value)
            : format === 'index'
                ? value.toFixed(2)
                : `${value.toFixed(1)}%`

    const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="p-2 rounded-md bg-slate-700/50">
                <Icon size={16} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</div>
                <div className="text-lg font-mono font-bold text-slate-200 mt-0.5">{displayValue}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
            </div>
            {trend && value !== null && (
                <TrendIcon
                    size={14}
                    className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}
                />
            )}
        </div>
    )
}

// ─── Main Component ───

export default function CostForecastDashboard() {
    const { handleAsync } = useErrorHandler()
    const activeProjectId = useProjectStore((s) => s.activeProjectId)
    const projects = useProjectStore((s) => s.projects)
    const project = activeProjectId ? projects[activeProjectId] : null

    const getCostByWBS = useRapStore((s) => s.getCostByWBS)
    const fetchRapItems = useRapStore((s) => s.fetchItems)

    const curvaSData = useCurvaSStore((s) => activeProjectId ? s.getDataPoints(activeProjectId) : [])
    const curvaSAnalysis = useCurvaSStore((s) => activeProjectId ? s.getAnalysis(activeProjectId) : null)
    const analyzeProject = useCurvaSStore((s) => s.analyzeProject)

    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [pageError, setPageError] = useState<string | null>(null)
    const [fallbackDates] = useState(() => {
        const now = Date.now()
        return {
            startDate: new Date(now - 30 * 86400000).toISOString().split('T')[0],
            endDate: new Date(now + 150 * 86400000).toISOString().split('T')[0],
        }
    })

    // Fetch data on mount
    useEffect(() => {
        if (!activeProjectId) return
        let cancelled = false

        async function load() {
            setLoading(true)
            setPageError(null)
            const dashStats = await handleAsync(async () => {
                await fetchRapItems(activeProjectId!)
                return dashboardService.getProjectStats(activeProjectId!)
            }, 'finance.general')

            if (!cancelled && dashStats) {
                setStats(dashStats)
                analyzeProject(activeProjectId!)
            } else if (!cancelled && !dashStats) {
                setPageError('Unable to load forecast metrics for the active project.')
            }

            if (!cancelled) setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [activeProjectId, analyzeProject, fetchRapItems, handleAsync])

    // Compute EVM metrics locally from RAP data
    const evmData = useMemo(() => {
        if (!activeProjectId || !stats) return null

        const totalBudget = stats.totalBudget || 0
        const actualCost = stats.utilizedBudget || 0
        const progress = stats.overallProgress || 0

        if (totalBudget <= 0) return null

        const startDate = (project as any)?.start_date || (project as any)?.startDate || fallbackDates.startDate
        const endDate = (project as any)?.end_date || (project as any)?.endDate || fallbackDates.endDate

        const { percent: plannedPercent, daysElapsed } = calcPlannedProgressPercent(startDate, endDate)

        const metrics = computeEVM({
            totalBudget,
            actualCost,
            progressPercent: progress,
            plannedProgressPercent: plannedPercent,
        })

        const health = classifyHealth(metrics.cpi, metrics.spi)

        const forecasts = computeForecasts({
            metrics,
            startDate,
            endDate,
            progressPercent: progress,
            daysElapsed,
        })

        return { metrics, health, forecasts, totalBudget, actualCost, progress }
    }, [activeProjectId, stats, project, fallbackDates])

    // WBS cost breakdown
    const wbsCosts = useMemo(() => {
        if (!activeProjectId) return []
        return getCostByWBS(activeProjectId)
    }, [activeProjectId, getCostByWBS])

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Cost Forecast & EVM"
                description="Earned value and forecast analysis dashboard."
                variant="empty"
                message="Select an active project to analyze cost forecasts."
            />
        )
    }

    if (loading && !stats) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Cost Forecast & EVM"
                description="Earned value and forecast analysis dashboard."
                variant="loading"
                message="Loading forecast metrics and RAP baselines..."
            />
        )
    }

    if (pageError && !stats) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Cost Forecast & EVM"
                description="Earned value and forecast analysis dashboard."
                variant="error"
                message={pageError}
            />
        )
    }

    return (
        <div className="space-y-6 p-6">
            <ModuleHeader
                icon={<BarChart3 size={18} />}
                title="Cost Forecast & EVM"
                description={`Earned Value Management analysis for ${project?.name || 'project'}`}
                actions={
                    <div className="flex items-center gap-3">
                        {evmData && getHealthBadge(evmData.health.status)}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                setLoading(true)
                                setPageError(null)
                                const s = await handleAsync(async () => {
                                    return dashboardService.getProjectStats(activeProjectId!)
                                }, 'finance.general')

                                if (s) {
                                    setStats(s)
                                    analyzeProject(activeProjectId!)
                                } else {
                                    setPageError('Unable to refresh forecast metrics.')
                                }

                                setLoading(false)
                            }}
                            className="border-slate-700 text-slate-400 hover:text-slate-200"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </Button>
                    </div>
                }
            />

            {/* Primary KPI Row: CPI / SPI Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CPI Gauge */}
                <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <CardContent className="p-6 relative z-10">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">
                            Cost Performance Index
                        </div>
                        <div className="flex items-end gap-3">
                            <span className={`text-5xl font-mono font-black ${getIndexColor(evmData?.metrics.cpi ?? 1)}`}>
                                {evmData ? evmData.metrics.cpi.toFixed(2) : '—'}
                            </span>
                            <div className="mb-1.5">
                                <div className="text-xs text-slate-500">Target: 1.00</div>
                                {evmData && (
                                    <div className={`text-sm font-mono ${evmData.metrics.cv >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        CV: {formatCurrency(evmData.metrics.cv)}
                                    </div>
                                )}
                            </div>
                        </div>
                        {evmData && (
                            <div className={`mt-3 px-2 py-1 rounded text-xs inline-block border ${getIndexBg(evmData.metrics.cpi)}`}>
                                {evmData.metrics.cpi >= 1 ? 'Under Budget' : 'Over Budget'}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* SPI Gauge */}
                <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <CardContent className="p-6 relative z-10">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">
                            Schedule Performance Index
                        </div>
                        <div className="flex items-end gap-3">
                            <span className={`text-5xl font-mono font-black ${getIndexColor(evmData?.metrics.spi ?? 1)}`}>
                                {evmData ? evmData.metrics.spi.toFixed(2) : '—'}
                            </span>
                            <div className="mb-1.5">
                                <div className="text-xs text-slate-500">Target: 1.00</div>
                                {evmData && (
                                    <div className={`text-sm font-mono ${evmData.metrics.sv >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        SV: {formatCurrency(evmData.metrics.sv)}
                                    </div>
                                )}
                            </div>
                        </div>
                        {evmData && (
                            <div className={`mt-3 px-2 py-1 rounded text-xs inline-block border ${getIndexBg(evmData.metrics.spi)}`}>
                                {evmData.metrics.spi >= 1 ? 'Ahead of Schedule' : 'Behind Schedule'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* EVM Metrics Grid */}
            <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Activity size={16} />
                        EVM Metrics
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <MetricCard
                            label="Planned Value (PV)"
                            value={evmData?.metrics.plannedValue ?? null}
                            icon={Target}
                            subtitle="Baseline budget to date"
                        />
                        <MetricCard
                            label="Earned Value (EV)"
                            value={evmData?.metrics.earnedValue ?? null}
                            icon={TrendingUp}
                            subtitle="Work completed value"
                        />
                        <MetricCard
                            label="Actual Cost (AC)"
                            value={evmData?.metrics.actualCost ?? null}
                            icon={DollarSign}
                            subtitle="Total spend to date"
                        />
                        <MetricCard
                            label="EAC"
                            value={evmData?.forecasts.eac ?? null}
                            icon={BarChart3}
                            subtitle="Estimate at Completion"
                        />
                        <MetricCard
                            label="ETC"
                            value={evmData?.forecasts.etc ?? null}
                            icon={DollarSign}
                            subtitle="Remaining cost estimate"
                        />
                        <MetricCard
                            label="VAC"
                            value={evmData?.forecasts.vac ?? null}
                            icon={evmData && evmData.forecasts.vac > 0 ? TrendingUp : TrendingDown}
                            trend={evmData ? (evmData.forecasts.vac > 0 ? 'up' : evmData.forecasts.vac < 0 ? 'down' : 'neutral') : undefined}
                            subtitle="Budget variance at completion"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Two-column: S-Curve + Forecast Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* S-Curve Chart (2/3 width) */}
                <Card className="lg:col-span-2 bg-slate-900/80 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            S-Curve (Planned vs Actual)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {curvaSData.length > 0 ? (
                            <CurvaSChart
                                data={curvaSData}
                                analysis={curvaSAnalysis}
                                type="both"
                                theme="dark"
                                height={320}
                                denseMode
                            />
                        ) : (
                            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                                No S-Curve data available. Generate a baseline from RAP first.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Forecast Panel (1/3 width) */}
                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Calendar size={16} />
                            Forecast
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Forecast Date */}
                        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Completion Date</div>
                            <div className="text-xl font-mono font-bold text-slate-200 mt-1">
                                {evmData?.forecasts.forecastDate || '—'}
                            </div>
                            {evmData?.forecasts.confidence && (
                                <Badge
                                    variant="outline"
                                    className={`mt-2 text-xs ${evmData.forecasts.confidence === 'high'
                                            ? 'border-emerald-500/40 text-emerald-400'
                                            : evmData.forecasts.confidence === 'medium'
                                                ? 'border-amber-500/40 text-amber-400'
                                                : 'border-slate-500/40 text-slate-400'
                                        }`}
                                >
                                    {evmData.forecasts.confidence.toUpperCase()} CONFIDENCE
                                </Badge>
                            )}
                        </div>

                        {/* Forecast Cost */}
                        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Forecast Total Cost</div>
                            <div className="text-xl font-mono font-bold text-slate-200 mt-1">
                                {evmData ? formatCurrency(evmData.forecasts.forecastCost) : '—'}
                            </div>
                            {evmData && (
                                <div className={`text-xs font-mono mt-1 ${evmData.forecasts.vac >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {evmData.forecasts.vac >= 0 ? 'Under' : 'Over'} budget by {formatCurrency(Math.abs(evmData.forecasts.vac))}
                                </div>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Overall Progress</div>
                            <div className="text-xl font-mono font-bold text-slate-200 mt-1">
                                {evmData ? `${evmData.progress}%` : '—'}
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2">
                                <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${evmData?.progress || 0}%` }}
                                />
                            </div>
                        </div>

                        {/* Insights */}
                        {evmData && evmData.health.insights.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Insights</div>
                                {evmData.health.insights.map((insight, i) => (
                                    <div
                                        key={i}
                                        className="text-xs text-slate-400 p-2 rounded bg-slate-800/80 border border-slate-700/30 leading-relaxed"
                                    >
                                        {insight}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Cost Breakdown by WBS */}
            <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <BarChart3 size={16} />
                        Cost Breakdown by WBS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {wbsCosts.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">WBS ID</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Items</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Planned</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Committed</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Actual</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Variance</th>
                                        <th className="text-right py-2 px-3 text-xs text-slate-500 uppercase tracking-wider font-medium">Var%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wbsCosts.map((row) => (
                                        <tr
                                            key={row.wbsId}
                                            className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                                        >
                                            <td className="py-2 px-3 font-mono text-slate-300 text-xs">
                                                {row.wbsId === 'unlinked' ? (
                                                    <span className="text-slate-500 italic">Unlinked</span>
                                                ) : (
                                                    row.wbsId.substring(0, 12)
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-400 text-xs">{row.itemCount}</td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-300 text-xs">{formatCurrency(row.plannedCost)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-blue-400 text-xs">{formatCurrency(row.committedCost)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-300 text-xs">{formatCurrency(row.actualCost)}</td>
                                            <td className={`py-2 px-3 text-right font-mono text-xs ${row.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {formatCurrency(row.variance)}
                                            </td>
                                            <td className={`py-2 px-3 text-right font-mono text-xs ${row.variancePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {row.variancePercent > 0 ? '+' : ''}{row.variancePercent}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Totals row */}
                                <tfoot>
                                    <tr className="border-t-2 border-slate-700 font-bold">
                                        <td className="py-2 px-3 text-xs text-slate-300">TOTAL</td>
                                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-300">
                                            {wbsCosts.reduce((s, r) => s + r.itemCount, 0)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-200">
                                            {formatCurrency(wbsCosts.reduce((s, r) => s + r.plannedCost, 0))}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-xs text-blue-400">
                                            {formatCurrency(wbsCosts.reduce((s, r) => s + r.committedCost, 0))}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-200">
                                            {formatCurrency(wbsCosts.reduce((s, r) => s + r.actualCost, 0))}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-xs text-emerald-400">
                                            {formatCurrency(wbsCosts.reduce((s, r) => s + r.variance, 0))}
                                        </td>
                                        <td className="py-2 px-3" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                            No RAP data available. Initialize RAP from RAB first.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
