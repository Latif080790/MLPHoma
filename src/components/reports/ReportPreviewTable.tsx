import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReportPreviewResult } from '@/types/report'

interface ReportPreviewTableProps {
  result: ReportPreviewResult | null
  loading?: boolean
}

export function ReportPreviewTable({ result, loading }: ReportPreviewTableProps) {
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
        <CardTitle className="text-sm">Preview ({result.rows.length} rows)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
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
