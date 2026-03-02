/**
 * RAPGenerator.tsx
 * Interactive generator for RAP (time-phased budget) based on Timeline tasks.
 *
 * Features:
 * - Pull tasks from timelineStore by projectId.
 * - Edit per-task amount (IDR).
 * - Auto-assign amounts (Equal / Proportional to duration).
 * - Choose granularity (week/month).
 * - Generate periodized RAP schedule (distribute amount linearly by task days).
 * - Visualize with BarChart (Recharts).
 * - Export to Excel (xlsx) and PDF (jsPDF + html2canvas).
 *
 * Notes:
 * - Non-destructive: no write to global rapStore to avoid breaking unknown APIs.
 * - Week buckets start on Monday (ISO-like).
 * - Currency format helper for IDR with thousand separators.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Download, LineChart, RefreshCcw, Equal, Calculator, FileSpreadsheet, FileText } from 'lucide-react'
import { useTimelineStore } from '../../store/timelineStore'
import { useRabStore } from '../../store/rabStore'
import type { RABItem } from '../../types/rab'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts'

/** Budget definition for a task used by RAP */
interface TaskBudget {
  taskId: string
  name: string
  startDate: string
  endDate: string
  duration: number
  amount: number // IDR, editable by user
}

/** Period bucket used for RAP schedule */
interface PeriodBucket {
  key: string
  label: string
  start: string
  end: string
  amount: number
}

/** Parse YYYY-MM-DD (UTC safe) */
function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

/** Format back to YYYY-MM-DD (UTC) */
function toISO(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().split('T')[0]
}

/** Inclusive days between start..end (>=1) */
function daysInclusive(startISO: string, endISO: string): number {
  const s = parseISO(startISO).getTime()
  const e = parseISO(endISO).getTime()
  const one = 1000 * 60 * 60 * 24
  return Math.max(1, Math.floor((e - s) / one) + 1)
}

/** Add days to ISO date */
function addDaysISO(startISO: string, days: number): string {
  const d = parseISO(startISO)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

/** Start of ISO week (Monday) for a date */
function startOfWeekISO(d: Date): Date {
  const day = d.getUTCDay() // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day // move to Monday
  const res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  res.setUTCDate(res.getUTCDate() + diff)
  return res
}

/** End of ISO week (Sunday) for a date */
function endOfWeekISO(d: Date): Date {
  const start = startOfWeekISO(d)
  const res = new Date(start)
  res.setUTCDate(res.getUTCDate() + 6)
  return res
}

/** Start of month (UTC) */
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** End of month (UTC) */
function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

/** IDR currency formatter (compact option for tooltips) */
function fmtIDR(n: number, compact = false): string {
  const f = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  })
  return f.format(isFinite(n) ? n : 0)
}

/** Tooltip formatter for Recharts */
interface ChartTooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string }
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const v = payload[0].value as number
  return (
    <div className="rounded-md border bg-white p-2 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="font-medium">{label}</div>
      <div className="text-blue-600 dark:text-blue-400">{fmtIDR(v)}</div>
    </div>
  )
}

/**
 * RAPGenerator component
 * Allows editing task amounts and generating time-phased RAP.
 */
export default function RAPGenerator({ projectId = 'PRJ-2024-001' }: { projectId?: string }) {
  const { getTasks } = useTimelineStore()
  const tasks = getTasks(projectId)

  // Editable budgets derived from tasks
  const [items, setItems] = useState<TaskBudget[]>([])
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [totalBudget, setTotalBudget] = useState<number>(0)

  // Generated schedule
  const [schedule, setSchedule] = useState<PeriodBucket[]>([])

  // Chart/export ref
  const exportRef = useRef<HTMLDivElement | null>(null)

  const rabItems = useRabStore((s: { getItems?: (id: string) => RABItem[] }) => s.getItems?.(projectId) ?? [])

  /** Import amounts from RAB items linked to tasks */
  const importFromRAB = () => {
    if (!items.length) {
      toast.error('No tasks found to import budget into.')
      return
    }

    // Map taskId -> total cost
    const taskCosts = new Map<string, number>()
    const activeRabItems = Array.isArray(rabItems) ? rabItems : []

    activeRabItems.forEach((item: RABItem) => {
      // Normalize taskId link
      const tid = item.taskId || item.task_id || item.wbsId || item.wbs_id
      if (tid) {
        const cost = Number(item.finalTotal || item.finalPrice || item.final_total || (item.volume * (item.unit_price || item.unitPrice || 0)) || 0)
        taskCosts.set(tid, (taskCosts.get(tid) || 0) + cost)
      }
    })

    let matchedCount = 0
    setItems(prev => prev.map(it => {
      const amt = taskCosts.get(it.taskId)
      if (amt !== undefined) matchedCount++
      return {
        ...it,
        amount: Math.round(amt || 0)
      }
    }))

    const total = Array.from(taskCosts.values()).reduce((a, b) => a + b, 0)
    setTotalBudget(Math.round(total))

    if (matchedCount > 0) {
      toast.success(`Imported Rp ${fmtIDR(total)} from RAB (${matchedCount} tasks matched)`)
    } else {
      toast.warning('No RAB items found with matching Task IDs.')
    }
  }

  /** Initialize items when tasks change */
  useEffect(() => {
    const next: TaskBudget[] = tasks.map((t) => ({
      taskId: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      duration: t.duration,
      amount: 0,
    }))
    setItems(next)
    setSchedule([])
  }, [tasks])

  /** Sum of edited amounts */
  const sumAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.amount) || 0), 0), [items])

  /** Overall time range from tasks */
  const overallRange = useMemo(() => {
    if (!tasks.length) return { start: '', end: '' }
    const start = tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), tasks[0].startDate)
    const end = tasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), tasks[0].endDate)
    return { start, end }
  }, [tasks])

  /** Assign equal amounts per task to match totalBudget */
  const assignEqual = () => {
    if (!items.length) {
      toast.message('No tasks found')
      return
    }
    const eq = Math.floor((totalBudget || 0) / items.length)
    setItems((arr) => arr.map((it) => ({ ...it, amount: eq })))
    toast.success('Assigned equal amounts per task')
  }

  /** Assign proportional to duration to match totalBudget */
  const assignByDuration = () => {
    if (!items.length) {
      toast.message('No tasks found')
      return
    }
    const sumDur = items.reduce((s, it) => s + Math.max(1, it.duration), 0)
    if (!sumDur) {
      toast.message('Invalid durations')
      return
    }
    const total = totalBudget || 0
    setItems((arr) =>
      arr.map((it, idx) => {
        const base = (total * Math.max(1, it.duration)) / sumDur
        // Handle remainder on last item to ensure exact total
        if (idx === arr.length - 1) {
          const rest = total - (arr.slice(0, idx).reduce((s, a) => s + Math.round((total * Math.max(1, a.duration)) / sumDur), 0))
          return { ...it, amount: Math.round(rest) }
        }
        return { ...it, amount: Math.round(base) }
      })
    )
    toast.success('Assigned by duration')
  }

  /** Clear all amounts */
  const clearAmounts = () => {
    setItems((arr) => arr.map((it) => ({ ...it, amount: 0 })))
    toast.message('Cleared amounts')
  }

  /**
   * Generate schedule by distributing each task's amount across its days.
   * Then aggregate by granularity to buckets.
   */
  const generate = () => {
    if (!items.length) {
      toast.message('No tasks to generate')
      return
    }
    const dayMap = new Map<string, number>() // ISO -> amount
    for (const it of items) {
      const dur = Math.max(1, daysInclusive(it.startDate, it.endDate))
      const perDay = (Number(it.amount) || 0) / dur
      for (let i = 0; i < dur; i++) {
        const d = addDaysISO(it.startDate, i)
        dayMap.set(d, (dayMap.get(d) || 0) + perDay)
      }
    }

    if (granularity === 'week') {
      // Build weekly buckets
      const weekly = new Map<string, PeriodBucket>()
      for (const [iso, val] of dayMap) {
        const d = parseISO(iso)
        const s = startOfWeekISO(d)
        const e = endOfWeekISO(d)
        const key = `${toISO(s)}_${toISO(e)}`
        const label = `${toISO(s)} .. ${toISO(e)}`
        const prev = weekly.get(key)
        weekly.set(
          key,
          prev
            ? { ...prev, amount: prev.amount + val }
            : { key, label, start: toISO(s), end: toISO(e), amount: val }
        )
      }
      const arr = Array.from(weekly.values()).sort((a, b) => a.start.localeCompare(b.start))
      setSchedule(arr)
    } else {
      // Monthly buckets
      const monthly = new Map<string, PeriodBucket>()
      for (const [iso, val] of dayMap) {
        const d = parseISO(iso)
        const s = startOfMonthUTC(d)
        const e = endOfMonthUTC(d)
        const key = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}`
        const label = key
        const prev = monthly.get(key)
        monthly.set(
          key,
          prev
            ? { ...prev, amount: prev.amount + val }
            : { key, label, start: toISO(s), end: toISO(e), amount: val }
        )
      }
      const arr = Array.from(monthly.values()).sort((a, b) => a.start.localeCompare(b.start))
      setSchedule(arr)
    }

    toast.success('RAP schedule generated')
  }

  /** Export schedule + task amounts to Excel */
  const exportExcel = () => {
    if (!schedule.length) {
      toast.message('Generate schedule first')
      return
    }
    const ws1 = XLSX.utils.json_to_sheet(
      schedule.map((p) => ({
        period: p.label,
        start: p.start,
        end: p.end,
        amount: Math.round(p.amount),
      }))
    )
    const ws2 = XLSX.utils.json_to_sheet(
      items.map((t) => ({
        task_id: t.taskId,
        task_name: t.name,
        start: t.startDate,
        end: t.endDate,
        duration_days: t.duration,
        amount: Math.round(t.amount),
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'RAP_Schedule')
    XLSX.utils.book_append_sheet(wb, ws2, 'Task_Amounts')
    XLSX.writeFile(wb, `rap-${projectId}-${granularity}.xlsx`)
  }

  /** Export chart + summary to PDF */
  const exportPDF = async () => {
    if (!exportRef.current) {
      toast.message('Nothing to export')
      return
    }
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const ratio = Math.min(pw / canvas.width, ph / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    pdf.addImage(img, 'PNG', (pw - w) / 2, 24, w, h)
    pdf.save(`rap-${projectId}-${granularity}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            RAP Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500">Total Budget</Label>
            <Input
              className="w-48"
              type="number"
              min={0}
              value={Number.isFinite(totalBudget) ? totalBudget : 0}
              onChange={(e) => setTotalBudget(parseInt(e.target.value || '0', 10))}
            />
            <span className="text-xs text-neutral-600">{fmtIDR(totalBudget || 0, true)}</span>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500">Granularity</Label>
            <Select value={granularity} onValueChange={(v: 'week' | 'month') => setGranularity(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={importFromRAB}>
              <FileText className="h-4 w-4" />
              Import from RAB
            </Button>
            <Button variant="outline" className="gap-2" onClick={assignEqual}>
              <Equal className="h-4 w-4" />
              Equal per Task
            </Button>
            <Button variant="outline" className="gap-2" onClick={assignByDuration}>
              <RefreshCcw className="h-4 w-4" />
              By Duration
            </Button>
            <Button variant="ghost" className="gap-2" onClick={clearAmounts}>
              Reset
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button className="gap-2" onClick={generate}>
              <LineChart className="h-4 w-4" />
              Generate Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Tasks</div>
            <div className="text-xl font-semibold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Edited amount</div>
            <div className="text-xl font-semibold">{fmtIDR(Math.round(sumAmount))}</div>
            {totalBudget > 0 && Math.round(sumAmount) !== Math.round(totalBudget) && (
              <div className="text-xs text-red-600">Not equal to Total Budget</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Granularity</div>
            <div className="text-xl font-semibold capitalize">{granularity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Range</div>
            <div className="text-sm font-medium">
              {overallRange.start} → {overallRange.end}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task amount editor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Task Amounts</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-neutral-500">No tasks found. Please set up Timeline first.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Task</th>
                    <th className="px-3 py-2 text-left font-medium">Start</th>
                    <th className="px-3 py-2 text-left font-medium">End</th>
                    <th className="px-3 py-2 text-left font-medium">Days</th>
                    <th className="px-3 py-2 text-left font-medium">Amount (IDR)</th>
                    <th className="px-3 py-2 text-left font-medium">Per-day</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const perDay = Math.round((Number(it.amount) || 0) / Math.max(1, it.duration))
                    return (
                      <tr key={it.taskId} className="border-b last:border-0 dark:border-neutral-800">
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">{it.startDate}</td>
                        <td className="px-3 py-2">{it.endDate}</td>
                        <td className="px-3 py-2 tabular-nums">{it.duration}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            value={Number.isFinite(it.amount) ? it.amount : 0}
                            onChange={(e) => {
                              const v = parseInt(e.target.value || '0', 10)
                              setItems((arr) => {
                                const next = [...arr]
                                next[idx] = { ...next[idx], amount: v }
                                return next
                              })
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{fmtIDR(perDay, true)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2 font-medium" colSpan={4}>
                      Total
                    </td>
                    <td className="px-3 py-2 font-semibold">{fmtIDR(Math.round(sumAmount))}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart + export */}
      <Card ref={exportRef as React.RefObject<HTMLDivElement>}>
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="h-4 w-4 text-blue-600" />
            RAP Schedule ({granularity})
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPDF}>
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={generate}>
              <Download className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!schedule.length ? (
            <div className="text-sm text-neutral-500">No schedule yet. Click Generate Schedule.</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schedule}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtIDR(v as number, true)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="amount" name="Amount" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {schedule.length > 0 && (
            <div className="mt-3 text-xs text-neutral-500">
              Tip: Adjust Task Amounts or Auto-assign, then click Generate Schedule. Export results to Excel/PDF.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
