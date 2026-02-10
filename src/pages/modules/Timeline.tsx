/**
 * Timeline.tsx
 * Timeline module page with GanttChart + TaskEditor and comprehensive toolbar:
 * - Scale (Day/Week/Month), Zoom, Search, Status Filter.
 * - Toggles: Highlight Critical Only, Show CPM Tooltip, Show Dependencies, Show Today Line, Show Baseline.
 * - Context menu per task (Edit/Delete).
 * - Export current view to PNG/PDF with html2canvas + jsPDF.
 * - Capture Baseline button (snapshot current dates into baseline fields).
 *
 * This file intentionally keeps UI cohesive and responsive with shadcn/ui.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Plus, Trash2, AlertTriangle, Filter, Search, Settings2, Download, Flag, FileText } from 'lucide-react'
import GanttChart from '../../components/timeline/GanttChart'
import TaskEditor from '../../components/timeline/TaskEditor'
import { WBSImportDialog } from '../../components/timeline/WBSImportDialog'
import { useTimelineStore } from '../../store/timelineStore'
import { useProjectStore } from '../../store/projectStore'
import type { TimelineTask } from '../../store/timelineStore'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { EmptyState } from '../../components/common/EmptyState'

/** YYYY-MM-DD from Date (local-safe for UI) */
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Days between (A - B), caller decides inclusive handling */
function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24
  const start = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  const end = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  return Math.floor((end - start) / ms)
}

/** Add days helper */
function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * seedDemoTasks
 * Create a simple FS network for CPM demo.
 * Returns true if seeding performed.
 */
function seedDemoTasks(projectId: string): boolean {
  try {
    const api: any = (useTimelineStore as any).getState?.()
    if (!api || typeof api.addTask !== 'function' || typeof api.updateTask !== 'function') return false

    const today = new Date()
    const start0 = addDays(today, 0)

    const t1 = api.addTask(projectId, {
      name: 'Project Initiation',
      description: 'Kickoff, approvals, mobilization',
      startDate: toISODate(start0),
      duration: 4,
      progress: 20,
      status: 'in_progress',
      priority: 'high',
    })

    const start1 = addDays(start0, 4)
    const t2 = api.addTask(projectId, {
      name: 'Foundation',
      description: 'Excavation, rebar, concrete',
      startDate: toISODate(start1),
      duration: 6,
      progress: 0,
      status: 'not_started',
      priority: 'high',
    })
    api.updateTask(projectId, t2, {
      dependencies: [{ id: 'dep-1', predecessorId: t1, successorId: t2, type: 'FS', lag: 0 }],
    })

    const start2 = addDays(start1, 6)
    const t3 = api.addTask(projectId, {
      name: 'Structural Frame',
      description: 'Columns, beams, slab',
      startDate: toISODate(start2),
      duration: 8,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    api.updateTask(projectId, t3, {
      dependencies: [{ id: 'dep-2', predecessorId: t2, successorId: t3, type: 'FS', lag: 0 }],
    })

    const start3 = addDays(start2, 8)
    const t4 = api.addTask(projectId, {
      name: 'MEP Rough-in',
      description: 'MEP first fix',
      startDate: toISODate(start3),
      duration: 5,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    api.updateTask(projectId, t4, {
      dependencies: [{ id: 'dep-3', predecessorId: t3, successorId: t4, type: 'FS', lag: 0 }],
    })

    const start4 = addDays(start3, 5)
    const t5 = api.addTask(projectId, {
      name: 'Finishes',
      description: 'Walls, floor, painting',
      startDate: toISODate(start4),
      duration: 6,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    api.updateTask(projectId, t5, {
      dependencies: [{ id: 'dep-4', predecessorId: t4, successorId: t5, type: 'FS', lag: 0 }],
    })

    // Non-critical parallel path
    const startP = addDays(start0, 6)
    const tp = api.addTask(projectId, {
      name: 'Landscaping',
      description: 'Hardscape & softscape',
      startDate: toISODate(startP),
      duration: 4,
      progress: 0,
      status: 'not_started',
      priority: 'low',
    })
    api.updateTask(projectId, tp, {
      dependencies: [{ id: 'dep-5', predecessorId: t1, successorId: tp, type: 'FS', lag: 2 }],
    })

    return true
  } catch {
    return false
  }
}

/** Timeline page component */
export default function Timeline() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectId = activeProject?.id || ''
  const projectName = activeProject?.name || '—'

  const { getTasks, removeTask } = useTimelineStore()
  const [editorOpen, setEditorOpen] = useState(false)
  const [importWBSOpen, setImportWBSOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')

  // Toolbar states
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false)
  const [showTooltip, setShowTooltip] = useState<boolean>(true)
  const [pxPerDay, setPxPerDay] = useState<number>(24)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [showDeps, setShowDeps] = useState(true)
  const [showBaseline, setShowBaseline] = useState(true)
  const [showTodayLine, setShowTodayLine] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Auto-seed demo tasks if empty
  useEffect(() => {
    if (!projectId) return
    const tasks = getTasks(projectId) || []
    if (!tasks.length) {
      const seeded = seedDemoTasks(projectId)
      if (seeded) {
        toast.info('Demo tasks added', { description: 'You can drag bars to reschedule.' })
      }
    }
  }, [getTasks, projectId])

  /** Open editor for a new task */
  const openNew = () => {
    setEditingTask(null)
    setEditorOpen(true)
  }

  /** Remove selected task */
  const removeSelected = () => {
    if (!selectedId) {
      toast.message('Select a task first')
      return
    }
    removeTask(projectId, selectedId)
    setSelectedId('')
    toast.success('Task removed')
  }

  /**
   * Handle task move from Gantt drag & drop.
   * Keep original duration (end - start + 1).
   */
  const handleTaskMove = (taskId: string, newStartDate: string) => {
    try {
      const tasks = getTasks(projectId) || []
      const task = tasks.find((x: any) => String(x.id ?? x.taskId) === String(taskId))
      if (!task) {
        toast.error('Task not found')
        return
      }

      const startOld = new Date(task.startDate)
      const endOld = new Date(task.endDate)
      const durationDays = Math.max(1, daysBetween(endOld, startOld) + 1)

      const startNew = new Date(newStartDate)
      const endNew = new Date(startNew)
      endNew.setDate(endNew.getDate() + durationDays - 1)

      const payload = {
        startDate: toISODate(startNew),
        endDate: toISODate(endNew),
      }

      const api: any = (useTimelineStore as any).getState?.() || null
      if (api && typeof api.updateTaskDates === 'function') {
        api.updateTaskDates(projectId, String(task.id), payload)
        toast.success('Task moved', { description: `${task.name} → ${payload.startDate} .. ${payload.endDate}` })
      } else {
        toast.message('Drop detected', { description: 'No store updater found.' })
      }
    } catch (err) {
      toast.error('Failed to move task')
      // eslint-disable-next-line no-console
      console.error(err)
    }
  }

  // Filtering & summary
  const rawTasks = getTasks(projectId)
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rawTasks.filter((t) => {
      const okQ = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      const okS = statusFilter === 'all' || t.status === statusFilter
      return okQ && okS
    })
  }, [rawTasks, query, statusFilter])

  const summary = useMemo(() => {
    const total = rawTasks.length
    const completed = rawTasks.filter((t) => t.status === 'completed').length
    const inProgress = rawTasks.filter((t) => t.status === 'in_progress').length
    const start = total ? rawTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), rawTasks[0].startDate) : ''
    const end = total ? rawTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), rawTasks[0].endDate) : ''
    return { total, completed, inProgress, start, end }
  }, [rawTasks])

  // Export refs
  const exportRef = useRef<HTMLDivElement | null>(null)

  /** Export current schedule view to PNG */
  const exportPNG = async () => {
    if (!exportRef.current) return
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#ffffff' })
    const url = canvas.toDataURL('image/png', 1.0)
    const a = document.createElement('a')
    a.href = url
    a.download = `timeline-${projectId}.png`
    a.click()
  }

  /** Export current schedule view to PDF (A4 landscape, scaled to fit width) */
  const exportPDF = async () => {
    if (!exportRef.current) return
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h)
    pdf.save(`timeline-${projectId}.pdf`)
  }

  if (!projectId) {
    return (
      <AppShell>
        <ModuleHeader
          icon={<AlertTriangle size={18} />}
          title="Timeline"
          description="Project schedule and Gantt chart"
        />
        <EmptyState
          title="No Project Selected"
          description="Please select a project to view its timeline."
          imageKeyword="gantt chart"
        />
      </AppShell>
    )
  }

  return (
    <AppShell projectName={projectName}>
      <ModuleHeader
        icon={<AlertTriangle size={18} />}
        title="Timeline & Gantt"
        description="Interactive Gantt chart with CPM analysis, dependencies, and baseline tracking."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportWBSOpen(true)} className="gap-2" size="sm">
              <FileText className="h-4 w-4" />
              Import WBS
            </Button>
            <Button onClick={openNew} className="gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={removeSelected} size="sm">
              <Trash2 className="h-4 w-4" />
              Remove Task
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" /> Display & Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500">Scale</Label>
            <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500">Zoom</Label>
            <input
              type="range"
              min={12}
              max={48}
              step={1}
              value={pxPerDay}
              onChange={(e) => setPxPerDay(parseInt(e.target.value, 10))}
              className="w-40 accent-blue-600"
            />
            <span className="w-10 text-xs tabular-nums text-neutral-600">{pxPerDay}px</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-600"
                checked={criticalOnly}
                onChange={(e) => setCriticalOnly(e.target.checked)}
              />
              <span className="text-sm">Highlight critical only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={showTooltip}
                onChange={(e) => setShowTooltip(e.target.checked)}
              />
              <span className="text-sm">Show CPM tooltip</span>
            </label>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={showDeps}
                onChange={(e) => setShowDeps(e.target.checked)}
              />
              <span className="text-sm">Show dependencies</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={showTodayLine}
                onChange={(e) => setShowTodayLine(e.target.checked)}
              />
              <span className="text-sm">Show today line</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={showBaseline}
                onChange={(e) => setShowBaseline(e.target.checked)}
              />
              <span className="text-sm">Show baseline</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-neutral-500" />
            <Input placeholder="Search task name or ID..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-neutral-500" />
            <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <span className="inline-block h-3 w-3 rounded bg-blue-500 ring-2 ring-red-500" /> Critical
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <span className="inline-block h-3 w-3 rounded bg-blue-500" /> Task bar
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <span className="inline-block h-3 w-3 rounded bg-green-500" /> Progress
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Total tasks</div>
            <div className="text-xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">In progress</div>
            <div className="text-xl font-semibold">{summary.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Completed</div>
            <div className="text-xl font-semibold">{summary.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-neutral-500">Range</div>
            <div className="text-sm font-medium">
              {summary.start} → {summary.end}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card ref={exportRef as any}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Project Schedule
          </CardTitle>

          {/* Export & Baseline actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Current View</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={exportPNG}>PNG</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPDF}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                ;(useTimelineStore as any).getState?.().setBaseline(projectId, true)
                toast.success('Baseline captured')
              }}
            >
              <Flag className="h-4 w-4" />
              Capture Baseline
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <GanttChart
            projectId={projectId}
            height={520}
            highlightCriticalOnly={criticalOnly}
            showCpmTooltip={showTooltip}
            pxPerDay={pxPerDay}
            viewMode={viewMode}
            showDependencies={showDeps}
            showTodayLine={showTodayLine}
            selectedTaskId={selectedId}
            showBaseline={showBaseline}
            tasksOverride={filteredTasks}
            onTaskClick={(id) => {
              const t = getTasks(projectId).find((x) => String(x.id) === String(id)) || null
              setEditingTask(t || null)
              setEditorOpen(true)
              setSelectedId(id)
            }}
            onTaskMove={handleTaskMove}
            onTaskEdit={(id) => {
              const t = getTasks(projectId).find((x) => String(x.id) === String(id)) || null
              setEditingTask(t || null)
              setEditorOpen(true)
              setSelectedId(id)
            }}
            onTaskDelete={(id) => {
              if (confirm('Delete this task?')) {
                removeTask(projectId, id)
                if (selectedId === id) setSelectedId('')
                toast.success('Task deleted')
              }
            }}
          />
          <div className="mt-3 text-xs text-neutral-500">
            Tip: drag and drop bars to reschedule. Turn on CPM tooltip to inspect ES/EF/LS/LF/TF. Use Day/Week/Month and Zoom to
            adjust the timeline scale.
          </div>
        </CardContent>
      </Card>

      {/* Editor modal */}
      <TaskEditor
        projectId={projectId}
        task={editingTask as any}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={(saved) => {
          setSelectedId(saved.id)
          setEditorOpen(false)
        }}
      />

      <WBSImportDialog 
        projectId={projectId}
        open={importWBSOpen}
        onOpenChange={setImportWBSOpen}
      />
    </AppShell>
  )
}
