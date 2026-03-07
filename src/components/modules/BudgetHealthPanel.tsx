/**
 * BudgetHealthPanel.tsx
 * FASE 5 — Cross-module budget health KPIs.
 * Renders inside ProjectCosting between CostingFlowIndicator and tabs.
 * Shows: Project Budget → RAB Total → RAP Planned → Actual Spent
 * All Zustand selectors return primitives to prevent infinite re-render loops.
 */

import React, { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useRabStore } from '@/store/rabStore'
import { useRapStore } from '@/store/rapStore'
import { formatIDR } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'warning' | 'danger' | 'empty'

function getStatus(ratio: number, warnAt: number, dangerAt: number, higherIsBetter = false): HealthStatus {
  if (ratio === 0) return 'empty'
  if (higherIsBetter) {
    if (ratio >= warnAt) return 'healthy'
    if (ratio >= dangerAt) return 'warning'
    return 'danger'
  }
  if (ratio <= warnAt) return 'healthy'
  if (ratio <= dangerAt) return 'warning'
  return 'danger'
}

function statusColor(s: HealthStatus) {
  return {
    healthy: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
    empty:   'text-slate-400 dark:text-slate-500',
  }[s]
}

function statusBg(s: HealthStatus) {
  return {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-red-500',
    empty:   'bg-slate-200 dark:bg-slate-700',
  }[s]
}

function StatusIcon({ s }: { s: HealthStatus }) {
  if (s === 'healthy') return <CheckCircle2 size={12} className="text-emerald-500" />
  if (s === 'warning') return <AlertTriangle size={12} className="text-amber-500" />
  if (s === 'danger')  return <AlertTriangle size={12} className="text-red-500" />
  return <Info size={12} className="text-slate-400" />
}

// ─── Mini metric card ─────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  status,
  pct,
  pctLabel,
}: {
  label: string
  value: string
  sub: string
  status: HealthStatus
  pct?: number
  pctLabel?: string
}) {
  const clampedPct = Math.min(100, Math.max(0, pct ?? 0))
  return (
    <div className="flex-1 min-w-[130px] rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 leading-tight">{label}</span>
        <StatusIcon s={status} />
      </div>
      <div className={`text-sm font-bold font-mono leading-snug ${statusColor(status)}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      {pct !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${statusBg(status)}`}
              style={{ width: `${clampedPct}%` }}
            />
          </div>
          {pctLabel && <div className="mt-0.5 text-xs text-slate-400">{pctLabel}</div>}
        </div>
      )}
    </div>
  )
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
function AlertBanner({ messages }: { messages: string[] }) {
  if (!messages.length) return null
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {messages.map((msg, i) => (
        <div
          key={i}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
        >
          <AlertTriangle size={11} />
          {msg}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BudgetHealthPanelProps {
  projectId: string
  projectBudget: number
}

export function BudgetHealthPanel({ projectId, projectBudget }: BudgetHealthPanelProps) {
  const [expanded, setExpanded] = useState(true)

  // All selectors return PRIMITIVES — avoids new-reference infinite loops
  const rabTotal   = useRabStore(s => (s.itemsByProject[projectId] ?? []).reduce((sum, i) => sum + ((i.volume || 0) * (i.unit_price || 0)), 0))
  const rapPlanned = useRapStore(s => s.items.filter(i => i.project_id === projectId).reduce((sum, i) => sum + (i.total_budget || 0), 0))
  const rapCommit  = useRapStore(s => s.items.filter(i => i.project_id === projectId).reduce((sum, i) => sum + (i.committed_cost || 0), 0))
  const rapActual  = useRapStore(s => s.items.filter(i => i.project_id === projectId).reduce((sum, i) => sum + (i.actual_cost || 0), 0))

  const kpi = useMemo(() => {
    const rabVsBudget  = projectBudget > 0 ? rabTotal / projectBudget : 0
    const rapVsRab     = rabTotal > 0       ? rapPlanned / rabTotal   : 0
    const actualVsPlan = rapPlanned > 0     ? rapActual / rapPlanned  : 0
    const commitVsPlan = rapPlanned > 0     ? rapCommit / rapPlanned  : 0
    const cpi          = rapActual > 0      ? rapPlanned / rapActual  : 0

    const rabStatus:    HealthStatus = projectBudget === 0 ? 'empty' : getStatus(rabVsBudget,  0.9, 1.0)
    const rapStatus:    HealthStatus = rabTotal === 0      ? 'empty' : getStatus(rapVsRab,     0.9, 1.1)
    const actualStatus: HealthStatus = rapPlanned === 0    ? 'empty' : getStatus(actualVsPlan, 0.8, 1.0)
    const cpiStatus:    HealthStatus = cpi === 0           ? 'empty' : getStatus(cpi, 0.9, 0.8, true)

    const alerts: string[] = []
    if (projectBudget > 0 && rabTotal > projectBudget)
      alerts.push(`RAB melebihi Project Budget sebesar ${formatIDR(rabTotal - projectBudget)}`)
    if (rabTotal > 0 && rapPlanned > rabTotal * 1.05)
      alerts.push(`Biaya produksi RAP melebihi harga kontrak RAB — selisih ${formatIDR(rapPlanned - rabTotal)} (${((rapPlanned / rabTotal - 1) * 100).toFixed(1)}%)`)
    if (rapActual > rapPlanned && rapPlanned > 0)
      alerts.push(`Actual cost melebihi RAP Planned — CPI ${cpi.toFixed(2)}`)
    if (rapCommit > rapPlanned * 0.95 && rapPlanned > 0)
      alerts.push(`Committed cost mendekati RAP Planned (${(commitVsPlan * 100).toFixed(0)}%)`)

    return {
      rabVsBudget, rapVsRab, actualVsPlan, commitVsPlan, cpi,
      rabStatus, rapStatus, actualStatus, cpiStatus,
      alerts,
    }
  }, [projectBudget, rabTotal, rapPlanned, rapCommit, rapActual])

  const totalAlerts = kpi.alerts.length
  const overallStatus: HealthStatus =
    kpi.rabStatus === 'danger' || kpi.actualStatus === 'danger' || kpi.cpiStatus === 'danger' ? 'danger'
    : kpi.rabStatus === 'warning' || kpi.actualStatus === 'warning' || kpi.cpiStatus === 'warning' ? 'warning'
    : 'healthy'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {overallStatus === 'healthy' && <CheckCircle2 size={14} className="text-emerald-500" />}
          {overallStatus === 'warning' && <AlertTriangle size={14} className="text-amber-500" />}
          {overallStatus === 'danger'  && <AlertTriangle size={14} className="text-red-500" />}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Budget Health</span>
          {totalAlerts > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {totalAlerts} alert
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {/* Metric cards */}
          <div className="flex flex-wrap gap-2">
            <MetricCard
              label="Project Budget"
              value={projectBudget > 0 ? formatIDR(projectBudget) : '—'}
              sub="anggaran ditetapkan"
              status={projectBudget > 0 ? 'healthy' : 'empty'}
            />
            <MetricCard
              label="RAB Total"
              value={rabTotal > 0 ? formatIDR(rabTotal) : '—'}
              sub={projectBudget > 0 ? `${(kpi.rabVsBudget * 100).toFixed(1)}% dari Budget` : 'belum ada items'}
              status={kpi.rabStatus}
              pct={projectBudget > 0 ? kpi.rabVsBudget * 100 : undefined}
              pctLabel={projectBudget > 0 ? `${(kpi.rabVsBudget * 100).toFixed(1)}% terpakai` : undefined}
            />
            <MetricCard
              label="RAP Planned"
              value={rapPlanned > 0 ? formatIDR(rapPlanned) : '—'}
              sub={rabTotal > 0 ? `margin ${(100 - kpi.rapVsRab * 100).toFixed(1)}% dari kontrak` : 'biaya produksi (AHSP base)'}
              status={kpi.rapStatus}
              pct={rabTotal > 0 ? kpi.rapVsRab * 100 : undefined}
              pctLabel={rabTotal > 0 ? `${(kpi.rapVsRab * 100).toFixed(1)}% biaya dari kontrak` : undefined}
            />
            <MetricCard
              label="Actual Spent"
              value={rapActual > 0 ? formatIDR(rapActual) : '—'}
              sub={rapPlanned > 0 ? `CPI ${kpi.cpi > 0 ? kpi.cpi.toFixed(2) : '—'}` : 'belum ada data'}
              status={kpi.actualStatus}
              pct={rapPlanned > 0 ? kpi.actualVsPlan * 100 : undefined}
              pctLabel={rapPlanned > 0 ? `${(kpi.actualVsPlan * 100).toFixed(1)}% burn` : undefined}
            />

            {/* CPI KPI card */}
            {kpi.cpi > 0 && (
              <div className="flex-1 min-w-[100px] rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">CPI</span>
                <div className={`flex items-center gap-1 mt-1 ${statusColor(kpi.cpiStatus)}`}>
                  {kpi.cpi >= 1 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-lg font-bold font-mono">{kpi.cpi.toFixed(2)}</span>
                </div>
                <span className="text-xs text-slate-400 mt-0.5">
                  {kpi.cpi >= 1.05 ? 'Under budget ✓' : kpi.cpi >= 0.9 ? 'On track' : 'Over budget ⚠️'}
                </span>
              </div>
            )}
          </div>

          {/* Alert banners */}
          <AlertBanner messages={kpi.alerts} />
        </div>
      )}
    </div>
  )
}
