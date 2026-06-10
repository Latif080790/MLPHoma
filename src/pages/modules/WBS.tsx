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

import { WBSEditor } from '../../components/wbs/WBSEditor'
import { WBSToolbar, type WBSLevelFilter } from '../../components/wbs/WBSToolbar'
import { WBSDetailPanel } from '../../components/wbs/WBSDetailPanel'
import { WBSKPIStrip } from '../../components/wbs/WBSKPIStrip'
import { WBSMiniMap } from '../../components/wbs/WBSMiniMap'
import { WBSVirtualTree, type WBSVirtualTreeHandle } from '../../components/wbs/WBSVirtualTree'
import { WBSBulkPaste } from '../../components/wbs/WBSBulkPaste'
import { WBSTableView } from '../../components/wbs/WBSTableView'
import { WorkspaceHeader } from '../../components/patterns'
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
import { flattenVisibleRows, recursiveBudget, weightedProgress } from '../../lib/wbsCalculations'
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
  const undoLastAction = useWBSStore((s) => s.undoLastAction)
  const bulkDeleteItems = useWBSStore((s) => s.bulkDeleteItems)
  const setActiveFilter = useWBSStore((s) => s.setActiveFilter)
  const activeFilter = useWBSStore((s) => s.activeFilter)

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
  const virtualTreeRef = useRef<WBSVirtualTreeHandle>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree')
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false)
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20])
  const [flashId, _setFlashId] = useState<string | null>(null)

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

  // ── Derived: recursive budget per node (aggregates children recursively) ─
  const recursiveBudgetByWbs = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.id, recursiveBudget(item.id, items, rabItems))
    }
    return map
  }, [items, rabItems])

  // ── Derived: direct budget per WBS node + grand total ──────────────────
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
    const rootItems = items.filter(i => !i.parentId)
    let totalBudget = 0
    let weightedSum = 0
    for (const root of rootItems) {
      const b = recursiveBudgetByWbs.get(root.id) ?? 0
      const p = weightedProgress(root.id, items, rabItems)
      totalBudget += b
      weightedSum += b * p
    }
    const projectWeightedProgress = totalBudget > 0
      ? Math.round(weightedSum / totalBudget)
      : rootItems.length > 0
        ? Math.round(rootItems.reduce((s, r) => s + weightedProgress(r.id, items, rabItems), 0) / rootItems.length)
        : 0

    const qcPassed = items.filter(i => i.qc_status === 'PASSED').length
    const rabLinkedIds = new Set(rabItems.filter(r => r.wbsId).map(r => r.wbsId!))
    const rabUnlinked = items.filter(i => !rabLinkedIds.has(i.id)).length
    const idSet = new Set(items.map(i => i.id))
    let timelineLinked = 0
    timelineCountByWbs.forEach((c, id) => { if (idSet.has(id) && c > 0) timelineLinked++ })

    return { n, projectWeightedProgress, qcPassed, rabUnlinked, timelineLinked }
  }, [items, rabItems, recursiveBudgetByWbs, timelineCountByWbs])

  // Level filter is a max-depth display filter — ancestors are always lower level
  const displayedItems = useMemo(
    () => (levelFilter ? items.filter((i) => (i.level ?? 1) <= levelFilter) : items),
    [items, levelFilter],
  )

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId])

  // ── Derived: flat rows for virtualized tree and mini-map ────────────────
  const flatRows = useMemo(
    () => flattenVisibleRows(displayedItems, expandedIds, null, rabItems, timelineCountByWbs),
    [displayedItems, expandedIds, rabItems, timelineCountByWbs]
  )

  // All rows expanded — for mini-map structural overview
  const allRowsForMiniMap = useMemo(
    () => flattenVisibleRows(items, new Set(items.map(i => i.id)), null, rabItems, timelineCountByWbs),
    [items, rabItems, timelineCountByWbs]
  )

  // RAB item count per WBS node (for table view column)
  const rabCountByWbs = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rabItems) {
      if (r.wbsId) map.set(r.wbsId, (map.get(r.wbsId) ?? 0) + 1)
    }
    return map
  }, [rabItems])

  // Checklist visibility — evaluated against full item set, not just visible rows,
  // so collapsed subtrees with RAB linked are correctly excluded.
  const showSetupChecklist = useMemo(
    () =>
      items.length > 0 &&
      items.every((i) => (rabCountByWbs.get(i.id) ?? 0) === 0) &&
      items.every((i) => (i.progress ?? 0) === 0),
    [items, rabCountByWbs],
  )

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

  const handleUndo = useCallback(() => {
    if (!activeProjectId) return
    undoLastAction(activeProjectId)
  }, [activeProjectId, undoLastAction])

  const handleUpdateProgress = useCallback(
    (id: string, progress: number) => {
      if (!activeProjectId) return
      updateItem(activeProjectId, id, { progress })
    },
    [activeProjectId, updateItem],
  )

  const handleBulkUpdateProgress = useCallback(
    (ids: string[], progress: number) => {
      if (!activeProjectId) return
      ids.forEach((id) => updateItem(activeProjectId, id, { progress }))
    },
    [activeProjectId, updateItem],
  )

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      if (!activeProjectId) return
      bulkDeleteItems(activeProjectId, ids)
    },
    [activeProjectId, bulkDeleteItems],
  )

  const handleBulkPasteImport = useCallback(
    (nodes: Array<{ name: string; relativeDepth: number }>) => {
      if (!activeProjectId) return
      const baseParentId = selectedId ?? null
      const baseItem = baseParentId ? items.find(i => i.id === baseParentId) : null
      const baseLevel = baseItem ? (baseItem.level ?? 1) : 0
      nodes.forEach((node) => {
        addItem(activeProjectId, {
          code: '',
          name: node.name,
          level: baseLevel + 1,
          parentId: baseParentId,
          sortOrder: 999,
          projectId: activeProjectId,
        } as Parameters<typeof addItem>[1])
      })
    },
    [activeProjectId, items, selectedId, addItem]
  )

  // ── Guard: no project ───────────────────────────────────────────────────
  if (!activeProjectId) {
    if (embedded) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
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
      onBulkPaste={() => setBulkPasteOpen(true)}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      compact={embedded}
    />
  )

  const kpiStrip = (
    <WBSKPIStrip
      totalItems={summary.n}
      totalBudget={budgetLinkedTotal}
      projectWeightedProgress={summary.projectWeightedProgress}
      qcPassed={summary.qcPassed}
      rabUnlinked={summary.rabUnlinked}
      timelineLinked={summary.timelineLinked}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
    />
  )

  const treePanel = (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
      <WBSMiniMap
        allRows={allRowsForMiniMap}
        visibleStartIndex={visibleRange[0]}
        visibleEndIndex={visibleRange[1]}
        onNavigate={(idx) => virtualTreeRef.current?.scrollToIndex(idx)}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        <WBSVirtualTree
          ref={virtualTreeRef}
          rows={flatRows}
          selectedId={selectedId}
          flashId={flashId}
          onSelect={(item) => selectItem(item.id)}
          onToggleExpand={handleToggleExpand}
          onAddChild={openAddChild}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveItem={(itemId, newParentId, index) =>
            moveItem(activeProjectId!, itemId, newParentId, index)
          }
          onVisibleRangeChange={(s, e) => setVisibleRange([s, e])}
          onUndo={handleUndo}
          rabCountByWbs={rabCountByWbs}
          onGenerateCodes={handleGenerateCodes}
          activeFilter={activeFilter}
          timelineCountByWbs={timelineCountByWbs}
          showSetupChecklist={showSetupChecklist}
          onUpdateProgress={handleUpdateProgress}
          onBulkUpdateProgress={handleBulkUpdateProgress}
          onBulkDelete={handleBulkDelete}
        />
      </div>
    </div>
  )

  const detailPanel = (
    <WBSDetailPanel
      item={selectedItem}
      budgetLinked={selectedId ? budgetByWbs.get(selectedId) ?? 0 : 0}
      timelineTaskCount={selectedId ? timelineCountByWbs.get(selectedId) ?? 0 : 0}
      rabItems={rabItems}
      timelineTasks={timelineTasks}
      onEdit={openEdit}
      onDelete={handleDelete}
      onAddChild={(parentId) => openAddChild(parentId)}
      onClose={() => selectItem(null)}
      onNavigateToRab={(wbsId) => toast.info(`Buka tab RAB untuk menghubungkan item ${wbsId}`)}
      onNavigateToTimeline={(wbsId) => toast.info(`Buka tab Timeline untuk menghubungkan item ${wbsId}`)}
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

      {/* Bulk paste dialog */}
      <WBSBulkPaste
        open={bulkPasteOpen}
        parentCode={selectedItem?.code ?? null}
        onClose={() => setBulkPasteOpen(false)}
        onImport={handleBulkPasteImport}
      />

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
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}>
        {kpiStrip}
        {toolbar}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {viewMode === 'tree' ? (
            <>
              {treePanel}
              <aside
                className="hidden w-[260px] shrink-0 border-l overflow-hidden lg:flex lg:flex-col"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
              >
                {detailPanel}
              </aside>
            </>
          ) : (
            <WBSTableView
              rows={flatRows}
              timelineCountByWbs={timelineCountByWbs}
              rabCountByWbs={rabCountByWbs}
            />
          )}
        </div>
        {dialogs}
      </div>
    )
  }

  // ── Standalone layout ───────────────────────────────────────────────────
  return (
    <section className="flex flex-col h-full overflow-hidden" aria-label="WBS Workspace">
      <WorkspaceHeader
        title="WBS Structure"
        subtitle={`${activeProjectName ?? 'Proyek'} — ${loading ? 'Memuat…' : `${items.length} item`}`}
      />
      {kpiStrip}
      {toolbar}
      <div
        className="flex min-h-0 flex-1 overflow-hidden rounded-xl border mt-2"
        style={{ borderColor: 'var(--border-default)' }}
      >
        {viewMode === 'tree' ? (
          <>
            {treePanel}
            <aside
              className="hidden w-[260px] shrink-0 border-l overflow-hidden lg:flex lg:flex-col"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              {detailPanel}
            </aside>
          </>
        ) : (
          <WBSTableView
            rows={flatRows}
            timelineCountByWbs={timelineCountByWbs}
            rabCountByWbs={rabCountByWbs}
          />
        )}
      </div>
      {dialogs}
    </section>
  )
}
