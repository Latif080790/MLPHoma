import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Plus, CheckCircle2, DollarSign, Calendar, MapPin, ArrowRight, Layout, TrendingUp, AlertCircle, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { useProjectStore, type Project } from '../../store/projectStore'
import { ProjectDialog } from '../../components/project/ProjectDialog'
import { formatIDR } from '../../lib/utils'
import { generateId } from '../../lib/idGenerator'
import { toast } from 'sonner'
import ModuleListToolbar from '@/components/common/ModuleListToolbar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const PROJECT_STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
]

const PROJECT_SORTS = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'budget-high', label: 'Budget High-Low' },
  { value: 'budget-low', label: 'Budget Low-High' },
  { value: 'deadline-near', label: 'Deadline Nearest' },
]

export default function ProjectManagement() {
  const navigate = useNavigate()
  const { projects: projectsObj, activeProjectId, setActiveProject, addProject, updateProject, removeProject, activateProject, loadProjects } = useProjectStore()

  const projects = useMemo(() => Object.values(projectsObj), [projectsObj])

  // Local state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId || null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.query') || '' } catch { return '' }
  })
  const [statusFilter, setStatusFilter] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.status') || 'all' } catch { return 'all' }
  })
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.sort') || 'name-asc' } catch { return 'name-asc' }
  })
  const [ownerFilter, setOwnerFilter] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.owner') || 'all' } catch { return 'all' }
  })
  const [deadlineFrom, setDeadlineFrom] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.deadlineFrom') || '' } catch { return '' }
  })
  const [deadlineTo, setDeadlineTo] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.deadlineTo') || '' } catch { return '' }
  })
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null)
  const [pendingActivateProject, setPendingActivateProject] = useState<Project | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    try {
      localStorage.setItem('pm.toolbar.query', searchQuery)
      localStorage.setItem('pm.toolbar.status', statusFilter)
      localStorage.setItem('pm.toolbar.sort', sortBy)
      localStorage.setItem('pm.toolbar.owner', ownerFilter)
      localStorage.setItem('pm.toolbar.deadlineFrom', deadlineFrom)
      localStorage.setItem('pm.toolbar.deadlineTo', deadlineTo)
    } catch {
      // ignore storage errors
    }
  }, [searchQuery, sortBy, statusFilter, ownerFilter, deadlineFrom, deadlineTo])

  // Sync selected project if active changes externaly or on mount
  useEffect(() => {
    if (activeProjectId && !selectedProjectId) {
      queueMicrotask(() => setSelectedProjectId(activeProjectId))
    }
  }, [activeProjectId, selectedProjectId])

  // Filter projects
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = projects.filter((project) => {
      const matchesQuery =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.code || '').toLowerCase().includes(q) ||
        (project.location || '').toLowerCase().includes(q)

      const normalizedStatus = (project.status || 'planning').toLowerCase().replace(' ', '_')
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter

      const matchesOwner = ownerFilter === 'all' || (project.userId || '').toLowerCase() === ownerFilter.toLowerCase()

      const deadlineDate = project.endDate ? new Date(project.endDate) : null
      const fromBoundary = deadlineFrom ? new Date(`${deadlineFrom}T00:00:00`) : null
      const toBoundary = deadlineTo ? new Date(`${deadlineTo}T23:59:59`) : null
      const matchesDeadlineFrom = !fromBoundary || (deadlineDate !== null && deadlineDate >= fromBoundary)
      const matchesDeadlineTo = !toBoundary || (deadlineDate !== null && deadlineDate <= toBoundary)

      return matchesQuery && matchesStatus && matchesOwner && matchesDeadlineFrom && matchesDeadlineTo
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name)
      if (sortBy === 'budget-high') return (b.budget || 0) - (a.budget || 0)
      if (sortBy === 'budget-low') return (a.budget || 0) - (b.budget || 0)
      if (sortBy === 'deadline-near') {
        const aDate = new Date(a.endDate || '9999-12-31').getTime()
        const bDate = new Date(b.endDate || '9999-12-31').getTime()
        return aDate - bDate
      }
      return a.name.localeCompare(b.name)
    })
  }, [projects, searchQuery, statusFilter, sortBy, ownerFilter, deadlineFrom, deadlineTo])

  const ownerOptions = useMemo(() => {
    return Array.from(new Set(
      projects
        .map((project) => (project.userId || '').trim())
        .filter((value) => value.length > 0)
    )).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const resetAdvancedFilters = () => {
    setOwnerFilter('all')
    setDeadlineFrom('')
    setDeadlineTo('')
  }

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId])

  // Handlers
  const handleCreate = () => {
    setEditingProject(null)
    setShowDialog(true)
  }

  const handleEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setEditingProject(p)
    setShowDialog(true)
  }

  const handleDelete = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setPendingDeleteProject(p)
  }

  const handleDeleteConfirm = () => {
    if (!pendingDeleteProject) return
    removeProject(pendingDeleteProject.id)
    if (selectedProjectId === pendingDeleteProject.id) setSelectedProjectId(null)
    setPendingDeleteProject(null)
  }

  const handleSave = (data: Partial<Project>) => {
    if (editingProject) {
      updateProject(editingProject.id, data)
    } else {
      if (data.name) {
        // Auto-generate ID if not provided or empty
        if (!data.id) {
          data.id = generateId('proj')
        }
        addProject(data as Project)
        // Reload from Supabase after a small delay to let sync complete
        setTimeout(() => loadProjects(), 1500)
      } else {
        toast.error("Name required")
      }
    }
    setShowDialog(false)
  }

  const handleEnterProject = () => {
    if (selectedProject) {
      setActiveProject(selectedProject.id)
      navigate('/') // Go to Command Center
      toast.success(`Entered ${selectedProject.name}`)
    }
  }

  const handleActivateConfirm = async () => {
    if (!pendingActivateProject) return
    await activateProject(pendingActivateProject.id)
    setPendingActivateProject(null)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">

      {/* LEFT PANEL: Project List */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">

        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg tracking-tight">Projects</h2>
            <Button size="sm" onClick={handleCreate} className="h-8 w-8 p-0 rounded-full bg-blue-600 hover:bg-blue-700">
              <Plus size={16} />
            </Button>
          </div>
          <ModuleListToolbar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            queryPlaceholder="Search portfolio..."
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={PROJECT_STATUS_FILTERS}
            sortValue={sortBy}
            onSortChange={setSortBy}
            sortOptions={PROJECT_SORTS}
            resultCount={filteredProjects.length}
            resultLabel="projects"
            className="md:flex-col md:items-stretch md:gap-2"
          />
          <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:gap-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Owner (User ID)</Label>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-9" aria-label="Filter by owner user id">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {ownerOptions.map((owner) => (
                    <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Deadline from</Label>
                <Input
                  type="date"
                  value={deadlineFrom}
                  onChange={(event) => setDeadlineFrom(event.target.value)}
                  aria-label="Filter deadline from"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Deadline to</Label>
                <Input
                  type="date"
                  value={deadlineTo}
                  onChange={(event) => setDeadlineTo(event.target.value)}
                  aria-label="Filter deadline to"
                  className="h-9"
                />
              </div>
            </div>
            <Button type="button" variant="outline" className="h-9" onClick={resetAdvancedFilters}>
              Reset Filters
            </Button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`group px-3 py-3 rounded-lg cursor-pointer transition-all border border-transparent ${selectedProjectId === project.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900 shadow-sm'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-100'
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-semibold text-sm line-clamp-1 ${selectedProjectId === project.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
                    {project.name}
                  </h3>
                  {project.id === activeProjectId && (
                    <Badge variant="secondary" className="text-xs h-4 px-1 bg-emerald-100 text-emerald-700 border-0">ACTIVE</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="truncate max-w-[120px]">{project.code || 'NO_CODE'}</span>
                  <Badge variant="outline" className="text-xs h-4 px-1 font-normal text-slate-500 border-slate-200">
                    {project.status || 'Planning'}
                  </Badge>
                </div>
                {/* Mini Progress Bar */}
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/50 rounded-full" style={{ width: '0%' }} />
                </div>
                {/* P1.2.1: Inline KPI chips */}
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {(project.budget ?? 0) > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono tabular-nums">
                      {formatIDR(project.budget!)}
                    </span>
                  )}
                  {project.endDate && (() => {
                    const days = Math.floor((new Date(project.endDate).getTime() - Date.now()) / 86_400_000)
                    if (days < 0) return (
                      <span key="d" className="text-xs bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded">
                        {Math.abs(days)}d overdue
                      </span>
                    )
                    if (days <= 60) return (
                      <span key="d" className="text-xs bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
                        {days}d left
                      </span>
                    )
                    return (
                      <span key="d" className="text-xs bg-slate-50 text-slate-400 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {days}d left
                      </span>
                    )
                  })()}
                  {project.clientName && (
                    <span className="text-xs bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                      {project.clientName}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredProjects.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                No projects found.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANEL: Detail Preview */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/30 dark:bg-slate-950/30 scrollbar-hide">
        {selectedProject ? (
          <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6">

            {/* Header Area */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-xs font-mono uppercase tracking-widest text-slate-500 rounded-md">
                    {selectedProject.code || 'PRJ-???'}
                  </Badge>
                  <Badge className={
                    selectedProject.status === 'Active' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-500'
                  }>
                    {selectedProject.status || 'Planning'}
                  </Badge>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  {selectedProject.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} /> {selectedProject.location || 'Location Not Set'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={14} /> {selectedProject.startDate || 'Start Date Not Set'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleEdit(e, selectedProject)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Project
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleDelete(e, selectedProject)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                    </DropdownMenuItem>
                    {selectedProject.status !== 'Active' && (
                      <DropdownMenuItem onClick={() => setPendingActivateProject(selectedProject)} className="text-blue-600 font-medium border-t mt-1 pt-1">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Activate & Freeze Baseline
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedProject.status !== 'Active' && (
                  <Button
                    variant="outline"
                    className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hidden sm:flex"
                    onClick={() => setPendingActivateProject(selectedProject)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Activate Project
                  </Button>
                )}
                <Button
                  size="lg"
                  onClick={handleEnterProject}
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 text-white font-bold px-8"
                >
                  Enter Project <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} /> Budget Cap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold font-mono tabular-nums">
                    {formatIDR(selectedProject.budget || 0)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Contract Value</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} /> Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-semibold">
                    {selectedProject.startDate || '—'}
                  </div>
                  <div className="text-xs text-slate-400">→ {selectedProject.endDate || '—'}</div>
                  {selectedProject.endDate && (() => {
                    const days = Math.floor((new Date(selectedProject.endDate).getTime() - Date.now()) / 86_400_000)
                    return (
                      <Badge variant={days < 0 ? 'destructive' : days <= 30 ? 'outline' : 'secondary'}
                        className="mt-1.5 text-xs h-5">
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                      </Badge>
                    )
                  })()}
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={14} /> Client
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-semibold">{selectedProject.clientName || 'Not Set'}</div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedProject.location || 'Location not set'}</p>
                </CardContent>
              </Card>
            </div>

            {/* Description / Metadata */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 flex-1">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Project Outline</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {(selectedProject.meta?.description as string) || "No description provided for this project."}
                </p>

                <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div className="border-b border-dashed pb-2">
                    <span className="text-slate-400 block text-xs uppercase mb-1">Contract Type</span>
                    <span className="font-medium">Lump Sum (Default)</span>
                  </div>
                  <div className="border-b border-dashed pb-2">
                    <span className="text-slate-400 block text-xs uppercase mb-1">Currency</span>
                    <span className="font-medium">IDR (Indonesian Rupiah)</span>
                  </div>
                  <div className="border-b border-dashed pb-2">
                    <span className="text-slate-400 block text-xs uppercase mb-1">Project Manager</span>
                    <span className="font-medium">Unassigned</span>
                  </div>
                  <div className="border-b border-dashed pb-2">
                    <span className="text-slate-400 block text-xs uppercase mb-1">Last Updated</span>
                    <span className="font-medium font-mono">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-8 text-center animate-in fade-in duration-500">
            <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-full shadow-sm">
              <Layout size={48} className="opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No Project Selected</h3>
            <p className="max-w-xs text-sm">Select a project from the list on the left to view details or manage its lifecycle.</p>
            <Button onClick={handleCreate} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Create New Project
            </Button>
          </div>
        )}
      </div>

      <ProjectDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        project={editingProject}
        onSave={handleSave}
      />

      <AlertDialog open={!!pendingDeleteProject} onOpenChange={(open) => { if (!open) setPendingDeleteProject(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteProject
                ? `"${pendingDeleteProject.name}" will be removed from your portfolio.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingActivateProject} onOpenChange={(open) => { if (!open) setPendingActivateProject(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Project & Freeze Baseline?</AlertDialogTitle>
            <AlertDialogDescription>
              Activating &quot;{pendingActivateProject?.name}&quot; will freeze its current Resource Allocation Budget (RAB) and Resource Allocation Plan (RAP) as the &quot;Initial Baseline&quot;.
              <br /><br />
              This signifies that the project is moving into the Execution phase. Any future variations to the budget will be tracked against this baseline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
              Activate & Freeze
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
