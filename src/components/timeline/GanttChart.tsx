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
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu'

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
    assignedResources?: string[]
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
  /** v4 Sprint 3 — Item 13: Resize right edge to change end date */
  onTaskResize?: (taskId: string, newEndDate: string) => void
  onAutoSchedule?: (tasks: import('../../store/timelineStore').TimelineTask[]) => void
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
  const start = parseISODate(minISO)
  const end = parseISODate(maxISO)
  let cur = start
  while (cur.getTime() <= end.getTime()) {
    out.push(toISODate(cur))
    const next = new Date(cur)
    next.setUTCDate(next.getUTCDate() + 1)
    cur = next
  }
  return out
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
  onTaskResize,
}: GanttChartProps) {
  const { width } = useWindowSize()
  const { getTasks } = useTimelineStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => tasksOverride ?? getTasks(projectId) ?? [], [tasksOverride, projectId])

  /**
   * Visual palette & responsive layout
   */
  const palette = useMemo(
    () => ({
      primary: 'rgb(var(--brand-primary-500))',
      critical: 'rgb(var(--color-status-danger-border))',
      line: 'rgb(var(--neutral-400))',
      progress: 'rgba(255, 255, 255, 0.3)',
      bg: 'rgb(var(--neutral-0))',
      rowAlt: 'rgba(var(--neutral-100), 0.3)',
    }),
    [],
  )
  const defaultLeftColWidth = width < 640 ? 220 : width < 1024 ? 300 : 360
  const [userLeftColWidth, setUserLeftColWidth] = useState<number | null>(null)
  const leftColWidth = userLeftColWidth ?? defaultLeftColWidth
  
  // Row height: 52px = accommodates 2-line content (name + date/duration)
  // Must match HTML left-panel row height exactly to keep bar alignment
  const rowHeight = 52
  const barHeight = 24
  const barRadius = 6

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
  const _fullChartWidth = Math.max(800, days.length * pxPerDay)

  /**
   * CPM (moved to worker)
   */
  const [cpmMetrics, setCpmMetrics] = useState<Record<string, { ES: number; EF: number; LS: number; LF: number; TF: number }>>({})
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
    } catch {
      // graceful fallback: compute minimal metrics inline
      const fallbackMetrics: Record<string, { ES: number; EF: number; LS: number; LF: number; TF: number }> = {}
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

  const [performanceMode, setPerformanceMode] = useState<boolean>(false)
  const [disableShadows, setDisableShadows] = useState<boolean>(false)
  const [disableTooltipsWhileInteracting, setDisableTooltipsWhileInteracting] = useState<boolean>(true)

  useEffect(() => {
    if (performanceMode) {
      setTileSizeDays(180)
      setConnectorRowThreshold(40)
      setDisableShadows(true)
      setDisableTooltipsWhileInteracting(true)

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

  // Auto-scroll to today on first task load
  const didAutoScrollRef = useRef(false)
  useEffect(() => {
    if (didAutoScrollRef.current || !containerRef.current || tasks.length === 0 || todayIndex < 0) return
    didAutoScrollRef.current = true
    const el = containerRef.current
    const visibleW = el.clientWidth - leftColWidth
    // Position today at ~1/3 from left of visible chart area
    const targetScroll = Math.max(0, (todayIndex - startDay) * pxPerDay - visibleW / 3)
    el.scrollLeft = targetScroll
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length])

  /* -------------------------
   * Grouping & Collapse by WBS
   * ------------------------- */
  const [groupByWBS, setGroupByWBS] = useState<boolean>(true)
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
  const _visibleDaysOffsetPx = startDay * pxPerDay

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
    const local: Array<{ x1: number; y1: number; x2: number; y2: number; type: string; color: string; label?: string }> = []
    const colorMap: Record<string, string> = { FS: '#6366f1', SS: '#a855f7', FF: '#22c55e', SF: '#f97316' }
    // helper: map task index in tasks -> row number in effectiveRows
    const taskIndexToRow: Record<number, number> = {}
    effectiveRows.forEach((r, idx) => {
      if (r.type === 'task') taskIndexToRow[r.taskIndex] = idx
    })

    for (let rIdx = startRow; rIdx < endRow; rIdx++) {
      const row = effectiveRows[rIdx]
      if (row.type !== 'task') continue
      const succTask = tasks[row.taskIndex]
      const deps = succTask.dependencies || []
      deps.forEach((d) => {
        const predIndex = tasks.findIndex((t) => t.id === d.predecessorId)
        if (predIndex === -1) return
        const predRow = taskIndexToRow[predIndex]
        if (predRow == null) return
        if (Math.abs(predRow - rIdx) > connectorRowThreshold) return
        const pred = tasks[predIndex]
        const predEndIndex = Math.max(0, days.indexOf(pred.endDate))
        const predStartIndex = Math.max(0, days.indexOf(pred.startDate))
        const succStartIndex = Math.max(0, days.indexOf(succTask.startDate))
        const succEndIndex = Math.max(0, days.indexOf(succTask.endDate))
        const depType = d.type ?? 'FS'
        const lag = d.lag ?? 0
        let x1: number, x2: number
        switch (depType) {
          case 'SS':
            x1 = leftColWidth + (predStartIndex - startDay) * pxPerDay
            x2 = leftColWidth + (succStartIndex - startDay) * pxPerDay
            break
          case 'FF':
            x1 = leftColWidth + (predEndIndex - startDay) * pxPerDay
            x2 = leftColWidth + (succEndIndex - startDay) * pxPerDay
            break
          case 'SF':
            x1 = leftColWidth + (predStartIndex - startDay) * pxPerDay
            x2 = leftColWidth + (succEndIndex - startDay) * pxPerDay
            break
          default: // FS
            x1 = leftColWidth + (predEndIndex - startDay) * pxPerDay
            x2 = leftColWidth + (succStartIndex - startDay) * pxPerDay
        }
        // skip outside horizontal window
        const minX = Math.min(x1, x2) - leftColWidth + startDay
        const maxX = Math.max(x1, x2) - leftColWidth + startDay
        if (maxX < startDay || minX > endDay) return
        const y1 = predRow * rowHeight + rowHeight / 2
        const y2 = rIdx * rowHeight + rowHeight / 2
        const color = colorMap[depType] || '#6366f1'
        const label = lag !== 0 ? `${lag > 0 ? '+' : ''}${lag}d` : undefined
        local.push({ x1, y1, x2, y2, type: depType, color, label })
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
    
    // Pro Palette for Connectors
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    
    const cornerRadius = 6

    for (const c of visibleConnectorCoords) {
      ctx.strokeStyle = c.color ?? palette.line
      ctx.fillStyle = c.color ?? palette.line
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(c.x1, c.y1)

      if (c.x1 < c.x2) {
        // Manhattan forward: Right -> Down/Up -> Right
        const midX = c.x1 + 12
        
        // Horizontal to mid point
        ctx.lineTo(midX - cornerRadius, c.y1)
        ctx.arcTo(midX, c.y1, midX, c.y1 + (c.y2 > c.y1 ? cornerRadius : -cornerRadius), cornerRadius)
        
        // Vertical to target row
        ctx.lineTo(midX, c.y2 + (c.y2 > c.y1 ? -cornerRadius : cornerRadius))
        ctx.arcTo(midX, c.y2, midX + cornerRadius, c.y2, cornerRadius)
        
        // Horizontal to arrow
        ctx.lineTo(c.x2, c.y2)
      } else {
        // Backward connection: Loop around (Manhattan style)
        const extendX = c.x1 + 16
        const dropY = c.y1 + rowHeight / 2
        
        ctx.lineTo(extendX - cornerRadius, c.y1)
        ctx.arcTo(extendX, c.y1, extendX, c.y1 + cornerRadius, cornerRadius)
        ctx.lineTo(extendX, dropY - cornerRadius)
        ctx.arcTo(extendX, dropY, extendX - cornerRadius, dropY, cornerRadius)
        ctx.lineTo(c.x2 - 16 + cornerRadius, dropY)
        ctx.arcTo(c.x2 - 16, dropY, c.x2 - 16, dropY + cornerRadius, cornerRadius)
        ctx.lineTo(c.x2 - 16, c.y2 - cornerRadius)
        ctx.arcTo(c.x2 - 16, c.y2, c.x2 - 16 + cornerRadius, c.y2, cornerRadius)
        ctx.lineTo(c.x2, c.y2)
      }
      ctx.stroke()

      // Precision Arrowhead
      const ax = c.x2
      const ay = c.y2
      ctx.beginPath()
      ctx.moveTo(ax - 5, ay - 3)
      ctx.lineTo(ax, ay)
      ctx.lineTo(ax - 5, ay + 3)
      ctx.lineWidth = 2
      ctx.stroke()

      // Lag label
      if (c.label) {
        const midX = (c.x1 + c.x2) / 2
        const midY = (c.y1 + c.y2) / 2
        ctx.font = '9px sans-serif'
        ctx.fillStyle = c.color ?? palette.line
        ctx.fillText(c.label, midX + 3, midY - 3)
      }
    }
  }, [visibleConnectorCoords, startDay, endDay, pxPerDay, leftColWidth, rowHeight, effectiveRows.length, palette.line])

  /* -------------------------
   * Profiling capture + analysis (local)
   * ------------------------- */
  const renderStartRef = useRef<number>(0)
  renderStartRef.current = performance.now()
  const [captureRunning, setCaptureRunning] = useState(false)
  const captureRef = useRef<ProfileSample[]>([])
  const captureIntervalRef = useRef<number | null>(null)
  const captureTimerRef = useRef<number | null>(null)


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



  /* -------------------------
   * Drag handling (kept minimal)
   * ------------------------- */
  const dragRef = useRef<{ id: string; startX: number; origStartISO: string } | null>(null)
  const resizeRef = useRef<{ id: string; startX: number; origEndISO: string; origStartISO: string; origDuration: number } | null>(null)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const deltaDays = Math.round(dx / pxPerDay)
      const newStart = addDaysISO(drag.origStartISO, deltaDays)
      if (containerRef.current) containerRef.current.setAttribute('data-drag-preview', newStart)
    }
    function onResizeMove(e: MouseEvent) {
      const resize = resizeRef.current
      if (!resize) return
      const dx = e.clientX - resize.startX
      const deltaDays = Math.round(dx / pxPerDay)
      const newEnd = addDaysISO(resize.origEndISO, deltaDays)
      if (containerRef.current) containerRef.current.setAttribute('data-resize-preview', newEnd)
    }
    function onUp(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = (e && typeof (e as MouseEvent).clientX === 'number' && drag.startX != null) ? (e.clientX - drag.startX) : 0
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
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
    }
    function onResizeUp(e: MouseEvent) {
      const resize = resizeRef.current
      if (!resize) return
      const dx = (e && typeof e.clientX === 'number') ? (e.clientX - resize.startX) : 0
      const deltaDays = Math.round(dx / pxPerDay)
      // Ensure end >= start + 1 day
      const rawEndDate = addDaysISO(resize.origEndISO, deltaDays)
      const minEndDate = addDaysISO(resize.origStartISO, 0) // same as start at minimum
      const newEnd = rawEndDate >= minEndDate ? rawEndDate : minEndDate
      const id = resize.id
      resizeRef.current = null
      if (containerRef.current) containerRef.current.removeAttribute('data-resize-preview')
      if (deltaDays !== 0 && onTaskResize) onTaskResize(id, newEnd)
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current)
      setIsInteracting(true)
      interactionTimeoutRef.current = window.setTimeout(() => setIsInteracting(false), 250)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    if (dragRef.current) {
      setIsInteracting(true)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    if (resizeRef.current) {
      setIsInteracting(true)
      window.addEventListener('mousemove', onResizeMove)
      window.addEventListener('mouseup', onResizeUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
    }
  }, [onTaskMove, onTaskResize, pxPerDay])

  function startDrag(id: string, startX: number, origStartISO: string) {
    dragRef.current = { id, startX, origStartISO }
  }

  function startResize(id: string, startX: number, origEndISO: string, origStartISO: string, origDuration: number) {
    resizeRef.current = { id, startX, origEndISO, origStartISO, origDuration }
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
      } catch {
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
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(clone as HTMLElement, { backgroundColor: palette.bg, scale: 2, useCORS: true })
      const url = canvas.toDataURL('image/png', 1.0)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt-${projectId}.png`
      a.click()
    } catch (err) {
      toast.error('Export PNG failed', { description: (err as Error).message })
    } finally {
      document.body.removeChild(clone)
    }
  }
  async function exportPDF() {
    const clone = makePrintClone()
    if (!clone) return
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
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
      toast.error('Export PDF failed', { description: (err as Error).message })
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
    <div className="flex flex-col h-full w-full bg-card overflow-hidden">
      {/* Chart – fills entire container */}
      <div ref={containerRef} className="relative overflow-auto outline-none flex-1" onKeyDown={handleKeyDown} tabIndex={0} role="region" aria-label="Gantt chart">
        {/* ── Full-container background overlays (pointer-events-none, z-0) ──
            These cover the ENTIRE scrollable area — full height & width:
            1. Column day/week grid lines starting at leftColWidth
            2. Left-panel border-r vertical separator line               */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          aria-hidden="true"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${pxPerDay}px)`,
            backgroundPosition: `${leftColWidth}px 0`,
          }}
        />
        <div
          className="absolute top-0 bottom-0 border-r border-border pointer-events-none z-0"
          aria-hidden="true"
          style={{ left: leftColWidth - 1, width: 1 }}
        />
        {/* Resizable Split Pane Handle */}
        <div
          className="sticky top-0 bottom-0 z-50 w-2 cursor-col-resize hover:bg-primary/60 hover:scale-x-150 transition-all flex items-center justify-center -ml-1 group"
          style={{ left: leftColWidth, height: '100%', float: 'left' }}
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = leftColWidth
            const move = (ev: MouseEvent) => setUserLeftColWidth(Math.max(200, Math.min(startW + (ev.clientX - startX), width - 200)))
            const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
            window.addEventListener('mousemove', move)
            window.addEventListener('mouseup', up)
          }}
        >
          <div className="h-full w-[1px] bg-border group-hover:bg-transparent" />
        </div>

        <div ref={exportRef} className="min-h-full flex flex-col" style={{ width: (endDay - startDay) * pxPerDay + leftColWidth, minWidth: '100%' }}>
          {/* Sticky headers */}
          <div className="sticky top-0 z-30 backdrop-blur-md bg-background/95 shadow-sm">
            {/* Month row */}
            <div className="flex items-center border-b border-border" style={{ height: 36 }}>
              <div className="flex items-center justify-between px-4 border-r border-border text-xs font-bold uppercase tracking-widest text-muted-foreground" style={{ width: leftColWidth }}>
                <span className="truncate">Activity / Task</span>
                <span className="text-xs font-medium text-muted-foreground/50 ml-2 shrink-0">Schedule</span>
              </div>
              <div className="relative" style={{ width: (endDay - startDay) * pxPerDay }}>
                {monthSpans.map((m, i) => (
                  <div key={i} className="absolute top-0 h-full px-3 text-xs font-bold uppercase tracking-wider text-primary flex items-center border-r border-border/40" style={{ left: (m.startIndex - startDay) * pxPerDay, width: m.width }}>
                    <div className="truncate">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day/Week row */}
            <div className="flex items-center border-b border-border" style={{ height: 28 }}>
              <div className="flex items-center gap-2 px-4 border-r border-border" style={{ width: leftColWidth }}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Task</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dur</span>
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
                          <div key={globalIdx} className="absolute top-0 h-8 border-l border-border/30 text-xs text-muted-foreground/60 flex items-center px-1 select-none" style={{ left, width: pxPerDay }} title={d}>
                            {showLabel ? <div className="text-xs">{label}</div> : null}
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

            {visibleDays.map((d, _i) => {
              const _globalIdx = startDay + _i
              const dow = parseISODate(d).getUTCDay()
              if (dow === 0 || dow === 6) {
                return <div key={`wk-${d}`} className="absolute top-0 h-full pointer-events-none" style={{ left: leftColWidth + _i * pxPerDay, width: pxPerDay, background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(148,163,184,0.04) 3px, rgba(148,163,184,0.04) 6px)' }} />
              }
              return null
            })}

            {showTodayLine && todayIndex >= startDay && todayIndex < endDay ? (
              <div className="absolute pointer-events-none z-20" style={{ left: leftColWidth + (todayIndex - startDay) * pxPerDay - 1, top: 0, height: effectiveRows.length * rowHeight + 64 }} aria-hidden="true">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div className="text-xs px-2 py-0.5 rounded-full text-white shadow font-bold tracking-wider" style={{ background: '#f59e0b' }}>
                    TODAY
                  </div>
                </div>
                <div className="absolute top-5 w-0.5 h-full" style={{ background: 'rgba(245,158,11,0.8)', marginLeft: '0.5px' }} />
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
                        className={`sticky left-0 z-10 flex items-center gap-2 px-4 text-sm bg-gradient-to-r from-muted/60 to-transparent border-b border-r border-border hover:from-muted/80`}
                        style={{ top: 0, width: leftColWidth }}
                      >
                        <button
                          className="flex items-center justify-center w-5 h-5 rounded text-xs font-bold border border-border bg-card text-muted-foreground hover:bg-accent/60 transition-colors"
                          onClick={() => setCollapsedGroups((s) => ({ ...s, [r.groupId]: !s[r.groupId] }))}
                        >
                          {collapsed ? '▶' : '▼'}
                        </button>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-foreground uppercase tracking-wide">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.count} items</div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // task row
                const t = tasks[r.taskIndex]
                const startIndex = Math.max(0, days.indexOf(t.startDate))
                // Exact duration logic (allow 0 for milestones)
                const rawDuration = t.duration ?? inclusiveDays(t.startDate, t.endDate)
                const isMilestone = rawDuration <= 1 && t.startDate === t.endDate
                const duration = Math.max(1, rawDuration)
                const leftPx = (startIndex - startDay) * pxPerDay
                const widthPx = duration * pxPerDay
                const isCritical = criticalIds.has(t.id)
                const isSelected = r.taskIndex === selectedIndex
                const taskStatus = t.status || 'not_started'

                const leftCellBase = `sticky left-0 z-10 flex items-center gap-2 px-3 text-[12px] border-b border-r transition-colors ${
                  isCritical
                    ? 'bg-rose-500/10 dark:bg-rose-950/20 border-l-2 border-l-rose-500'
                    : globalRowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                } ${isSelected ? 'ring-1 ring-inset ring-primary/30 bg-primary/5' : 'hover:bg-accent/40'}`

                const barTop = (rowHeight - barHeight) / 2

                // Status-based bar gradient
                const barGradient = isCritical
                  ? 'linear-gradient(180deg, #f43f5e 0%, #be123c 100%)'
                  : taskStatus === 'completed'
                  ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                  : taskStatus === 'delayed'
                  ? 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)'
                  : taskStatus === 'in_progress'
                  ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)'

                const barBorder = isCritical
                  ? 'rgb(159, 18, 57)'
                  : taskStatus === 'completed'
                  ? 'rgb(22, 101, 52)'
                  : taskStatus === 'delayed'
                  ? 'rgb(194, 65, 12)'
                  : taskStatus === 'in_progress'
                  ? 'rgb(29, 78, 216)'
                  : 'rgb(71, 85, 105)'

                const barShadow = disableShadows ? 'none' : isCritical
                  ? '0 2px 8px rgba(225,29,72,0.4), inset 0 1px 1px rgba(255,255,255,0.35)'
                  : taskStatus === 'completed'
                  ? '0 2px 8px rgba(34,197,94,0.35), inset 0 1px 1px rgba(255,255,255,0.35)'
                  : taskStatus === 'in_progress'
                  ? '0 2px 8px rgba(59,130,246,0.35), inset 0 1px 1px rgba(255,255,255,0.35)'
                  : '0 1px 4px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.2)'

                // Aesthetic Premium Bar Styles (Capsule + Glass)
                const barStyle = {
                  left: Math.max(4, leftPx),
                  width: Math.max(8, widthPx - 8),
                  top: barTop,
                  height: barHeight,
                  borderRadius: barRadius,
                  background: barGradient,
                  border: `1px solid ${barBorder}`,
                  boxShadow: barShadow,
                  backdropFilter: 'blur(2px)',
                } as React.CSSProperties

                const dimmed = highlightCriticalOnly && !isCritical ? 'opacity-20 saturate-50' : ''
                const shouldUseTooltip = showCpmTooltip && !isInteracting && !(disableTooltipsWhileInteracting && isInteracting)

                // Render Milestone (Diamond) or Standard Task Bar
                const barNode = isMilestone ? (
                  <div
                    id={`gantt-bar-${t.id}`}
                    role="gridcell"
                    aria-label={`${t.name} Milestone`}
                    className={`absolute flex items-center justify-center transition-transform duration-200 cursor-pointer hover:scale-125 z-20 ${dimmed}`}
                    style={{ left: Math.max(0, leftPx) - barHeight / 2, top: barTop, width: barHeight, height: barHeight }}
                    onMouseDown={(e) => { e.preventDefault(); startDrag(t.id, e.clientX, t.startDate) }}
                    onClick={() => { setSelectedIndex(r.taskIndex); onTaskClick?.(t.id) }}
                  >
                    <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg" style={{ fill: isCritical ? palette.critical : palette.primary }}>
                      <path d="M12 2L22 12L12 22L2 12L12 2Z" />
                    </svg>
                  </div>
                ) : (
                  <div
                    id={`gantt-bar-${t.id}`}
                    role="gridcell"
                    aria-label={`${t.name} Bar`}
                    className={`absolute transition-opacity duration-200 cursor-pointer group ${dimmed}`}
                    style={barStyle}
                    onMouseDown={(e) => { e.preventDefault(); startDrag(t.id, e.clientX, t.startDate) }}
                    onClick={() => { setSelectedIndex(r.taskIndex); onTaskClick?.(t.id) }}
                  >
                    {/* Inner Progress Bar - visible dark overlay showing completion */}
                     <div
                      className="absolute left-0 top-0 h-full"
                      style={{ 
                        width: `${Math.max(0, Math.min(100, t.progress ?? 0))}%`,
                        borderRadius: `${barRadius}px ${Math.min(barRadius, (t.progress ?? 0) >= 99 ? barRadius : 0)}px ${Math.min(barRadius, (t.progress ?? 0) >= 99 ? barRadius : 0)}px ${barRadius}px`,
                        background: 'rgba(0,0,0,0.22)'
                      }}
                    />
                    {/* Progress label (shown if bar is wide enough) */}
                    {(t.progress ?? 0) > 0 && widthPx > 48 && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span className="text-xs font-bold text-white drop-shadow-sm">
                          {Math.round(t.progress ?? 0)}%
                        </span>
                      </div>
                    )}
                    {/* Resize handle — right edge drag to change end date */}
                    {onTaskResize && (
                      <div
                        aria-label="Resize task end date"
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/30 rounded-r"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          startResize(t.id, e.clientX, t.endDate, t.startDate, duration)
                        }}
                      />
                    )}
                  </div>
                )

                return (
                  <div key={t.id} role="row" aria-rowindex={globalRowIndex + 1} style={{ height: rowHeight }} className="relative group/row">
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id={`gantt-task-${t.id}`}
                          className={leftCellBase}
                          style={{ top: 0, width: leftColWidth, height: rowHeight }}
                          onClick={() => {
                            setSelectedIndex(r.taskIndex)
                            onTaskClick?.(t.id)
                          }}
                          tabIndex={0}
                        >
                          {/* Line ID / Index */}
                          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                            {(globalRowIndex + 1).toString().padStart(2, '0')}
                          </span>
                          
                          {/* Status Dot */}
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            t.status === 'completed' ? 'bg-emerald-500' : 
                            t.status === 'in_progress' ? 'bg-blue-500' : 
                            'bg-border'
                          }`} />

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-foreground leading-tight text-xs">
                              {t.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                                {t.startDate}
                              </span>
                              <span className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-1 rounded">
                                {inclusiveDays(t.startDate, t.endDate)}d
                              </span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-44">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">{t.name}</div>
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
                            className="absolute h-1.5 rounded-sm border border-dashed border-border/60"
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
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div>
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>{barNode}</TooltipTrigger>
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
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-44">
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">{t.name}</div>
                              <ContextMenuSeparator />
                              <ContextMenuItem onSelect={() => onTaskEdit?.(t.id)}>Edit task</ContextMenuItem>
                              <ContextMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onTaskDelete?.(t.id)}>
                                Delete task
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ) : (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>{barNode}</ContextMenuTrigger>
                            <ContextMenuContent className="w-44">
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">{t.name}</div>
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

          {/* Height filler — ensures exportRef fills container height.
              Visual background handled by the absolute overlay above.  */}
          <div className="flex-1" aria-hidden="true" style={{ minHeight: 120 }} />
        </div>
      </div>
    </div>
  )
}
