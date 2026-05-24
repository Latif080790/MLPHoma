/**
 * CostDashboardView.tsx
 * Main Enterprise Cost Dashboard surface.
 * Composes KPI strip, cost type breakdown, EVM area chart, and EAC projections.
 */

import React, { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatIDR } from '@/lib/utils'
import { useForecastStore } from '@/store/costForecastStore'
import { useProjectStore } from '@/store/projectStore'
import { CostKPIStrip } from './CostKPIStrip'
import { CostTypeBreakdownChart } from './CostTypeBreakdownChart'
import { BurnRateSparkline } from './BurnRateSparkline'

export function CostDashboardView() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const { snapshot, snapshotLoading, history, projections, fetchSnapshot, fetchHistory } =
    useForecastStore(
      useShallow((s) => ({
        snapshot: s.snapshot,
        snapshotLoading: s.snapshotLoading,
        history: s.history,
        projections: s.projections,
        fetchSnapshot: s.fetchSnapshot,
        fetchHistory: s.fetchHistory,
      }))
    )

  useEffect(() => {
    if (!activeProjectId) return
    fetchSnapshot(activeProjectId)
    fetchHistory(activeProjectId)
  }, [activeProjectId, fetchSnapshot, fetchHistory])

  // Build EVM chart data from history
  const evmChartData = useMemo(
    () => (history || []).map((m) => ({
      date: (() => { try { return format(new Date(m.snapshot_date), 'dd/MM') } catch { return '' } })(),
      PV: Number(m.pv),
      EV: Number(m.ev),
      AC: Number(m.ac),
    })),
    [history]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: KPI Strip */}
      <CostKPIStrip snapshot={snapshot} loading={snapshotLoading} />

      {/* Row 2: Breakdown + EVM chart */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left 4 cols: Cost Type Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Breakdown Biaya</CardTitle>
            </CardHeader>
            <CardContent>
              {!snapshot ? (
                <div className="animate-pulse rounded bg-muted h-40" />
              ) : (
                <CostTypeBreakdownChart
                  breakdown={snapshot.costTypeBreakdown}
                  totalRab={snapshot.rabTotal}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 8 cols: EVM Performance + Sparkline */}
        <div className="col-span-12 lg:col-span-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                EVM Performance — PV / EV / AC
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evmChartData.length < 2 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  Belum ada data metrik harian
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={evmChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="evmPV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmEV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmAC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) =>
                        new Intl.NumberFormat('id-ID', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(v)
                      }
                    />
                    <Tooltip formatter={(value: number) => formatIDR(value)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="PV"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      fill="url(#evmPV)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="EV"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      fill="url(#evmEV)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="AC"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      fill="url(#evmAC)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* Burn Rate Sparkline below */}
              <div className="mt-3 border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">AC vs EV — 12 bulan terakhir</p>
                <BurnRateSparkline history={history} limit={12} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3: EAC Projections */}
      {projections && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">EAC Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">EAC Standard</p>
                <p className="text-base font-semibold">{formatIDR(projections.eacStandard)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EAC Conservative</p>
                <p className="text-base font-semibold">{formatIDR(projections.eacConservative)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EAC Aggressive</p>
                <p className="text-base font-semibold">{formatIDR(projections.eacAggressive)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">VAC (Variance at Completion)</p>
                <p
                  className={`text-base font-semibold ${
                    projections.varianceAtCompletion < 0 ? 'text-red-500' : 'text-green-600'
                  }`}
                >
                  {formatIDR(projections.varianceAtCompletion)}
                </p>
              </div>
            </div>
            {projections.isRedAlert && projections.alertReason && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {projections.alertReason}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
