import React, { useState } from 'react'
import { ChevronsUpDown, Check, FolderOpen, Search } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNavigate } from 'react-router-dom'

export function ProjectSwitcherDropdown() {
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const projectList = Object.values(projects)
    .filter((p) => !p.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = search.trim()
    ? projectList.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.code ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : projectList.slice(0, 8)

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-500',
    'in-progress': 'bg-blue-500',
    completed: 'bg-muted-foreground/40',
    on_hold: 'bg-amber-400',
  }

  const handleSelect = (projectId: string) => {
    setActiveProject(projectId)
    setSearch('')
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setSearch('') }}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 h-8 max-w-[220px] px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:border-border dark:hover:border-border hover:bg-accent/40 transition-colors bg-transparent truncate"
          aria-label="Ganti proyek aktif"
        >
          <FolderOpen size={13} className="shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            {activeProject ? activeProject.name : 'Pilih Proyek'}
          </span>
          <ChevronsUpDown size={12} className="shrink-0 text-muted-foreground ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0" sideOffset={6}>
        <DropdownMenuLabel className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Proyek
        </DropdownMenuLabel>
        {/* Search */}
        <div className="relative px-2 pb-1">
          <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full h-7 pl-6 pr-2 text-xs rounded border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="Cari proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-52 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Tidak ditemukan</p>
          ) : (
            filtered.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${statusColor[project.status ?? ''] ?? 'bg-muted-foreground/30'}`}
                />
                <span className="truncate flex-1">{project.name}</span>
                {project.code && (
                  <span className="text-xs text-muted-foreground shrink-0">{project.code}</span>
                )}
                {project.id === activeProjectId && (
                  <Check size={12} className="shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
        {projectList.length > 8 && !search && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-muted-foreground justify-center py-1.5"
              onClick={() => navigate('/projects')}
            >
              Lihat semua {projectList.length} proyek →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
