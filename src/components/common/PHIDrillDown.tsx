/**
 * PHIDrillDown.tsx
 *
 * Project Health Index (PHI) card with interactive factor breakdown.
 * Calls phiService.calculatePHI() → shows composite score + 5-factor detail.
 *
 * v4 Sprint 1 — expose phiService backend to UI
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { phiService, type PHIResult } from '@/services/phiService'
import { forecastingService } from '@/services/forecastingService'
import { anomalyService } from '@/services/anomalyService'
import {
    Activity,
    DollarSign,
    CalendarClock,
    ShieldAlert,
    FileCheck,
    CheckSquare,
    RefreshCw,
    ChevronRight,
    Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────
interface PHIDrillDownProps {
    projectId: string | null
    /** Count of critical-severity risks (available from ProjectOverview) */
    criticalRiskCount?: number
    className?: string
}

// ── Factor metadata ──────────────────────────────────────────────────────────
const FACTOR_META = [
    {
        key: 'financial' as const,
        label: 'Financial',
        weight: '25%',
        icon: <DollarSign className="h-4 w-4" />,
        color: 'indigo',
        description: 'Based on CPI efficiency (Earned Value vs Actual Cost)',
    },
    {
        key: 'schedule' as const,
        label: 'Schedule',
        weight: '25%',
        icon: <CalendarClock className="h-4 w-4" />,
        color: 'blue',
        description: 'Based on SPI (progress velocity vs plan)',
    },
    {
        key: 'risk' as const,
        label: 'Risk Exposure',
        weight: '20%',
        icon: <ShieldAlert className="h-4 w-4" />,
        color: 'rose',
        description: 'Penalized by critical risks and active anomaly alerts',
    },
    {
        key: 'integrity' as const,
        label: 'Evidence Integrity',
        weight: '15%',
        icon: <FileCheck className="h-4 w-4" />,
        color: 'amber',
        description: 'Progress logs with photo + GPS verification',
    },
    {
        key: 'compliance' as const,
        label: 'Compliance',
        weight: '15%',
        icon: <CheckSquare className="h-4 w-4" />,
        color: 'emerald',
        description: 'Regulatory adherence and process compliance score',
    },
] as const

// ── Score color helpers ───────────────────────────────────────────────────────
function scoreColor(score: number) {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 65) return 'text-blue-600 dark:text-blue-400'
    return 'text-red-600 dark:text-red-400'
}

function scoreBarColor(score: number) {
    if (score >= 85) return 'bg-emerald-500'
    if (score >= 65) return 'bg-blue-500'
    return 'bg-red-500'
}

function ratingBadgeClass(rating: PHIResult['rating']) {
    if (rating === 'OPTIMAL') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    if (rating === 'STABLE') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
}

// ── Main Component ──────────────────────────────────────────────────────────
export function PHIDrillDown({ projectId, criticalRiskCount = 0, className }: PHIDrillDownProps) {
    const [phi, setPhi] = useState<PHIResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    const load = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        setError(null)
        try {
            // 1. Fetch latest EVM indices
            const history = await forecastingService.getHistory(projectId)
            const latest = history[history.length - 1]
            const cpi = latest ? Number(latest.cpi) || 1 : 1
            const spi = latest ? Number(latest.spi) || 1 : 1

            // 2. Count active anomalies
            const anomalies = await anomalyService.detectAnomalies(projectId)
            const activeAlerts = anomalies.length

            // 3. Calculate PHI
            const result = await phiService.calculatePHI(projectId, {
                cpi,
                spi,
                criticalRisks: criticalRiskCount,
                activeAlerts,
            })
            setPhi(result)
        } catch {
            setError('Unable to calculate PHI.')
        } finally {
            setLoading(false)
        }
    }, [projectId, criticalRiskCount])

    useEffect(() => { load() }, [load])

    if (!projectId) return null

    return (
        <>
            {/* Compact card — clicking opens drill-down */}
            <Card
                className={cn(
                    'cursor-pointer group transition-all duration-200 hover:-translate-y-px hover:shadow-md border-[hsl(var(--color-border-subtle))]',
                    className
                )}
                onClick={() => phi && setOpen(true)}
                role="button"
                tabIndex={0}
                aria-label="Open Project Health Index breakdown"
                onKeyDown={(e) => e.key === 'Enter' && phi && setOpen(true)}
            >
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                        <Activity className="h-4 w-4 text-orange-500" />
                        Project Health Index (PHI)
                        {phi && (
                            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40 group-hover:opacity-80 transition-opacity" />
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && !phi ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-8 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
                            <div className="h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <Info className="h-3.5 w-3.5" /> {error}
                        </div>
                    ) : phi ? (
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className={cn('text-3xl font-black font-mono', scoreColor(phi.score))}>
                                    {phi.score}
                                </span>
                                <span className="text-xs text-zinc-400 font-medium">/ 100</span>
                                <Badge className={cn('ml-auto text-xs', ratingBadgeClass(phi.rating))}>
                                    {phi.rating}
                                </Badge>
                            </div>
                            <Progress value={phi.score} className="h-2" />
                            <p className="text-xs text-zinc-400">Click to see factor breakdown →</p>
                        </div>
                    ) : null}
                    {phi && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-6 px-0 text-xs text-orange-500 hover:text-orange-600"
                            onClick={(e) => { e.stopPropagation(); load() }}
                            aria-label="Refresh PHI"
                            disabled={loading}
                        >
                            <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />
                            Refresh
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Drill-down dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-orange-500" />
                            Project Health Index — Factor Breakdown
                        </DialogTitle>
                    </DialogHeader>

                    {phi && (
                        <div className="space-y-5">
                            {/* Composite score */}
                            <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Composite Score</p>
                                    <p className={cn('text-4xl font-black font-mono mt-1', scoreColor(phi.score))}>
                                        {phi.score}<span className="text-base font-medium text-zinc-400">/100</span>
                                    </p>
                                </div>
                                <Badge className={cn('text-sm px-3 py-1', ratingBadgeClass(phi.rating))}>
                                    {phi.rating}
                                </Badge>
                            </div>

                            {/* Factor rows */}
                            <div className="space-y-3">
                                {FACTOR_META.map(factor => {
                                    const score = phi.factors[factor.key]
                                    return (
                                        <div key={factor.key} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-zinc-400">{factor.icon}</span>
                                                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                        {factor.label}
                                                    </span>
                                                    <Badge variant="outline" className="text-xs px-1.5 py-0 text-zinc-400">
                                                        {factor.weight}
                                                    </Badge>
                                                </div>
                                                <span className={cn('text-sm font-black', scoreColor(score))}>
                                                    {score}
                                                </span>
                                            </div>
                                            <Progress value={score} className={cn('h-1.5', '[&>div]:transition-all')} />
                                            <p className="text-xs text-zinc-400 leading-snug">
                                                {factor.description}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
