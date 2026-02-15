/**
 * ProjectManagement.tsx
 * Dashboard manajemen multi-proyek: daftar proyek, ringkasan portfolio, dan set active project.
 * Menyediakan form sederhana untuk menambah proyek baru.
 */

import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { FolderKanban, Plus, CheckCircle2, DollarSign, Calendar, MapPin, MoreVertical, Edit, Trash2, Search, ArrowUpDown, Eye } from 'lucide-react'
import { useProjectStore, type Project } from '../../store/projectStore'
import { ProjectDialog } from '../../components/project/ProjectDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu'
import { formatIDR } from '../../lib/utils'
import { toast } from 'sonner'

/**
 * Project card menampilkan KPI ringkas dan tombol set aktif.
 */
function ProjectCard({
  project,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onViewOverview,
}: {
  project: Project
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
  onViewOverview: () => void
}) {
  return (
    <Card className={`overflow-hidden flex flex-col ${isActive ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold leading-none">
              {project.name}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {project.id}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-100">
                Active
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Budget
            </span>
            <span className="font-medium">{formatIDR(project.budget || 0)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Status
            </span>
            <Badge variant="outline" className="w-fit font-normal">
              {project.status || 'Planning'}
            </Badge>
          </div>
          {project.startDate && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Start
              </span>
              <span className="font-medium">{project.startDate}</span>
            </div>
          )}
          {project.location && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </span>
              <span className="font-medium truncate">{project.location}</span>
            </div>
          )}
        </div>
        {project.meta?.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
            {project.meta.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-0 gap-2">
        <Button
          className="flex-1"
          variant={isActive ? 'secondary' : 'default'}
          onClick={onActivate}
          disabled={isActive}
        >
          {isActive ? 'Currently Active' : 'Set Active'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="View Overview"
          onClick={onViewOverview}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Halaman Project Management
 */
export default function ProjectManagement() {
  const navigate = useNavigate()
  /**
   * Select raw projects object from the store (stable reference).
   * Convert to array with useMemo so we don't create a new array on every render
   * which can cause unnecessary re-renders / update loops.
   */
  const projectsObj = useProjectStore((s) => s.projects)
  const projects = useMemo(() => Object.values(projectsObj), [projectsObj])
  const activeId = useProjectStore((s) => s.activeProjectId)
  const setActive = useProjectStore((s) => s.setActiveProject)
  const addProject = useProjectStore((s) => s.addProject)
  const updateProject = useProjectStore((s) => s.updateProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const loadProjects = useProjectStore((s) => s.loadProjects)

  // Load projects from Supabase on mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')

  // Filtered + sorted projects
  const filteredProjects = useMemo(() => {
    let result = [...projects]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q) ||
          (p.clientName || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => (p.status || 'Planning').toLowerCase() === statusFilter.toLowerCase())
    }

    // Sort
    const [field, dir] = sortBy.split('-') as [string, string]
    result.sort((a, b) => {
      let cmp = 0
      switch (field) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'date':
          cmp = (a.startDate || '').localeCompare(b.startDate || '')
          break
        case 'budget':
          cmp = (a.budget || 0) - (b.budget || 0)
          break
        default:
          cmp = 0
      }
      return dir === 'desc' ? -cmp : cmp
    })

    return result
  }, [projects, searchQuery, statusFilter, sortBy])

  // Ringkasan portfolio
  const summary = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const activeCount = projects.filter((p) => p.status?.toLowerCase() === 'active').length
    const planningCount = projects.filter((p) => p.status?.toLowerCase() === 'planning').length
    return { totalBudget, activeCount, planningCount, total: projects.length }
  }, [projects])

  // Handlers
  const handleAdd = () => {
    setEditingProject(null)
    setShowDialog(true)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setShowDialog(true)
  }

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
      removeProject(project.id)
    }
  }

  const handleSave = (data: Partial<Project>) => {
    if (editingProject) {
      updateProject(editingProject.id, data)
    } else {
      if (data.name) {
        // If ID is missing, we still send it as undefined/empty string
        // so the database trigger can handle it
        addProject(data as Project)
      } else {
        toast.error("Project Name is required")
      }
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<FolderKanban size={18} />}
        title="Project Management"
        description="Kelola portofolio proyek, pilih aktif, dan tambah proyek baru."
        actions={
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        }
      />

      {/* Portfolio summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planning Phase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.planningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(summary.totalBudget)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filter, Sort toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A → Z</SelectItem>
            <SelectItem value="name-desc">Name Z → A</SelectItem>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="budget-desc">Budget High → Low</SelectItem>
            <SelectItem value="budget-asc">Budget Low → High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid projects */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-muted/10">
          <h3 className="text-lg font-medium">{projects.length === 0 ? 'No Projects Found' : 'No Matching Projects'}</h3>
          <p className="text-muted-foreground mb-4">
            {projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your search or filters.'}
          </p>
          {projects.length === 0 && (
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={p.id === activeId}
              onActivate={() => setActive(p.id)}
              onEdit={() => handleEdit(p)}
              onDelete={() => handleDelete(p)}
              onViewOverview={() => {
                setActive(p.id)
                navigate('/project-overview')
              }}
            />
          ))}
        </div>
      )}

      <ProjectDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        project={editingProject}
        onSave={handleSave}
      />
    </div>
  )
}
