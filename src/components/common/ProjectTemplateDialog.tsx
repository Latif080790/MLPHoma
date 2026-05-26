/**
 * ProjectTemplateDialog.tsx
 * v4 Sprint 3 — Item 15: Project Templates
 *
 * Two-mode dialog:
 *  - "save"  → name + save current project as template
 *  - "apply" → list saved templates, apply one to current project
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  loadTemplates,
  saveTemplateFromProject,
  applyTemplate,
  deleteTemplate,
  type ProjectTemplate,
} from '@/services/templateService'
import { Trash2, Download, FolderOpen, Save } from 'lucide-react'

type Mode = 'save' | 'apply'

interface ProjectTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  /** Current project ID */
  projectId: string
  /** Called after applying a template (pass item count) */
  onApplied?: (count: number) => void
  /** Called after saving a template */
  onSaved?: (template: ProjectTemplate) => void
}

export function ProjectTemplateDialog({
  open,
  onOpenChange,
  mode,
  projectId,
  onApplied,
  onSaved,
}: ProjectTemplateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && mode === 'apply') {
      setTemplates(loadTemplates())
      setSelectedId(null)
    }
    if (open && mode === 'save') {
      setName('')
      setDescription('')
    }
  }, [open, mode])

  function handleSave() {
    if (!name.trim()) {
      toast.error('Nama template wajib diisi')
      return
    }
    setLoading(true)
    try {
      const tpl = saveTemplateFromProject(projectId, name.trim(), description.trim() || undefined)
      toast.success('Template disimpan', { description: `"${tpl.name}" tersedia untuk dipakai ulang.` })
      onSaved?.(tpl)
      onOpenChange(false)
    } catch (err) {
      toast.error('Gagal menyimpan template')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!selectedId) {
      toast.error('Pilih template terlebih dahulu')
      return
    }
    setLoading(true)
    try {
      const count = applyTemplate(selectedId, projectId)
      toast.success('Template diterapkan', { description: `${count} task ditambahkan ke proyek.` })
      onApplied?.(count)
      onOpenChange(false)
    } catch (err) {
      toast.error('Gagal menerapkan template')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteTemplate(id)
    setTemplates(loadTemplates())
    if (selectedId === id) setSelectedId(null)
    toast.success('Template dihapus')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            {mode === 'save' ? (
              <><Save className="h-4 w-4 text-brand-primary-500" /> Simpan Sebagai Template</>
            ) : (
              <><FolderOpen className="h-4 w-4 text-brand-primary-500" /> Terapkan Template</>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === 'save' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">Nama Template <span className="text-red-500">*</span></Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Template Gedung 3 Lantai"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc" className="text-xs font-medium">Deskripsi (opsional)</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat template..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Template akan menyimpan semua task pada proyek ini sebagai acuan untuk proyek baru.
            </p>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-sm text-neutral-400">
                Belum ada template tersimpan.
                <br />
                <span className="text-xs">Gunakan &quot;Simpan Sebagai Template&quot; pada proyek lain.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedId(tpl.id)}
                    className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedId === tpl.id
                        ? 'border-brand-primary-400 bg-brand-primary-050 dark:bg-brand-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{tpl.name}</p>
                      {tpl.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{tpl.description}</p>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">{tpl.wbsItems.length} task · dibuat {new Date(tpl.createdAt).toLocaleDateString('id-ID')}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(tpl.id, e)}
                      className="shrink-0 p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label="Hapus template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          {mode === 'save' ? (
            <Button size="sm" onClick={handleSave} disabled={loading || !name.trim()}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Simpan Template
            </Button>
          ) : (
            <Button size="sm" onClick={handleApply} disabled={loading || !selectedId}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Terapkan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
