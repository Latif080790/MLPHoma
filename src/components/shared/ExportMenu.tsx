import React from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import * as xlsx from 'xlsx'
import { toast } from 'sonner'

export interface ExportColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

interface ExportMenuProps<T> {
  data: T[]
  columns: ExportColumn<T>[]
  filename: string
  disabled?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function ExportMenu<T>({
  data,
  columns,
  filename,
  disabled,
  size = 'sm',
  className,
}: ExportMenuProps<T>) {
  const exportXLSX = () => {
    if (!data.length) { toast.warning('Tidak ada data untuk diekspor'); return }
    const rows = data.map(row =>
      Object.fromEntries(columns.map(col => [col.header, col.accessor(row) ?? '']))
    )
    const ws = xlsx.utils.json_to_sheet(rows)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Data')
    xlsx.writeFile(wb, `${filename}.xlsx`)
    toast.success(`Berhasil ekspor ${data.length} baris ke ${filename}.xlsx`)
  }

  const exportCSV = () => {
    if (!data.length) { toast.warning('Tidak ada data untuk diekspor'); return }
    const header = columns.map(c => `"${c.header}"`).join(',')
    const rows = data.map(row =>
      columns.map(col => {
        const v = col.accessor(row) ?? ''
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Berhasil ekspor ${data.length} baris ke ${filename}.csv`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled || !data.length}
          className={`h-9 text-xs gap-2 text-emerald-600 hover:bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/30 ${className ?? ''}`}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
          Export Data
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportXLSX} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-blue-600" />
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
