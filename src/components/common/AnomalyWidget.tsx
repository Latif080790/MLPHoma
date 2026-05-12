/**
 * AnomalyWidget.tsx
 *
 * Surfaces anomalies detected by anomalyService (COST_OVERRUN, FROZEN_PROGRESS,
 * ORPHAN_COST) as dismissible alert banners with action guidance.
 *
 * v4 Sprint 1 — expose anomalyService backend to UI
 */
import React, { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, AlertCircle, Info, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { anomalyService, type Anomaly } from '@/services/anomalyService'
import { cn } from '@/lib/utils'

// ── Config ──────────────────────────────────────────────────────────────────
const ANOMALY_LABELS: Record<Anomaly['type'], string> = {
    COST_OVERRUN: 'Cost Overrun',
    FROZEN_PROGRESS: 'Frozen Progress',
    ORPHAN_COST: 'Orphan Cost',
}

const ANOMALY_ICONS: Record<Anomaly['severity'], React.ReactNode> = {
    CRITICAL: <AlertCircle className="h-4 w-4 shrink-0" />,
    WARNING: <AlertTriangle className="h-4 w-4 shrink-0" />,
}

interface AnomalyWidgetProps {
    projectId: string | null
    /** Compact: collapsed by default, only show count badge */
    compact?: boolean
    className?: string
}

export function AnomalyWidget({ projectId, compact = false, className }: AnomalyWidgetProps) {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [dismissed, setDismissed] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(!compact)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(() => {
        if (!projectId) return
        setLoading(true)
        setError(null)
        anomalyService.detectAnomalies(projectId)
            .then(setAnomalies)
            .catch(() => setError('Failed to load anomaly data.'))
            .finally(() => setLoading(false))
    }, [projectId])

    useEffect(() => { load() }, [load])

    const visible = anomalies.filter(a => !dismissed.has(a.id))
    const criticalCount = visible.filter(a => a.severity === 'CRITICAL').length
    const warningCount = visible.filter(a => a.severity === 'WARNING').length

    if (!projectId) return null
    if (!loading && visible.length === 0 && !error) return null

    return (
        <div className={cn('rounded-lg border bg-white dark:bg-zinc-900 shadow-sm', className)}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
                role="button"
                aria-expanded={expanded}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(p => !p)}
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                        Anomaly Detection
                    </span>
                    {criticalCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-1.5 py-0">
                            {criticalCount} critical
                        </Badge>
                    )}
                    {warningCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs px-1.5 py-0">
                            {warningCount} warning
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); load() }}
                        aria-label="Refresh anomalies"
                        disabled={loading}
                    >
                        <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                    </Button>
                    {expanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                </div>
            </div>

            {/* Body */}
            {expanded && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {error ? (
                        <div className="px-4 py-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                            <Info className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    ) : loading && anomalies.length === 0 ? (
                        <div className="px-4 py-3 flex gap-2 animate-pulse">
                            {[1, 2].map(i => (
                                <div key={i} className="h-14 w-full rounded-md bg-zinc-100 dark:bg-zinc-800" />
                            ))}
                        </div>
                    ) : (
                        visible.map(anomaly => (
                            <AnomalyRow
                                key={anomaly.id}
                                anomaly={anomaly}
                                onDismiss={() => setDismissed(s => new Set([...s, anomaly.id]))}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

// ── Internal Row ─────────────────────────────────────────────────────────────
interface AnomalyRowProps {
    anomaly: Anomaly
    onDismiss: () => void
}

function AnomalyRow({ anomaly, onDismiss }: AnomalyRowProps) {
    const isCritical = anomaly.severity === 'CRITICAL'

    return (
        <div
            className={cn(
                'flex items-start gap-3 px-4 py-3 transition-colors',
                isCritical
                    ? 'bg-red-50/60 dark:bg-red-900/10'
                    : 'bg-amber-50/60 dark:bg-amber-900/10'
            )}
        >
            <span className={isCritical ? 'text-red-500 mt-0.5' : 'text-amber-500 mt-0.5'}>
                {ANOMALY_ICONS[anomaly.severity]}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <Badge
                        variant="outline"
                        className={cn(
                            'text-xs px-1.5 py-0 border',
                            isCritical
                                ? 'border-red-300 text-red-700 dark:text-red-400'
                                : 'border-amber-300 text-amber-700 dark:text-amber-400'
                        )}
                    >
                        {ANOMALY_LABELS[anomaly.type]}
                    </Badge>
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-snug">
                    {anomaly.description}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    → {anomaly.suggestedAction}
                </p>
            </div>
            <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 mt-0.5 text-zinc-400 hover:text-zinc-700"
                onClick={onDismiss}
                aria-label="Dismiss anomaly"
            >
                <X className="h-3 w-3" />
            </Button>
        </div>
    )
}
