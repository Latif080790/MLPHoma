import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Plus, CheckCircle2, DollarSign, Calendar, MapPin, Search, ArrowRight, Layout, TrendingUp, AlertCircle, Clock, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { useProjectStore, type Project } from '../../store/projectStore'
import { ProjectDialog } from '../../components/project/ProjectDialog'
import { formatIDR } from '../../lib/utils'
import { toast } from 'sonner'
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

export default function ProjectManagement() {
  const navigate = useNavigate()
  const { projects: projectsObj, activeProjectId, setActiveProject, addProject, updateProject, removeProject, loadProjects } = useProjectStore()

  const projects = useMemo(() => Object.values(projectsObj), [projectsObj])

  // Local state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId || null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Sync selected project if active changes externaly or on mount
  useEffect(() => {
    if (activeProjectId && !selectedProjectId) {
      setSelectedProjectId(activeProjectId)
    }
  }, [activeProjectId])

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    )
  }, [projects, searchQuery])

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
      if (data.name) addProject(data as Project)
      else toast.error("Name required")
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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search portfolio..."
              className="pl-8 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
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
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-emerald-100 text-emerald-700 border-0">ACTIVE</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="truncate max-w-[120px]">{project.code || 'NO_CODE'}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal text-slate-500 border-slate-200">
                    {project.status || 'Planning'}
                  </Badge>
                </div>
                {/* Mini Progress Bar */}
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/50 rounded-full" style={{ width: '0%' }} />
                  {/* TODO: Connect to real progress */}
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
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} /> Budget Cap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    {formatIDR(selectedProject.budget || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={14} /> Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">0%</div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-0" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={14} /> Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-emerald-600">0</div>
                  <p className="text-xs text-slate-400 mt-1">No critical issues detected</p>
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
                  {selectedProject.meta?.description || "No description provided for this project."}
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

    </div>
  )
}
