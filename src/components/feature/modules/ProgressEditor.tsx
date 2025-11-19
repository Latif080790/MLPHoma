/**
 * ProgressEditor.tsx
 *
 * Detailed editor for Progress Tracking module.
 * Controls capture options, auto-update sync and quality thresholds.
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
 * Props for ProgressEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for Progress Tracking config
 */
const schema = z.object({
  capture: z.object({
    allowPhotoUpload: z.boolean().optional(),
    maxPhotosPerTask: z.number().optional(),
    requireCommentOnUpdate: z.boolean().optional(),
  }).optional(),
  autoUpdate: z.object({
    enableAutoUpdateFromCurva: z.boolean().optional(),
    syncIntervalMinutes: z.number().optional(),
  }).optional(),
  quality: z.object({
    defectThresholdPerTask: z.number().optional(),
    requireQCApproval: z.boolean().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * ProgressEditor
 *
 * Editor component for progress tracking settings.
 */
export default function ProgressEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.capture) patch.capture = {
      allowPhotoUpload: !!d.capture.allowPhotoUpload,
      maxPhotosPerTask: d.capture.maxPhotosPerTask ? Number(d.capture.maxPhotosPerTask) : undefined,
      requireCommentOnUpdate: !!d.capture.requireCommentOnUpdate,
    }
    if (d.autoUpdate) patch.autoUpdate = {
      enableAutoUpdateFromCurva: !!d.autoUpdate.enableAutoUpdateFromCurva,
      syncIntervalMinutes: d.autoUpdate.syncIntervalMinutes ? Number(d.autoUpdate.syncIntervalMinutes) : undefined,
    }
    if (d.quality) patch.quality = {
      defectThresholdPerTask: d.quality.defectThresholdPerTask ? Number(d.quality.defectThresholdPerTask) : undefined,
      requireQCApproval: !!d.quality.requireQCApproval,
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
        <h4 className="text-sm font-medium">Progress Tracking</h4>
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
          <Label>Allow photo upload</Label>
          <Input type="checkbox" {...register('capture.allowPhotoUpload')} />
        </div>

        <div>
          <Label>Max photos per task</Label>
          <Input type="number" {...register('capture.maxPhotosPerTask')} />
        </div>

        <div>
          <Label>Enable auto-update from Curva</Label>
          <Input type="checkbox" {...register('autoUpdate.enableAutoUpdateFromCurva')} />
        </div>

        <div>
          <Label>Sync interval (minutes)</Label>
          <Input type="number" {...register('autoUpdate.syncIntervalMinutes')} />
        </div>

        <div>
          <Label>Require QC approval</Label>
          <Input type="checkbox" {...register('quality.requireQCApproval')} />
        </div>
      </div>
    </form>
  )
}