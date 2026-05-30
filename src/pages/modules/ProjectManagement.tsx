import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Plus,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
  Edit,
  Trash2,
  Search,
} from 'lucide-react'
import { useProjectStore, type Project } from '../../store/projectStore'
import { ProjectDialog } from '../../components/project/ProjectDialog'
import { formatIDR } from '../../lib/utils'
import { generateId } from '../../lib/idGenerator'
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
// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader } from '@/components/patterns'

// ── Status filter pill definitions ─────────────────────────────────────────
const STATUS_FILTERS = ['Semua', 'Aktif', 'Draft', 'Ditangguhkan', 'Selesai', 'Terminasi'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_MAP: Record<StatusFilter, string[]> = {
  Semua: [],
  Aktif: ['active', 'ACTIVE', 'Active'],
  Draft: ['planning', 'PLANNING', 'draft', 'DRAFT', 'Planning'],
  Ditangguhkan: ['on_hold', 'ON_HOLD', 'On Hold'],
  Selesai: ['completed', 'COMPLETED', 'Completed'],
  Terminasi: ['terminated', 'TERMINATED', 'Terminated'],
}

// ── Sort option definitions ─────────────────────────────────────────────────
type SortOption = 'newest' | 'name-asc' | 'name-desc' | 'budget-high' | 'deadline-near'
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'name-asc', label: 'Nama A-Z' },
  { value: 'name-desc', label: 'Nama Z-A' },
  { value: 'budget-high', label: 'Anggaran Tertinggi' },
  { value: 'deadline-near', label: 'Deadline Terdekat' },
]

// ── Status badge helper ─────────────────────────────────────────────────────
function getStatusBadgeClass(status?: string): string {
  const s = (status || '').toLowerCase().replace(' ', '_')
  if (['active'].includes(s)) return 'bg-green-500/10 text-green-400 border border-green-500/20'
  if (['planning', 'draft'].includes(s)) return 'bg-slate-500/10 text-muted-foreground border border-border/20'
  if (['on_hold'].includes(s)) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
  if (['completed'].includes(s)) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
  if (['terminated'].includes(s)) return 'bg-red-500/10 text-red-400 border border-red-500/20'
  return 'bg-slate-500/10 text-muted-foreground border border-border/20'
}

function getStatusLabel(status?: string): string {
  const s = (status || '').toLowerCase().replace(' ', '_')
  if (s === 'active') return 'Aktif'
  if (['planning', 'draft'].includes(s)) return 'Draft'
  if (s === 'on_hold') return 'Ditangguhkan'
  if (s === 'completed') return 'Selesai'
  if (s === 'terminated') return 'Terminasi'
  return status || 'Draft'
}

// ── Deadline display helper ─────────────────────────────────────────────────
function getDeadlineDisplay(endDate?: string): string {
  if (!endDate) return '—'
  const d = new Date(endDate)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Project Card ────────────────────────────────────────────────────────────
interface ProjectCardProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onActivate: () => void
  onEnter: () => void
}

function ProjectCard({
  project,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onActivate,
  onEnter,
}: ProjectCardProps) {
  const statusNorm = (project.status || '').toLowerCase().replace(' ', '_')
  const isActivated = ['active'].includes(statusNorm)

  return (
    <div
      onClick={onSelect}
      className={[
        'bg-card rounded-xl border p-5 cursor-pointer transition-all duration-200',
        isActive
          ? 'border-nl-orange/30 ring-2 ring-nl-orange ring-offset-2 ring-offset-nl-navy-1'
          : 'border-border hover:border-nl-orange/30',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-white text-sm leading-snug line-clamp-2 flex-1">
          {project.name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusBadgeClass(project.status)}`}
          >
            {getStatusLabel(project.status)}
          </span>
          {/* Edit/Delete kebab menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Opsi proyek"
              >
                <MoreVertical size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" /> Edit Proyek
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Hapus Proyek
              </DropdownMenuItem>
              {!isActivated && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onActivate() }}
                  className="text-blue-500 font-medium"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aktifkan Proyek
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sub-info row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mb-3">
        {project.code && (
          <span className="font-mono tracking-tight">{project.code}</span>
        )}
        {project.code && (project.location || project.budget) && (
          <span className="text-muted-foreground">·</span>
        )}
        {project.location && (
          <span className="truncate max-w-[120px]">{project.location}</span>
        )}
        {project.location && project.budget && (
          <span className="text-muted-foreground">·</span>
        )}
        {(project.budget ?? 0) > 0 && (
          <span className="font-mono">{formatIDR(project.budget!)}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted/50 rounded-full h-1.5 mt-1">
        <div
          className="bg-nl-cyan rounded-full h-1.5 transition-all duration-500"
          style={{ width: `${project.progress ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-right tabular-nums">
        {project.progress != null ? `${project.progress}%` : 'Belum ada data'}
      </p>

      {/* KPI mini row */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <span>
          <span className="text-muted-foreground">CPI </span>
          <span className={`font-mono font-bold ${
            project.cpi != null
              ? project.cpi >= 1 ? 'text-nl-cyan' : project.cpi >= 0.9 ? 'text-amber-400' : 'text-red-400'
              : 'text-muted-foreground'
          }`}>
            {project.cpi != null ? project.cpi.toFixed(2) : '—'}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">SPI </span>
          <span className={`font-mono font-bold ${
            project.spi != null
              ? project.spi >= 1 ? 'text-nl-cyan' : project.spi >= 0.9 ? 'text-amber-400' : 'text-red-400'
              : 'text-muted-foreground'
          }`}>
            {project.spi != null ? project.spi.toFixed(2) : '—'}
          </span>
        </span>
        <span className="ml-auto text-muted-foreground truncate max-w-[100px]">
          {getDeadlineDisplay(project.endDate)}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/50">
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-nl-orange-dim border border-nl-orange/40 text-nl-orange-light cursor-default select-none">
            <CheckCircle2 size={12} /> Proyek Aktif
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onEnter() }}
            className="text-xs text-muted-foreground hover:text-nl-orange-light hover:underline transition-colors font-medium"
          >
            Pilih Proyek →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ProjectManagement() {
  const navigate = useNavigate()
  const {
    projects: projectsObj,
    activeProjectId,
    setActiveProject,
    addProject,
    updateProject,
    removeProject,
    activateProject,
    loadProjects,
  } = useProjectStore()

  const projects = useMemo(() => Object.values(projectsObj), [projectsObj])

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId || null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return localStorage.getItem('pm.toolbar.query') || '' } catch { return '' }
  })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    try {
      const stored = localStorage.getItem('pm.toolbar.status2') as StatusFilter | null
      return STATUS_FILTERS.includes(stored as StatusFilter) ? (stored as StatusFilter) : 'Semua'
    } catch { return 'Semua' }
  })
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try { return (localStorage.getItem('pm.toolbar.sort') as SortOption) || 'newest' } catch { return 'newest' }
  })
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null)
  const [pendingActivateProject, setPendingActivateProject] = useState<Project | null>(null)

  // ── Side effects ─────────────────────────────────────────────────────────
  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    try {
      localStorage.setItem('pm.toolbar.query', searchQuery)
      localStorage.setItem('pm.toolbar.status2', statusFilter)
      localStorage.setItem('pm.toolbar.sort', sortBy)
    } catch { /* ignore */ }
  }, [searchQuery, statusFilter, sortBy])

  useEffect(() => {
    if (activeProjectId && !selectedProjectId) {
      queueMicrotask(() => setSelectedProjectId(activeProjectId))
    }
  }, [activeProjectId, selectedProjectId])

  // ── Filtered + sorted projects ───────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const allowedStatuses = STATUS_MAP[statusFilter]

    const filtered = projects.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'Semua' ||
        allowedStatuses.includes(p.status || 'planning')

      return matchesQuery && matchesStatus
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name)
      if (sortBy === 'budget-high') return (b.budget || 0) - (a.budget || 0)
      if (sortBy === 'deadline-near') {
        return (
          new Date(a.endDate || '9999-12-31').getTime() -
          new Date(b.endDate || '9999-12-31').getTime()
        )
      }
      // newest: reverse lexicographic by id (approximates insertion order)
      return b.id.localeCompare(a.id)
    })
  }, [projects, searchQuery, statusFilter, sortBy])

  // ── Handlers ─────────────────────────────────────────────────────────────
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
        if (!data.id) data.id = generateId('proj')
        addProject(data as Project)
        setTimeout(() => loadProjects(), 1500)
      } else {
        toast.error('Name required')
      }
    }
    setShowDialog(false)
  }

  const handleEnterProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId)
    if (p) {
      setActiveProject(p.id)
      navigate('/')
      toast.success(`Masuk ke ${p.name}`)
    }
  }

  const handleActivateConfirm = async () => {
    if (!pendingActivateProject) return
    await activateProject(pendingActivateProject.id)
    setPendingActivateProject(null)
  }

  // ── Active project label for context bar ────────────────────────────────
  const activeProject = activeProjectId ? projectsObj[activeProjectId] : undefined

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Urutkan'

  return (
    <>
      <PageShell
        contextBar={
          <GlobalContextBar
            projectName={activeProject ? activeProject.name : 'Portfolio'}
            packageName="Manajemen Proyek"
            syncStatus="synced"
          />
        }
        header={
          <WorkspaceHeader
            title="Proyek"
            subtitle={`${filteredProjects.length} proyek ditemukan`}
            primaryAction={{
              label: 'Proyek Baru',
              icon: <Plus className="h-3.5 w-3.5" />,
              onClick: handleCreate,
            }}
          />
        }
      >
        {/* ── Filter bar ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Search input */}
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari proyek..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-card border border-border text-foreground placeholder-slate-500 focus:outline-none focus:border-nl-orange/40 focus:ring-1 focus:ring-nl-orange/30 transition-colors"
            />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  statusFilter === filter
                    ? 'bg-nl-orange-dim border-nl-orange/40 text-nl-orange-light'
                    : 'bg-card border-white/10 text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="sm:ml-auto shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors">
                  {sortLabel}
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={sortBy === opt.value ? 'font-semibold text-nl-orange-light' : ''}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Project cards grid ─────────────────────────────────────── */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
            <p className="text-sm">Tidak ada proyek yang ditemukan.</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-card border border-white/10 text-foreground hover:text-white hover:border-nl-orange/30 transition-colors"
            >
              <Plus size={14} /> Buat Proyek Baru
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                onSelect={() => setSelectedProjectId(project.id)}
                onEdit={(e) => handleEdit(e, project)}
                onDelete={(e) => handleDelete(e, project)}
                onActivate={() => setPendingActivateProject(project)}
                onEnter={() => handleEnterProject(project.id)}
              />
            ))}
          </div>
        )}
      </PageShell>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <ProjectDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        project={editingProject}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!pendingDeleteProject}
        onOpenChange={(open) => { if (!open) setPendingDeleteProject(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus proyek?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteProject
                ? `"${pendingDeleteProject.name}" akan dihapus dari portofolio Anda.`
                : 'Tindakan ini tidak dapat dibatalkan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingActivateProject}
        onOpenChange={(open) => { if (!open) setPendingActivateProject(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktifkan Proyek &amp; Bekukan Baseline?</AlertDialogTitle>
            <AlertDialogDescription>
              Mengaktifkan &quot;{pendingActivateProject?.name}&quot; akan membekukan RAB dan RAP
              saat ini sebagai &quot;Initial Baseline&quot;.
              <br /><br />
              Ini menandakan proyek memasuki fase Eksekusi. Semua variasi anggaran ke depan akan
              dilacak terhadap baseline ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivateConfirm}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Aktifkan &amp; Bekukan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
