/**
 * PriceDriftBanner.tsx
 * Inline contextual alert shown on RAB page when price drift is detected.
 * For LOCKED baselines: warns about budget impact.
 * For UNLOCKED projects: informs that prices were auto-synced.
 */

import React from 'react'
import { AlertTriangle, TrendingUp, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatIDR } from '@/lib/utils'
import { useRabStore } from '@/store/rabStore'

interface PriceDriftBannerProps {
    projectId: string
    isLocked: boolean
}

export function PriceDriftBanner({ projectId, isLocked }: PriceDriftBannerProps) {
    const priceDrift = useRabStore(s => s.priceDrift)
    const refreshDrift = useRabStore(s => s.refreshDrift)
    const [refreshing, setRefreshing] = React.useState(false)

    const driftData = priceDrift[projectId]
    if (!driftData) return null

    const { totalDrift, lastChecked } = driftData
    const absDrift = Math.abs(totalDrift)

    // No drift = no banner
    if (absDrift < 1000) return null

    const isNegative = totalDrift < 0 // prices went down = savings

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await refreshDrift(projectId)
        } finally {
            setRefreshing(false)
        }
    }

    if (isLocked) {
        // ── LOCKED: Show warning about drift impact ─────────────────────────
        return (
            <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                isNegative
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20'
                    : 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
            }`}>
                <div className={`mt-0.5 shrink-0 ${isNegative ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {isNegative ? <TrendingUp size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${isNegative ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        Price Drift Detected — Baseline Protected
                    </div>
                    <div className={`text-xs mt-0.5 ${isNegative ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Harga master AHSP telah berubah sejak baseline dikunci.
                        {isNegative
                            ? ` Potensi penghematan: ${formatIDR(absDrift)}.`
                            : ` Potensi kenaikan anggaran: +${formatIDR(absDrift)}.`
                        }
                        {' '}Harga RAB saat ini tetap terlindungi oleh snapshot baseline.
                    </div>
                    {lastChecked && (
                        <div className="text-xs text-slate-400 mt-1">
                            Terakhir diperiksa: {new Date(lastChecked).toLocaleString('id-ID')}
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
        )
    }

    // ── UNLOCKED: Informational — prices were already auto-synced ───────────
    return (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-sm dark:border-blue-800 dark:bg-blue-950/20">
            <CheckCircle2 size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
                <span className="font-medium text-blue-700 dark:text-blue-300">
                    Harga RAB tersinkronisasi otomatis dengan katalog AHSP terbaru.
                </span>
                <span className="text-xs text-blue-500 dark:text-blue-400 ml-1">
                    (Baseline belum dikunci — perubahan harga dipropagasi otomatis)
                </span>
            </div>
        </div>
    )
}
