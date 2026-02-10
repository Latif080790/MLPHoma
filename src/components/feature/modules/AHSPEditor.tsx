/**
 * AHSPEditor.tsx
 *
 * Detailed editor for AHSP (unit price catalog) module.
 * Controls pricing behavior, component rules and import/export behavior.
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
 * Props for AHSPEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for AHSP config
 */
const schema = z.object({
  meta: z.object({ name: z.string().optional() }).optional(),
  pricing: z.object({
    includeEquipmentCost: z.boolean().optional(),
    rounding: z.object({ enabled: z.boolean().optional(), toNearest: z.number().optional() }).optional(),
    escalationRateAnnualPct: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  componentRules: z.object({
    allowedTypes: z.string().optional(), // comma
    maxComponentsPerItem: z.number().optional(),
    requireResourceLinking: z.boolean().optional(),
  }).optional(),
  importExport: z.object({
    allowedFormats: z.string().optional(), // comma
    validateOnImport: z.boolean().optional(),
    importMaxRows: z.number().optional(),
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
 * AHSPEditor
 *
 * Editor component for AHSP settings.
 */
export default function AHSPEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.pricing) patch.pricing = {
      ...d.pricing,
      escalationRateAnnualPct: d.pricing.escalationRateAnnualPct ? Number(d.pricing.escalationRateAnnualPct) : undefined,
    }
    if (d.componentRules) patch.componentRules = {
      ...d.componentRules,
      allowedTypes: typeof d.componentRules.allowedTypes === 'string' ? parseComma(d.componentRules.allowedTypes) : d.componentRules.allowedTypes,
    }
    if (d.importExport) patch.importExport = {
      ...d.importExport,
      allowedFormats: typeof d.importExport.allowedFormats === 'string' ? parseComma(d.importExport.allowedFormats) : d.importExport.allowedFormats,
      importMaxRows: d.importExport.importMaxRows ? Number(d.importExport.importMaxRows) : undefined,
    }
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    if (d.notifications) patch.notifications = {
      enabled: !!d.notifications.enabled,
      channels: parseComma(d.notifications.channels),
    }
    if (d.meta) patch.meta = d.meta
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">AHSP (Unit Price Catalog)</h4>
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
          <Label>Currency</Label>
          <Input {...register('pricing.currency')} placeholder="IDR" />
        </div>

        <div>
          <Label>Include equipment cost</Label>
          <Input type="checkbox" {...register('pricing.includeEquipmentCost')} />
        </div>

        <div>
          <Label>Escalation rate annual (%)</Label>
          <Input type="number" {...register('pricing.escalationRateAnnualPct')} />
        </div>

        <div>
          <Label>Allowed component types (comma)</Label>
          <Input {...register('componentRules.allowedTypes')} placeholder="material,labor,equipment,subcontract" />
        </div>

        <div>
          <Label>Import allowed formats (comma)</Label>
          <Input {...register('importExport.allowedFormats')} placeholder="xlsx,csv" />
        </div>

        <div>
          <Label>Import validate on import</Label>
          <Input type="checkbox" {...register('importExport.validateOnImport')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} placeholder="admin,estimator" />
        </div>
      </div>
    </form>
  )
}