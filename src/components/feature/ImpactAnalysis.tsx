/**
 * ImpactAnalysis.tsx
 *
 * Quick simulation panel to show the estimated financial impact of configuration changes.
 * - Uses a sample RAB dataset to compute subtotal and the effect of overhead/profit/tax changes.
 * - Displays a small bar breakdown and delta compared to default percentages.
 *
 * This component is intentionally lightweight and designed for fast "what-if" previews.
 */

import React, { useMemo } from 'react'
import type { FC } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { SAMPLE_RAB_ITEMS, computeUsingFeatureConfig, computeRABTotals } from '../../lib/sampleData/rabSample'
import type { FeatureConfig } from '../../config/features'

/**
 * Props for ImpactAnalysis
 */
interface ImpactAnalysisProps {
  /** The current feature config (optional) */
  config?: Partial<FeatureConfig> | null
}

/**
 * ImpactAnalysis
 *
 * Presents a simple breakdown for the sample RAB set according to the current config.
 *
 * @param config - optional feature config used to read rab.calculation percentages
 */
const ImpactAnalysis: FC<ImpactAnalysisProps> = ({ config }) => {
  // compute using current config values (if present)
  const current = useMemo(() => computeUsingFeatureConfig(SAMPLE_RAB_ITEMS, config ?? undefined), [config])
  // compute using fallback defaults to show delta
  const defaults = useMemo(() => computeRABTotals(SAMPLE_RAB_ITEMS, { overheadPct: 10, profitPct: 8, taxPct: 11 }), [])

  const chartData = [
    { name: 'Subtotal', value: Math.round(current.subtotal) },
    { name: 'Overhead', value: Math.round(current.overheadAmount) },
    { name: 'Profit', value: Math.round(current.profitAmount) },
    { name: 'Tax', value: Math.round(current.taxAmount) },
    { name: 'Total', value: Math.round(current.finalTotal) },
  ]

  const deltaPercent = ((current.finalTotal - defaults.finalTotal) / Math.max(1, defaults.finalTotal)) * 100

  return (
    <div>
      <div className="mb-3">
        <h5 className="text-sm font-medium">Impact Analysis (sample RAB)</h5>
        <div className="text-xs text-neutral-600">
          Sample subtotal: <strong>{current.subtotal.toLocaleString()}</strong>
        </div>
      </div>

      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : v)} />
            <Bar dataKey="value" fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-sm">
        <div>
          <strong>Estimated total:</strong> {Math.round(current.finalTotal).toLocaleString()}
        </div>
        <div className="text-xs text-neutral-600">
          Delta vs defaults (10/8/11):{' '}
          <span className={deltaPercent > 0 ? 'text-rose-600' : deltaPercent < 0 ? 'text-green-600' : ''}>
            {deltaPercent >= 0 ? '+' : ''}
            {deltaPercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default ImpactAnalysis