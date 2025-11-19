/**
 * CurvaSEditor.tsx
 *
 * Detailed editor for Curva-S (S-Curve / Earned Value).
 * Controls metric tolerances, actual capture behavior and analytics options.
 */

import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { RefreshCw, Save } from 'lucide-react'

/**
 * Props for CurvaSEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for Curva-S config
 */
const schema = z.object({
  metrics: z.object({
    spiTolerance: z.number().optional(),
    cpiTolerance: z.number().optional(),
    performanceWindowDays: z.number().optional(),
    baselineSmoothingEnabled: z.boolean().optional(),
  }).optional(),
  actuals: z.object({
    allowManualActuals: z.boolean().optional(),
    photoEvidenceRequiredForActuals: z.boolean().optional(),
    actualsLockAfterDays: z.number().optional(),
  }).optional(),
  analytics: z.object({
    runDailyAnalysis: z.boolean().optional(),
    anomalyDetectionEnabled: z.boolean().optional(),
    anomalyThresholdPct: z.number().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * CurvaSEditor
 *
 * Editor component for Curva-S settings.
 */
export default function CurvaSEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.metrics) patch.metrics = {
      ...d.metrics,
      spiTolerance: d.metrics.spiTolerance ? Number(d.metrics.spiTolerance) : undefined,
      cpiTolerance: d.metrics.cpiTolerance ? Number(d.metrics.cpiTolerance) : undefined,
      performanceWindowDays: d.metrics.performanceWindowDays ? Number(d.metrics.performanceWindowDays) : undefined,
    }
    if (d.actuals) patch.actuals = d.actuals
    if (d.analytics) patch.analytics = {
      ...d.analytics,
      anomalyThresholdPct: d.analytics.anomalyThresholdPct ? Number(d.analytics.anomalyThresholdPct) : undefined,
    }
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Curva-S / Earned Value</h4>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent" size="sm" type="button" onClick={() => reset(initialValue)}>
            <RefreshCw className="mr-2" />
            Reset
          </Button>
          <Button size="sm" type="submit">
            <Save className="mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label>SPI tolerance</Label>
          <Input type="number" {...register('metrics.spiTolerance')} />
        </div>

        <div>
          <Label>CPI tolerance</Label>
          <Input type="number" {...register('metrics.cpiTolerance')} />
        </div>

        <div>
          <Label>Baseline smoothing enabled</Label>
          <Input type="checkbox" {...register('metrics.baselineSmoothingEnabled')} />
        </div>

        <div>
          <Label>Run daily analysis</Label>
          <Input type="checkbox" {...register('analytics.runDailyAnalysis')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} />
        </div>
      </div>
    </form>
  )
}