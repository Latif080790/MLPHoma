/**
 * RABPriceDriftDashboard.tsx
 * Visualizes Price Drift (Snapshot vs Live AHSP vs Procurement Actuals)
 */

import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Lock, ArrowRight, ShoppingCart, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { ScrollArea } from '../ui/scroll-area'
import { formatIDR } from '../../lib/utils'
import { useRabStore } from '../../store/rabStore'

interface RABPriceDriftDashboardProps {
    projectId: string
}

export function RABPriceDriftDashboard({ projectId }: RABPriceDriftDashboardProps) {
    const { priceDrift, refreshDrift } = useRabStore()
    const [loading, setLoading] = useState(false)

    const driftData = priceDrift[projectId]

    const handleRefresh = async () => {
        setLoading(true)
        try {
            await refreshDrift(projectId)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!driftData) {
            handleRefresh()
        }
    }, [projectId])

    if (!driftData && loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                <p>Analyzing price drift...</p>
            </div>
        )
    }

    if (!driftData) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <Zap className="h-10 w-10 text-slate-200 mb-2" />
                    <p className="text-slate-500 text-sm mb-4">No price drift data available.</p>
                    <Button size="sm" onClick={handleRefresh}>
                        Start Analysis
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const { totalDrift, details, lastChecked } = driftData
    const itemsWithDrift = details.filter(d => Math.abs(d.potentialImpact) > 1000)
    const leakage = details.reduce((sum, d) => sum + (d.potentialImpact > 0 ? d.potentialImpact : 0), 0)
    const savings = details.reduce((sum, d) => sum + (d.potentialImpact < 0 ? Math.abs(d.potentialImpact) : 0), 0)

    const driftPercentage = (totalDrift / details.reduce((sum, d) => sum + (d.baselinePrice * d.volume), 0)) * 100

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Summary Card */}
                <Card className={`${totalDrift > 0 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Price Drift</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className={`text-2xl font-bold font-mono ${totalDrift > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {totalDrift > 0 ? '+' : ''}{formatIDR(totalDrift)}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                    {totalDrift > 0 ? (
                                        <TrendingUp className="h-3 w-3 text-red-500" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3 text-green-500" />
                                    )}
                                    <span className={`text-xs font-medium ${totalDrift > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {Math.abs(driftPercentage).toFixed(2)}% vs Baseline
                                    </span>
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRefresh} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Leakage vs Savings */}
                <Card className="col-span-1 md:col-span-2">
                    <CardContent className="p-4 py-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efficiency Progress</div>
                                    <div className="text-sm font-semibold">Budget Health Analysis</div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-red-500 uppercase tracking-widest">Market Leakage</div>
                                        <div className="text-xs font-bold font-mono">{formatIDR(leakage)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-green-500 uppercase tracking-widest">Market Savings</div>
                                        <div className="text-xs font-bold font-mono text-green-600">{formatIDR(savings)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div
                                    className="bg-red-500 h-full transition-all"
                                    style={{ width: `${(leakage / (leakage + savings + 0.001)) * 100}%` }}
                                />
                                <div
                                    className="bg-green-500 h-full transition-all"
                                    style={{ width: `${(savings / (leakage + savings + 0.001)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Critical Items Table */}
            <Card>
                <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm">Significant Price Divergence</CardTitle>
                            <CardDescription className="text-xs">Items contributing most to budget impact</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono">
                            Last Check: {new Date(lastChecked).toLocaleTimeString()}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-4">
                    <ScrollArea className="h-[300px]">
                        <div className="divide-y divide-slate-100">
                            {itemsWithDrift.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs italic">
                                    No significant drift detected. All prices within ±0.01 tolerance.
                                </div>
                            ) : (
                                itemsWithDrift.map((item, idx) => (
                                    <div key={idx} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded flex items-center justify-center ${item.potentialImpact > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {item.potentialImpact > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">{item.itemName}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-mono text-slate-400">{formatIDR(item.baselinePrice)}</span>
                                                    <ArrowRight size={10} className="text-slate-300" />
                                                    <span className="text-xs font-mono font-bold text-blue-600">{formatIDR(item.currentAhspPrice)}</span>
                                                    {item.livingPrice && (
                                                        <Badge variant="secondary" className="h-4 px-1.5 text-xs bg-amber-50 text-amber-600 border-amber-200">
                                                            <ShoppingCart size={8} className="mr-1" />
                                                            Latest: {formatIDR(item.livingPrice)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-black font-mono ${item.potentialImpact > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {item.potentialImpact > 0 ? '+' : '-'}{formatIDR(Math.abs(item.potentialImpact))}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                Budget Impact ({item.volume} {item.unit})
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
