/**
 * ProfitHealthWidget.tsx
 * Dashboard widget showing RAP Profit First health metrics.
 * Shows target margin vs projected margin with color-coded status.
 */

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Target, RefreshCw, Loader2, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react"
import { rapProfitService, ProjectProfitSummary } from "@/services/rapProfitService"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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

    const DrillDownContent = () => (
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-500" />
                    Profit Health Detailed Analysis
                </DialogTitle>
                <p className="text-xs text-muted-foreground">Detailed breakdown of RAB vs RAP Performance per work package.</p>
            </DialogHeader>
            <div className="flex-1 overflow-auto mt-4 border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <TableRow>
                            <TableHead className="text-[10px] font-bold uppercase">Work Package / WBS</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">RAB (Est)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">RAP (Budget)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">Actual + Comm</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">Target Prof</TableHead>
                            <TableHead className="text-right text-[10px] font-bold uppercase">Actual Prof</TableHead>
                            <TableHead className="text-center text-[10px] font-bold uppercase">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.items.map((item, idx) => {
                            const totalBurn = (item.actualCost || 0) + (item.committedCost || 0)
                            const statusColor = item.healthStatus === 'healthy' ? 'bg-emerald-500' :
                                item.healthStatus === 'loss' ? 'bg-red-600 animate-pulse' :
                                    item.healthStatus === 'critical' ? 'bg-red-500' : 'bg-amber-500'

                            return (
                                <TableRow key={item.wbsId || idx} className="text-xs">
                                    <TableCell className="font-medium py-2">{item.wbsName || 'Unnamed Package'}</TableCell>
                                    <TableCell className="text-right font-mono py-2">{(item.rabTotal || 0).toLocaleString('id-ID')}</TableCell>
                                    <TableCell className="text-right font-mono py-2">{(item.rapBudget || 0).toLocaleString('id-ID')}</TableCell>
                                    <TableCell className="text-right font-mono py-2 text-amber-600">{(totalBurn).toLocaleString('id-ID')}</TableCell>
                                    <TableCell className="text-right font-mono py-2 text-slate-400">{(item.profitTarget || 0).toLocaleString('id-ID')}</TableCell>
                                    <TableCell className={`text-right font-mono font-bold py-2 ${item.profitActual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(item.profitActual || 0).toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell className="text-center py-2">
                                        <Badge variant="outline" className={`h-4 px-1.5 text-[9px] border-none text-white ${statusColor}`}>
                                            {item.healthStatus?.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border flex justify-between items-center text-xs">
                <div className="flex gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">Target Margin</span>
                        <span className="font-bold">{data.targetProfitPct}%</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">Projected Margin</span>
                        <span className={`font-bold ${isCritical ? 'text-red-600' : isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {data.projectedProfitPct.toFixed(1)}%
                        </span>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={load}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </Button>
            </div>
        </DialogContent>
    )

    if (compact) {
        return (
            <Dialog>
                <DialogTrigger asChild>
                    <Card className={`group cursor-pointer hover:border-slate-400 transition-all border-l-4 ${isCritical ? 'border-l-red-500' : isHealthy ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                        <CardContent className="p-4 relative">
                            <ExternalLink size={12} className="absolute right-2 top-2 opacity-0 group-hover:opacity-40 transition-opacity" />
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
                </DialogTrigger>
                <DrillDownContent />
            </Dialog>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Profit First Health
                    </CardTitle>
                    <div className="flex gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-[10px]">
                                    <ExternalLink size={12} className="mr-1" />
                                    Details
                                </Button>
                            </DialogTrigger>
                            <DrillDownContent />
                        </Dialog>
                        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-7 w-7 p-0">
                            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
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
                        <div className="text-muted-foreground text-xs uppercase tracking-tight">Total RAB</div>
                        <div className="font-semibold">Rp {data.totalRab.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-tight">RAP Budget</div>
                        <div className="font-semibold">Rp {data.totalRapBudget.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-tight">Actual (RAP)</div>
                        <div className="font-semibold text-red-600">Rp {(data.totalRapActualOnly ?? data.totalActualCost).toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-tight">Equipment</div>
                        <div className="font-semibold text-orange-600">Rp {(data.totalEquipmentCost ?? 0).toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-tight font-bold">Total Actual</div>
                        <div className="font-bold text-red-700">Rp {data.totalActualCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-tight font-bold">Committed</div>
                        <div className="font-bold text-blue-600">Rp {data.totalCommittedCost.toLocaleString('id-ID')}</div>
                    </div>
                </div>

                {/* Alerts */}
                {(data.warningCount > 0 || data.criticalCount > 0) && (
                    <div className="flex gap-2 text-xs pt-2 border-t">
                        {data.criticalCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                                {data.criticalCount} Critical Packages
                            </Badge>
                        )}
                        {data.warningCount > 0 && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                {data.warningCount} Warning Packages
                            </Badge>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
