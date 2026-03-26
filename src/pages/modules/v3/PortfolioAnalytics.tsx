/**
 * PortfolioAnalytics.tsx
 *
 * Portfolio-level KPI aggregator — shows CPI / SPI / PHI / budget
 * health across ALL projects side-by-side with mini gauges + export.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Download,
    BarChart3,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
} from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { useProjectStore } from '@/store/projectStore'
import { dashboardService, type DashboardStats } from '@/services/dashboardService'
import { toast } from 'sonner'
import ModulePageState from '@/components/common/ModulePageState'
import ModuleListToolbar from '@/components/common/ModuleListToolbar'
import { Skeleton } from '@/components/common/LoadingSkeleton'
import PortfolioHeatmap from '@/components/analytics/PortfolioHeatmap'

const HEALTH_FILTERS = [
    { value: 'all', label: 'All Health' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' },
]

const ROW_SORTS = [
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'cpi-high', label: 'CPI High-Low' },
    { value: 'spi-high', label: 'SPI High-Low' },
    { value: 'progress-high', label: 'Progress High-Low' },
    { value: 'budget-high', label: 'Budget High-Low' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectStats {
    projectId: string
    projectName: string
    projectCode?: string
    status?: string
    ownerUserId?: string
    budget?: number
    endDate?: string
    stats: DashboardStats | null
    loading: boolean
    error: boolean
}

// ─── Mini Semicircle gauge (same logic as CostForecastDashboard) ──────────────

function MiniGauge({ value, size = 56 }: { value: number | null; size?: number }) {
    const R = 20, cx = 28, cy = 28
    const pt = (v: number): [number, number] => {
        const pct = Math.max(0, Math.min(2, v)) / 2
        const a = Math.PI * (1 - pct)
        return [cx + R * Math.cos(a), cy - R * Math.sin(a)]
    }
    const seg = (from: number, to: number) => {
        const [x1, y1] = pt(from), [x2, y2] = pt(to)
        const largeArc = (to - from) / 2 > 1 ? 1 : 0
        return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${R},${R} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)}`
    }
    const v = Math.max(0, Math.min(2, value ?? 0))
    const [nx, ny] = pt(v)
    const color = value === null ? '#64748b' : value >= 1.0 ? '#10b981' : value >= 0.85 ? '#f59e0b' : '#ef4444'
    return (
        <svg viewBox="0 0 56 32" width={size} height={size * 32 / 56} aria-hidden>
            <path d={seg(0, 2)} fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
            <path d={seg(0, 0.85)} fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="butt" opacity="0.3" />
            <path d={seg(0.85, 1.0)} fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="butt" opacity="0.3" />
            <path d={seg(1.0, 2)} fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="butt" opacity="0.3" />
            {v > 0 && <path d={seg(0, v)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />}
            {value !== null && v > 0 && <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="3" fill={color} stroke="white" strokeWidth="1" />}
            <text x="28" y="29" fontSize="7" fill={color} textAnchor="middle" fontWeight="700">
                {value === null ? '—' : value.toFixed(2)}
            </text>
        </svg>
    )
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ cpi, spi }: { cpi: number | null; spi: number | null }) {
    const ok = (v: number | null) => v !== null && v >= 0.95
    const warn = (v: number | null) => v !== null && v >= 0.85 && v < 0.95
    if (cpi === null && spi === null) return <Badge variant="secondary" className="text-xs">N/A</Badge>
    if (ok(cpi) && ok(spi)) return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs gap-1 border-0">
            <CheckCircle2 size={10} /> HEALTHY
        </Badge>
    )
    if (warn(cpi) || warn(spi)) return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1 border-0">
            <AlertTriangle size={10} /> WARNING
        </Badge>
    )
    return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs gap-1 border-0">
            <XCircle size={10} /> CRITICAL
        </Badge>
    )
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number) {
    if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(1)}M`
    return `Rp ${(v / 1e3).toFixed(0)}K`
}

function daysLeft(endDate?: string) {
    if (!endDate) return null
    try {
        return Math.floor((new Date(endDate).getTime() - Date.now()) / 86_400_000)
    } catch { return null }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioAnalytics() {
    const projectsMap = useProjectStore((s) => s.projects)
    const projects = useMemo(() => Object.values(projectsMap), [projectsMap])

    const [data, setData] = useState<ProjectStats[]>([])
    const [exporting, setExporting] = useState(false)
    const [bootstrapping, setBootstrapping] = useState(true)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')
    const [query, setQuery] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.query') || '' } catch { return '' }
    })
    const [healthFilter, setHealthFilter] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.health') || 'all' } catch { return 'all' }
    })
    const [sortBy, setSortBy] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.sort') || 'name-asc' } catch { return 'name-asc' }
    })
    const [statusFilter, setStatusFilter] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.status') || 'all' } catch { return 'all' }
    })
    const [ownerFilter, setOwnerFilter] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.owner') || 'all' } catch { return 'all' }
    })
    const [endDateFrom, setEndDateFrom] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.endDateFrom') || '' } catch { return '' }
    })
    const [endDateTo, setEndDateTo] = useState(() => {
        try { return localStorage.getItem('portfolio.toolbar.endDateTo') || '' } catch { return '' }
    })
    const tableRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        try {
            localStorage.setItem('portfolio.toolbar.query', query)
            localStorage.setItem('portfolio.toolbar.health', healthFilter)
            localStorage.setItem('portfolio.toolbar.sort', sortBy)
            localStorage.setItem('portfolio.toolbar.status', statusFilter)
            localStorage.setItem('portfolio.toolbar.owner', ownerFilter)
            localStorage.setItem('portfolio.toolbar.endDateFrom', endDateFrom)
            localStorage.setItem('portfolio.toolbar.endDateTo', endDateTo)
        } catch {
            // ignore storage errors
        }
    }, [query, healthFilter, sortBy, statusFilter, ownerFilter, endDateFrom, endDateTo])

    const load = async (showBootstrap = false) => {
        if (projects.length === 0) {
            setData([])
            setBootstrapping(false)
            setPageError(null)
            setSrStatus('No projects available for analytics.')
            return
        }

        if (showBootstrap) {
            setBootstrapping(true)
        }
        setSrStatus(showBootstrap ? 'Loading portfolio analytics...' : 'Refreshing portfolio analytics...')
        setPageError(null)

        // Seed loading rows immediately
        setData(projects.map(p => ({
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code,
            status: p.status,
            ownerUserId: p.userId,
            budget: p.budget,
            endDate: p.endDate,
            stats: null,
            loading: true,
            error: false,
        })))

        // Parallel fetch (concurrency = all)
        const results = await Promise.allSettled(
            projects.map(p => dashboardService.getProjectStats(p.id))
        )

        const hasSuccess = results.some((r) => r.status === 'fulfilled')
        if (!hasSuccess) {
            setPageError('Failed to load portfolio analytics for all projects.')
            setSrStatus('Failed to load portfolio analytics.')
        }

        setData(projects.map((p, i) => {
            const r = results[i]
            return {
                projectId: p.id,
                projectName: p.name,
                projectCode: p.code,
                status: p.status,
                ownerUserId: p.userId,
                budget: p.budget,
                endDate: p.endDate,
                stats: r.status === 'fulfilled' ? r.value : null,
                loading: false,
                error: r.status === 'rejected',
            }
        }))

        if (hasSuccess) {
            setSrStatus('Portfolio analytics updated.')
        }

        if (showBootstrap) {
            setBootstrapping(false)
        }
    }

    useEffect(() => {
        void load(true)
    }, [projects.length]) // eslint-disable-line react-hooks/exhaustive-deps

    const visibleRows = useMemo(() => {
        const q = query.trim().toLowerCase()
        const rowHealth = (row: ProjectStats) => {
            const cpi = row.stats?.cpi
            const spi = row.stats?.spi
            if (cpi === null || cpi === undefined || spi === null || spi === undefined) return 'warning'
            if (cpi >= 0.95 && spi >= 0.95) return 'healthy'
            if (cpi >= 0.85 || spi >= 0.85) return 'warning'
            return 'critical'
        }

        const filtered = data.filter((row) => {
            const matchesQuery =
                !q ||
                row.projectName.toLowerCase().includes(q) ||
                (row.projectCode || '').toLowerCase().includes(q) ||
                (row.status || '').toLowerCase().includes(q)
            const matchesHealth = healthFilter === 'all' || rowHealth(row) === healthFilter
            const matchesStatus = statusFilter === 'all' || (row.status || '').toLowerCase() === statusFilter.toLowerCase()
            const matchesOwner = ownerFilter === 'all' || (row.ownerUserId || '').toLowerCase() === ownerFilter.toLowerCase()

            const endDateValue = row.endDate ? new Date(row.endDate) : null
            const fromBoundary = endDateFrom ? new Date(`${endDateFrom}T00:00:00`) : null
            const toBoundary = endDateTo ? new Date(`${endDateTo}T23:59:59`) : null
            const matchesDateFrom = !fromBoundary || (endDateValue !== null && endDateValue >= fromBoundary)
            const matchesDateTo = !toBoundary || (endDateValue !== null && endDateValue <= toBoundary)

            return matchesQuery && matchesHealth && matchesStatus && matchesOwner && matchesDateFrom && matchesDateTo
        })

        return [...filtered].sort((a, b) => {
            if (sortBy === 'name-desc') return b.projectName.localeCompare(a.projectName)
            if (sortBy === 'cpi-high') return (b.stats?.cpi ?? -1) - (a.stats?.cpi ?? -1)
            if (sortBy === 'spi-high') return (b.stats?.spi ?? -1) - (a.stats?.spi ?? -1)
            if (sortBy === 'progress-high') return (b.stats?.overallProgress ?? -1) - (a.stats?.overallProgress ?? -1)
            if (sortBy === 'budget-high') {
                const bBudget = b.budget || b.stats?.totalBudget || 0
                const aBudget = a.budget || a.stats?.totalBudget || 0
                return bBudget - aBudget
            }
            return a.projectName.localeCompare(b.projectName)
        })
    }, [data, query, healthFilter, sortBy, statusFilter, ownerFilter, endDateFrom, endDateTo])

    const statusOptions = useMemo(() => {
        return Array.from(new Set(
            data
                .map((row) => (row.status || '').trim())
                .filter((value) => value.length > 0)
        )).sort((a, b) => a.localeCompare(b))
    }, [data])

    const ownerOptions = useMemo(() => {
        return Array.from(new Set(
            data
                .map((row) => (row.ownerUserId || '').trim())
                .filter((value) => value.length > 0)
        )).sort((a, b) => a.localeCompare(b))
    }, [data])

    const resetAdvancedFilters = () => {
        setStatusFilter('all')
        setOwnerFilter('all')
        setEndDateFrom('')
        setEndDateTo('')
        setSrStatus('Portfolio advanced filters reset.')
    }

    // Portfolio aggregates
    const agg = useMemo(() => {
        const loaded = visibleRows.filter(d => d.stats)
        if (loaded.length === 0) return null
        const totalBudget = loaded.reduce((s, d) => s + (d.budget || d.stats?.totalBudget || 0), 0)
        const totalUtilized = loaded.reduce((s, d) => s + (d.stats?.utilizedBudget || 0), 0)
        const cpiValues = loaded.map(d => d.stats?.cpi).filter((v): v is number => v !== null)
        const spiValues = loaded.map(d => d.stats?.spi).filter((v): v is number => v !== null)
        const phiValues = loaded.map(d => d.stats?.phi?.score).filter((v): v is number => v !== undefined)
        const avgCpi = cpiValues.length ? cpiValues.reduce((a, b) => a + b, 0) / cpiValues.length : null
        const avgSpi = spiValues.length ? spiValues.reduce((a, b) => a + b, 0) / spiValues.length : null
        const avgPhi = phiValues.length ? phiValues.reduce((a, b) => a + b, 0) / phiValues.length : null
        const criticalCount = loaded.filter(d => {
            const c = d.stats?.cpi ?? 1
            const s = d.stats?.spi ?? 1
            return c < 0.85 || s < 0.85
        }).length
        return { totalBudget, totalUtilized, avgCpi, avgSpi, avgPhi, criticalCount, count: loaded.length }
    }, [visibleRows])

    // PDF export
    const handleExportPDF = async () => {
        setSrStatus('Preparing portfolio analytics PDF export...')
        setExporting(true)
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ])

            if (!tableRef.current) {
                toast.error('Nothing to export')
                setSrStatus('Nothing to export.')
                return
            }
            const canvas = await html2canvas(tableRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
            const pw = pdf.internal.pageSize.getWidth()
            const ph = pdf.internal.pageSize.getHeight()
            const ratio = Math.min(pw / canvas.width, ph / canvas.height) * 96
            const w = canvas.width * ratio / 96
            const h = canvas.height * ratio / 96
            pdf.setFontSize(16)
            pdf.setTextColor(30, 58, 138)
            pdf.text(`Portfolio Analytics — ${new Date().toLocaleDateString('id-ID')}`, 14, 14)
            pdf.addImage(imgData, 'PNG', (pw - w) / 2, 22, w, h)
            pdf.save(`portfolio-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
            toast.success('PDF exported')
            setSrStatus('Portfolio analytics PDF exported.')
        } catch (err) {
            toast.error('Export failed', { description: (err as Error).message })
            setSrStatus('Failed to export portfolio analytics PDF.')
        } finally {
            setExporting(false)
        }
    }

    if (projects.length === 0) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Portfolio Analytics"
                description="Cross-project EVM comparison — CPI, SPI, PHI, budget & schedule health"
                variant="empty"
                message="No projects found in portfolio. Create a project to start analytics."
            />
        )
    }

    if (bootstrapping) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Portfolio Analytics"
                description="Cross-project EVM comparison — CPI, SPI, PHI, budget & schedule health"
                variant="loading"
                message="Loading portfolio KPI telemetry..."
            />
        )
    }

    if (pageError && data.length === 0) {
        return (
            <ModulePageState
                icon={<BarChart3 size={18} />}
                title="Portfolio Analytics"
                description="Cross-project EVM comparison — CPI, SPI, PHI, budget & schedule health"
                variant="error"
                message={pageError}
                onRetry={() => {
                    void load(true)
                }}
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <ModuleHeader
                icon={<BarChart3 size={18} />}
                title="Portfolio Analytics"
                description="Cross-project EVM comparison — CPI, SPI, PHI, budget & schedule health"
                accent="fuchsia"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { void load(false) }} className="gap-2" aria-busy={bootstrapping}>
                            <RefreshCw size={14} /> Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2" aria-busy={exporting}>
                            <Download size={14} /> {exporting ? 'Exporting…' : 'Export PDF'}
                        </Button>
                    </div>
                }
            />

            <ModuleListToolbar
                query={query}
                onQueryChange={setQuery}
                queryPlaceholder="Search project, code, or status..."
                filterValue={healthFilter}
                onFilterChange={setHealthFilter}
                filterOptions={HEALTH_FILTERS}
                sortValue={sortBy}
                onSortChange={setSortBy}
                sortOptions={ROW_SORTS}
                resultCount={visibleRows.length}
                resultLabel="projects"
            />

            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                <div className="grid gap-1 md:w-[200px]">
                    <Label className="text-xs text-muted-foreground">Project status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9" aria-label="Filter by project status">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-1 md:w-[220px]">
                    <Label className="text-xs text-muted-foreground">Owner (User ID)</Label>
                    <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                        <SelectTrigger className="h-9" aria-label="Filter by project owner">
                            <SelectValue placeholder="All Owners" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Owners</SelectItem>
                            {ownerOptions.map((owner) => (
                                <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-1 md:w-[170px]">
                    <Label className="text-xs text-muted-foreground">End date from</Label>
                    <Input
                        type="date"
                        value={endDateFrom}
                        onChange={(event) => setEndDateFrom(event.target.value)}
                        aria-label="Filter end date from"
                        className="h-9"
                    />
                </div>

                <div className="grid gap-1 md:w-[170px]">
                    <Label className="text-xs text-muted-foreground">End date to</Label>
                    <Input
                        type="date"
                        value={endDateTo}
                        onChange={(event) => setEndDateTo(event.target.value)}
                        aria-label="Filter end date to"
                        className="h-9"
                    />
                </div>

                <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={resetAdvancedFilters}>
                    Reset Filters
                </Button>
            </div>

            {/* Portfolio Summary Cards */}
            {agg && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Projects', value: `${agg.count}`, sub: 'In Portfolio', icon: Activity, accent: 'border-t-blue-500' },
                        { label: 'Total Budget', value: fmtCurrency(agg.totalBudget), sub: 'Contract Value', icon: DollarSign, accent: 'border-t-indigo-500' },
                        { label: 'Utilized', value: fmtCurrency(agg.totalUtilized), sub: `${agg.totalBudget > 0 ? ((agg.totalUtilized / agg.totalBudget) * 100).toFixed(1) : 0}% of total`, icon: TrendingDown, accent: agg.totalUtilized / agg.totalBudget > 1 ? 'border-t-red-500' : 'border-t-orange-400' },
                        { label: 'Avg CPI', value: agg.avgCpi !== null ? agg.avgCpi.toFixed(2) : '—', sub: agg.avgCpi !== null && agg.avgCpi >= 1 ? 'Under Budget' : 'Over Budget', icon: TrendingUp, accent: agg.avgCpi !== null && agg.avgCpi >= 0.95 ? 'border-t-emerald-500' : 'border-t-red-500' },
                        { label: 'Avg SPI', value: agg.avgSpi !== null ? agg.avgSpi.toFixed(2) : '—', sub: agg.avgSpi !== null && agg.avgSpi >= 1 ? 'On Schedule' : 'Delayed', icon: Clock, accent: agg.avgSpi !== null && agg.avgSpi >= 0.95 ? 'border-t-emerald-500' : 'border-t-amber-500' },
                        { label: 'Critical', value: `${agg.criticalCount}`, sub: 'Projects < 0.85', icon: AlertTriangle, accent: agg.criticalCount > 0 ? 'border-t-red-500' : 'border-t-green-500' },
                    ].map(c => (
                        <Card key={c.label} className={`border-t-2 ${c.accent}`}>
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                                    <c.icon className="h-3 w-3 text-muted-foreground/60" />
                                </div>
                                <div className="text-sm font-bold tabular-nums">{c.value}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Portfolio Heatmap (Phase 5 Governance) */}
            {!bootstrapping && (
                <div className="mt-4">
                    <PortfolioHeatmap 
                        projects={data.map(p => ({
                            id: p.projectId,
                            name: p.projectName,
                            spi: p.stats?.spi || 1,
                            cpi: p.stats?.cpi || 1,
                            budget: p.budget || p.stats?.totalBudget || 0
                        }))} 
                    />
                </div>
            )}

            {/* Project Comparison Table */}
            <div ref={tableRef} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_100px_80px] gap-0 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <span>Project</span>
                    <span className="text-center">CPI</span>
                    <span className="text-center">SPI</span>
                    <span className="text-center">PHI</span>
                    <span className="text-center">Progress</span>
                    <span className="text-right">Budget</span>
                    <span className="text-right">Utilized</span>
                    <span className="text-center">Health</span>
                </div>

                {visibleRows.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                        No projects match the current search/filter.
                    </div>
                )}

                {visibleRows.map((row, idx) => {
                    const s = row.stats
                    const days = daysLeft(row.endDate)
                    const utilPct = row.budget && s ? (s.utilizedBudget / row.budget) * 100 : null

                    return (
                        <div
                            key={row.projectId}
                            className={`grid grid-cols-[1fr_80px_80px_80px_80px_100px_100px_80px] gap-0 px-4 py-3 items-center border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30 ${idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-900/30' : ''}`}
                        >
                            {/* Name + meta */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm truncate">{row.projectName}</span>
                                    {row.status && (
                                        <Badge variant="outline" className={`text-xs px-1 py-0 ${row.status === 'Active' ? 'border-emerald-400 text-emerald-600' : 'border-slate-300 text-slate-500'}`}>
                                            {row.status}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {row.projectCode && <span className="text-xs font-mono text-slate-400">{row.projectCode}</span>}
                                    {days !== null && (
                                        <span className={`text-xs ${days < 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* CPI gauge */}
                            <div className="flex justify-center">
                                {row.loading ? (
                                    <Skeleton className="w-14 h-8" />
                                ) : (
                                    <MiniGauge value={s?.cpi ?? null} size={52} />
                                )}
                            </div>

                            {/* SPI gauge */}
                            <div className="flex justify-center">
                                {row.loading ? (
                                    <Skeleton className="w-14 h-8" />
                                ) : (
                                    <MiniGauge value={s?.spi ?? null} size={52} />
                                )}
                            </div>

                            {/* PHI score */}
                            <div className="text-center">
                                {row.loading ? (
                                    <Skeleton className="mx-auto h-5 w-10" />
                                ) : s?.phi ? (
                                    <div className="flex flex-col items-center">
                                        <span className={`text-lg font-bold tabular-nums ${s.phi.score >= 85 ? 'text-emerald-500' : s.phi.score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                                            {s.phi.score}
                                        </span>
                                        <span className="text-xs text-slate-400">{s.phi.rating}</span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                )}
                            </div>

                            {/* Progress */}
                            <div className="flex flex-col items-center gap-1">
                                {row.loading ? (
                                    <Skeleton className="h-5 w-12" />
                                ) : (
                                    <>
                                        <span className="text-sm font-bold tabular-nums">{s?.overallProgress ?? 0}%</span>
                                        <Progress value={s?.overallProgress ?? 0} className="h-1 w-14" />
                                    </>
                                )}
                            </div>

                            {/* Budget */}
                            <div className="text-right">
                                {row.loading ? (
                                    <Skeleton className="ml-auto h-5 w-16" />
                                ) : (
                                    <span className="text-sm font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                        {row.budget ? fmtCurrency(row.budget) : s?.totalBudget ? fmtCurrency(s.totalBudget) : '—'}
                                    </span>
                                )}
                            </div>

                            {/* Utilized + bar */}
                            <div className="text-right">
                                {row.loading ? (
                                    <Skeleton className="ml-auto h-5 w-16" />
                                ) : s ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-sm font-mono tabular-nums ${utilPct !== null && utilPct > 100 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {fmtCurrency(s.utilizedBudget)}
                                        </span>
                                        {utilPct !== null && (
                                            <div className="w-16 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${utilPct > 100 ? 'bg-red-500' : utilPct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(utilPct, 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : <span className="text-slate-400 text-xs">—</span>}
                            </div>

                            {/* Health badge */}
                            <div className="flex justify-center">
                                {row.loading ? (
                                    <Skeleton className="h-5 w-16" />
                                ) : (
                                    <HealthBadge cpi={s?.cpi ?? null} spi={s?.spi ?? null} />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> CPI/SPI ≥ 1.00 — Optimal</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> 0.85–0.99 — Watch</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> &lt; 0.85 — Critical</span>
            </div>
        </div>
    )
}
