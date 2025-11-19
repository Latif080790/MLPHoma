/**
 * CashFlowEditor.tsx
 *
 * Detailed editor for Cash Flow configuration.
 * Controls projection period, retention, what-if scenarios and alerts.
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
 * Props for CashFlowEditor
 */
interface Props {
  initialValue?: any
  onSave: (patch: any) => void
}

/**
 * Zod schema for Cash Flow config
 */
const schema = z.object({
  projection: z.object({
    cashflowPeriod: z.enum(['monthly', 'weekly', 'daily']).optional(),
    includeRetentionPct: z.number().optional(),
    earlyPaymentDiscountPct: z.number().optional(),
    paymentTermsDays: z.number().optional(),
  }).optional(),
  whatIf: z.object({
    enableWhatIf: z.boolean().optional(),
    maxScenariosStored: z.number().optional(),
  }).optional(),
  alerts: z.object({
    deficitAlertPct: z.number().optional(),
    liquidityReservePct: z.number().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * CashFlowEditor
 *
 * Editor component for Cash Flow settings.
 */
export default function CashFlowEditor({ initialValue = {}, onSave }: Props) {
  const methods = useForm<any>({ resolver: zodResolver(schema), defaultValues: initialValue })
  const { register, handleSubmit, reset } = methods

  function parseComma(v?: string) {
    if (!v) return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function submit(d: any) {
    const patch: any = {}
    if (d.projection) patch.projection = {
      ...d.projection,
      includeRetentionPct: d.projection.includeRetentionPct ? Number(d.projection.includeRetentionPct) : undefined,
      earlyPaymentDiscountPct: d.projection.earlyPaymentDiscountPct ? Number(d.projection.earlyPaymentDiscountPct) : undefined,
      paymentTermsDays: d.projection.paymentTermsDays ? Number(d.projection.paymentTermsDays) : undefined,
    }
    if (d.whatIf) patch.whatIf = {
      enableWhatIf: !!d.whatIf.enableWhatIf,
      maxScenariosStored: d.whatIf.maxScenariosStored ? Number(d.whatIf.maxScenariosStored) : undefined,
    }
    if (d.alerts) patch.alerts = {
      deficitAlertPct: d.alerts.deficitAlertPct ? Number(d.alerts.deficitAlertPct) : undefined,
      liquidityReservePct: d.alerts.liquidityReservePct ? Number(d.alerts.liquidityReservePct) : undefined,
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
        <h4 className="text-sm font-medium">Cash Flow</h4>
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
          <Label>Cashflow period</Label>
          <Input {...register('projection.cashflowPeriod')} placeholder="monthly" />
        </div>

        <div>
          <Label>Include retention (%)</Label>
          <Input type="number" {...register('projection.includeRetentionPct')} />
        </div>

        <div>
          <Label>Payment terms (days)</Label>
          <Input type="number" {...register('projection.paymentTermsDays')} />
        </div>

        <div>
          <Label>Enable What-If</Label>
          <Input type="checkbox" {...register('whatIf.enableWhatIf')} />
        </div>

        <div>
          <Label>Deficit alert (%)</Label>
          <Input type="number" {...register('alerts.deficitAlertPct')} />
        </div>
      </div>
    </form>
  )
}