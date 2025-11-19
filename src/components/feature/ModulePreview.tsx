/**
 * ModulePreview.tsx
 *
 * Small preview panel that provides quick insights for each module.
 * - Uses Recharts for simple visualizations where appropriate.
 * - Reads module-specific configuration and renders key metrics.
 */

import React from 'react'
import type { FC } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'

/**
 * Props for ModulePreview
 */
interface ModulePreviewProps {
  /** Module key (e.g. 'rab', 'rap', 'curvas') */
  moduleKey: string
  /** The module-specific configuration object */
  config: any
  /** Full feature config (optional) */
  fullConfig?: any
}

/**
 * makeMockSeries
 *
 * Generate a small mock series for charts based on numeric seeds.
 *
 * @param seed - numeric seed to vary series
 * @returns array of {name, value}
 */
function makeMockSeries(seed = 5) {
  const len = 6
  const out: Array<{ name: string; value: number }> = []
  for (let i = 0; i < len; i++) {
    const base = Math.max(1, seed * (1 + i / 6))
    out.push({ name: `P${i + 1}`, value: Math.round(base * (i + 1) * (0.8 + (seed % 3) * 0.1)) })
  }
  return out
}

/**
 * ModulePreview
 *
 * Presents a small, fast visualization & stats for the given module config.
 */
const ModulePreview: FC<ModulePreviewProps> = ({ moduleKey, config, fullConfig }) => {
  if (!config) {
    return <div className="text-sm text-neutral-500">No configuration available for this module.</div>
  }

  // Helpers
  const numberOr = (v: any, fallback = 0) => (typeof v === 'number' ? v : fallback)
  const percentOr = (v: any, fallback = 0) => (typeof v === 'number' ? `${v}%` : `${fallback}%`)

  switch (moduleKey) {
    case 'projectManagement':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Project Management</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="text-sm"><strong>Name:</strong> {config?.meta?.name ?? '—'}</div>
            <div className="text-sm"><strong>Stages:</strong> {(config?.workflow?.stages || []).join(' › ') || '—'}</div>
            <div className="text-sm"><strong>KPIs:</strong> Budget Var {numberOr(config?.kpis?.budgetVarianceTolerancePct, 5)}%</div>
          </div>
        </div>
      )

    case 'wbs':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">WBS Settings</div>
          <div className="text-sm"><strong>Max Levels:</strong> {config?.codeRules?.maxLevels ?? '—'}</div>
          <div className="text-sm"><strong>Auto-number:</strong> {config?.codeRules?.autoNumbering ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>Show Est. Hours:</strong> {config?.tree?.showEstimatedHours ? 'Yes' : 'No'}</div>
        </div>
      )

    case 'ahsp':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">AHSP (Unit Price)</div>
          <div className="text-sm"><strong>Currency:</strong> {config?.pricing?.currency ?? 'IDR'}</div>
          <div className="text-sm"><strong>Include equipment:</strong> {config?.pricing?.includeEquipmentCost ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>Rounding:</strong> {config?.pricing?.rounding?.enabled ? `to ${config?.pricing?.rounding?.toNearest}` : 'No'}</div>
        </div>
      )

    case 'rab':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">RAB (Estimation)</div>
          <div className="text-sm"><strong>Overhead:</strong> {percentOr(config?.calculation?.includeOverheadPct, 10)}</div>
          <div className="text-sm"><strong>Profit:</strong> {percentOr(config?.calculation?.includeProfitPct, 8)}</div>
          <div className="text-sm"><strong>Tax:</strong> {percentOr(config?.calculation?.includeTaxPct, 11)}</div>
        </div>
      )

    case 'timeline':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Timeline / Gantt</div>
          <div className="text-sm"><strong>Calendar:</strong> {config?.scheduling?.workCalendar ?? '5day'}</div>
          <div className="text-sm"><strong>Auto CPM:</strong> {config?.scheduling?.autoCalculateCriticalPath ? 'Yes' : 'No'}</div>
        </div>
      )

    case 'rap': {
      const pts = makeMockSeries(config?.distribution?.minPeriodAllocationPct ?? 5)
      return (
        <div style={{ height: 160 }}>
          <div className="mb-2 text-xs text-neutral-600">RAP Distribution (preview)</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={pts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs mt-2 text-neutral-600">Default: {config?.distribution?.defaultPeriod ?? 'monthly'}</div>
        </div>
      )
    }

    case 'curvas': {
      const series = makeMockSeries(Math.round((config?.metrics?.performanceWindowDays ?? 30) / 10))
      return (
        <div style={{ height: 160 }}>
          <div className="mb-2 text-xs text-neutral-600">Curva-S (sample)</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-xs mt-2 text-neutral-600">SPI tol: {config?.metrics?.spiTolerance ?? 0.95}</div>
        </div>
      )
    }

    case 'resources':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Resource Planning</div>
          <div className="text-sm"><strong>Bucket days:</strong> {config?.histogram?.bucketSizeDays ?? 7}</div>
          <div className="text-sm"><strong>Lead time:</strong> {config?.procurement?.leadTimeDaysDefault ?? 14} days</div>
        </div>
      )

    case 'cashflow':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Cash Flow</div>
          <div className="text-sm"><strong>Period:</strong> {config?.projection?.cashflowPeriod ?? 'monthly'}</div>
          <div className="text-sm"><strong>Retention:</strong> {percentOr(config?.projection?.includeRetentionPct, 5)}</div>
          <div className="text-sm"><strong>Payment terms:</strong> {config?.projection?.paymentTermsDays ?? 30} days</div>
        </div>
      )

    case 'progress':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Progress Tracking</div>
          <div className="text-sm"><strong>Photo upload:</strong> {config?.capture?.allowPhotoUpload ? 'Enabled' : 'Disabled'}</div>
          <div className="text-sm"><strong>Auto sync (mins):</strong> {config?.autoUpdate?.syncIntervalMinutes ?? 60}</div>
        </div>
      )

    case 'reporting':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Reporting</div>
          <div className="text-sm"><strong>Widgets:</strong> {(config?.dashboard?.widgets || []).length || 0}</div>
          <div className="text-sm"><strong>Excel export:</strong> {config?.exports?.enableExcelExport ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>PDF export:</strong> {config?.exports?.enablePdfExport ? 'Yes' : 'No'}</div>
        </div>
      )

    default:
      return <div className="text-sm text-neutral-600">No preview available for this module.</div>
  }
}

export default ModulePreview