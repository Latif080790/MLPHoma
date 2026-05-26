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
} from 'recharts'

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
    <div className="p-4 flex flex-col gap-3">

      {/* Row 1: KPI Strip */}
      <CostKPIStrip snapshot={snapshot} loading={snapshotLoading} />

      {/* Row 2: Breakdown + EVM chart */}
      <div className="grid grid-cols-12 gap-3">

        {/* Cost Type Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden h-full">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Breakdown Biaya</span>
            </div>
            <div className="p-4">
              {!snapshot ? (
                <div className="animate-pulse rounded bg-slate-100 h-40" />
              ) : (
                <CostTypeBreakdownChart breakdown={snapshot.costTypeBreakdown} totalRab={snapshot.rabTotal} />
              )}
            </div>
          </div>
        </div>

        {/* EVM Performance Chart */}
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">EVM Performance — PV / EV / AC</span>
              <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-px" style={{ background: '#f59e0b' }} /> PV
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-px" style={{ background: '#10b981' }} /> EV
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-px border-t border-dashed border-slate-400" /> AC
                </span>
              </div>
            </div>
            <div className="p-4">
              {evmChartData.length < 2 ? (
                <div className="flex items-center justify-center h-40 text-xs text-slate-400">
                  Belum ada data metrik harian
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={evmChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="evmPV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmEV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="evmAC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.08} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#f8fafc',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      }}
                      formatter={(value: number) => formatIDR(value)}
                    />
                    <Area type="monotone" dataKey="PV" stroke="#f59e0b" strokeWidth={1.5} fill="url(#evmPV)" dot={false} legendType="none" />
                    <Area type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={1.5} fill="url(#evmEV)" dot={false} legendType="none" />
                    <Area type="monotone" dataKey="AC" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#evmAC)" dot={false} legendType="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Burn Rate — 12 bulan terakhir</p>
                <BurnRateSparkline history={history} limit={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: EAC Projections */}
      {projections && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">EAC Projections</span>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'EAC Standard', value: projections.eacStandard, colored: false },
                { label: 'EAC Conservative', value: projections.eacConservative, colored: false },
                { label: 'EAC Aggressive', value: projections.eacAggressive, colored: false },
                { label: 'VAC', value: projections.varianceAtCompletion, colored: true },
              ].map(({ label, value, colored }) => (
                <div key={label}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                  <p className={`text-base font-bold font-mono ${
                    colored ? (value < 0 ? 'text-red-500' : 'text-emerald-600') : 'text-slate-800'
                  }`}>
                    {formatIDR(value)}
                  </p>
                </div>
              ))}
            </div>
            {projections.isRedAlert && projections.alertReason && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {projections.alertReason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
