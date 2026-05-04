/**
 * ResourcePlanningEditor.tsx
 *
 * Detailed editor for Resource Planning module.
 * Controls histogram, procurement defaults and shortage alerts.
 */

import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Button } from '../../ui/button'
import { RefreshCw, Save } from 'lucide-react'

/**
 * Props for ResourcePlanningEditor
 */
interface Props {
  initialValue?: Record<string, unknown>
  onSave: (patch: Record<string, unknown>) => void
}

/**
 * Zod schema for Resource Planning config
 */
const schema = z.object({
  histogram: z.object({
    bucketSizeDays: z.number().optional(),
    normalizeByWorkingDays: z.boolean().optional(),
    showSkillLevels: z.boolean().optional(),
  }).optional(),
  procurement: z.object({
    leadTimeDaysDefault: z.number().optional(),
    reorderPointPct: z.number().optional(),
    vendorPreferredList: z.string().optional(), // comma
  }).optional(),
  shortages: z.object({
    alertWhenShortagePct: z.number().optional(),
    autoSuggestSubstitutes: z.boolean().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * ResourcePlanningEditor
 *
 * Editor component for resource planning settings.
 */
export default function ResourcePlanningEditor({ initialValue = {}, onSave }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function submit(d: any) {
    const patch: Record<string, unknown> = {}
    if (d.histogram) patch.histogram = {
      bucketSizeDays: d.histogram.bucketSizeDays ? Number(d.histogram.bucketSizeDays) : undefined,
      normalizeByWorkingDays: !!d.histogram.normalizeByWorkingDays,
      showSkillLevels: !!d.histogram.showSkillLevels,
    }
    if (d.procurement) patch.procurement = {
      leadTimeDaysDefault: d.procurement.leadTimeDaysDefault ? Number(d.procurement.leadTimeDaysDefault) : undefined,
      reorderPointPct: d.procurement.reorderPointPct ? Number(d.procurement.reorderPointPct) : undefined,
      vendorPreferredList: parseComma(d.procurement.vendorPreferredList),
    }
    if (d.shortages) patch.shortages = d.shortages
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Resource Planning</h4>
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
          <Label>Bucket size (days)</Label>
          <Input type="number" {...register('histogram.bucketSizeDays')} />
        </div>

        <div>
          <Label>Normalize by working days</Label>
          <Input type="checkbox" {...register('histogram.normalizeByWorkingDays')} />
        </div>

        <div>
          <Label>Default lead time days</Label>
          <Input type="number" {...register('procurement.leadTimeDaysDefault')} />
        </div>

        <div>
          <Label>Vendor preferred list (comma)</Label>
          <Input {...register('procurement.vendorPreferredList')} />
        </div>

        <div>
          <Label>Shortage alert pct</Label>
          <Input type="number" {...register('shortages.alertWhenShortagePct')} />
        </div>
      </div>
    </form>
  )
}