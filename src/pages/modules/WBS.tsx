
/**
 * WBS.tsx
 * Work Breakdown Structure management page with hierarchical tree view
 * Phase 3: KPI bar, mobile layout, RAB integration context menu
 */

import React, { useState, useCallback, useMemo } from 'react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useWBSStore, validateWBS } from '../../store/wbsStore'
import { useRabStore } from '../../store/rabStore'
import { WBSTree } from '../../components/wbs/WBSTree'
import { WBSEditor } from '../../components/wbs/WBSEditor'
import { EmptyState } from '../../components/common/EmptyState'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { RABTable } from '../../components/rab/RABTable'
import BoQImportDialog from '../../components/rab/BoQImportDialog'
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
import {
  Download, Upload, AlertTriangle, FileText, Plus, FileUp,
  Search, ChevronsDownUp, ChevronsUpDown, X, Layers, Calculator,
  Link2, PanelLeft, PanelRight,
} from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'

// ── KPI Mini Bar ──────────────────────────────────────────────
function WBSKpiBar({ items, rabLinkedCount, totalBudget }: {
  items: WBSItem[]
  rabLinkedCount: number
  totalBudget: number
}) {
  const rootCount = items.filter(i => !i.parentId).length
  const maxLevel = items.reduce((m, i) => Math.max(m, i.level || 1), 0)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Badge variant="outline" className="h-6 gap-1 text-xs font-mono bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
        <Layers size={11} className="text-indigo-500" />
        {items.length} nodes
      </Badge>
      <Badge variant="outline" className="h-6 gap-1 text-xs font-mono bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
        {rootCount} root · L{maxLevel}
      </Badge>
      <Badge variant="outline" className="h-6 gap-1 text-xs font-mono bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
        <Link2 size={11} className="text-blue-500" />
        {rabLinkedCount} RAB-linked
      </Badge>
      {totalBudget > 0 && (
        <Badge variant="outline" className="h-6 gap-1 text-xs font-mono bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
          <Calculator size={11} className="text-emerald-500" />
          {formatIDR(totalBudget)}
        </Badge>
      )}
    </div>
  )
}

/**
 * WBS Page Component
 */
export default function WBS() {
  // Project context
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectId = activeProject?.id ?? ''

  // WBS state
  const {
    itemsByProject,
    selectedId,
    expandedIds,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    toggleExpanded,
    selectItem,
    generateCodes,
    importWBS,
    exportWBS,
  } = useWBSStore()

  const items = itemsByProject[projectId] || []
  const validation = validateWBS(items)

  // RAB state for KPI + budget badges
  const rabItems = useRabStore(s => s.itemsByProject[projectId] || [])

  // KPI derived
  const kpiData = useMemo(() => {
    const wbsIdsWithRab = new Set(rabItems.filter(r => r.wbsId).map(r => r.wbsId!))
    const rabLinkedCount = items.filter(i => wbsIdsWithRab.has(i.id)).length
    const totalBudget = rabItems.reduce((s, r) => s + ((r.volume || 0) * (r.unit_price || 0)), 0)
    // Budget per WBS node
    const budgetByWbs = new Map<string, number>()
    rabItems.forEach(r => {
      if (r.wbsId) {
        budgetByWbs.set(r.wbsId, (budgetByWbs.get(r.wbsId) || 0) + ((r.volume || 0) * (r.unit_price || 0)))
      }
    })
    return { rabLinkedCount, totalBudget, budgetByWbs }
  }, [items, rabItems])

  // Editor state
  const [editorItem, setEditorItem] = useState<WBSItem | null>(null)
  const [editorParentId, setEditorParentId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<WBSItem | null>(null)
  const [showBoQImport, setShowBoQImport] = useState(false)
  // Search + filter sync
  const [treeSearch, setTreeSearch] = useState('')
  const [filterWbsId, setFilterWbsId] = useState<string | null>(null)
  // Mobile panel toggle
  const [mobilePanel, setMobilePanel] = useState<'tree' | 'rab'>('tree')

  /**
   * Handle adding new item
   */
  const handleAddItem = useCallback((parentId: string | null) => {
    setEditorItem(null)
    setEditorParentId(parentId)
    setShowEditor(true)
    setImportError(null)
  }, [])

  /**
   * Handle editing existing item
   */
  const handleEditItem = useCallback((item: WBSItem) => {
    setEditorItem(item)
    setEditorParentId(null)
    setShowEditor(true)
    setImportError(null)
  }, [])

  /**
   * Handle deleting item
   */
  const handleDeleteItem = useCallback((item: WBSItem) => {
    setPendingDeleteItem(item)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (!pendingDeleteItem) return
    deleteItem(projectId, pendingDeleteItem.id)
    setPendingDeleteItem(null)
  }, [projectId, deleteItem, pendingDeleteItem])

  /**
   * Handle saving editor — supports "add another" via keepOpen param
   */
  const handleSaveEditor = useCallback(async (data: Omit<WBSItem, 'id' | 'createdAt' | 'updatedAt'>, keepOpen?: boolean) => {
    try {
      if (editorItem) {
        // Update existing item
        updateItem(projectId, editorItem.id, data)
      } else {
        // Add new item
        addItem(projectId, data)

        // Auto-expand parent to show new item
        if (data.parentId) {
          toggleExpanded(data.parentId)
        }
      }

      // Generate codes to ensure consistency
      generateCodes(projectId)

      if (!keepOpen) {
        setShowEditor(false)
      } else {
        // Reset for next entry
        setEditorItem(null)
      }
    } catch (error) {
      console.error('Failed to save WBS item:', error)
      throw error
    }
  }, [editorItem, projectId, addItem, updateItem, generateCodes, toggleExpanded])

  /**
   * Handle moving items
   */
  const handleMoveItem = useCallback((itemId: string, newParentId: string | null, index: number) => {
    moveItem(projectId, itemId, newParentId, index)
    generateCodes(projectId)
  }, [projectId, moveItem, generateCodes])

  /** Expand all nodes that have children */
  const handleExpandAll = useCallback(() => {
    const parentIds = new Set(items.filter(i => i.parentId).map(i => i.parentId!))
    items.forEach(i => {
      if (parentIds.has(i.id) && !expandedIds.has(i.id)) toggleExpanded(i.id)
    })
  }, [items, expandedIds, toggleExpanded])

  /** Collapse all expanded nodes */
  const handleCollapseAll = useCallback(() => {
    expandedIds.forEach(id => toggleExpanded(id))
  }, [expandedIds, toggleExpanded])

  /**
   * Handle export
   */
  const handleExport = useCallback(() => {
    try {
      const data = exportWBS(projectId)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wbs-${projectId}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export WBS:', error)
      setImportError('Failed to export WBS data')
    }
  }, [projectId, exportWBS])

  /**
   * Handle import
   */
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as WBSItem[]

        // Validate imported data
        if (!Array.isArray(data)) {
          throw new Error('Invalid file format')
        }

        // Map to import format
        const importData = data.map(item => ({
          code: item.code,
          name: item.name,
          description: item.description,
          level: item.level,
          parentId: item.parentId,
          sortOrder: item.sortOrder || 0,
        }))

        importWBS(projectId, importData)
        generateCodes(projectId)
        setImportError(null)
      } catch (error) {
        console.error('Failed to import WBS:', error)
        setImportError('Failed to import WBS data. Please check the file format.')
      }
    }
    reader.readAsText(file)

    // Reset file input
    event.target.value = ''
  }, [projectId, importWBS, generateCodes])

  // No project selected
  if (!projectId) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon={<FileText size={18} />}
          title="WBS"
          description="Work Breakdown Structure management"
        />
        <EmptyState
          title="No Project Selected"
          description="Please select a project to manage its WBS structure."
          imageKeyword="work breakdown structure"
        />
      </div>
    )
  }

  // ── Shared tree panel content ────────────────────────────────
  const treePanel = (
    <>
      <div className="sticky top-0 z-10 border-b bg-neutral-50/95 p-3 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">WBS Structure</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExpandAll}
              title="Expand all"
              disabled={!items.length}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 disabled:opacity-30 dark:hover:bg-neutral-700"
            >
              <ChevronsUpDown size={13} />
            </button>
            <button
              onClick={handleCollapseAll}
              title="Collapse all"
              disabled={!expandedIds.size}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 disabled:opacity-30 dark:hover:bg-neutral-700"
            >
              <ChevronsDownUp size={13} />
            </button>
          </div>
        </div>

        {/* KPI Mini Bar (Task 14) */}
        {items.length > 0 && (
          <WBSKpiBar
            items={items}
            rabLinkedCount={kpiData.rabLinkedCount}
            totalBudget={kpiData.totalBudget}
          />
        )}

        {/* Search input */}
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={treeSearch}
            onChange={e => setTreeSearch(e.target.value)}
            placeholder="Cari kode / nama..."
            className="w-full rounded-md border border-neutral-200 bg-white py-1 pl-7 pr-7 text-xs placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
          />
          {treeSearch && (
            <button
              onClick={() => setTreeSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <WBSTree
          items={items}
          selectedId={selectedId}
          expandedIds={expandedIds}
          loading={loading}
          filterText={treeSearch}
          budgetByWbs={kpiData.budgetByWbs}
          onItemClick={(item) => { selectItem(item.id); setFilterWbsId(item.id) }}
          onToggleExpand={toggleExpanded}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
          maxNestingLevel={8}
        />
      </div>
    </>
  )

  // ── Shared RAB panel content ─────────────────────────────────
  const rabPanel = (
    <>
      <div className="sticky top-0 z-10 border-b bg-neutral-50/95 p-3 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Rencana Anggaran Biaya (RAB)</h3>
          {filterWbsId && (() => {
            const wbsItem = items.find(i => i.id === filterWbsId)
            return wbsItem ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {wbsItem.code} — {wbsItem.name}
                <button onClick={() => setFilterWbsId(null)} className="ml-0.5 hover:text-red-500">
                  <X size={10} />
                </button>
              </span>
            ) : null
          })()}
        </div>
        {filterWbsId && (
          <button
            onClick={() => setFilterWbsId(null)}
            className="text-xs text-neutral-500 hover:text-neutral-800 underline"
          >
            Show all
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-neutral-50 dark:bg-neutral-900/50 p-0 m-0">
        <RABTable projectId={projectId} filterWbsId={filterWbsId ?? undefined} />
      </div>
    </>
  )

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<FileText size={18} />}
        title="WBS"
        description="Work Breakdown Structure with hierarchical management"
        accent="indigo"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent text-xs"
              onClick={handleExport}
              disabled={!items.length}
            >
              <Download size={16} className="mr-2" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent text-xs"
              onClick={() => document.getElementById('wbs-import')?.click()}
              asChild
            >
              <label className="cursor-pointer">
                <Upload size={16} className="mr-2" />
                Import
                <input
                  id="wbs-import"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent text-xs"
              onClick={() => setShowBoQImport(true)}
            >
              <FileUp size={16} className="mr-2" />
              BoQ Import
            </Button>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAddItem(null)}
            >
              <Plus size={16} className="mr-2" />
              Add Root Item
            </Button>
          </div>
        }
      />

      {/* Error messages */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {importError && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {importError}
          </AlertDescription>
        </Alert>
      )}

      {/* Validation errors */}
      {!validation.isValid && (
        <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {validation.errors.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile layout (Task 22): Single panel with toggle */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant={mobilePanel === 'tree' ? 'default' : 'outline'}
            size="sm"
            className="h-8 flex-1 text-xs gap-1.5"
            onClick={() => setMobilePanel('tree')}
          >
            <PanelLeft size={14} />
            WBS Tree
          </Button>
          <Button
            variant={mobilePanel === 'rab' ? 'default' : 'outline'}
            size="sm"
            className="h-8 flex-1 text-xs gap-1.5"
            onClick={() => setMobilePanel('rab')}
          >
            <PanelRight size={14} />
            RAB Table
          </Button>
        </div>
        <div className="rounded-xl border bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 border-neutral-200 flex flex-col min-h-[60vh]">
          {mobilePanel === 'tree' ? treePanel : rabPanel}
        </div>
      </div>

      {/* Desktop Split Pane Layout */}
      <div className="hidden md:block flex-1 rounded-xl border bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 border-neutral-200">
        <PanelGroup direction="horizontal">
          {/* Left Panel: WBS Tree */}
          <Panel defaultSize={35} minSize={20} className="flex flex-col relative bg-white dark:bg-neutral-900">
            {treePanel}
          </Panel>

          {/* Resizer Handle */}
          <PanelResizeHandle className="w-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-500/50 active:bg-blue-500 transition-colors mx-auto flex flex-col justify-center items-center cursor-col-resize group">
            <div className="h-8 w-1 rounded-full bg-neutral-300 dark:bg-neutral-600 group-hover:bg-white transition-colors" />
          </PanelResizeHandle>

          {/* Right Panel: RAB Table */}
          <Panel defaultSize={65} minSize={30} className="flex flex-col relative bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
            {rabPanel}
          </Panel>
        </PanelGroup>
      </div>

      {/* WBS Editor Modal (Task 21: supports keepOpen "Tambah lagi") */}
      <WBSEditor
        item={editorItem}
        parentId={editorParentId}
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSaveEditor}
        existingItems={items}
        projectId={projectId}
      />

      <AlertDialog open={!!pendingDeleteItem} onOpenChange={(open) => { if (!open) setPendingDeleteItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete WBS item?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteItem
                ? `"${pendingDeleteItem.name}" and all child items will be deleted.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* BoQ Import Dialog */}
      <BoQImportDialog
        open={showBoQImport}
        onOpenChange={setShowBoQImport}
        projectId={projectId}
      />
    </div>
  )
}
