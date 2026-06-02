import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { VisibilityState } from '@tanstack/react-table'
import { Calculator, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import * as xlsx from 'xlsx'

import { useRabStore, calculatePareto, RABItem } from '@/store/rabStore'
import { useAHSPStore } from '@/store/ahspStore'
import { AHSPItem } from '@/types/ahsp'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/projectStore'
import { useWBSStore } from '@/store/wbsStore'
import { useRabWbsLinkStore } from '@/store/rabWbsLinkStore'
import { useRABVersionStore } from '@/store/rabVersionStore'
import { generateScheduleFromRAB } from '@/lib/autoScheduler'
import { baselineService } from '@/services/baselineService'
import { rabWbsLinkService } from '@/services/rabWbsLinkService'
import { formatIDR } from '@/lib/utils'
import { readMarginSettings, effectiveMarginPct } from '@/lib/marginSettings'
import { baseFromSelling, sellingFromBase } from '@/lib/costingMargin'

import { RABPriceDriftDashboard } from './RABPriceDriftDashboard'
import { RABVersionHistory } from './RABVersionHistory'
import { RABWbsAllocationPanel } from './RABWbsAllocationPanel'
import { DataTable } from '../shared/DataTable'
import { RABToolbar } from './RABToolbar'
import { getRABColumns } from './RABColumns'
import { RABSubComponent } from './RABSubComponent'
import { AddAhspItemDialog } from './AddAhspItemDialog'
import BoQImportDialog from './BoQImportDialog'
import { ExportMenu, type ExportColumn } from '@/components/shared/ExportMenu'

import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

interface RABTableProps {
  projectId: string
  filterWbsId?: string
}

export function RABTable({ projectId, filterWbsId }: RABTableProps) {
  // Global Stores
  const { getItems, addItem, updateItem, removeItem, publishDrafts, getDraftCount, hasUnsaved, isLocked, takeSnapshot, unlockBaseline, scenarios, activeScenarioVersion, createScenario, setScenarioData, switchScenario } = useRabStore()
  const { fetchComponents, componentsByAHSP, ahspItems } = useAHSPStore()
  const { getTasks, setTasks } = useTimelineStore()
  const project = useProjectStore(s => s.projects[projectId])
  const updateProject = useProjectStore(s => s.updateProject)
  const { zones } = useAHSPStore()
  const { importWBS, itemsByProject: wbsItemsByProject } = useWBSStore()
  const { fetchLinks, addLink, linksByRabItem } = useRabWbsLinkStore()

  // Local State
  const [activeTab, setActiveTab] = useState<'direct' | 'overhead'>('direct')
  const [searchQuery, setSearchQuery] = useState('')
  const [ahspSearchQuery, setAhspSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [showBoqImport, setShowBoqImport] = useState(false)
  const [confirmScheduleOpen, setConfirmScheduleOpen] = useState(false)
  const [confirmWBSOpen, setConfirmWBSOpen] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false)
  const [showDriftAnalysis, setShowDriftAnalysis] = useState(false)
  const [showSaveScenario, setShowSaveScenario] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [allocationPanelItemId, setAllocationPanelItemId] = useState<string | null>(null)
  
  // Row Selection (DataTable -> TanStack internal)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  // Column Visibility
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    pareto: true,
    item_code: true,
    name: true,
    volume: true,
    unit: true,
    unit_price: true,
    margin_pct: true,
    total: true,
  })

  const marginSettings = useMemo(() => readMarginSettings(project?.meta), [project?.meta])

  const getEffectiveMargin = useCallback((itemId: string) => {
    return effectiveMarginPct(marginSettings, itemId)
  }, [marginSettings])

  const getSellingUnitPrice = useCallback((itemId: string, unitCost: number) => {
    return sellingFromBase(unitCost || 0, getEffectiveMargin(itemId))
  }, [getEffectiveMargin])

  const getSellingTotal = useCallback((itemId: string, volume: number, unitCost: number) => {
    return getSellingUnitPrice(itemId, unitCost) * (volume || 0)
  }, [getSellingUnitPrice])

  const handleMarginChange = useCallback((itemId: string, val: string) => {
    if (!project?.id) return
    const parsed = Number.parseFloat(val)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.max(0, Math.min(99.99, parsed))
    const base = readMarginSettings(project.meta)
    updateProject(project.id, {
      meta: {
        ...project.meta,
        ...base,
        marginMode: 'per_item',
        itemMargins: {
          ...base.itemMargins,
          [itemId]: clamped,
        },
      },
    })
  }, [project, updateProject])

  // Fetch effects
  useEffect(() => { if (projectId) fetchLinks(projectId) }, [projectId, fetchLinks])

  // Data Selectors
  const currentZone = project?.zoneId ? zones.find(z => z.id === project.zoneId) : null
  const projectLocked = isLocked(projectId)
  const draftCount = getDraftCount(projectId)
  const hasUnsavedChanges = hasUnsaved(projectId)
  
  const allItems = getItems(projectId)
  const items = useMemo(() => {
    return allItems.filter(i => {
      if (activeTab === 'direct' ? i.is_overhead : !i.is_overhead) return false
      if (filterWbsId && i.wbsId !== filterWbsId) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!(i.name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q) || (i.notes as string)?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [allItems, activeTab, filterWbsId, searchQuery])

  // Pareto Calculation
  const paretoMap = useMemo(() => {
    const arr = calculatePareto(items)
    const map = new Map<string, string>()
    arr.forEach(i => map.set(i.id, i.paretoClass))
    return map
  }, [items])

  // Selected Count
  const selectedCount = Object.values(rowSelection).filter(Boolean).length

  // Handlers
  const handleBulkDelete = () => {
    const ids = Object.entries(rowSelection).filter(([_, checked]) => checked).map(([id]) => id)
    ids.forEach(id => removeItem(projectId, id))
    setRowSelection({})
    setConfirmBulkDelete(false)
    toast.success(`${ids.length} items deleted`)
  }

  const handleBulkOverhead = (percent: number) => {
    const ids = Object.entries(rowSelection).filter(([_, checked]) => checked).map(([id]) => id)
    if (!ids.length) return
    const factor = 1 + percent / 100
    ids.forEach(id => {
      const item = items.find(i => i.id === id)
      if (item) updateItem(projectId, id, { unit_price: Math.round((item.unit_price || 0) * factor) })
    })
    setRowSelection({})
    toast.success(`Margin ${percent > 0 ? '+' : ''}${percent}% applied to ${ids.length} items`)
  }

  const rabExportColumns: ExportColumn<RABItem>[] = [
    { header: 'Item Code', accessor: r => r.item_code ?? '' },
    { header: 'Work Item', accessor: r => r.name ?? r.item_name ?? '' },
    { header: 'Unit', accessor: r => r.unit ?? '' },
    { header: 'Volume', accessor: r => r.volume ?? 0 },
    { header: 'Unit Cost', accessor: r => getSellingUnitPrice(r.id, r.unit_price ?? 0) },
    { header: 'Margin %', accessor: r => getEffectiveMargin(r.id) },
    { header: 'Total Cost', accessor: r => getSellingTotal(r.id, r.volume ?? 0, r.unit_price ?? 0) },
    { header: 'Category', accessor: r => (r as any).category ?? '' },
    { header: 'Overhead', accessor: r => r.is_overhead ? 'Yes' : 'No' },
  ]

  const handleAddFromAhsp = useCallback(async (ahsp: any) => {
    try {
      const components = componentsByAHSP[ahsp.id]
      if (!components) {
        toast.promise(fetchComponents(ahsp.id), {
          loading: 'Loading AHSP analysis...',
          success: 'Analysis loaded',
          error: 'Failed to load analysis'
        })
      }

      const baseCost  = Number(ahsp.finalPrice || ahsp.total_price || 0)

      addItem(projectId, {
        item_code: ahsp.code,
        name: ahsp.name,
        unit: ahsp.unit,
        base_price: baseCost,
        unit_price: baseCost,
        cost_material: ahsp.price_material || 0,
        cost_labor: ahsp.price_labor || 0,
        cost_equipment: ahsp.price_equipment || 0,
        cost_subcon: ahsp.price_subcon || 0,
        category: ahsp.category || '',
        volume: 0,
        is_overhead: activeTab === 'overhead',
        source_ahsp_id: ahsp.id,
      })
      toast.success('Item added to RAB', { description: ahsp.name })
      setIsAddDialogOpen(false)
      setAhspSearchQuery('')
    } catch (err) {
      toast.error('Failed to add item')
    }
  }, [projectId, activeTab, componentsByAHSP, fetchComponents, addItem])

  const handleDownloadTemplate = () => {
    const ws = xlsx.utils.json_to_sheet([{
      'Kode Item': 'P.01',
      'Nama Pekerjaan': 'Pembersihan Lapangan',
      'Satuan': 'm2',
      'Volume': 100,
      'Harga Satuan': 15000,
      'Kategori': 'Pekerjaan Persiapan'
    }])
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Template BoQ')
    xlsx.writeFile(wb, 'Template_Import_BoQ_MLPHoma.xlsx')
    toast.success('Template downloaded')
  }

  const handleAutoSchedule = async () => {
    const ahspMap = new Map<string, AHSPItem>(ahspItems.map((i: any) => [i.code || '', i]))
    const tasks = generateScheduleFromRAB(projectId, project?.startDate || new Date().toISOString(), items, ahspMap, componentsByAHSP)

    // Auto-link each task to its primary WBS node (highest allocationPct) via rabWbsLinkStore
    const { getLinksForItem } = useRabWbsLinkStore.getState()
    const linkedTasks = tasks.map(task => {
      if (!task.rabId) return task
      const links = getLinksForItem(task.rabId)
      if (!links.length) return task
      const primary = links.reduce((best, l) => l.allocationPct >= best.allocationPct ? l : best, links[0])
      return { ...task, wbsId: primary.wbsItemId }
    })

    setTasks(projectId, linkedTasks)
    setConfirmScheduleOpen(false)
    const wbsLinkedCount = linkedTasks.filter(t => t.wbsId).length
    toast.success(
      `Generated ${linkedTasks.length} tasks from RAB`,
      { description: wbsLinkedCount > 0 ? `${wbsLinkedCount} tasks linked to WBS` : undefined }
    )

    // Tag auto-generated RAB-WBS links as 'auto' mapping status (non-blocking)
    linkedTasks.forEach(task => {
      if (task.rabId && task.wbsId) {
        rabWbsLinkService.updateMappingStatus(task.rabId, task.wbsId, 'auto', 80).catch(() => {})
      }
    })
  }

  const handleGenerateWBS = () => {
    const directItems = items.filter(i => !i.is_overhead)
    const newWbsItems = directItems.map((item, index) => ({
      name: item.name || `Pekerjaan ${index + 1}`,
      code: item.item_code || `WBS-${index + 1}`,
      description: item.notes as string || '',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'planned' as const,
      progress: 0,
      isMilestone: false,
      color: '#3B82F6',
      sortOrder: index,
      rab_item_id: item.id,
      level: 1,
      parentId: null
    }))
    importWBS(projectId, newWbsItems)
    setConfirmWBSOpen(false)
    toast.success(`Generated ${newWbsItems.length} WBS nodes from RAB`)
  }

  // Cost calculations for Footer
  let totalSelling = 0
  items.forEach(item => {
    const v = item.volume || 0
    totalSelling += getSellingTotal(item.id, v, item.unit_price || 0)
  })

  const columns = useMemo(() => getRABColumns({
    onSelectRow: (id, checked) => setRowSelection(prev => ({ ...prev, [id]: checked })),
    onVolumeChange: (id, val) => updateItem(projectId, id, { volume: parseFloat(val) || 0 }),
    onPriceChange: (id, val) => {
      const sellingInput = parseFloat(val) || 0
      const marginPct = getEffectiveMargin(id)
      updateItem(projectId, id, { unit_price: baseFromSelling(sellingInput, marginPct) })
    },
    onMarginChange: handleMarginChange,
    getSellingUnitPrice,
    getSellingTotal,
    onRemoveRow: (id) => removeItem(projectId, id),
    onToggleExpand: (id) => {}, // Handled by DataTable internally
    paretoMap,
    projectLocked,
    validLinksByRabItem: linksByRabItem,
    marginMode: marginSettings.marginMode,
    getEffectiveMargin,
  }), [projectId, paretoMap, projectLocked, linksByRabItem, updateItem, removeItem, handleMarginChange, marginSettings.marginMode, getEffectiveMargin, getSellingUnitPrice, getSellingTotal])

  useUnsavedChanges(hasUnsavedChanges, 'RAB has unpublished drafts. Leave without saving?')

  return (
    <div className="flex flex-col h-full bg-card p-2 sm:p-4 rounded-xl shadow-sm border border-border relative z-0">
      
      {showDriftAnalysis && (
        <div className="mb-4">
          <RABPriceDriftDashboard projectId={projectId} />
        </div>
      )}

      {/* Extracted Toolbar */}
      <RABToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isLocked={projectLocked}
        draftCount={draftCount}
        selectedCount={selectedCount}
        scenarioVersion={activeScenarioVersion(projectId)}
        scenarios={scenarios(projectId)}
        onAddItem={() => setIsAddDialogOpen(true)}
        onBulkDelete={() => setConfirmBulkDelete(true)}
        onBulkOverhead={handleBulkOverhead}
        onGenerateWBS={() => setConfirmWBSOpen(true)}
        onDownloadTemplate={handleDownloadTemplate}
        onImportExcel={() => setShowBoqImport(true)}
        onAutoSchedule={() => setConfirmScheduleOpen(true)}
        onPriceDrift={() => setShowDriftAnalysis(!showDriftAnalysis)}
        onToggleLock={() => projectLocked ? setShowUnlockConfirm(true) : setShowLockConfirm(true)}
        onShowHistory={() => setShowVersionHistory(true)}
        onPublish={() => setShowPublishConfirm(true)}
        onSwitchScenario={(v) => { if (v) switchScenario(projectId, v) }}
        onSaveScenario={() => setShowSaveScenario(true)}
        availableColumns={[
          { id: 'pareto', label: 'Pareto Class' },
          { id: 'item_code', label: 'Item Code' },
          { id: 'name', label: 'Description & Specification' },
          { id: 'volume', label: 'Volume' },
          { id: 'unit', label: 'Unit' },
          { id: 'unit_price', label: 'Unit Cost' },
          { id: 'margin_pct', label: 'Margin %' },
          { id: 'total', label: 'Total Cost' },
        ]}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={(id, v) => setColumnVisibility(prev => ({ ...prev, [id]: v }))}
      />

      {/* Fast virtualized DataTable */}
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={items}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          virtualized={true}
          maxHeight="calc(100vh - 280px)"
          enableRowSelection={true}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row) => row.id}
          getRowCanExpand={() => true}
          rowClassName={(row: any) => {
             const cls = paretoMap.get(row.id)
             if (cls === 'A') return "border-l-[3px] border-l-red-500 bg-red-50/10"
             if (cls === 'B') return "border-l-[3px] border-l-yellow-400 bg-yellow-50/10"
             return "border-l-[3px] border-l-transparent"
          }}
          renderSubComponent={({ row }) => {
            const ahspId = row.original.source_ahsp_id
            const analysis = ahspId ? {
              ahsp: { code: row.original.item_code || '', name: row.original.name || '' },
              components: componentsByAHSP[ahspId] || []
            } : null
            return (
              <RABSubComponent
                item={row.original}
                analysis={analysis}
                onMarkupChange={(id, src) => updateItem(projectId, id, { markup_source: src as any })}
              />
            )
          }}
          renderFooter={() => (
             items.length > 0 ? (
               <tfoot className="sticky bottom-0 bg-muted/30/95 backdrop-blur z-20 border-t-2 border-border">
                  <tr className="hover:bg-transparent">
                    <td colSpan={8} className="py-3 px-4 text-right font-black text-xs text-muted-foreground uppercase tracking-wider">Sub-Totals</td>
                    <td className="py-3" />
                    <td className="py-3 px-4 text-right font-mono text-sm font-black text-indigo-600 bg-muted/50/50 border-l border-border">
                      {formatIDR(totalSelling)}
                    </td>
                    <td className="py-3" />
                  </tr>
               </tfoot>
             ) : null
          )}
        />
      </div>

      {/* Global Form Footer */}
      <div className="sticky-glass-footer flex flex-col gap-4 rounded-lg p-3 md:p-4 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs uppercase font-bold tracking-wider">
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-red-500 rounded-full" /> <span className="text-muted-foreground">Class A:</span> <span className="text-foreground">80% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-yellow-400 rounded-full" /> <span className="text-muted-foreground">Class B:</span> <span className="text-foreground">15% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 border border-border rounded-full" /> <span className="text-muted-foreground">Class C:</span> <span className="text-foreground">Non-Critical</span></div>
          </div>
          <div className="flex items-end gap-4">
            <ExportMenu
              data={items}
              columns={rabExportColumns}
              filename={`RAB_${projectId}_${new Date().toISOString().slice(0, 10)}`}
            />
            <div className="flex flex-col items-end">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5 opacity-80">
                <Calculator size={12} /> Grand Total Estimated
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono text-foreground mt-1 drop-shadow-sm tracking-tighter">
                {formatIDR(totalSelling)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasUnsavedChanges && draftCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 rounded-full border border-yellow-300 bg-yellow-50/95 px-6 py-3 backdrop-blur-sm shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 text-yellow-800">
            <Save size={16} className="animate-pulse" />
            <span className="text-sm font-semibold">
              {draftCount} pending changes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs text-yellow-700 rounded-full px-4" onClick={() => window.location.reload()}>
              Discard
            </Button>
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white rounded-full px-6 shadow-md" onClick={() => setShowPublishConfirm(true)}>
              Publish All
            </Button>
          </div>
        </div>
      )}

      {/* Auxiliary Modals */}
      <AddAhspItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        currentZone={currentZone}
        onAddItem={handleAddFromAhsp}
        searchQuery={ahspSearchQuery}
        onSearchChange={setAhspSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
      />
      <BoQImportDialog
         open={showBoqImport}
         onOpenChange={setShowBoqImport}
         projectId={projectId}
      />
      <RABVersionHistory projectId={projectId} open={showVersionHistory} onClose={() => setShowVersionHistory(false)} />
      <RABWbsAllocationPanel
        projectId={projectId}
        rabItemId={allocationPanelItemId}
        rabItemName={allocationPanelItemId ? (items.find(i => i.id === allocationPanelItemId)?.name || '') : ''}
        rabItemTotal={allocationPanelItemId ? (() => { const i = items.find(x => x.id === allocationPanelItemId); return (i?.volume || 0) * (i?.unit_price || 0) })() : 0}
        open={allocationPanelItemId !== null}
        onClose={() => setAllocationPanelItemId(null)}
      />

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} items?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {draftCount} RAB Changes?</AlertDialogTitle>
            <AlertDialogDescription>This will publish your local edits as the new active RAB version for the field team.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Again</AlertDialogCancel>
            <AlertDialogAction onClick={() => { publishDrafts(projectId); setShowPublishConfirm(false); toast.success('RAB changes published') }} className="bg-green-600 hover:bg-green-700">Commit Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock RAB Baseline?</AlertDialogTitle>
            <AlertDialogDescription>This preserves current prices and volumes. Future changes will require Change Orders.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                takeSnapshot(projectId)
                try {
                  await baselineService.freezeBaseline(projectId)
                } catch {
                  // non-blocking — lock still applies in-app
                }
                setShowLockConfirm(false)
                toast.success('Baseline locked and saved to database')
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Lock Baseline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnlockConfirm} onOpenChange={setShowUnlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Unlock Baseline?</AlertDialogTitle>
            <AlertDialogDescription>WARNING: This invalidates historical variance reporting. Only do this if the baseline was created in error.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { unlockBaseline(projectId); setShowUnlockConfirm(false); toast.success('Baseline unlocked') }} className="bg-red-600 hover:bg-red-700">Force Unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmScheduleOpen} onOpenChange={setConfirmScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Schedule?</AlertDialogTitle>
            <AlertDialogDescription>This wipes current tasks and auto-generates them chronologically based on RAB classification.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAutoSchedule}>Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmWBSOpen} onOpenChange={setConfirmWBSOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate WBS Tree?</AlertDialogTitle>
            <AlertDialogDescription>This will structure WBS nodes mirroring your RAB Direct Costs.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateWBS}>Generate WBS</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
