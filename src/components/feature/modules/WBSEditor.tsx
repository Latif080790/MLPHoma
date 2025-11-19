/**
 * WBSEditor.tsx
 *
 * Detailed editor for WBS module settings.
 * Controls code generation, tree behavior, validation and access.
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
 * Props for WBSEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for WBS config
 */
const schema = z.object({
  meta: z.object({
    name: z.string().optional(),
  }).optional(),
  codeRules: z.object({
    useDotNotation: z.boolean().optional(),
    maxLevels: z.number().int().optional(),
    autoNumbering: z.boolean().optional(),
    segmentPadLength: z.number().int().optional(),
  }).optional(),
  tree: z.object({
    allowDragDrop: z.boolean().optional(),
    maxChildrenPerNode: z.number().int().optional(),
    collapseDepthDefault: z.number().int().optional(),
    showEstimatedHours: z.boolean().optional(),
  }).optional(),
  validation: z.object({
    requireDescription: z.boolean().optional(),
    maxNameLength: z.number().int().optional(),
    uniqueCodeAcrossProject: z.boolean().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
  notifications: z.object({
    enabled: z.boolean().optional(),
    channels: z.string().optional(),
    thresholds: z.string().optional(),
  }).optional(),
})

/**
 * WBSEditor
 *
 * Editor component for WBS configuration fields.
 */
export default function WbsEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.meta) patch.meta = d.meta
    if (d.codeRules) {
      patch.codeRules = {
        ...d.codeRules,
        maxLevels: d.codeRules.maxLevels ? Number(d.codeRules.maxLevels) : undefined,
        segmentPadLength: d.codeRules.segmentPadLength ? Number(d.codeRules.segmentPadLength) : undefined,
      }
    }
    if (d.tree) patch.tree = d.tree
    if (d.validation) patch.validation = d.validation
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    if (d.notifications) patch.notifications = {
      enabled: !!d.notifications.enabled,
      channels: parseComma(d.notifications.channels),
      thresholds: {}, // keep string parse optional (could extend)
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">WBS Configuration</h4>
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
          <Label>Use dot notation</Label>
          <Input type="checkbox" {...register('codeRules.useDotNotation')} />
        </div>

        <div>
          <Label>Max levels</Label>
          <Input type="number" {...register('codeRules.maxLevels')} />
        </div>

        <div>
          <Label>Segment pad length</Label>
          <Input type="number" {...register('codeRules.segmentPadLength')} />
        </div>

        <div>
          <Label>Allow drag & drop</Label>
          <Input type="checkbox" {...register('tree.allowDragDrop')} />
        </div>

        <div>
          <Label>Max children per node</Label>
          <Input type="number" {...register('tree.maxChildrenPerNode')} />
        </div>

        <div>
          <Label>Show estimated hours</Label>
          <Input type="checkbox" {...register('tree.showEstimatedHours')} />
        </div>

        <div>
          <Label>Read roles (comma separated)</Label>
          <Input {...register('access.readRoles')} placeholder="admin,pm,planner" />
        </div>
      </div>
    </form>
  )
}