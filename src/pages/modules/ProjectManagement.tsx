/**
 * ProjectManagement.tsx
 * Dashboard manajemen multi-proyek: daftar proyek, ringkasan portfolio, dan set active project.
 * Menyediakan form sederhana untuk menambah proyek baru.
 */

import React, { useMemo, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { FolderKanban, Plus, CheckCircle2, DollarSign } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'

/**
 * Project card menampilkan KPI ringkas dan tombol set aktif.
 */
function ProjectCard({
  id,
  name,
  budget,
  status,
  isActive,
  onActivate,
}: {
  id: string
  name: string
  budget: number
  status: string
  isActive: boolean
  onActivate: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{name}</span>
          {isActive ? (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Active
            </Badge>
          ) : (
            <Badge variant="outline">{status || '—'}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md border p-3 text-sm dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>Budget</span>
          </div>
          <strong>Rp {Number(budget || 0).toLocaleString('id-ID')}</strong>
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>ID</span>
          <span>{id}</span>
        </div>
        <Button className="w-full" variant={isActive ? 'outline' : 'default'} onClick={onActivate} disabled={isActive}>
          {isActive ? 'Currently Active' : 'Set Active'}
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Halaman Project Management
 */
export default function ProjectManagement() {
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

  // Form tambah proyek
  const [form, setForm] = useState({
    name: '',
    id: '',
    budget: '',
    status: 'Planning',
  })

  // Ringkasan portfolio
  const summary = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const activeCount = projects.filter((p) => p.status?.toLowerCase() === 'active').length
    const planningCount = projects.filter((p) => p.status?.toLowerCase() === 'planning').length
    return { totalBudget, activeCount, planningCount, total: projects.length }
  }, [projects])

  // Handler tambah proyek
  const onAdd = () => {
    if (!form.id || !form.name) return
    addProject({
      id: form.id,
      name: form.name,
      budget: Number(form.budget || 0),
      status: form.status,
    } as any)
    setForm({ name: '', id: '', budget: '', status: 'Planning' })
  }

  return (
    <AppShell projectName="Portfolio">
      <ModuleHeader
        icon={<FolderKanban size={18} />}
        title="Project Management"
        description="Kelola portofolio proyek, pilih aktif, dan tambah proyek baru."
      />

      {/* Portfolio summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="mt-1 text-xs text-neutral-500">Projects in portfolio</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeCount}</div>
            <div className="mt-1 text-xs text-neutral-500">Currently running</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.planningCount}</div>
            <div className="mt-1 text-xs text-neutral-500">Upcoming</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {summary.totalBudget.toLocaleString('id-ID')}</div>
            <div className="mt-1 text-xs text-neutral-500">Across all projects</div>
          </CardContent>
        </Card>
      </div>

      {/* Grid projects */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            id={p.id}
            name={p.name}
            budget={(p as any).budget || 0}
            status={(p as any).status || '—'}
            isActive={p.id === activeId}
            onActivate={() => setActive(p.id)}
          />
        ))}
      </div>

      {/* Add new project */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Project
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Project ID</div>
              <Input
                placeholder="P-004"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Project Name</div>
              <Input
                placeholder="Proyek Baru"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Budget (IDR)</div>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Status</div>
              <Input
                placeholder="Active / Planning / Hold"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button className="w-full" onClick={onAdd}>
                Add Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
