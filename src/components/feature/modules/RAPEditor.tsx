/**
 * RAPEditor.tsx
 *
 * Detailed editor for RAP (time-phased budget).
 * Controls distribution defaults, generation toggles and period rounding behavior.
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
 * Props for RAPEditor
 */
interface Props {
  initialValue?: Record<string, unknown>
  onSave: (patch: Record<string, unknown>) => void
}

/**
 * Zod schema for RAP config
 */
const schema = z.object({
  distribution: z.object({
    defaultPeriod: z.enum(['daily', 'weekly', 'monthly']).optional(),
    roundingMethod: z.enum(['round', 'ceil', 'floor']).optional(),
    allowManualAdjustPerPeriod: z.boolean().optional(),
    minPeriodAllocationPct: z.number().optional(),
  }).optional(),
  generation: z.object({
    autoGenerateFromRab: z.boolean().optional(),
    useTimelineWeights: z.boolean().optional(),
    smoothingWindowPeriods: z.number().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
  notifications: z.object({
    enabled: z.boolean().optional(),
    channels: z.string().optional(),
  }).optional(),
})

/**
 * RAPEditor
 *
 * Editor component for RAP generation & distribution settings.
 */
export default function RAPEditor({ initialValue = {}, onSave }: Props) {
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
    if (d.distribution) patch.distribution = {
      ...d.distribution,
      minPeriodAllocationPct: d.distribution.minPeriodAllocationPct ? Number(d.distribution.minPeriodAllocationPct) : undefined,
    }
    if (d.generation) patch.generation = {
      ...d.generation,
      smoothingWindowPeriods: d.generation.smoothingWindowPeriods ? Number(d.generation.smoothingWindowPeriods) : undefined,
    }
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    if (d.notifications) patch.notifications = {
      enabled: !!d.notifications.enabled,
      channels: parseComma(d.notifications.channels),
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">RAP (Time-phased Budget)</h4>
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
          <Label>Default period</Label>
          <Input {...register('distribution.defaultPeriod')} placeholder="monthly" />
        </div>

        <div>
          <Label>Rounding method</Label>
          <Input {...register('distribution.roundingMethod')} placeholder="round" />
        </div>

        <div>
          <Label>Allow manual adjust per period</Label>
          <Input type="checkbox" {...register('distribution.allowManualAdjustPerPeriod')} />
        </div>

        <div>
          <Label>Auto-generate from RAB</Label>
          <Input type="checkbox" {...register('generation.autoGenerateFromRab')} />
        </div>

        <div>
          <Label>Use timeline weights</Label>
          <Input type="checkbox" {...register('generation.useTimelineWeights')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} />
        </div>
      </div>
    </form>
  )
}