/**
 * ProfitHealthWidget.tsx
 * Dashboard widget showing RAP Profit First health metrics.
 * Shows target margin vs projected margin with color-coded status.
 */

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Target, RefreshCw, Loader2, ShieldCheck, AlertTriangle } from "lucide-react"
import { rapProfitService, ProjectProfitSummary } from "@/services/rapProfitService"
import { toast } from "sonner"

interface ProfitHealthWidgetProps {
    projectId: string
    compact?: boolean
}

export function ProfitHealthWidget({ projectId, compact = false }: ProfitHealthWidgetProps) {
    const [data, setData] = useState<ProjectProfitSummary | null>(null)
    const [loading, setLoading] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const result = await rapProfitService.getProfitHealth(projectId)
            setData(result)
        } catch (err) {
            console.warn('Profit health load failed:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (projectId) load()
    }, [projectId])

    if (loading && !data) {
        return (
            <Card>
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (!data) return null

    const isHealthy = data.projectedProfitPct >= data.targetProfitPct * 0.8
    const isCritical = data.projectedProfitPct < data.targetProfitPct * 0.5

    if (compact) {
        return (
            <Card className={`border-l-4 ${isCritical ? 'border-l-red-500' : isHealthy ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Profit Margin</div>
                            <div className={`text-2xl font-bold ${isCritical ? 'text-red-600' : isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {data.projectedProfitPct.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Target: {data.targetProfitPct}%
                            </div>
                        </div>
                        {isHealthy ? (
                            <ShieldCheck className="h-8 w-8 text-emerald-500" />
                        ) : isCritical ? (
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                        ) : (
                            <Target className="h-8 w-8 text-amber-500" />
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Profit First Health
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Profit gauge */}
                <div className={`p-4 rounded-lg ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : isHealthy ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Projected Profit</span>
                        <Badge variant="outline" className={isCritical ? 'border-red-300 text-red-700' : isHealthy ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'}>
                            {isCritical ? 'CRITICAL' : isHealthy ? 'HEALTHY' : 'WARNING'}
                        </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold ${isCritical ? 'text-red-600' : isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {data.projectedProfitPct.toFixed(1)}%
                        </span>
                        <span className="text-sm text-muted-foreground">/ target {data.targetProfitPct}%</span>
                    </div>
                    <div className="text-sm font-medium mt-1">
                        Rp {data.projectedProfit.toLocaleString('id-ID')}
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-muted-foreground text-xs">Total RAB</div>
                        <div className="font-semibold">Rp {data.totalRab.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs">RAP Budget</div>
                        <div className="font-semibold">Rp {data.totalRapBudget.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs">Actual Cost</div>
                        <div className="font-semibold text-red-600">Rp {data.totalActualCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs">Committed</div>
                        <div className="font-semibold text-blue-600">Rp {data.totalCommittedCost.toLocaleString('id-ID')}</div>
                    </div>
                </div>

                {/* Alerts */}
                {(data.warningCount > 0 || data.criticalCount > 0) && (
                    <div className="flex gap-2 text-xs">
                        {data.criticalCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                                {data.criticalCount} Critical
                            </Badge>
                        )}
                        {data.warningCount > 0 && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                {data.warningCount} Warning
                            </Badge>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
