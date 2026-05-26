import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ReportChartType, ReportDataset, ReportTemplate } from '@/types/report'

interface ReportTemplateEditorProps {
  template: ReportTemplate | null
  saving?: boolean
  onChange: (patch: Partial<ReportTemplate>) => void
  onSave: () => void
  onDelete: () => void
  onRun: () => void
}

const DATASETS: ReportDataset[] = ['DASHBOARD_KPI', 'RISK_REGISTER', 'PURCHASE_ORDERS']
const CHART_TYPES: ReportChartType[] = ['TABLE', 'BAR', 'LINE', 'AREA', 'PIE']

export function ReportTemplateEditor({
  template,
  saving,
  onChange,
  onSave,
  onDelete,
  onRun,
}: ReportTemplateEditorProps) {
  if (!template) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Select an existing template or create a new one.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Template Detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-template-name">Name</Label>
          <Input
            id="report-template-name"
            value={template.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Dataset</Label>
          <Select
            value={template.dataset}
            onValueChange={(value) => onChange({ dataset: value as ReportDataset })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select dataset" />
            </SelectTrigger>
            <SelectContent>
              {DATASETS.map((dataset) => (
                <SelectItem key={dataset} value={dataset}>
                  {dataset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Chart Type</Label>
          <Select
            value={template.chart_type}
            onValueChange={(value) => onChange({ chart_type: value as ReportChartType })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select chart" />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((chartType) => (
                <SelectItem key={chartType} value={chartType}>
                  {chartType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="secondary" onClick={onRun}>Run</Button>
          <Button onClick={onSave} disabled={saving}>Save</Button>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
        </div>
      </CardContent>
    </Card>
  )
}
