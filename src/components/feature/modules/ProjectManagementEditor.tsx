/**
 * ProjectManagementEditor.tsx
 *
 * Detailed editor for the Project Management module.
 * Provides fields for metadata, workflow, templates, numbering, KPIs, access and notifications.
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
 * Props for ProjectManagementEditor
 */
interface Props {
  /** Initial module configuration (partial) */
  initialValue?: Record<string, unknown>
  /** Callback to persist partial updates (patch) */
  onSave: (patch: Record<string, unknown>) => void
}

/**
 * Zod schema for Project Management configuration subset
 */
const schema = z.object({
  meta: z.object({
    name: z.string().optional(),
    schemaVersion: z.string().optional(),
  }).optional(),
  workflow: z.object({
    enableMultiStage: z.boolean().optional(),
    stages: z.string().optional(), // comma-separated in UI
    autoArchiveAfterDays: z.number().int().optional(),
  }).optional(),
  templates: z.object({
    enableProjectTemplates: z.boolean().optional(),
    defaultTemplateId: z.string().optional(),
    preserveWbsOnClone: z.boolean().optional(),
    preserveBudgetOnClone: z.boolean().optional(),
  }).optional(),
  numbering: z.object({
    prefix: z.string().optional(),
    counterStart: z.number().int().optional(),
    useYearInCode: z.boolean().optional(),
  }).optional(),
  kpis: z.object({
    budgetVarianceTolerancePct: z.number().optional(),
    scheduleVarianceToleranceDays: z.number().optional(),
    criticalPathNotifyDays: z.number().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(), // comma-separated
    writeRoles: z.string().optional(), // comma-separated
  }).optional(),
  notifications: z.object({
    enabled: z.boolean().optional(),
    channels: z.string().optional(), // comma-separated
    thresholds: z.string().optional(), // key:value pairs comma-separated (k1:10,k2:5)
  }).optional(),
})

/**
 * ProjectManagementEditor
 *
 * Renders a more detailed editor for project management config.
 */
export default function ProjectManagementEditor({ initialValue = {}, onSave }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  /**
   * parseComma
   * Convert comma-separated string into trimmed array (removes empties).
   */
  function parseComma(v?: string) {
    if (!v || typeof v !== 'string') return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  /**
   * parseThresholds
   * Converts "key:val,key2:val2" into object { key: number, key2: number }
   */
  function parseThresholds(v?: string) {
    if (!v || typeof v !== 'string') return {}
    return v.split(',').map((s) => s.trim()).filter(Boolean).reduce((acc: Record<string, unknown>, pair) => {
      const [k, val] = pair.split(':').map((x: string) => x?.trim())
      if (!k) return acc
      const num = Number(val)
      acc[k] = Number.isFinite(num) ? num : val
      return acc
    }, {})
  }

  /**
   * submit
   * Compose nested patch object and call onSave
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function submit(d: any) {
    const patch: Record<string, unknown> = {}
    if (d.meta) patch.meta = d.meta
    if (d.workflow) {
      patch.workflow = {
        ...d.workflow,
        stages: typeof d.workflow.stages === 'string' ? (d.workflow.stages ? d.workflow.stages.split(',').map((s: string) => s.trim()).filter(Boolean) : []) : d.workflow.stages,
      }
    }
    if (d.templates) patch.templates = d.templates
    if (d.numbering) patch.numbering = d.numbering
    if (d.kpis) patch.kpis = d.kpis
    if (d.access) {
      patch.access = {
        readRoles: parseComma(d.access.readRoles),
        writeRoles: parseComma(d.access.writeRoles),
      }
    }
    if (d.notifications) {
      patch.notifications = {
        enabled: !!d.notifications.enabled,
        channels: parseComma(d.notifications.channels),
        thresholds: parseThresholds(d.notifications.thresholds),
      }
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Project Management</h4>
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
          <Label>Name</Label>
          <Input {...register('meta.name')} placeholder="Display name" />
        </div>

        <div>
          <Label>Enable multi-stage workflow</Label>
          <Input type="checkbox" {...register('workflow.enableMultiStage')} />
        </div>

        <div>
          <Label>Workflow stages (comma separated)</Label>
          <Input {...register('workflow.stages')} placeholder="Init,Plan,Execute,Close" />
        </div>

        <div>
          <Label>Auto archive after days</Label>
          <Input type="number" {...register('workflow.autoArchiveAfterDays')} placeholder="e.g. 365" />
        </div>

        <div>
          <Label>Project templates enabled</Label>
          <Input type="checkbox" {...register('templates.enableProjectTemplates')} />
        </div>

        <div>
          <Label>Numbering prefix</Label>
          <Input {...register('numbering.prefix')} placeholder="PRJ" />
        </div>

        <div>
          <Label>KPIs - budget variance tolerance (%)</Label>
          <Input type="number" {...register('kpis.budgetVarianceTolerancePct')} placeholder="e.g. 5" />
        </div>

        <div>
          <Label>Read roles (comma separated)</Label>
          <Input {...register('access.readRoles')} placeholder="admin,pm,estimator" />
        </div>

        <div>
          <Label>Notifications channels (comma separated)</Label>
          <Input {...register('notifications.channels')} placeholder="inapp,email,slack" />
        </div>

        <div>
          <Label>Notification thresholds (k:val comma-separated)</Label>
          <Input {...register('notifications.thresholds')} placeholder="budgetOverrunPct:10,criticalPathChangeDays:3" />
        </div>
      </div>
    </form>
  )
}