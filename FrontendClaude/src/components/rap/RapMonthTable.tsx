/**
 * RapMonthTable.tsx
 * Editable table for monthly RAP values with percent, cumulative and baseline delta.
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { RapPlanItem, sumPlan } from './RapUtils'

/** Props for RapMonthTable */
export interface RapMonthTableProps {
  plan: RapPlanItem[]
  setPlan: (plan: RapPlanItem[]) => void
  baseline?: RapPlanItem[] | null
}

/** Build a quick lookup map for baseline */
function baselineMap(base?: RapPlanItem[] | null): Map<string, number> {
  return new Map((base || []).map((p) => [String(p.period), Number(p.planned || 0)]))
}

/** RapMonthTable component */
export const RapMonthTable: React.FC<RapMonthTableProps> = ({ plan, setPlan, baseline }) => {
  const total = useMemo(() => sumPlan(plan), [plan])
  const baseMap = useMemo(() => baselineMap(baseline), [baseline])

  const rows = useMemo(() => {
    let cum = 0
    return [...plan]
      .sort((a, b) => String(a.period).localeCompare(String(b.period)))
      .map((p) => {
        const planned = Number(p.planned || 0)
        cum += planned
        const base = baseMap.get(String(p.period)) || 0
        const delta = planned - base
        return {
          ...p,
          percent: total > 0 ? (planned / total) * 100 : 0,
          cum,
          base,
          delta,
        }
      })
  }, [plan, baseMap, total])

  const handleValueChange = (period: string, value: number) => {
    const next = plan.map((p) => (p.period === period ? { ...p, planned: Math.max(0, value) } : p))
    setPlan(next)
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Detail Bulanan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-6 border-b bg-neutral-50 p-2 text-sm font-medium dark:border-neutral-800 dark:bg-neutral-900">
              <div>Period</div>
              <div className="text-right">Planned (Rp)</div>
              <div className="text-right">% of Total</div>
              <div className="text-right">Cumulative</div>
              <div className="text-right">Baseline</div>
              <div className="text-right">Δ vs Baseline</div>
            </div>
            {rows.map((r) => (
              <div key={r.period} className="grid grid-cols-6 border-b p-2 text-sm last:border-b-0 dark:border-neutral-800">
                <div className="font-mono">{r.period}</div>
                <div className="text-right">
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={Math.round(r.planned)}
                    onChange={(e) => handleValueChange(r.period, Number(e.target.value) || 0)}
                    className="w-44 rounded-md border bg-transparent px-2 py-1 text-right text-sm dark:border-neutral-700"
                  />
                </div>
                <div className="text-right">{r.percent.toFixed(2)}%</div>
                <div className="text-right">Rp {Math.round(r.cum).toLocaleString('id-ID')}</div>
                <div className="text-right">Rp {Math.round(r.base).toLocaleString('id-ID')}</div>
                <div className={`text-right ${r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-red-600' : ''}`}>
                  Rp {Math.round(r.delta).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-6 p-2 text-sm font-medium">
              <div>Total</div>
              <div className="text-right">Rp {Math.round(total).toLocaleString('id-ID')}</div>
              <div className="text-right">100%</div>
              <div />
              <div />
              <div />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}