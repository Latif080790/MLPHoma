/**
 * RABEditor.tsx
 *
 * Detailed editor for RAB (Budget / Estimation).
 * Controls calculation toggles, item rules and cost-control policy.
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
 * Props for RABEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for RAB config
 */
const schema = z.object({
  calculation: z.object({
    includeOverheadPct: z.number().optional(),
    includeProfitPct: z.number().optional(),
    includeTaxPct: z.number().optional(),
    allowManualOverride: z.boolean().optional(),
    autoRecalcOnAhspChange: z.boolean().optional(),
  }).optional(),
  itemRules: z.object({
    minVolume: z.number().optional(),
    maxDecimalPrecision: z.number().optional(),
    requireAhspReference: z.boolean().optional(),
    enableBulkEdit: z.boolean().optional(),
  }).optional(),
  costControl: z.object({
    contingencyPct: z.number().optional(),
    approvalThresholdAmount: z.number().optional(),
    budgetLockOnApproval: z.boolean().optional(),
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
 * RABEditor
 *
 * Editor component for RAB settings and policies.
 */
export default function RABEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.calculation) {
      patch.calculation = {
        ...d.calculation,
        includeOverheadPct: d.calculation.includeOverheadPct ? Number(d.calculation.includeOverheadPct) : undefined,
        includeProfitPct: d.calculation.includeProfitPct ? Number(d.calculation.includeProfitPct) : undefined,
        includeTaxPct: d.calculation.includeTaxPct ? Number(d.calculation.includeTaxPct) : undefined,
      }
    }
    if (d.itemRules) patch.itemRules = d.itemRules
    if (d.costControl) patch.costControl = {
      ...d.costControl,
      contingencyPct: d.costControl.contingencyPct ? Number(d.costControl.contingencyPct) : undefined,
      approvalThresholdAmount: d.costControl.approvalThresholdAmount ? Number(d.costControl.approvalThresholdAmount) : undefined,
    }
    if (d.access) patch.access = {
      readRoles: parseComma(d.access.readRoles),
      writeRoles: parseComma(d.access.writeRoles),
    }
    if (d.notifications) patch.notifications = {
      enabled: !!d.notifications.enabled,
      channels: parseComma(d.notifications.channels),
      thresholds: {},
    }
    onSave(patch)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-xl border p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">RAB (Budget / Estimation)</h4>
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
          <Label>Overhead (%)</Label>
          <Input type="number" {...register('calculation.includeOverheadPct')} />
        </div>

        <div>
          <Label>Profit (%)</Label>
          <Input type="number" {...register('calculation.includeProfitPct')} />
        </div>

        <div>
          <Label>Tax (%)</Label>
          <Input type="number" {...register('calculation.includeTaxPct')} />
        </div>

        <div>
          <Label>Allow manual override</Label>
          <Input type="checkbox" {...register('calculation.allowManualOverride')} />
        </div>

        <div>
          <Label>Require AHSP reference for items</Label>
          <Input type="checkbox" {...register('itemRules.requireAhspReference')} />
        </div>

        <div>
          <Label>Approval threshold amount</Label>
          <Input type="number" {...register('costControl.approvalThresholdAmount')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} placeholder="admin,estimator,pm" />
        </div>
      </div>
    </form>
  )
}