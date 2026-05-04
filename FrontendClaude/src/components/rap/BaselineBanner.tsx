/**
 * BaselineBanner.tsx
 * Displays baseline info and high-level KPIs.
 */

import React, { useMemo } from 'react'
import { Card, CardContent } from '../ui/card'
import { RapPlanItem, sumPlan } from './RapUtils'

export interface BaselineInfo {
  version: number
  lockedAt: string
}

export interface BaselineBannerProps {
  baseline?: RapPlanItem[] | null
  info?: BaselineInfo | null
  current?: RapPlanItem[]
}

/** BaselineBanner component: summary of baseline and current deltas */
export const BaselineBanner: React.FC<BaselineBannerProps> = ({ baseline, info, current }) => {
  const totalBase = useMemo(() => sumPlan(baseline || []), [baseline])
  const totalCurr = useMemo(() => sumPlan(current || []), [current])
  const delta = totalCurr - totalBase

  if (!baseline || baseline.length === 0) return null

  return (
    <Card className="mb-4 border-amber-300 dark:border-amber-700">
      <CardContent className="flex items-center justify-between p-3 text-sm">
        <div>
          <div className="font-medium">Baseline V{info?.version ?? 1}</div>
          <div className="text-xs text-neutral-500">Locked at: {info?.lockedAt ? new Date(info.lockedAt).toLocaleString() : '—'}</div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-neutral-500">Total Baseline</div>
            <div className="font-medium text-amber-700 dark:text-amber-300">Rp {Math.round(totalBase).toLocaleString('id-ID')}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Total Current</div>
            <div className="font-medium text-blue-700 dark:text-blue-300">Rp {Math.round(totalCurr).toLocaleString('id-ID')}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Δ Total</div>
            <div className={`font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : ''}`}>
              Rp {Math.round(delta).toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}