/**
 * WBS.tsx
 * Work Breakdown Structure module — hierarchical tree, inspector panel,
 * summary KPIs, and full CRUD wired to wbsStore.
 *
 * Renders in two modes:
 *   - standalone : full WorkspaceHeader + toolbar + summary + tree/detail split
 *   - embedded   : compact layout that fits inside the Project Costing pipeline tab
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { toast } from 'sonner'

import ModulePageState from '../../components/common/ModulePageState'
import { useProjectStore } from '../../store/projectStore'
import { useWBSStore } from '../../store/wbsStore'
import { useRabStore } from '../../store/rabStore'
import { useTimelineStore } from '../../store/timelineStore'

import { WBSTree } from '../../components/wbs/WBSTree'
import { WBSEditor } from '../../components/wbs/WBSEditor'
import { WBSToolbar, type WBSLevelFilter } from '../../components/wbs/WBSToolbar'
import { WBSDetailPanel } from '../../components/wbs/WBSDetailPanel'
import { WorkspaceHeader, SummaryStrip } from '../../components/patterns'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../components/ui/alert-dialog'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'
import type { RABItem } from '../../types/rab'

const EMPTY_WBS: WBSItem[] = []
const EMPTY_RAB: RABItem[] = []
const EMPTY_TASKS: { id: string; wbsId?: string; name: string }[] = []

/** RAB item total with cross-naming fallbacks */
function rabTotal(r: RABItem): number {
  return (
    r.finalTotal ??
    r.final_total ??
    r.finalPrice ??
    (r.volume ?? 0) * (r.unit_price ?? r.unitPrice ?? 0)
  )
}

export default function WBS({ embedded = false }: { embedded?: boolean } = {}) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeProjectName = useProjectStore((s) =>
    s.activeProjectId ? s.projects[s.activeProjectId]?.name : undefined,
  )

  // ── Store: WBS state + actions ──────────────────────────────────────────
  const items = useWBSStore((s) => (activeProjectId ? s.itemsByProject[activeProjectId] ?? EMPTY_WBS : EMPTY_WBS))
  const selectedId = useWBSStore((s) => s.selectedId)
  const loading = useWBSStore((s) => s.loading)
  const pendingDelete = useWBSStore((s) => s.pendingDeleteConfirmation)
  const fetchItems = useWBSStore((s) => s.fetchItems)
  const addItem = useWBSStore((s) => s.addItem)
  const updateItem = useWBSStore((s) => s.updateItem)
  const deleteItem = useWBSStore((s) => s.deleteItem)
  const confirmDelete = useWBSStore((s) => s.confirmDelete)
  const cancelDelete = useWBSStore((s) => s.cancelDelete)
  const moveItem = useWBSStore((s) => s.moveItem)
  const generateCodes = useWBSStore((s) => s.generateCodes)
  const importWBS = useWBSStore((s) => s.importWBS)
  const exportWBS = useWBSStore((s) => s.exportWBS)
  const selectItem = useWBSStore((s) => s.selectItem)

  // ── Cross-module data for budget / timeline linkage ─────────────────────
  const rabItems = useRabStore((s) => (activeProjectId ? s.getItems(activeProjectId) : EMPTY_RAB))
  const timelineTasks = useTimelineStore((s) =>
    activeProjectId ? s.tasksByProject[activeProjectId] ?? EMPTY_TASKS : EMPTY_TASKS,
  )

  // ── Local UI state (not persisted in store) ─────────────────────────────
  const [filterText, setFilterText] = useState('')
  const [levelFilter, setLevelFilter] = useState<WBSLevelFilter>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorItem, setEditorItem] = useState<WBSItem | null>(null)
  const [editorParentId, setEditorParentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch on mount / project change
  useEffect(() => {
    if (activeProjectId) void fetchItems(activeProjectId)
  }, [activeProjectId, fetchItems])

  // Auto-expand root level once items arrive and nothing is expanded yet
  useEffect(() => {
    if (items.length && expandedIds.size === 0) {
      setExpandedIds(new Set(items.filter((i) => !i.parentId).map((i) => i.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // ── Derived: budget per WBS node + grand total ──────────────────────────
  const { budgetByWbs, budgetLinkedTotal } = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const r of rabItems) {
      if (!r.wbsId) continue
      const t = rabTotal(r)
      map.set(r.wbsId, (map.get(r.wbsId) ?? 0) + t)
      total += t
    }
    return { budgetByWbs: map, budgetLinkedTotal: total }
  }, [rabItems])

  // ── Derived: timeline task count per WBS node ───────────────────────────
  const timelineCountByWbs = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of timelineTasks) {
      if (t.wbsId) m.set(t.wbsId, (m.get(t.wbsId) ?? 0) + 1)
    }
    return m
  }, [timelineTasks])

  // ── Derived: summary KPIs ───────────────────────────────────────────────
  const summary = useMemo(() => {
    const n = items.length
    const avgProgress = n ? Math.round(items.reduce((s, i) => s + (i.progress ?? 0), 0) / n) : 0
    const qcPassed = items.filter((i) => i.qc_status === 'PASSED').length
    const idSet = new Set(items.map((i) => i.id))
    let timelineLinked = 0
    timelineCountByWbs.forEach((c, id) => {
      if (idSet.has(id)) timelineLinked += c
    })
    return { n, avgProgress, qcPassed, timelineLinked }
  }, [items, timelineCountByWbs])

  // Level filter is a max-depth display filter — ancestors are always lower level
  const displayedItems = useMemo(
    () => (levelFilter ? items.filter((i) => (i.level ?? 1) <= levelFilter) : items),
    [items, levelFilter],
  )

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => setExpandedIds(new Set(items.map((i) => i.id))), [items])
  const handleCollapseAll = useCallback(() => setExpandedIds(new Set()), [])

  const openAddRoot = useCallback(() => {
    setEditorItem(null)
    setEditorParentId(null)
    setEditorOpen(true)
  }, [])

  const openAddChild = useCallback((parentId: string | null) => {
    setEditorItem(null)
    setEditorParentId(parentId)
    setEditorOpen(true)
    if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId))
  }, [])

  const openEdit = useCallback((item: WBSItem) => {
    setEditorItem(item)
    setEditorParentId(item.parentId ?? null)
    setEditorOpen(true)
  }, [])

  const handleDelete = useCallback(
    (item: WBSItem) => {
      if (!activeProjectId) return
      deleteItem(activeProjectId, item.id)
    },
    [activeProjectId, deleteItem],
  )

  const handleSave = useCallback(
    (data: Omit<WBSItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!activeProjectId) return
      if (editorItem) {
        updateItem(activeProjectId, editorItem.id, data)
      } else {
        addItem(activeProjectId, data)
        if (data.parentId) setExpandedIds((prev) => new Set(prev).add(data.parentId as string))
      }
    },
    [activeProjectId, editorItem, updateItem, addItem],
  )

  const handleGenerateCodes = useCallback(() => {
    if (!activeProjectId) return
    generateCodes(activeProjectId)
    toast.success('Kode WBS diperbarui')
  }, [activeProjectId, generateCodes])

  const handleExport = useCallback(() => {
    if (!activeProjectId) return
    const data = exportWBS(activeProjectId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wbs-${activeProjectName ?? activeProjectId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${data.length} item WBS diekspor`)
  }, [activeProjectId, activeProjectName, exportWBS])

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-selecting the same file
      if (!file || !activeProjectId) return
      try {
        const parsed = JSON.parse(await file.text())
        if (!Array.isArray(parsed)) throw new Error('Format tidak valid — diharapkan array item WBS')
        const cleaned = (parsed as WBSItem[]).map((it) => ({
          code: it.code ?? '',
          name: it.name ?? '',
          description: it.description,
          level: it.level ?? 1,
          parentId: it.parentId ?? null,
          sortOrder: it.sortOrder ?? 0,
          qc_status: it.qc_status,
          progress: it.progress,
          progressSource: it.progressSource,
          physicalProgressLocked: it.physicalProgressLocked,
        }))
        await importWBS(activeProjectId, cleaned)
        toast.success(`${cleaned.length} item WBS diimpor`)
      } catch (err) {
        toast.error('Gagal impor WBS', { description: (err as Error).message })
      }
    },
    [activeProjectId, importWBS],
  )

  // ── Guard: no project ───────────────────────────────────────────────────
  if (!activeProjectId) {
    if (embedded) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-slate-400">
          Pilih proyek aktif untuk melihat WBS.
        </div>
      )
    }
    return (
      <ModulePageState
        icon={<GitBranch size={18} />}
        title="WBS"
        description="Work Breakdown Structure"
        variant="empty"
        message="Pilih proyek aktif untuk melihat WBS."
      />
    )
  }

  const selectedBudget = selectedId ? budgetByWbs.get(selectedId) ?? 0 : 0
  const selectedTimelineCount = selectedId ? timelineCountByWbs.get(selectedId) ?? 0 : 0

  // ── Shared content blocks ───────────────────────────────────────────────
  const toolbar = (
    <WBSToolbar
      filterText={filterText}
      onFilterChange={setFilterText}
      levelFilter={levelFilter}
      onLevelChange={setLevelFilter}
      onExpandAll={handleExpandAll}
      onCollapseAll={handleCollapseAll}
      onImport={handleImportClick}
      onExport={handleExport}
      onGenerateCodes={handleGenerateCodes}
      onAddRoot={openAddRoot}
      compact={embedded}
    />
  )

  const summaryStrip = (
    <SummaryStrip
      items={[
        { label: 'Total Item', value: summary.n, status: 'info' },
        { label: 'Progress Rata', value: `${summary.avgProgress}%`, status: summary.avgProgress >= 100 ? 'success' : 'info' },
        { label: 'Budget RAB', value: formatIDR(budgetLinkedTotal), status: 'warning' },
        { label: 'QC Passed', value: `${summary.qcPassed}/${summary.n}`, status: summary.qcPassed === summary.n && summary.n > 0 ? 'success' : 'neutral' },
        { label: 'Timeline Linked', value: summary.timelineLinked, status: 'info' },
      ]}
    />
  )

  const tree = (
    <WBSTree
      items={displayedItems}
      selectedId={selectedId}
      expandedIds={expandedIds}
      loading={loading}
      filterText={filterText}
      budgetByWbs={budgetByWbs}
      onItemClick={(item) => selectItem(item.id)}
      onToggleExpand={handleToggleExpand}
      onAddItem={openAddChild}
      onEditItem={openEdit}
      onDeleteItem={handleDelete}
      onMoveItem={(itemId, newParentId, index) => moveItem(activeProjectId, itemId, newParentId, index)}
    />
  )

  const detailPanel = (
    <WBSDetailPanel
      item={selectedItem}
      budgetLinked={selectedBudget}
      timelineTaskCount={selectedTimelineCount}
      onEdit={openEdit}
      onDelete={handleDelete}
      onClose={() => selectItem(null)}
    />
  )

  const dialogs = (
    <>
      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />

      {/* Create / edit editor */}
      <WBSEditor
        open={editorOpen}
        item={editorItem}
        parentId={editorParentId}
        existingItems={items}
        projectId={activeProjectId}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Guarded delete confirmation (linked timeline tasks) */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus WBS [{pendingDelete?.wbsCode}]?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.affectedTaskNames.length > 0 ? (
                <>
                  {pendingDelete.affectedTaskNames.length} Timeline Task akan ter-<em>unlink</em>:{' '}
                  <span className="font-medium">{pendingDelete.affectedTaskNames.join(' · ')}</span>. Item beserta seluruh
                  sub-item akan dihapus permanen.
                </>
              ) : (
                'Item beserta seluruh sub-item akan dihapus permanen.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile detail drawer (below lg) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => selectItem(null)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[78vh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {detailPanel}
          </div>
        </div>
      )}
    </>
  )

  // ── Embedded layout (Project Costing pipeline) ──────────────────────────
  if (embedded) {
    return (
      <div
        className="flex flex-col gap-2 overflow-hidden"
        style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
      >
        {toolbar}
        <div
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-[#1e253c] dark:bg-[#131c2e]"
        >
          {summaryStrip}
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          <div
            className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-[#1e253c] dark:bg-[#0e1523]"
          >
            {tree}
          </div>
          <aside
            className="hidden w-80 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1e253c] dark:bg-[#0e1523] lg:flex lg:flex-col"
          >
            {detailPanel}
          </aside>
        </div>
        {dialogs}
      </div>
    )
  }

  // ── Standalone layout ───────────────────────────────────────────────────
  return (
    <section className="space-y-4" aria-label="WBS Workspace">
      <WorkspaceHeader
        title="WBS Structure"
        subtitle={`${activeProjectName ?? 'Proyek'} — ${loading ? 'Memuat…' : `${items.length} item`}`}
      />
      {toolbar}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-[#1e253c] dark:bg-[#131c2e]">
        {summaryStrip}
      </div>
      <div className="flex gap-4">
        <div className="min-h-[480px] min-w-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-[#1e253c] dark:bg-[#0e1523]">
          {tree}
        </div>
        <aside className="hidden w-80 shrink-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1e253c] dark:bg-[#0e1523] lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col">
          {detailPanel}
        </aside>
      </div>
      {dialogs}
    </section>
  )
}
