/**
 * ProfitControlDashboard.tsx
 * Phase 11: Complete Profit Control view for ProjectCosting module.
 *
 * Shows:
 * 1. Profit Health gauge (target vs projected margin)
 * 2. Cost breakdown: RAP Actual vs Equipment (tools_usage_logs) vs Committed
 * 3. Per-WBS profit health table with color-coded status
 * 4. Equipment/Automation cost breakdown
 */

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Target,
    RefreshCw,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Wrench,
    DollarSign,
    BarChart3,
} from "lucide-react"
import { rapProfitService, ProjectProfitSummary } from "@/services/rapProfitService"
import { toast } from "sonner"

interface ProfitControlDashboardProps {
    projectId: string
}

const STATUS_CONFIG = {
    healthy: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300", badge: "border-emerald-300 text-emerald-700", icon: ShieldCheck, label: "HEALTHY" },
    warning: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300", badge: "border-amber-300 text-amber-700", icon: AlertTriangle, label: "WARNING" },
    critical: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300", badge: "border-red-300 text-red-700", icon: AlertTriangle, label: "CRITICAL" },
    loss: { color: "text-red-700", bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-400", badge: "border-red-400 text-red-800", icon: TrendingDown, label: "LOSS" },
} as const

function getOverallStatus(data: ProjectProfitSummary) {
    if (data.projectedProfitPct < 0) return "loss"
    if (data.projectedProfitPct < data.targetProfitPct * 0.5) return "critical"
    if (data.projectedProfitPct < data.targetProfitPct * 0.8) return "warning"
    return "healthy"
}

function formatRp(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)}M`
    if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}Jt`
    return `Rp ${value.toLocaleString("id-ID")}`
}

export function ProfitControlDashboard({ projectId }: ProfitControlDashboardProps) {
    const [data, setData] = useState<ProjectProfitSummary | null>(null)
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const result = await rapProfitService.getProfitHealth(projectId)
            setData(result)
        } catch (err) {
            toast.error("Gagal memuat data profit control")
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        if (projectId) load()
    }, [projectId, load])

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Memuat data profit...</span>
            </div>
        )
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">Belum ada data RAP</p>
                    <p className="text-sm mt-1">Buat RAP items terlebih dahulu di tab RAP (Budget & Control).</p>
                </CardContent>
            </Card>
        )
    }

    const status = getOverallStatus(data)
    const cfg = STATUS_CONFIG[status]
    const StatusIcon = cfg.icon

    // Cost breakdown percentages for visual bar
    const totalCost = data.totalActualCost + Math.max(0, data.totalCommittedCost - data.totalRapActualOnly)
    const rapPct = totalCost > 0 ? (data.totalRapActualOnly / totalCost) * 100 : 0
    const equipPct = totalCost > 0 ? (data.totalEquipmentCost / totalCost) * 100 : 0
    const committedRemainder = Math.max(0, data.totalCommittedCost - data.totalRapActualOnly)
    const commitPct = totalCost > 0 ? (committedRemainder / totalCost) * 100 : 0

    // Group equipment costs by date (last 10)
    const equipByDate = new Map<string, number>()
    for (const e of data.equipmentBreakdown) {
        const d = e.logDate || "unknown"
        equipByDate.set(d, (equipByDate.get(d) || 0) + e.rentCost)
    }
    const equipDates = Array.from(equipByDate.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)

    return (
        <div className="space-y-6">
            {/* Row 1: Profit Health Gauge + Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Profit Gauge */}
                <Card className={`lg:col-span-1 border-l-4 ${cfg.border}`}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Profit Health
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`p-4 rounded-lg ${cfg.bg}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Projected Profit</div>
                                    <div className={`text-4xl font-bold ${cfg.color}`}>
                                        {data.projectedProfitPct.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Target: {data.targetProfitPct}%
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <StatusIcon className={`h-10 w-10 ${cfg.color}`} />
                                    <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                                        {cfg.label}
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-lg font-semibold">
                                {formatRp(data.projectedProfit)}
                            </div>
                            {/* Progress bar: projected vs target */}
                            <div className="mt-3">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>0%</span>
                                    <span>Target {data.targetProfitPct}%</span>
                                </div>
                                <div className="relative h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    <div
                                        className={`absolute h-full rounded-full transition-all ${status === "healthy" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500"}`}
                                        style={{ width: `${Math.max(0, Math.min(100, (data.projectedProfitPct / Math.max(data.targetProfitPct, 1)) * 100))}%` }}
                                    />
                                    {/* Target marker */}
                                    <div className="absolute h-full w-0.5 bg-gray-600 dark:bg-gray-300" style={{ left: "100%" }} />
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        {(data.warningCount > 0 || data.criticalCount > 0) && (
                            <div className="flex gap-2 mt-3">
                                {data.criticalCount > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        {data.criticalCount} Critical
                                    </Badge>
                                )}
                                {data.warningCount > 0 && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                                        {data.warningCount} Warning
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* KPI Cards */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <KpiCard
                        label="Total RAB (Owner)"
                        value={formatRp(data.totalRab)}
                        icon={<DollarSign className="h-4 w-4" />}
                        color="text-blue-600"
                    />
                    <KpiCard
                        label="RAP Budget (Internal)"
                        value={formatRp(data.totalRapBudget)}
                        icon={<BarChart3 className="h-4 w-4" />}
                        color="text-indigo-600"
                    />
                    <KpiCard
                        label="RAP Actual Cost"
                        value={formatRp(data.totalRapActualOnly)}
                        icon={<TrendingDown className="h-4 w-4" />}
                        color="text-red-600"
                        sub="Material + Tenaga + Subcon"
                    />
                    <KpiCard
                        label="Equipment Cost"
                        value={formatRp(data.totalEquipmentCost)}
                        icon={<Wrench className="h-4 w-4" />}
                        color="text-orange-600"
                        sub={`${data.equipmentBreakdown.length} log entries`}
                        highlight={data.totalEquipmentCost > 0}
                    />
                    <KpiCard
                        label="Total Actual (All)"
                        value={formatRp(data.totalActualCost)}
                        icon={<TrendingUp className="h-4 w-4" />}
                        color="text-red-700"
                        sub="RAP + Equipment"
                    />
                    <KpiCard
                        label="Committed Cost"
                        value={formatRp(data.totalCommittedCost)}
                        icon={<Target className="h-4 w-4" />}
                        color="text-blue-700"
                    />
                </div>
            </div>

            {/* Row 2: Cost Breakdown Bar */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Cost Composition</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {rapPct > 0 && (
                            <div
                                className="bg-red-500 transition-all flex items-center justify-center text-xs text-white font-medium"
                                style={{ width: `${rapPct}%` }}
                                title={`RAP Actual: ${rapPct.toFixed(1)}%`}
                            >
                                {rapPct > 10 && `${rapPct.toFixed(0)}%`}
                            </div>
                        )}
                        {equipPct > 0 && (
                            <div
                                className="bg-orange-500 transition-all flex items-center justify-center text-xs text-white font-medium"
                                style={{ width: `${equipPct}%` }}
                                title={`Equipment: ${equipPct.toFixed(1)}%`}
                            >
                                {equipPct > 8 && `${equipPct.toFixed(0)}%`}
                            </div>
                        )}
                        {commitPct > 0 && (
                            <div
                                className="bg-blue-400 transition-all flex items-center justify-center text-xs text-white font-medium"
                                style={{ width: `${commitPct}%` }}
                                title={`Committed Remaining: ${commitPct.toFixed(1)}%`}
                            >
                                {commitPct > 8 && `${commitPct.toFixed(0)}%`}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> RAP Actual</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Equipment</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Committed Remaining</span>
                    </div>
                </CardContent>
            </Card>

            {/* Row 3: Per-WBS Health Table + Equipment Log */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* WBS Health Table */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Per-WBS Profit Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.items.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data WBS terhubung ke RAP items.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-muted-foreground">
                                            <th className="pb-2 pr-3">WBS</th>
                                            <th className="pb-2 pr-3 text-right">RAB</th>
                                            <th className="pb-2 pr-3 text-right">RAP Budget</th>
                                            <th className="pb-2 pr-3 text-right">Actual</th>
                                            <th className="pb-2 pr-3 text-right">Profit %</th>
                                            <th className="pb-2 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((item, idx) => {
                                            const itemCfg = STATUS_CONFIG[item.healthStatus]
                                            return (
                                                <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                                                    <td className="py-2 pr-3 font-medium max-w-[200px] truncate" title={item.wbsName}>
                                                        {item.wbsName}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">{formatRp(item.rabTotal)}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">{formatRp(item.rapBudget)}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums text-red-600">{formatRp(item.actualCost)}</td>
                                                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${itemCfg.color}`}>
                                                        {item.profitPctActual.toFixed(1)}%
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        <Badge variant="outline" className={`text-xs ${itemCfg.badge}`}>
                                                            {itemCfg.label}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Equipment Cost Log */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-orange-500" />
                            <CardTitle className="text-base">Automation Costs</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {equipDates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Belum ada data tools_usage_logs.<br />
                                <span className="text-xs">Scheduler-cron akan mengisi otomatis.</span>
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {equipDates.map(([date, cost]) => (
                                    <div key={date} className="flex justify-between items-center py-1.5 border-b last:border-0">
                                        <span className="text-xs text-muted-foreground">{date}</span>
                                        <span className="text-sm font-semibold text-orange-600 tabular-nums">{formatRp(cost)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-2 border-t font-bold text-sm">
                                    <span>Total Equipment</span>
                                    <span className="text-orange-700 tabular-nums">{formatRp(data.totalEquipmentCost)}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Margin Erosion Warning (if applicable) */}
            {status !== "healthy" && (
                <Card className={`border ${cfg.border} ${cfg.bg}`}>
                    <CardContent className="p-4 flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${cfg.color} shrink-0`} />
                        <div>
                            <div className={`font-semibold ${cfg.color}`}>
                                {status === "loss"
                                    ? "Proyek Mengalami RUGI!"
                                    : status === "critical"
                                        ? "Margin Profit Kritis"
                                        : "Peringatan Erosi Margin"}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {status === "loss"
                                    ? `Projected profit ${data.projectedProfitPct.toFixed(1)}% (negatif). Total biaya aktual Rp ${data.totalActualCost.toLocaleString("id-ID")} sudah melebihi total RAB Rp ${data.totalRab.toLocaleString("id-ID")}. Segera lakukan review biaya.`
                                    : `Projected profit ${data.projectedProfitPct.toFixed(1)}% di bawah target ${data.targetProfitPct}%. ${data.criticalCount} item kritis, ${data.warningCount} item warning. Equipment cost berkontribusi Rp ${data.totalEquipmentCost.toLocaleString("id-ID")} terhadap total biaya.`}
                            </p>
                            <div className="mt-2 text-xs">
                                <strong>Rekomendasi:</strong> Review RAP items yang berstatus CRITICAL, optimalkan penggunaan alat (equipment), dan pertimbangkan negosiasi ulang dengan supplier.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// --- Sub-components ---

function KpiCard({
    label,
    value,
    icon,
    color,
    sub,
    highlight,
}: {
    label: string
    value: string
    icon: React.ReactNode
    color: string
    sub?: string
    highlight?: boolean
}) {
    return (
        <Card className={highlight ? "border-orange-300 dark:border-orange-700" : ""}>
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className={color}>{icon}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
                {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
            </CardContent>
        </Card>
    )
}
