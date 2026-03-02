/**
 * ReportingEditor.tsx
 *
 * Detailed editor for Reporting module.
 * Controls dashboard widgets, export settings and retention.
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
 * Props for ReportingEditor
 */
interface Props {
  initialValue?: Record<string, unknown>
  onSave: (patch: Record<string, unknown>) => void
}

/**
 * Zod schema for Reporting config
 */
const schema = z.object({
  dashboard: z.object({
    widgets: z.string().optional(), // comma
    refreshIntervalSeconds: z.number().optional(),
    defaultDateRangeDays: z.number().optional(),
  }).optional(),
  exports: z.object({
    enableExcelExport: z.boolean().optional(),
    enablePdfExport: z.boolean().optional(),
    defaultPaperSize: z.enum(['A4', 'Letter']).optional(),
  }).optional(),
  retention: z.object({
    keepReportHistoryDays: z.number().optional(),
    archivedReportsOn: z.string().optional(),
  }).optional(),
  access: z.object({
    readRoles: z.string().optional(),
    writeRoles: z.string().optional(),
  }).optional(),
})

/**
 * ReportingEditor
 *
 * Editor component for reporting & export settings.
 */
export default function ReportingEditor({ initialValue = {}, onSave }: Props) {
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
    if (d.dashboard) patch.dashboard = {
      widgets: typeof d.dashboard.widgets === 'string' ? parseComma(d.dashboard.widgets) : d.dashboard.widgets,
      refreshIntervalSeconds: d.dashboard.refreshIntervalSeconds ? Number(d.dashboard.refreshIntervalSeconds) : undefined,
      defaultDateRangeDays: d.dashboard.defaultDateRangeDays ? Number(d.dashboard.defaultDateRangeDays) : undefined,
    }
    if (d.exports) patch.exports = d.exports
    if (d.retention) patch.retention = {
      keepReportHistoryDays: d.retention.keepReportHistoryDays ? Number(d.retention.keepReportHistoryDays) : undefined,
      archivedReportsOn: d.retention.archivedReportsOn,
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
        <h4 className="text-sm font-medium">Reporting</h4>
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
          <Label>Widgets (comma)</Label>
          <Input {...register('dashboard.widgets')} placeholder="kpiBudget,curvaS,cashflow,resourceHistogram" />
        </div>

        <div>
          <Label>Refresh interval (seconds)</Label>
          <Input type="number" {...register('dashboard.refreshIntervalSeconds')} />
        </div>

        <div>
          <Label>Enable PDF export</Label>
          <Input type="checkbox" {...register('exports.enablePdfExport')} />
        </div>

        <div>
          <Label>Keep report history (days)</Label>
          <Input type="number" {...register('retention.keepReportHistoryDays')} />
        </div>

        <div>
          <Label>Read roles (comma)</Label>
          <Input {...register('access.readRoles')} />
        </div>
      </div>
    </form>
  )
}