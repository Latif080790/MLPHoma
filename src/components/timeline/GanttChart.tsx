/**
 * GanttChart.tsx
 *
 * Interactive Gantt chart with:
 * - Tile-based horizontal virtualization
 * - Row virtualization
 * - Canvas-based connector rendering
 * - Worker-based CPM computation
 * - Print/export friendly cloning to avoid tumpang tindih pada export
 *
 * File follows project JSDoc/comment rules.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTimelineStore } from '../../store/timelineStore'
import type { TimelineTask, TaskDependency } from '../../store/timelineStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { Image as ImageIcon, FileText, Activity } from 'lucide-react'
import GanttLegend from './GanttLegend'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { createCpmWorker } from '../../workers/createCpmWorker'

/**
 * Props for GanttChart
 */
export interface GanttChartProps {
  projectId: string
  tasksOverride?: Array<{
    id: string
    name: string
    startDate: string
    endDate: string
    duration?: number
    progress?: number
    status?: string
    dependencies?: Array<{ predecessorId: string; type?: string; lag?: number }>
    baselineStartDate?: string
    baselineEndDate?: string
    wbsId?: string
    wbsCode?: string
  }>
  height?: number
  onTaskClick?: (taskId: string) => void
  onTaskMove?: (taskId: string, newStartDate: string) => void
  highlightCriticalOnly?: boolean
  showCpmTooltip?: boolean
  pxPerDay?: number
  viewMode?: 'day' | 'week' | 'month'
  showTodayLine?: boolean
  showDependencies?: boolean
  selectedTaskId?: string
  showBaseline?: boolean
  onTaskEdit?: (taskId: string) => void
  onTaskDelete?: (taskId: string) => void
}

/**
 * parseISODate
 * Parse YYYY-MM-DD to a UTC Date to avoid timezone drift.
 * @param s ISO date string
 */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * toISODate
 * Convert Date -> YYYY-MM-DD (UTC)
 * @param d Date
 */
function toISODate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .split('T')[0]
}

/**
 * addDaysISO
 * Add days to an ISO date string
 * @param dateISO YYYY-MM-DD
 * @param days number
 */
function addDaysISO(dateISO: string, days: number): string {
  const d = parseISODate(dateISO)
  d.setUTCDate(d.getUTCDate() + days)
  return toISODate(d)
}

/**
 * inclusiveDays
 * Inclusive days difference (>=1)
 * @param startISO
 * @param endISO
 */
function inclusiveDays(startISO: string, endISO: string): number {
  const s = parseISODate(startISO)
  const e = parseISODate(endISO)
  const ms = 1000 * 60 * 60 * 24
  return Math.max(1, Math.floor((e.getTime() - s.getTime()) / ms) + 1)
}

/**
 * buildDates
 * Build array of ISO dates between min..max inclusive.
 * @param minISO
 * @param maxISO
 */
function buildDates(minISO: string, maxISO: string): string[] {
  const out: string[] = []
  let cur = parseISODate(minISO)
  const end = parseISODate(maxISO)
  while (cur.getTime() <= end.getTime()) {
    out.push(toISODate(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/**
 * statusColor
 * Small color helper for status chips
 * @param status
 */
function statusColor(status?: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500'
    case 'in_progress':
      return 'bg-blue-500'
    case 'delayed':
      return 'bg-red-500'
    default:
      return 'bg-neutral-400'
  }
}

/**
 * useWindowSize - return window width (simple hook)
 */
function useWindowSize() {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return { width }
}

/**
 * ProfileSample - single profiling sample snapshot
 */
interface ProfileSample {
  t: number
  scrollTop: number
  scrollLeft: number
  startRow: number
  endRow: number
  startDay: number
  endDay: number
  renderedRows: number
  renderedDays: number
  connectors: number
  renderMsEstimate: number
}

/**
 * Row types used after grouping
 */
type Row =
  | { type: 'group'; groupId: string; label: string; count: number; wbsId?: string }
  | { type: 'task'; taskIndex: number; taskId: string }

/**
 * GanttChart
 *
 * Main component implementing tile-based virtualization, canvas connectors,
 * worker-based CPM, grouping/collapse and profiling capture.
 */
export default function GanttChart({
  projectId,
  tasksOverride,
  height = 560,
  onTaskClick,
  onTaskMove,
  highlightCriticalOnly = false,
  showCpmTooltip = true,
  pxPerDay = 24,
  viewMode = 'week',
  showTodayLine = true,
  showDependencies = true,
  selectedTaskId,
  showBaseline = true,
  onTaskEdit,
  onTaskDelete,
}: GanttChartProps) {
  const { width } = useWindowSize()
  const { getTasks } = useTimelineStore()
  const tasks = tasksOverride ?? getTasks(projectId) ?? []

  /**
   * Visual palette & responsive layout
   */
  const palette = useMemo(
    () => ({
      primary: '#0ea5a4',
      critical: '#ef4444',
      progress: '#16a34a',
      neutral: '#94a3b8',
      bg: '#ffffff',
    }),
    [],
  )
  const leftColWidth = width < 640 ? 240 : width < 1024 ? 300 : 340
  // Increase row height to reduce tumpang tindih; ensure bars are centered
  const rowHeight = width < 640 ? 64 : 72
  const barHeight = 28

  /**
   * Date range and days
   */
  const [minISO, maxISO] = useMemo(() => {
    if (!tasks.length) {
      const t = toISODate(new Date())
      return [t, t] as const
    }
    const min = tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), tasks[0].startDate)
    const max = tasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), tasks[0].endDate)
    return [min, max] as const
  }, [tasks])

  const days = useMemo(() => buildDates(minISO, maxISO), [minISO, maxISO])
  const fullChartWidth = Math.max(800, days.length * pxPerDay)

  /**
   * CPM (moved to worker)
   */
  const [cpmMetrics, setCpmMetrics] = useState<Record<string, any>>({})
  const [criticalIds, setCriticalIds] = useState<Set<string>>(new Set())
  const cpmWorkerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // create worker on mount
    cpmWorkerRef.current = createCpmWorker()
    const w = cpmWorkerRef.current
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data
      if (!d) return
      if (d.id === 'result') {
        setCpmMetrics(d.metrics || {})
        setCriticalIds(new Set(d.criticalIds || []))
      }
    }
    w.addEventListener('message', onMessage)
    return () => {
      if (w) {
        w.removeEventListener('message', onMessage)
        w.terminate()
      }
      cpmWorkerRef.current = null
    }
  }, [])

  useEffect(() => {
    // Post tasks to worker for CPM computation
    const w = cpmWorkerRef.current
    if (!w) return
    try {
      w.postMessage({
        id: 'compute',
        tasks: tasks.map((t) => ({
          id: t.id,
          duration: Math.max(1, t.duration || inclusiveDays(t.startDate, t.endDate)),
          dependencies: t.dependencies || [],
        })),
      })
    } catch (err) {
      // graceful fallback: compute minimal metrics inline
      const fallbackMetrics: Record<string, any> = {}
      tasks.forEach((t) => {
        const dur = Math.max(1, t.duration || inclusiveDays(t.startDate, t.endDate))
        fallbackMetrics[t.id] = { ES: 0, EF: dur, LS: 0, LF: dur, TF: 0 }
      })
      setCpmMetrics(fallbackMetrics)
      setCriticalIds(new Set(tasks.map((t) => t.id)))
    }
  }, [tasks])

  /* -------------------------
   * Perf tuning & profiling states
   * ------------------------- */
  const [tileSizeDays, setTileSizeDays] = useState<number>(120)
  const [connectorRowThreshold, setConnectorRowThreshold] = useState<number>(60)
  const [sampleMs, setSampleMs] = useState<number>(200)
  const [performanceMode, setPerformanceMode] = useState<boolean>(false)
  const [disableShadows, setDisableShadows] = useState<boolean>(false)
  const [disableTooltipsWhileInteracting, setDisableTooltipsWhileInteracting] = useState<boolean>(true)

  useEffect(() => {
    if (performanceMode) {
      setTileSizeDays(180)
      setConnectorRowThreshold(40)
      setDisableShadows(true)
      setDisableTooltipsWhileInteracting(true)
      setSampleMs(250)
    }
    // do not revert user values automatically when performanceMode = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performanceMode])

  /* -------------------------
   * rAF-batched scroll + resize handling
   * ------------------------- */
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [visibleHeight, setVisibleHeight] = useState(height)
  const [visibleWidthPx, setVisibleWidthPx] = useState(900)
  const interactionTimeoutRef = useRef<number | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setVisibleWidthPx(el.clientWidth)
    function onScroll() {
      const st = el!.scrollTop
      const sl = el!.scrollLeft
      setIsInteracting(true)
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      interactionTimeoutRef.current = window.setTimeout(() => setIsInteracting(false), 250)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(st)
        setScrollLeft(sl)
      })
    }
    function onResize() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setVisibleHeight(el!.clientHeight)
        setVisibleWidthPx(el!.clientWidth)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // init
    setScrollTop(el.scrollTop)
    setScrollLeft(el.scrollLeft)
    setVisibleHeight(el.clientHeight)
    setVisibleWidthPx(el.clientWidth)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current)
    }
  }, [containerRef, height])

  /* -------------------------
   * Grouping & Collapse by WBS
   * ------------------------- */
  const [groupByWBS, setGroupByWBS] = useState<boolean>(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  /**
   * buildGroupedRows
   * Build an array of Row entries representing group headers and tasks
   * @returns Row[]
   */
  const rows: Row[] = useMemo(() => {
    if (!groupByWBS) {
      return tasks.map((t, idx) => ({ type: 'task', taskIndex: idx, taskId: t.id }))
    }
    // group by wbsId -> fallback to wbsCode -> fallback to first token or 'Ungrouped'
    const groups = new Map<string, { label: string; indices: number[]; wbsId?: string }>()
    tasks.forEach((t, idx) => {
      const groupKey = (t.wbsId && String(t.wbsId)) || (t.wbsCode && String(t.wbsCode)) || (t.id ? String(t.id).split('-')[0] : 'Ungrouped')
      const label = (t.wbsCode && String(t.wbsCode)) || groupKey || 'Ungrouped'
      if (!groups.has(groupKey)) groups.set(groupKey, { label, indices: [], wbsId: t.wbsId })
      groups.get(groupKey)!.indices.push(idx)
    })
    const out: Row[] = []
    groups.forEach((g, key) => {
      out.push({ type: 'group', groupId: key, label: g.label, count: g.indices.length, wbsId: g.wbsId })
      for (const idx of g.indices) out.push({ type: 'task', taskIndex: idx, taskId: tasks[idx].id })
    })
    return out
  }, [tasks, groupByWBS])

  /**
   * visibleRowsCount
   * Helper to count rows for virtualization; each group header counts as 1,
   * collapsed groups hide their children.
   */
  const effectiveRows: Row[] = useMemo(() => {
    if (!groupByWBS) return rows
    const out: Row[] = []
    let i = 0
    while (i < rows.length) {
      const r = rows[i]
      if (r.type === 'group') {
        out.push(r)
        const collapsed = collapsedGroups[r.groupId]
        // collect its children
        let j = i + 1
        while (j < rows.length && rows[j].type === 'task') {
          if (!collapsed) out.push(rows[j])
          j++
        }
        i = j
      } else {
        out.push(r)
        i++
      }
    }
    return out
  }, [rows, collapsedGroups, groupByWBS])

  /* -------------------------
   * Row virtualization using effectiveRows
   * ------------------------- */
  const overscanRows = 6
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / rowHeight))
  const visibleRowCount = Math.ceil(visibleHeight / rowHeight)
  const startRow = Math.max(0, firstVisibleRow - overscanRows)
  const endRow = Math.min(effectiveRows.length, firstVisibleRow + visibleRowCount + overscanRows)
  const topSpacerHeight = startRow * rowHeight
  const bottomSpacerHeight = Math.max(0, effectiveRows.length * rowHeight - topSpacerHeight - (endRow - startRow) * rowHeight)
  const visibleRowsSlice = effectiveRows.slice(startRow, endRow)

  /* -------------------------
   * Column virtualization (tiles)
   * ------------------------- */
  const overscanDays = 8
  const firstVisibleDay = Math.max(0, Math.floor(scrollLeft / pxPerDay))
  const visibleDayCount = Math.ceil(visibleWidthPx / pxPerDay)
  const startDay = Math.max(0, firstVisibleDay - overscanDays)
  const endDay = Math.min(days.length, firstVisibleDay + visibleDayCount + overscanDays)
  const visibleDays = days.slice(startDay, endDay)
  const visibleDaysOffsetPx = startDay * pxPerDay

  const firstVisibleTile = Math.floor(startDay / tileSizeDays)
  const lastVisibleTile = Math.floor((endDay - 1) / tileSizeDays)
  const tiles: Array<{ tileIndex: number; tileStartDay: number; tileEndDay: number }> = []
  for (let ti = firstVisibleTile; ti <= lastVisibleTile; ti++) {
    const ts = ti * tileSizeDays
    const te = Math.min(days.length, ts + tileSizeDays)
    tiles.push({ tileIndex: ti, tileStartDay: ts, tileEndDay: te })
  }

  /* -------------------------
   * Visible connectors (coords)
   * Using effectiveRows mapping to compute y positions
   * ------------------------- */
  const visibleConnectorCoords = useMemo(() => {
    if (!showDependencies) return []
    const local: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    // helper: map task index in tasks -> row number in effectiveRows
    const taskIndexToRow: Record<number, number> = {}
    effectiveRows.forEach((r, idx) => {
      if (r.type === 'task') taskIndexToRow[r.taskIndex] = idx
    })

    for (let rIdx = startRow; rIdx < endRow; rIdx++) {
      const row = effectiveRows[rIdx]
      if (row.type !== 'task') continue
      const succTask = tasks[row.taskIndex]
      const deps = (succTask.dependencies || []).filter((d) => !d.type || d.type === 'FS')
      deps.forEach((d) => {
        const predIndex = tasks.findIndex((t) => t.id === d.predecessorId)
        if (predIndex === -1) return
        const predRow = taskIndexToRow[predIndex]
        if (predRow == null) return
        if (Math.abs(predRow - rIdx) > connectorRowThreshold) return
        const pred = tasks[predIndex]
        const predEndIndex = Math.max(0, days.indexOf(pred.endDate))
        const succStartIndex = Math.max(0, days.indexOf(succTask.startDate))
        if (predEndIndex === -1 || succStartIndex === -1) return
        // skip outside horizontal window
        const minIndex = Math.min(predEndIndex, succStartIndex)
        const maxIndex = Math.max(predEndIndex, succStartIndex)
        if (maxIndex < startDay || minIndex > endDay) return
        const x1 = leftColWidth + (predEndIndex - startDay) * pxPerDay + 8
        const x2 = leftColWidth + (succStartIndex - startDay) * pxPerDay - 6
        const y1 = predRow * rowHeight + rowHeight / 2
        const y2 = rIdx * rowHeight + rowHeight / 2
        local.push({ x1, y1, x2, y2 })
      })
    }
    return local
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRow, endRow, startDay, endDay, tasks, days, leftColWidth, rowHeight, pxPerDay, showDependencies, connectorRowThreshold, effectiveRows])

  /* -------------------------
   * Canvas overlay for connectors
   * ------------------------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const widthPx = Math.max(1, (endDay - startDay) * pxPerDay + leftColWidth)
    const heightPx = Math.max(1, effectiveRows.length * rowHeight + 40)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(widthPx * dpr)
    canvas.height = Math.floor(heightPx * dpr)
    canvas.style.width = `${widthPx}px`
    canvas.style.height = `${heightPx}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(148,163,184,0.6)'
    ctx.fillStyle = 'rgba(148,163,184,0.75)'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const c of visibleConnectorCoords) {
      const midX = c.x1 + (c.x2 - c.x1) * 0.6
      ctx.beginPath()
      ctx.moveTo(c.x1, c.y1)
      ctx.bezierCurveTo(c.x1 + 24, c.y1, midX - 24, c.y2, midX, c.y2)
      ctx.lineTo(c.x2, c.y2)
      ctx.stroke()
      const ax = c.x2
      const ay = c.y2
      ctx.beginPath()
      ctx.moveTo(ax - 6, ay - 4)
      ctx.lineTo(ax, ay)
      ctx.lineTo(ax - 6, ay + 4)
      ctx.fill()
    }
  }, [visibleConnectorCoords, startDay, endDay, pxPerDay, leftColWidth, rowHeight, effectiveRows.length])

  /* -------------------------
   * Profiling capture + analysis (local)
   * ------------------------- */
  const renderStartRef = useRef<number>(0)
  renderStartRef.current = performance.now()
  const [captureRunning, setCaptureRunning] = useState(false)
  const captureRef = useRef<ProfileSample[]>([])
  const captureIntervalRef = useRef<number | null>(null)
  const captureTimerRef = useRef<number | null>(null)
  const [lastMetrics, setLastMetrics] = useState<ProfileSample | null>(null)
  const [lastAnalysis, setLastAnalysis] = useState<any | null>(null)

  /**
   * startCapture
   * Start short capture and collect ProfileSample entries
   * @param durationMs total capture duration
   * @param sampleIntervalMs sampling interval
   */
  function startCapture(durationMs = 5000, sampleIntervalMs = 200) {
    if (captureRunning) return
    captureRef.current = []
    setCaptureRunning(true)
    function sample() {
      const s: ProfileSample = {
        t: performance.now(),
        scrollTop,
        scrollLeft,
        startRow,
        endRow,
        startDay,
        endDay,
        renderedRows: endRow - startRow,
        renderedDays: endDay - startDay,
        connectors: visibleConnectorCoords.length,
        renderMsEstimate: Math.round(performance.now() - renderStartRef.current),
      }
      captureRef.current.push(s)
      setLastMetrics(s)
    }
    sample()
    captureIntervalRef.current = window.setInterval(sample, sampleIntervalMs)
    captureTimerRef.current = window.setTimeout(() => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
        captureIntervalRef.current = null
      }
      setCaptureRunning(false)
    }, durationMs)
  }

  /**
   * runPerfAnalyze
   * Capture for durationMs, compute aggregations and suggestions.
   * @param durationMs capture duration
   * @param sampleIntervalMs sample interval
   */
  async function runPerfAnalyze(durationMs = 10000, sampleIntervalMs = 200) {
    if (captureRunning) return
    captureRef.current = []
    setCaptureRunning(true)
    startCapture(durationMs, sampleIntervalMs)
    await new Promise((res) => setTimeout(res, durationMs + 250))
    setCaptureRunning(false)
    const samples = captureRef.current.slice()
    const n = samples.length || 1
    const avgRenderedRows = Math.round(samples.reduce((s, it) => s + it.renderedRows, 0) / n)
    const avgRenderedDays = Math.round(samples.reduce((s, it) => s + it.renderedDays, 0) / n)
    const avgConnectors = Math.round(samples.reduce((s, it) => s + it.connectors, 0) / n)
    const avgRenderMs = Math.round(samples.reduce((s, it) => s + it.renderMsEstimate, 0) / n)
    const peakRenderedRows = Math.max(...samples.map((s) => s.renderedRows), 0)
    const peakRenderedDays = Math.max(...samples.map((s) => s.renderedDays), 0)
    const peakConnectors = Math.max(...samples.map((s) => s.connectors), 0)
    const suggestions: string[] = []

    if (avgRenderedDays > 200 || peakRenderedDays > 400) {
      suggestions.push(
        `Large horizontal window (avg ${avgRenderedDays} days). Increase tileSizeDays (currently ${tileSizeDays}) to lower per-day DOM.`,
      )
    } else if (avgRenderedDays > 80) {
      suggestions.push(`Moderate horizontal window (avg ${avgRenderedDays} days). Consider increasing tileSizeDays or reduce label frequency.`)
    } else {
      suggestions.push('Horizontal rendering looks reasonable.')
    }

    if (avgConnectors > 150 || peakConnectors > 300) {
      suggestions.push(
        `Many connectors (avg ${avgConnectors}). Consider reducing connectorRowThreshold, aggregating connectors, or keep canvas connectors.`,
      )
    } else {
      suggestions.push('Connector rendering within acceptable range.')
    }

    if (avgRenderMs > 120) {
      suggestions.push(`High render time (avg ${avgRenderMs}ms). Consider disabling shadows/gradients and tooltips during interactions.`)
    } else if (avgRenderMs > 60) {
      suggestions.push(`Moderate render time (avg ${avgRenderMs}ms). Try adjusting overscan and visual effects.`)
    } else {
      suggestions.push('Rendering latency is low.')
    }

    if (avgRenderedRows > 500 || peakRenderedRows > 800) {
      suggestions.push('Many rows rendered. Consider grouping WBS items or server-side pagination for very large projects.')
    } else {
      suggestions.push('Row rendering is acceptable.')
    }

    const result = {
      capturedAt: new Date().toISOString(),
      samples,
      avgRenderedRows,
      avgRenderedDays,
      avgConnectors,
      avgRenderMs,
      peakRenderedRows,
      peakRenderedDays,
      peakConnectors,
      suggestions,
    }
    setLastAnalysis(result)
    // open JSON for inspection
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return result
  }

  /* -------------------------
   * Drag handling (kept minimal)
   * ------------------------- */
  const dragRef = useRef<{ id: string; startX: number; origStartISO: string } | null>(null)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const deltaDays = Math.round(dx / pxPerDay)
      const newStart = addDaysISO(drag.origStartISO, deltaDays)
      if (containerRef.current) containerRef.current.setAttribute('data-drag-preview', newStart)
    }
    function onUp(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = (e && typeof (e as any).clientX === 'number' && drag.startX != null) ? (e.clientX - drag.startX) : 0
      const deltaDays = Math.round(dx / pxPerDay)
      const newStart = addDaysISO(drag.origStartISO, deltaDays)
      const id = drag.id
      dragRef.current = null
      if (containerRef.current) containerRef.current.removeAttribute('data-drag-preview')
      if (deltaDays !== 0 && onTaskMove) onTaskMove(id, newStart)
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current)
      setIsInteracting(true)
      interactionTimeoutRef.current = window.setTimeout(() => setIsInteracting(false), 250)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    if (dragRef.current) {
      setIsInteracting(true)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onTaskMove, pxPerDay])

  function startDrag(id: string, startX: number, origStartISO: string) {
    dragRef.current = { id, startX, origStartISO }
  }

  /* -------------------------
   * Selection & keyboard navigation (row indices map to effectiveRows)
   * ------------------------- */
  const [selectedIndex, setSelectedIndex] = useState<number>(() => {
    if (!selectedTaskId) return -1
    return tasks.findIndex((t) => t.id === selectedTaskId)
  })
  useEffect(() => {
    if (selectedTaskId) {
      const idx = tasks.findIndex((t) => t.id === selectedTaskId)
      setSelectedIndex(idx)
    }
  }, [selectedTaskId, tasks])
  useEffect(() => {
    if (selectedIndex < 0 || !containerRef.current) return
    const el = containerRef.current
    const rowTop = selectedIndex * rowHeight
    const rowBottom = rowTop + rowHeight
    if (rowTop < el.scrollTop) {
      window.requestAnimationFrame(() => el.scrollTo({ top: Math.max(0, rowTop - rowHeight * 2), behavior: 'smooth' }))
    } else if (rowBottom > el.scrollTop + el.clientHeight) {
      window.requestAnimationFrame(() =>
        el.scrollTo({ top: Math.min(effectiveRows.length * rowHeight, rowBottom - el.clientHeight + rowHeight * 2), behavior: 'smooth' }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, rowHeight, effectiveRows.length])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!tasks.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(tasks.length - 1, Math.max(0, selectedIndex + 1))
      setSelectedIndex(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(0, selectedIndex - 1)
      setSelectedIndex(prev)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const t = tasks[selectedIndex]
      if (t && onTaskMove) {
        const newStart = addDaysISO(t.startDate, -1)
        onTaskMove(t.id, newStart)
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const t = tasks[selectedIndex]
      if (t && onTaskMove) {
        const newStart = addDaysISO(t.startDate, 1)
        onTaskMove(t.id, newStart)
      }
    } else if (e.key === 'Enter') {
      const t = tasks[selectedIndex]
      if (t && onTaskEdit) onTaskEdit(t.id)
    }
  }

  /* -------------------------
   * Export PNG / PDF (print-friendly clone)
   * ------------------------- */
  const exportRef = useRef<HTMLDivElement | null>(null)

  /**
   * makePrintClone
   * Clone chart area and prepare for print/export:
   * - Replace canvas with its dataURL image
   * - Remove sticky positioning and hover/shadow effects
   * - Increase row height for clarity
   * @returns cloned HTMLElement appended offscreen
   */
  function makePrintClone() {
    if (!exportRef.current) return null
    const original = exportRef.current
    const clone = original.cloneNode(true) as HTMLElement

    // Replace canvas with image from original canvasRef
    const origCanvas = canvasRef.current
    if (origCanvas) {
      try {
        const data = origCanvas.toDataURL('image/png')
        const cloneCanvas = clone.querySelector('canvas')
        if (cloneCanvas && cloneCanvas.parentElement) {
          const img = document.createElement('img')
          img.src = data
          // scale the image size to CSS size
          img.style.width = origCanvas.style.width || `${(endDay - startDay) * pxPerDay}px`
          img.style.height = origCanvas.style.height || `${Math.max(1, effectiveRows.length * rowHeight)}px`
          img.style.display = 'block'
          cloneCanvas.parentElement.replaceChild(img, cloneCanvas)
        }
      } catch (err) {
        // ignore if canvas cannot be serialized
      }
    }

    // Remove sticky styles and interactive artifacts
    clone.querySelectorAll('.sticky').forEach((el) => {
      const he = el as HTMLElement
      he.classList.remove('sticky')
      he.style.position = 'static'
      he.style.top = ''
      he.style.zIndex = ''
    })
    // Remove hover/transform classes and shadows
    clone.querySelectorAll('*').forEach((n) => {
      const el = n as HTMLElement
      if (el.style) {
        // remove transitions/transform/shadows to get a clean snapshot
        el.style.transition = 'none'
        el.style.transform = 'none'
        el.style.boxShadow = 'none'
      }
      // remove hover-only classes that may cause visual differences
      if (el.className && typeof el.className === 'string') {
        el.className = el.className
          .split(' ')
          .filter((c) => !c.startsWith('hover:') && c !== 'ring-2' && c !== 'ring-sky-300')
          .join(' ')
      }
    })

    // Add print-friendly adjustments
    clone.style.background = palette.bg
    clone.style.color = '#111827'
    clone.style.width = original.style.width || `${(endDay - startDay) * pxPerDay + leftColWidth}px`

    // Make rows slightly taller for print readability
    clone.querySelectorAll('[role="row"]').forEach((r) => {
      const el = r as HTMLElement
      el.style.height = `${rowHeight + 8}px`
      el.style.lineHeight = `${rowHeight + 8}px`
    })

    // Place offscreen and append
    clone.style.position = 'fixed'
    clone.style.left = '-20000px'
    clone.style.top = '0'
    clone.style.padding = '20px'
    document.body.appendChild(clone)
    return clone
  }

  async function exportPNG() {
    const clone = makePrintClone()
    if (!clone) return
    try {
      const canvas = await html2canvas(clone as HTMLElement, { backgroundColor: palette.bg, scale: 2, useCORS: true })
      const url = canvas.toDataURL('image/png', 1.0)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt-${projectId}.png`
      a.click()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Export PNG failed', err)
    } finally {
      document.body.removeChild(clone)
    }
  }
  async function exportPDF() {
    const clone = makePrintClone()
    if (!clone) return
    try {
      const canvas = await html2canvas(clone as HTMLElement, { backgroundColor: palette.bg, scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
      const w = canvas.width * ratio
      const h = canvas.height * ratio
      pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h)
      pdf.save(`gantt-${projectId}.pdf`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Export PDF failed', err)
    } finally {
      document.body.removeChild(clone)
    }
  }

  /* -------------------------
   * Header month spans computed for visible days only
   * ------------------------- */
  const monthSpans = useMemo(() => {
    const spans: Array<{ label: string; startIndex: number; width: number }> = []
    if (!visibleDays.length) return spans
    let curMonth = -1
    let startIndex = startDay
    visibleDays.forEach((d, i) => {
      const globalIdx = startDay + i
      const dt = parseISODate(d)
      const m = dt.getUTCMonth()
      if (m !== curMonth) {
        if (globalIdx > startDay) {
          const prevDt = parseISODate(days[globalIdx - 1])
          spans.push({
            label: prevDt.toLocaleString('en', { month: 'short', year: 'numeric' }),
            startIndex,
            width: (globalIdx - startIndex) * pxPerDay,
          })
        }
        curMonth = m
        startIndex = globalIdx
      }
      if (globalIdx === endDay - 1) {
        spans.push({
          label: dt.toLocaleString('en', { month: 'short', year: 'numeric' }),
          startIndex,
          width: (globalIdx - startIndex + 1) * pxPerDay,
        })
      }
    })
    return spans
  }, [visibleDays, startDay, endDay, days, pxPerDay])

  const todayISO = toISODate(new Date())
  const todayIndex = days.indexOf(todayISO)

  /* -------------------------
   * Render
   * ------------------------- */
  return (
    <div className="rounded-lg border bg-white/60 dark:bg-neutral-900/60 dark:border-neutral-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-white/80 dark:bg-neutral-900/80">
        <div>
          <div className="text-base font-semibold">Project Schedule</div>
          <div className="text-xs text-neutral-500">Tiles + canvas connectors · Perf mode available</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            title="Export PNG"
            className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={exportPNG}
          >
            <ImageIcon className="h-4 w-4" />
            PNG
          </button>
          <button
            title="Export PDF (A4)"
            className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={exportPDF}
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>

          <button
            title="Start profiling capture (5s)"
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${captureRunning ? 'bg-yellow-50' : ''}`}
            onClick={() => {
              if (!captureRunning) startCapture(5000, sampleMs)
            }}
          >
            <Activity className="h-4 w-4" />
            {captureRunning ? 'Capturing…' : 'Start capture'}
          </button>

          <div className="hidden md:flex">
            <GanttLegend compact={width < 900} palette={{ primary: palette.primary, critical: palette.critical, progress: palette.progress }} />
          </div>
        </div>
      </div>

      {/* Performance controls + grouping */}
      <div className="px-4 py-3 border-b bg-white/80 dark:bg-neutral-900/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={performanceMode} onChange={(e) => setPerformanceMode(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm">Performance Mode</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-xs text-neutral-500">Tile days</span>
            <input
              type="number"
              className="w-20 rounded border px-2 py-1 text-sm"
              value={tileSizeDays}
              onChange={(e) => setTileSizeDays(Math.max(10, Number(e.target.value)))}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-xs text-neutral-500">Connector rows</span>
            <input
              type="number"
              className="w-20 rounded border px-2 py-1 text-sm"
              value={connectorRowThreshold}
              onChange={(e) => setConnectorRowThreshold(Math.max(1, Number(e.target.value)))}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={groupByWBS} onChange={(e) => setGroupByWBS(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm">Group by WBS</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={disableShadows} onChange={(e) => setDisableShadows(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm">Disable shadows</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={disableTooltipsWhileInteracting} onChange={(e) => setDisableTooltipsWhileInteracting(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm">Disable tooltips while interacting</span>
          </label>

          <button
            className="rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={async () => {
              try {
                await runPerfAnalyze(8000, sampleMs)
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Perf analyze failed', err)
              }
            }}
          >
            Run Analysis (8s)
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="relative overflow-auto outline-none" style={{ height }} onKeyDown={handleKeyDown} tabIndex={0} role="region" aria-label="Gantt chart">
        <div ref={exportRef} style={{ width: (endDay - startDay) * pxPerDay + leftColWidth }}>
          {/* Sticky headers */}
          <div className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-neutral-900/70">
            <div className="flex items-center border-b" style={{ height: 44 }}>
              <div className="flex items-center justify-start px-4 border-r text-sm text-neutral-600 dark:text-neutral-300" style={{ width: leftColWidth }}>
                Tasks
              </div>
              <div className="relative" style={{ width: (endDay - startDay) * pxPerDay }}>
                {monthSpans.map((m, i) => (
                  <div key={i} className="absolute top-0 h-9 px-2 text-xs text-neutral-600 dark:text-neutral-300 flex items-center" style={{ left: (m.startIndex - startDay) * pxPerDay, width: m.width }}>
                    <div className="truncate">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center border-b" style={{ height: 36 }}>
              <div className="flex items-center px-4 border-r text-[12px] text-neutral-500" style={{ width: leftColWidth }}>
                ID / Title
              </div>

              <div className="relative" style={{ width: (endDay - startDay) * pxPerDay }}>
                {tiles.map((tile) => {
                  const tileLeftPx = (tile.tileStartDay - startDay) * pxPerDay
                  const tileWidthPx = (tile.tileEndDay - tile.tileStartDay) * pxPerDay
                  const labelStep = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 7
                  return (
                    <div key={tile.tileIndex} className="absolute top-0 h-8" style={{ left: tileLeftPx, width: tileWidthPx }}>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px)`,
                          backgroundSize: `${pxPerDay}px 100%`,
                        }}
                      />
                      {Array.from({ length: tile.tileEndDay - tile.tileStartDay }).map((_, di) => {
                        const globalIdx = tile.tileStartDay + di
                        const left = di * pxPerDay
                        const showLabel = (globalIdx - startDay) % labelStep === 0
                        const d = days[globalIdx]
                        const dow = parseISODate(d).getUTCDay()
                        const label = viewMode === 'month' ? `${new Date(d).toISOString().slice(8, 10)}` : ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow]
                        return (
                          <div key={globalIdx} className="absolute top-0 h-8 border-l text-[11px] text-neutral-500 flex items-center px-1 select-none" style={{ left, width: pxPerDay }} title={d}>
                            {showLabel ? <div className="text-[11px]">{label}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Grid + weekend shading */}
          <div className="relative" style={{ minWidth: (endDay - startDay) * pxPerDay + leftColWidth }}>
            {tiles.map((tile) => {
              const tileLeftPx = (tile.tileStartDay - startDay) * pxPerDay + leftColWidth
              const tileWidthPx = (tile.tileEndDay - tile.tileStartDay) * pxPerDay
              return (
                <div key={`bg-${tile.tileIndex}`} className="absolute top-0" style={{ left: tileLeftPx, width: tileWidthPx, height: effectiveRows.length * rowHeight }}>
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px)`,
                      backgroundSize: `${pxPerDay}px 100%`,
                    }}
                  />
                </div>
              )
            })}

            {visibleDays.map((d, i) => {
              const globalIdx = startDay + i
              const dow = parseISODate(d).getUTCDay()
              if (dow === 0 || dow === 6) {
                return <div key={`wk-${d}`} className="absolute top-0 h-full pointer-events-none" style={{ left: leftColWidth + i * pxPerDay, width: pxPerDay, background: 'linear-gradient(90deg, rgba(148,163,184,0.03), rgba(148,163,184,0.01))' }} />
              }
              return null
            })}

            {showTodayLine && todayIndex >= startDay && todayIndex < endDay ? (
              <div className="absolute pointer-events-none z-20" style={{ left: leftColWidth + (todayIndex - startDay) * pxPerDay - 1, top: 6, height: effectiveRows.length * rowHeight + 30 }} aria-hidden="true">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="text-[11px] px-2 py-0.5 rounded-full text-white shadow-sm" style={{ background: palette.critical }}>
                    {todayISO}
                  </div>
                </div>
                <div className="w-px h-full" style={{ background: `${palette.critical}cc`, marginLeft: '0.5px' }} />
              </div>
            ) : null}

            {/* top spacer */}
            <div style={{ height: topSpacerHeight }} />

            {/* Visible rows (group headers & tasks) */}
            <div role="grid" aria-rowcount={effectiveRows.length}>
              {visibleRowsSlice.map((r, idx) => {
                const globalRowIndex = startRow + idx
                if (r.type === 'group') {
                  const collapsed = !!collapsedGroups[r.groupId]
                  return (
                    <div key={`group-${r.groupId}`} role="row" style={{ height: rowHeight }} className="relative">
                      <div
                        className={`sticky left-0 z-10 flex items-center gap-3 px-4 text-sm bg-white/95 dark:bg-neutral-900/95 border-b border-r hover:bg-neutral-50 dark:hover:bg-neutral-800/60`}
                        style={{ top: 0, width: leftColWidth }}
                      >
                        <button
                          className="mr-2 rounded px-2 py-1 text-xs border"
                          onClick={() => setCollapsedGroups((s) => ({ ...s, [r.groupId]: !s[r.groupId] }))}
                        >
                          {collapsed ? '+' : '−'}
                        </button>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{r.label}</div>
                          <div className="text-[12px] text-neutral-500">{r.count} items</div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // task row
                const t = tasks[r.taskIndex]
                const startIndex = Math.max(0, days.indexOf(t.startDate))
                const duration = Math.max(1, t.duration || inclusiveDays(t.startDate, t.endDate))
                const leftPx = (startIndex - startDay) * pxPerDay + leftColWidth
                const widthPx = duration * pxPerDay
                const isCritical = criticalIds.has(t.id)
                const isSelected = r.taskIndex === selectedIndex

                const leftCellBase = `sticky left-0 z-10 flex items-center gap-3 px-4 text-sm bg-white/95 dark:bg-neutral-900/95 border-b border-r ${isSelected ? 'ring-2 ring-sky-300' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`

                // keep bars slightly inset vertically so baseline can sit below
                const barTop = (rowHeight - barHeight) / 2
                const barStyle = {
                  left: Math.max(leftColWidth + 4, leftPx),
                  width: Math.max(6, widthPx - 4),
                  top: barTop,
                  height: barHeight,
                  background: isCritical ? (disableShadows ? palette.critical : `linear-gradient(90deg, ${palette.critical}CC, ${palette.critical})`) : (disableShadows ? palette.primary : `linear-gradient(90deg, ${palette.primary}CC, ${palette.primary})`),
                  borderColor: isCritical ? `${palette.critical}99` : `${palette.primary}99`,
                  boxShadow: disableShadows ? 'none' : isCritical ? '0 6px 18px rgba(239,68,68,0.12)' : '0 4px 12px rgba(14,165,164,0.08)',
                } as React.CSSProperties

                const dimmed = highlightCriticalOnly && !isCritical ? 'opacity-30 saturate-50' : ''

                const shouldUseTooltip = showCpmTooltip && !isInteracting && !(disableTooltipsWhileInteracting && isInteracting)

                const barNode = (
                  <div
                    id={`gantt-bar-${t.id}`}
                    role="gridcell"
                    aria-label={`${t.name} ${t.startDate} to ${t.endDate}`}
                    tabIndex={0}
                    className={`absolute rounded-xl border transition-none ${dimmed}`}
                    style={barStyle}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      startDrag(t.id, e.clientX, t.startDate)
                    }}
                    onClick={() => {
                      setSelectedIndex(r.taskIndex)
                      onTaskClick?.(t.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onTaskEdit?.(t.id)
                    }}
                    title={`${t.startDate} → ${t.endDate} (${duration}d)`}
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-l-xl"
                      style={{
                        width: `${Math.max(0, Math.min(100, t.progress ?? 0))}%`,
                        background: palette.progress,
                        opacity: 0.95,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
                      <span className="text-[12px] font-semibold text-white truncate">{Math.round(t.progress ?? 0)}%</span>
                    </div>
                  </div>
                )

                return (
                  <div key={t.id} role="row" aria-rowindex={globalRowIndex + 1} style={{ height: rowHeight }} className="relative">
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id={`gantt-task-${t.id}`}
                          className={leftCellBase}
                          style={{ top: 0, width: leftColWidth }}
                          onClick={() => {
                            setSelectedIndex(r.taskIndex)
                            onTaskClick?.(t.id)
                          }}
                          tabIndex={0}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${statusColor(t.status)} ring-2 ring-white`} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{t.name}</div>
                            <div className="text-[12px] text-neutral-500 truncate" style={{ maxWidth: leftColWidth - 80 }}>
                              {t.id.slice(0, 10)} • {t.startDate} → {t.endDate}
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-44">
                        <div className="px-2 py-1.5 text-xs text-neutral-500">{t.name}</div>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onTaskEdit?.(t.id)}>Edit task</ContextMenuItem>
                        <ContextMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onTaskDelete?.(t.id)}>
                          Delete task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    <div className="absolute left-0 right-0" style={{ left: leftColWidth, top: 0 }}>
                      <div className="relative" style={{ width: (endDay - startDay) * pxPerDay, height: rowHeight }}>
                        {showBaseline && t.baselineStartDate && t.baselineEndDate ? (
                          <div
                            className="absolute h-1.5 rounded-sm border border-dashed border-neutral-300"
                            style={{
                              left: (Math.max(0, days.indexOf(t.baselineStartDate)) - startDay) * pxPerDay,
                              width: Math.max(1, inclusiveDays(t.baselineStartDate, t.baselineEndDate)) * pxPerDay,
                              top: barTop + barHeight + 6, // baseline sits below bar
                              background: 'rgba(148,163,184,0.06)',
                            }}
                            aria-label="Baseline"
                          />
                        ) : null}

                        {shouldUseTooltip && cpmMetrics[t.id] ? (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>{barNode}</ContextMenuTrigger>
                                  <ContextMenuContent className="w-44">
                                    <div className="px-2 py-1.5 text-xs text-neutral-500">{t.name}</div>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onSelect={() => onTaskEdit?.(t.id)}>Edit task</ContextMenuItem>
                                    <ContextMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onTaskDelete?.(t.id)}>
                                      Delete task
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <div className="mb-1 font-medium">{t.name}</div>
                                <div className="grid grid-cols-5 gap-2">
                                  <span>
                                    <b>ES</b>: {cpmMetrics[t.id].ES}
                                  </span>
                                  <span>
                                    <b>EF</b>: {cpmMetrics[t.id].EF}
                                  </span>
                                  <span>
                                    <b>LS</b>: {cpmMetrics[t.id].LS}
                                  </span>
                                  <span>
                                    <b>LF</b>: {cpmMetrics[t.id].LF}
                                  </span>
                                  <span>
                                    <b>TF</b>: {cpmMetrics[t.id].TF}
                                  </span>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>{barNode}</ContextMenuTrigger>
                            <ContextMenuContent className="w-44">
                              <div className="px-2 py-1.5 text-xs text-neutral-500">{t.name}</div>
                              <ContextMenuSeparator />
                              <ContextMenuItem onSelect={() => onTaskEdit?.(t.id)}>Edit task</ContextMenuItem>
                              <ContextMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onTaskDelete?.(t.id)}>
                                Delete task
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* bottom spacer */}
            <div style={{ height: bottomSpacerHeight }} />

            {/* Canvas for connectors positioned absolute */}
            <canvas ref={canvasRef} className="absolute left-0 top-0 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* mobile legend */}
      <div className="md:hidden px-4 py-3 border-t bg-white/70 dark:bg-neutral-900/70">
        <GanttLegend compact palette={{ primary: palette.primary, critical: palette.critical, progress: palette.progress }} />
      </div>

      {/* Lightweight Analysis results */}
      <div className="mt-3 rounded-lg border bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 mx-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Automated Perf Analysis</div>
            <div className="text-xs text-neutral-500">Run capture to receive guidance and downloadable JSON.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={async () => {
                try {
                  // start 10s analysis
                  const res = await runPerfAnalyze(10000, sampleMs)
                  // open JSON already handled inside runPerfAnalyze
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('Perf analyze failed', err)
                }
              }}
            >
              Run 10s Analysis
            </button>
            <button
              className="rounded-md border px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => {
                if (!captureRef.current || !captureRef.current.length) return
                const blob = new Blob([JSON.stringify(captureRef.current, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `gantt-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export JSON
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm">
          {captureRunning && <div className="text-neutral-600">Capturing metrics — interact with the chart (scroll/drag) to simulate real usage.</div>}
          {!captureRunning && !captureRef.current.length && <div className="text-neutral-500">No analysis run yet.</div>}
          {lastMetrics && (
            <div className="mt-2 grid gap-2">
              <div className="text-xs text-neutral-500">Last sample at: {new Date(lastMetrics.t).toISOString()}</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-2">
                  <div className="text-xs text-neutral-500">Rendered rows</div>
                  <div className="text-lg font-semibold">{lastMetrics.renderedRows}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-neutral-500">Rendered days</div>
                  <div className="text-lg font-semibold">{lastMetrics.renderedDays}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-neutral-500">Connectors</div>
                  <div className="text-lg font-semibold">{lastMetrics.connectors}</div>
                </div>
              </div>
            </div>
          )}

          {lastAnalysis && (
            <div className="mt-3">
              <div className="text-xs text-neutral-500">Analysis suggestions:</div>
              <ul className="list-disc list-inside text-sm mt-1">
                {lastAnalysis.suggestions?.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
