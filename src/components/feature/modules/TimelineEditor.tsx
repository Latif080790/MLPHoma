/**
 * TimelineEditor.tsx
 *
 * Detailed editor for Timeline / Gantt configuration.
 * Controls scheduling calendar, dependency rules and baseline behavior.
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
 * Props for TimelineEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for Timeline config
 */
const schema = z.object({
  scheduling: z.object({
    workCalendar: z.enum(['7day', '5day', 'custom']).optional(),
    defaultWorkHoursPerDay: z.number().optional(),
    autoCalculateCriticalPath: z.boolean().optional(),
    floatPrecisionDays: z.number().optional(),
  }).optional(),
  dependencyRules: z.object({
    allowedTypes: z.string().optional(), // comma
    maxPredecessors: z.number().optional(),
    defaultLagDays: z.number().optional(),
  }).optional(),
  baseline: z.object({
    keepMultipleBaselines: z.boolean().optional(),
    baselineLimit: z.number().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * TimelineEditor
 *
 * Editor component for timeline settings.
 */
export default function TimelineEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.scheduling) patch.scheduling = {
      ...d.scheduling,
      defaultWorkHoursPerDay: d.scheduling.defaultWorkHoursPerDay ? Number(d.scheduling.defaultWorkHoursPerDay) : undefined,
      floatPrecisionDays: d.scheduling.floatPrecisionDays ? Number(d.scheduling.floatPrecisionDays) : undefined,
    }
    if (d.dependencyRules) patch.dependencyRules = {
      ...d.dependencyRules,
      allowedTypes: typeof d.dependencyRules.allowedTypes === 'string' ? parseComma(d.dependencyRules.allowedTypes) : d.dependencyRules.allowedTypes,
      maxPredecessors: d.dependencyRules.maxPredecessors ? Number(d.dependencyRules.maxPredecessors) : undefined,
    }
    if (d.baseline) patch.baseline = d.baseline
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Timeline / Gantt</h4>
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
          <Label>Work calendar</Label>
          <Input {...register('scheduling.workCalendar')} placeholder="5day" />
        </div>

        <div>
          <Label>Default work hours per day</Label>
          <Input type="number" {...register('scheduling.defaultWorkHoursPerDay')} />
        </div>

        <div>
          <Label>Auto-calc critical path</Label>
          <Input type="checkbox" {...register('scheduling.autoCalculateCriticalPath')} />
        </div>

        <div>
          <Label>Allowed dependency types (comma)</Label>
          <Input {...register('dependencyRules.allowedTypes')} placeholder="FS,FF,SS,SF" />
        </div>

        <div>
          <Label>Keep multiple baselines</Label>
          <Input type="checkbox" {...register('baseline.keepMultipleBaselines')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} />
        </div>
      </div>
    </form>
  )
}