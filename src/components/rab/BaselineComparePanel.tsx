/**
 * BaselineComparePanel.tsx
 *
 * Side-by-side comparison of RAB Baseline vs Current.
 * Highlights added, removed, and changed items with variance percentages.
 * Includes a "Freeze Baseline" action button.
 */

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { format } from 'date-fns'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'
import {
    Lock, Unlock, TrendingUp, TrendingDown, Minus, Plus, AlertTriangle, CheckCircle2, Archive,
} from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { baselineService, type BaselineComparison, type BaselineVariance } from '../../services/baselineService'
import { formatIDR } from '../../lib/utils'
import { toast } from 'sonner'

// ─── Variance Badge ───

function VarianceBadge({ status }: { status: BaselineVariance['status'] }) {
    const config = {
        unchanged: { label: '—', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
        increased: { label: '▲ Increased', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
        decreased: { label: '▼ Decreased', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
        new: { label: '+ New', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
        removed: { label: '× Removed', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    }
    const c = config[status]
    return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>
}

// ─── Main Component ───

export function BaselineComparePanel() {
    const activeProjectId = useProjectStore(s => s.activeProjectId)
    const [refreshKey, setRefreshKey] = useState(0)

    const comparison: BaselineComparison | null = useMemo(() => {
        if (!activeProjectId) return null
        return baselineService.compareToBaseline(activeProjectId)
    }, [activeProjectId, refreshKey])

    const hasBaseline = activeProjectId ? baselineService.hasBaseline(activeProjectId) : false

    const handleFreeze = () => {
        if (!activeProjectId) return
        const name = prompt('Baseline name (optional):', `Baseline ${new Date().toLocaleDateString('id-ID')}`)
        if (name === null) return // cancelled
        baselineService.freezeBaseline(activeProjectId, name || undefined)
        toast.success('RAB Baseline frozen', { description: 'Current RAB values saved as execution baseline.' })
        setRefreshKey(k => k + 1)
    }

    const handleDelete = () => {
        if (!activeProjectId) return
        if (!confirm('Delete this baseline? This cannot be undone.')) return
        baselineService.deleteBaseline(activeProjectId)
        toast.info('Baseline deleted')
        setRefreshKey(k => k + 1)
    }

    if (!activeProjectId) return null

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                            <Archive size={16} />
                        </div>
                        <CardTitle className="text-sm font-semibold">RAB Baseline</CardTitle>
                        {hasBaseline && comparison && (
                            <Badge variant="outline" className={`text-xs h-5 ${comparison.variancePercent > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                comparison.variancePercent < -5 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                }`}>
                                {comparison.variancePercent > 0 ? '+' : ''}{comparison.variancePercent.toFixed(1)}% variance
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {hasBaseline && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={handleDelete}>
                                <Unlock size={12} className="mr-1" /> Unfreeze
                            </Button>
                        )}
                        <Button size="sm" className="h-7 text-xs" onClick={handleFreeze}>
                            <Lock size={12} className="mr-1" /> {hasBaseline ? 'Re-freeze' : 'Freeze Baseline'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4">
                {!hasBaseline ? (
                    <div className="text-center py-8">
                        <Lock size={28} className="mx-auto mb-2 text-slate-300 opacity-40" />
                        <p className="text-sm text-slate-400">No baseline frozen yet.</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Freeze the RAB baseline when project execution begins to track variance.
                        </p>
                    </div>
                ) : comparison ? (
                    <div className="space-y-4 mt-2">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Baseline</p>
                                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                                    {formatIDR(comparison.totalBaseline)}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {format(new Date(comparison.baseline.frozenAt), 'dd MMM yyyy')}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Current</p>
                                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                                    {formatIDR(comparison.totalCurrent)}
                                </p>
                            </div>
                            <div className={`p-3 rounded-lg border text-center ${comparison.totalVariance > 0 ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' :
                                comparison.totalVariance < 0 ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' :
                                    'border-slate-200 dark:border-slate-800'
                                }`}>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Variance</p>
                                <p className={`text-sm font-mono font-bold mt-1 ${comparison.totalVariance > 0 ? 'text-red-600' : comparison.totalVariance < 0 ? 'text-green-600' : 'text-slate-500'
                                    }`}>
                                    {comparison.totalVariance > 0 ? '+' : ''}{formatIDR(comparison.totalVariance)}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Changes</p>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                    {comparison.addedCount > 0 && (
                                        <span className="text-xs text-blue-600 font-semibold">+{comparison.addedCount}</span>
                                    )}
                                    {comparison.changedCount > 0 && (
                                        <span className="text-xs text-amber-600 font-semibold">~{comparison.changedCount}</span>
                                    )}
                                    {comparison.removedCount > 0 && (
                                        <span className="text-xs text-red-600 font-semibold">-{comparison.removedCount}</span>
                                    )}
                                    {comparison.addedCount === 0 && comparison.changedCount === 0 && comparison.removedCount === 0 && (
                                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> No changes
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Variance Table */}
                        {comparison.items.filter(v => v.status !== 'unchanged').length > 0 && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="max-h-[400px] overflow-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10">
                                            <TableRow className="hover:bg-transparent text-xs">
                                                <TableHead className="h-8 px-3 font-semibold uppercase">Item</TableHead>
                                                <TableHead className="h-8 px-3 text-right font-semibold uppercase">Baseline</TableHead>
                                                <TableHead className="h-8 px-3 text-right font-semibold uppercase">Current</TableHead>
                                                <TableHead className="h-8 px-3 text-right font-semibold uppercase">Variance</TableHead>
                                                <TableHead className="h-8 px-3 text-center font-semibold uppercase">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {comparison.items
                                                .filter(v => v.status !== 'unchanged')
                                                .sort((a, b) => Math.abs(b.totalChange) - Math.abs(a.totalChange))
                                                .map(v => (
                                                    <TableRow key={v.itemId} className="text-xs border-b border-slate-100 dark:border-slate-800">
                                                        <TableCell className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                                                            {v.name}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2 text-right font-mono text-slate-500">
                                                            {v.baselineTotal > 0 ? formatIDR(v.baselineTotal) : '—'}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                                            {v.currentTotal > 0 ? formatIDR(v.currentTotal) : '—'}
                                                        </TableCell>
                                                        <TableCell className={`px-3 py-2 text-right font-mono font-semibold ${v.totalChange > 0 ? 'text-red-600' : v.totalChange < 0 ? 'text-green-600' : 'text-slate-400'
                                                            }`}>
                                                            {v.totalChange > 0 ? '+' : ''}{formatIDR(v.totalChange)}
                                                            <span className="text-xs ml-1 opacity-70">
                                                                ({v.totalChangePercent > 0 ? '+' : ''}{v.totalChangePercent.toFixed(1)}%)
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2 text-center">
                                                            <VarianceBadge status={v.status} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

