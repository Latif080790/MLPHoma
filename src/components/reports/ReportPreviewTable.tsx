import React from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReportChartType, ReportPreviewResult } from '@/types/report'

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#eab308']

interface ReportPreviewTableProps {
  result: ReportPreviewResult | null
  loading?: boolean
  chartType?: ReportChartType
}

function deriveChartKeys(result: ReportPreviewResult): { nameKey: string; valueKey: string } {
  const first = result.rows[0] ?? {}
  let nameKey = result.columns[0]
  let valueKey = result.columns[result.columns.length - 1]
  for (const col of result.columns) {
    if (typeof first[col] === 'string') { nameKey = col; break }
  }
  for (const col of result.columns) {
    if (typeof first[col] === 'number') { valueKey = col; break }
  }
  return { nameKey, valueKey }
}

function exportToExcel(result: ReportPreviewResult) {
  const ws = XLSX.utils.json_to_sheet(result.rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `report_${Date.now()}.xlsx`)
}

function exportToPDF(result: ReportPreviewResult) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(11)
  doc.text('BI Report Preview', 14, 14)
  doc.setFontSize(8)
  doc.text(`Generated: ${new Date(result.generatedAt).toLocaleString()}`, 14, 20)

  autoTable(doc, {
    head: [result.columns],
    body: result.rows.map(row => result.columns.map(col => String(row[col] ?? ''))),
    startY: 25,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [249, 115, 22] },
  })

  doc.save(`report_${Date.now()}.pdf`)
}

function ChartView({ result, chartType }: { result: ReportPreviewResult; chartType: ReportChartType }) {
  const { nameKey, valueKey } = deriveChartKeys(result)
  const data = result.rows.map(row => ({
    ...row,
    [nameKey]: String(row[nameKey] ?? '').slice(0, 20),
  }))

  const commonProps = {
    data,
    margin: { top: 8, right: 16, left: 8, bottom: 40 },
  }

  if (chartType === 'PIE') {
    const pieData = data.map(row => ({
      name: String(row[nameKey]),
      value: Number(row[valueKey] ?? 0),
    }))
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'LINE') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart {...commonProps}>
          <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey={valueKey} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'AREA') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart {...commonProps}>
          <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey={valueKey} stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}33`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Default: BAR
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart {...commonProps}>
        <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey={valueKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ReportPreviewTable({ result, loading, chartType = 'TABLE' }: ReportPreviewTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Generating preview...</CardContent>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">No preview generated yet.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Preview ({result.rows.length} rows)</CardTitle>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => exportToExcel(result)}
            >
              <Download size={12} />
              Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => exportToPDF(result)}
            >
              <Download size={12} />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-auto">
        {chartType !== 'TABLE' && (
          <ChartView result={result} chartType={chartType} />
        )}

        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, index) => (
              <TableRow key={`${index}-${row[result.columns[0]] || 'row'}`}>
                {result.columns.map((column) => (
                  <TableCell key={column}>{String(row[column] ?? '')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
