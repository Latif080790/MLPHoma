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
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Plus, Trash2, AlertTriangle, Settings2, Download, Flag, FileText, ZoomIn, ZoomOut, CalendarClock, Layers, Activity, CheckCircle2, X, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import GanttChart from '../../components/timeline/GanttChart'
import TaskEditor from '../../components/timeline/TaskEditor'
import type { TaskEditorProps } from '../../components/timeline/TaskEditor'
import { WBSImportDialog } from '../../components/timeline/WBSImportDialog'
import { useTimelineStore } from '../../store/timelineStore'
import { useProjectStore } from '../../store/projectStore'
import type { TimelineState, TimelineTask } from '../../store/timelineStore'
import { calculateTimelineAlerts } from '../../lib/timelineAlerts'
import { seedEnterpriseProject } from '../../lib/demoDataSeeder'
import { toast } from 'sonner'
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
import ModuleListToolbar from '../../components/common/ModuleListToolbar'

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

type ViewMode = 'day' | 'week' | 'month'

type TimelineStoreApi = Pick<TimelineState, 'addTask' | 'updateTask' | 'updateTaskDates' | 'setBaseline'>

const TIMELINE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
]

function isViewMode(value: string): value is ViewMode {
  return value === 'day' || value === 'week' || value === 'month'
}

function toEditorTask(task: TimelineTask | null): TaskEditorProps['task'] {
  if (!task) return null
  return task as unknown as TaskEditorProps['task']
}

/**
 * seedDemoTasks
 * Create a simple FS network for CPM demo.
 * Returns true if seeding performed.
 */
function seedDemoTasks(projectId: string): boolean {
  try {
    const api: Partial<TimelineStoreApi> = useTimelineStore.getState()
    if (typeof api.addTask !== 'function' || typeof api.updateTask !== 'function') return false

    const addTask = api.addTask
    const updateTask = api.updateTask

    const today = new Date()
    const start0 = addDays(today, 0)

    const t1 = addTask(projectId, {
      name: 'Project Initiation',
      description: 'Kickoff, approvals, mobilization',
      startDate: toISODate(start0),
      duration: 4,
      progress: 20,
      status: 'in_progress',
      priority: 'high',
    })

    const start1 = addDays(start0, 4)
    const t2 = addTask(projectId, {
      name: 'Foundation',
      description: 'Excavation, rebar, concrete',
      startDate: toISODate(start1),
      duration: 6,
      progress: 0,
      status: 'not_started',
      priority: 'high',
    })
    updateTask(projectId, t2, {
      dependencies: [{ id: 'dep-1', predecessorId: t1, successorId: t2, type: 'FS', lag: 0 }],
    })

    const start2 = addDays(start1, 6)
    const t3 = addTask(projectId, {
      name: 'Structural Frame',
      description: 'Columns, beams, slab',
      startDate: toISODate(start2),
      duration: 8,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    updateTask(projectId, t3, {
      dependencies: [{ id: 'dep-2', predecessorId: t2, successorId: t3, type: 'FS', lag: 0 }],
    })

    const start3 = addDays(start2, 8)
    const t4 = addTask(projectId, {
      name: 'MEP Rough-in',
      description: 'MEP first fix',
      startDate: toISODate(start3),
      duration: 5,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    updateTask(projectId, t4, {
      dependencies: [{ id: 'dep-3', predecessorId: t3, successorId: t4, type: 'FS', lag: 0 }],
    })

    const start4 = addDays(start3, 5)
    const t5 = addTask(projectId, {
      name: 'Finishes',
      description: 'Walls, floor, painting',
      startDate: toISODate(start4),
      duration: 6,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
    })
    updateTask(projectId, t5, {
      dependencies: [{ id: 'dep-4', predecessorId: t4, successorId: t5, type: 'FS', lag: 0 }],
    })

    // Non-critical parallel path
    const startP = addDays(start0, 6)
    const tp = addTask(projectId, {
      name: 'Landscaping',
      description: 'Hardscape & softscape',
      startDate: toISODate(startP),
      duration: 4,
      progress: 0,
      status: 'not_started',
      priority: 'low',
    })
    updateTask(projectId, tp, {
      dependencies: [{ id: 'dep-5', predecessorId: t1, successorId: tp, type: 'FS', lag: 2 }],
    })

    return true
  } catch {
    return false
  }
}

/** Timeline page component */
export default function Timeline() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const activeProject = useProjectStore(s => activeProjectId ? s.projects[activeProjectId] : null)
  const projectId = activeProject?.id || ''

  const { getTasks, removeTask, fetchTasks } = useTimelineStore()
  const [editorOpen, setEditorOpen] = useState(false)
  const [importWBSOpen, setImportWBSOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskEditorProps['task']>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null)
  // Warning slide-over panel state
  const [warningPanelOpen, setWarningPanelOpen] = useState(false)
  // Track per-project fetch completion to gate the demo-seed guard
  const [fetchedForProject, setFetchedForProject] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const taskIdInQuery = searchParams.get('taskId')
    if (taskIdInQuery) {
      setSelectedId(taskIdInQuery)
      // Remove or keep the search param. We'll just read it here to highlight.
    }
  }, [searchParams])

  // Toolbar states
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false)
  const [showTooltip] = useState<boolean>(true)
  const [pxPerDay, setPxPerDay] = useState<number>(24)
  const [viewMode, setViewMode] = useState<ViewMode>('week')

  // P1.6.1 + QW.9: Zoom step helpers
  const ZOOM_MIN = 10
  const ZOOM_MAX = 64
  const ZOOM_STEP = 4
  const zoomIn = () => setPxPerDay(v => Math.min(v + ZOOM_STEP, ZOOM_MAX))
  const zoomOut = () => setPxPerDay(v => Math.max(v - ZOOM_STEP, ZOOM_MIN))
  const zoomReset = () => setPxPerDay(24)

  // Keyboard shortcuts: ] = zoom in, [ = zoom out, \ = reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ']') zoomIn()
      else if (e.key === '[') zoomOut()
      else if (e.key === '\\') zoomReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [showDeps, setShowDeps] = useState(true)
  const [showBaseline, setShowBaseline] = useState(true)
  const [showTodayLine] = useState(true)
  const [query, setQuery] = useState(() => {
    try { return localStorage.getItem('timeline.toolbar.query') || '' } catch { return '' }
  })
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try { return localStorage.getItem('timeline.toolbar.status') || 'all' } catch { return 'all' }
  })
  const [resourceFilter, setResourceFilter] = useState<string>(() => {
    try { return localStorage.getItem('timeline.toolbar.resource') || 'all' } catch { return 'all' }
  })
  const [dateFrom, setDateFrom] = useState<string>(() => {
    try { return localStorage.getItem('timeline.toolbar.dateFrom') || '' } catch { return '' }
  })
  const [dateTo, setDateTo] = useState<string>(() => {
    try { return localStorage.getItem('timeline.toolbar.dateTo') || '' } catch { return '' }
  })

  useEffect(() => {
    try {
      localStorage.setItem('timeline.toolbar.query', query)
      localStorage.setItem('timeline.toolbar.status', statusFilter)
      localStorage.setItem('timeline.toolbar.resource', resourceFilter)
      localStorage.setItem('timeline.toolbar.dateFrom', dateFrom)
      localStorage.setItem('timeline.toolbar.dateTo', dateTo)
    } catch {
      // ignore storage errors
    }
  }, [query, statusFilter, resourceFilter, dateFrom, dateTo])

  // Load tasks from Supabase on project change
  useEffect(() => {
    if (!projectId) return
    setFetchedForProject(null) // reset guard when project changes
    fetchTasks(projectId).then(() => setFetchedForProject(projectId))
  }, [projectId, fetchTasks])

  // Auto-seed demo tasks if empty — ONLY after fetch completes (prevents duplicate seeding on real projects)
  useEffect(() => {
    if (!projectId || fetchedForProject !== projectId) return
    const tasks = getTasks(projectId) || []
    if (!tasks.length) {
      seedEnterpriseProject(projectId).then((seeded) => {
        if (seeded) {
          toast.info('Enterprise sample project seeded', { 
            description: 'WBS, RAB, and Timeline data have been generated for testing.' 
          })
        }
      })
    }
  }, [getTasks, projectId, fetchedForProject])

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
      const task = tasks.find((x: TimelineTask) => String(x.id) === String(taskId))
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

      const api = useTimelineStore.getState()
      if (typeof api.updateTaskDates === 'function') {
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
      const resources = (t.assignedResources || []).map((r) => r.toLowerCase())
      const okR = resourceFilter === 'all' || resources.includes(resourceFilter.toLowerCase())

      const taskStart = new Date(t.startDate)
      const fromBoundary = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
      const toBoundary = dateTo ? new Date(`${dateTo}T23:59:59`) : null
      const okFrom = !fromBoundary || taskStart >= fromBoundary
      const okTo = !toBoundary || taskStart <= toBoundary

      return okQ && okS && okR && okFrom && okTo
    })
  }, [rawTasks, query, statusFilter, resourceFilter, dateFrom, dateTo])



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
    const { default: html2canvas } = await import('html2canvas')
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
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
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
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      
      {/* ─── Level 1: Sleek Command Ribbon ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 bg-white dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)] z-10 shrink-0">
        
        {/* Left: View Controls */}
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v: string) => { if (isViewMode(v)) setViewMode(v) }}>
            <TabsList className="h-8 bg-slate-100/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-1">
              <TabsTrigger value="day" className="text-xs font-bold px-3 h-6 uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs font-bold px-3 h-6 uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs font-bold px-3 h-6 uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg px-2 h-8 border border-slate-200/60 dark:border-slate-800/60">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-transparent" onClick={zoomOut} disabled={pxPerDay <= ZOOM_MIN}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={pxPerDay} onChange={(e) => setPxPerDay(parseInt(e.target.value, 10))} className="w-20 accent-blue-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-transparent" onClick={zoomIn} disabled={pxPerDay >= ZOOM_MAX}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-slate-400 w-8 text-center">{pxPerDay}px</span>
          </div>
        </div>

        {/* Center: Logic Toggles */}
        <div className="flex items-center gap-5">
           <div className="flex items-center gap-4 border-x border-slate-200/60 dark:border-slate-800/60 px-5">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="h-3.5 w-3.5 accent-rose-500 rounded border-slate-300" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-rose-600 transition-colors">Critical Path</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="h-3.5 w-3.5 accent-blue-500 rounded border-slate-300" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">Dependencies</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="h-3.5 w-3.5 accent-emerald-500 rounded border-slate-300" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-emerald-600 transition-colors">Baseline</span>
            </label>
          </div>
        </div>

        {/* Right: Tools & Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block border-r border-slate-200/60 dark:border-slate-800/60 pr-2 mr-1">
            <ModuleListToolbar
              query={query}
              onQueryChange={setQuery}
              queryPlaceholder="Filter activities..."
              filterValue={statusFilter}
              onFilterChange={setStatusFilter}
              filterOptions={TIMELINE_STATUS_OPTIONS}
              resultCount={filteredTasks.length}
              resultLabel="nodes"
              className="h-8 border-none bg-transparent shadow-none"
            />
          </div>
          
          <Button variant="outline" onClick={() => setImportWBSOpen(true)} className="h-8 text-xs px-3 gap-2 font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50" size="sm">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            WBS IMPORT
          </Button>
          
          <Button onClick={openNew} className="h-8 text-xs px-4 gap-2 font-bold bg-blue-600 hover:bg-blue-700 shadow-sm" size="sm">
            <Plus className="h-3.5 w-3.5" />
            NEW TASK
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-slate-400 px-3 py-2">Engineering Tools</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-amber-600 dark:text-amber-400 font-medium"
                onClick={() => {
                  seedEnterpriseProject(projectId).then(() => {
                    toast.success('Project Re-seeded', { 
                      description: 'Sample data has been re-generated.' 
                    })
                  })
                }}
              >
                <Activity className="mr-2 h-4 w-4" />
                Seed Mock Data (Dev)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { const api = useTimelineStore.getState(); api.setBaseline(projectId, true); toast.success('Baseline captured'); }}>
                <Flag className="h-4 w-4 mr-3 text-slate-400" /> 
                <div className="flex flex-col">
                  <span>Capture Baseline</span>
                  <span className="text-xs text-slate-400">Lock current schedule as baseline</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={exportPNG}><Download className="h-4 w-4 mr-3 text-slate-400" /> Export PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportPDF}><Download className="h-4 w-4 mr-3 text-slate-400" /> Export PDF</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={removeSelected} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="h-4 w-4 mr-3" /> 
                <span>Delete Selected</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Level 2: Metric Chip Strip ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch border-b bg-neutral-50 dark:bg-neutral-900 shadow-inner shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-4 px-4 py-1.5">
          
          {/* Metric Chips */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-full px-2.5 py-1 shadow-sm">
            <Layers className="h-3 w-3 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Total Scope</span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white px-1 ml-1">{summary.total}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-full px-2.5 py-1">
            <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Active Tasks</span>
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 px-1 ml-1">{summary.inProgress}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-full px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Completed</span>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 px-1 ml-1">{summary.completed}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 ml-4 border-l border-slate-200/60 dark:border-slate-800/60 pl-4 py-1">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase leading-none">Global Window</span>
              <div className="flex items-center gap-2 mt-1">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  {summary.start || 'N/A'} <span className="text-slate-300 mx-1">→</span> {summary.end || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Level 2 Right: Alert Strip (Clickable) */}
        {alerts.length > 0 && (
          <button
            onClick={() => setWarningPanelOpen(true)}
            className="flex items-center gap-3 px-6 py-1.5 ml-auto border-l border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 transition-colors group"
          >
            <div className="relative">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                {alerts.length} Warnings
              </span>
              <span className="text-xs text-rose-500/80 font-medium">Klik untuk detail</span>
            </div>
            <ChevronRight className="h-3 w-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* ─── Level 3: The Edge-to-Edge Gantt Canvas ─────────────────────── */}
      <div ref={exportRef} className="flex-1 w-full bg-white relative overflow-hidden">
        <GanttChart
          projectId={projectId}
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
            setEditingTask(toEditorTask(t))
            setEditorOpen(true)
            setSelectedId(id)
          }}
          onTaskMove={handleTaskMove}
          onTaskEdit={(id) => {
            const t = getTasks(projectId).find((x: TimelineTask) => String(x.id) === String(id)) || null
            setEditingTask(toEditorTask(t))
            setEditorOpen(true)
            setSelectedId(id)
          }}
          onTaskDelete={(id) => {
            setPendingDeleteTaskId(id)
          }}
        />
      </div>

      {/* ─── Warning Slide-over Panel ─────────────────────────────────── */}
      {warningPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setWarningPanelOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          {/* Panel */}
          <div
            className="relative z-10 w-80 max-w-full h-full bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-rose-50 dark:bg-rose-950/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span className="font-bold text-sm text-rose-700 dark:text-rose-400">
                  Schedule Warnings ({alerts.length})
                </span>
              </div>
              <button
                onClick={() => setWarningPanelOpen(false)}
                className="rounded p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 p-3 space-y-1.5 hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}>
                      {alert.severity === 'critical' ? 'OVERDUE' : 'DELAY'}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-snug">
                    {alert.taskName}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-400">Expected:</span>
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">{Math.round(alert.expectedProgress)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-400">Actual:</span>
                      <span className="text-xs font-bold text-rose-600">{Math.round(alert.actualProgress)}%</span>
                    </div>
                    {alert.delayDays > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-amber-500" />
                        <span className="text-xs font-bold text-amber-600">+{alert.delayDays}d late</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
                  <AlertCircle size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No active warnings</p>
                </div>
              )}
            </div>
            {/* Panel Footer */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setWarningPanelOpen(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      <TaskEditor
        projectId={projectId}
        task={editingTask}
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
