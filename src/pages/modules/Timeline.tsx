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
import { Plus, Trash2, AlertTriangle, Filter, Search, Settings2, Download, Flag, FileText, GanttChartSquare } from 'lucide-react'
import GanttChart from '../../components/timeline/GanttChart'
import TaskEditor from '../../components/timeline/TaskEditor'
import { WBSImportDialog } from '../../components/timeline/WBSImportDialog'
import { useTimelineStore } from '../../store/timelineStore'
import { useProjectStore } from '../../store/projectStore'
import type { TimelineTask } from '../../store/timelineStore'
import { calculateTimelineAlerts } from '../../lib/timelineAlerts'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
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
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null)

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
    const completed = rawTasks.filter((t: TimelineTask) => t.status === 'completed').length
    const inProgress = rawTasks.filter((t: TimelineTask) => t.status === 'in_progress').length
    const start = total ? rawTasks.reduce((m: string, t: TimelineTask) => (t.startDate < m ? t.startDate : m), rawTasks[0].startDate) : ''
    const end = total ? rawTasks.reduce((m: string, t: TimelineTask) => (t.endDate > m ? t.endDate : m), rawTasks[0].endDate) : ''
    return { total, completed, inProgress, start, end }
  }, [rawTasks])

  // Calculate alerts based on current data
  const alerts = useMemo(() => calculateTimelineAlerts(rawTasks), [rawTasks])

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
      <div className="space-y-6">
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Display & Controls</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Scale</Label>
            <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-2 h-6">Day</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2 h-6">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2 h-6">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Zoom</Label>
            <input
              type="range"
              min={12}
              max={48}
              step={1}
              value={pxPerDay}
              onChange={(e) => setPxPerDay(parseInt(e.target.value, 10))}
              className="w-32 accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
            />
            <span className="w-10 text-xs tabular-nums text-neutral-600 font-mono py-1 px-1.5 bg-slate-100 rounded text-center">{pxPerDay}px</span>
          </div>

          <div className="md:col-span-2 xl:col-span-2 flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-600 rounded border-slate-300"
                checked={criticalOnly}
                onChange={(e) => setCriticalOnly(e.target.checked)}
              />
              <span className="text-sm group-hover:text-red-600 transition-colors">Critical Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600 rounded border-slate-300"
                checked={showDeps}
                onChange={(e) => setShowDeps(e.target.checked)}
              />
              <span className="text-sm group-hover:text-blue-600 transition-colors">Dependencies</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600 rounded border-slate-300"
                checked={showBaseline}
                onChange={(e) => setShowBaseline(e.target.checked)}
              />
              <span className="text-sm group-hover:text-emerald-600 transition-colors">Baseline</span>
            </label>
          </div>

          <div className="md:col-span-2 xl:col-span-2 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-blue-500 shadow-sm relative overflow-hidden">
          <CardContent className="py-4">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Tasks</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</div>
            <div className="absolute right-2 top-2 opacity-10">
              <FileText size={48} className="text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-amber-500 shadow-sm relative overflow-hidden">
          <CardContent className="py-4">
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">In Progress</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.inProgress}</div>
            <div className="absolute right-2 top-2 opacity-10">
              <Settings2 size={48} className="text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-emerald-500 shadow-sm relative overflow-hidden">
          <CardContent className="py-4">
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Completed</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.completed}</div>
            <div className="absolute right-2 top-2 opacity-10">
              <Filter size={48} className="text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-purple-500 shadow-sm relative overflow-hidden">
          <CardContent className="py-4">
            <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Schedule Range</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 flex flex-col">
              <span>{summary.start || '-'}</span>
              <span className="text-slate-400 text-xs font-normal">to</span>
              <span>{summary.end || '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Path Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-bold text-red-800 dark:text-red-400">Early Warning Alerts</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.slice(0, 4).map((alert, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded p-3 text-sm flex items-center justify-between border border-red-100 dark:border-red-900/30">
                <div className="overflow-hidden">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">{alert.taskName}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{alert.message}</div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="text-xs font-mono text-red-600 font-bold">{alert.actualProgress.toFixed(0)}% / {alert.expectedProgress.toFixed(0)}%</div>
                  {alert.severity === 'critical' ? (
                    <span className="text-xs bg-red-100 text-red-700 px-1 py-0.5 mt-1 rounded">CRITICAL</span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 mt-1 rounded">WARNING</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {alerts.length > 4 && (
            <div className="text-xs text-red-600 mt-3 text-center cursor-pointer hover:underline">
              + {alerts.length - 4} more warnings...
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <Card ref={exportRef as any} className="border-0 shadow-md">
        <CardHeader className="flex items-center justify-between bg-slate-50/50 border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <GanttChartSquare className="h-5 w-5 text-blue-600" />
            Project Schedule Visualization
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
                (useTimelineStore as any).getState?.().setBaseline(projectId, true)
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
              const t = getTasks(projectId).find((x: TimelineTask) => String(x.id) === String(id)) || null
              setEditingTask(t || null)
              setEditorOpen(true)
              setSelectedId(id)
            }}
            onTaskMove={handleTaskMove}
            onTaskEdit={(id) => {
              const t = getTasks(projectId).find((x: TimelineTask) => String(x.id) === String(id)) || null
              setEditingTask(t || null)
              setEditorOpen(true)
              setSelectedId(id)
            }}
            onTaskDelete={(id) => {
              setPendingDeleteTaskId(id)
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

      <AlertDialog open={!!pendingDeleteTaskId} onOpenChange={(open) => { if (!open) setPendingDeleteTaskId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task from the timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDeleteTaskId) return
                removeTask(projectId, pendingDeleteTaskId)
                if (selectedId === pendingDeleteTaskId) setSelectedId('')
                toast.success('Task deleted')
                setPendingDeleteTaskId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WBSImportDialog
        projectId={projectId}
        open={importWBSOpen}
        onOpenChange={setImportWBSOpen}
      />
    </div>
  )
}
