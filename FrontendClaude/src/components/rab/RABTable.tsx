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
import { formatIDR } from '@/lib/utils'

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
    total: true,
  })

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
    toast.success(`Markup ${percent > 0 ? '+' : ''}${percent}% diterapkan ke ${ids.length} item`)
  }

  const rabExportColumns: ExportColumn<RABItem>[] = [
    { header: 'Kode Item', accessor: r => r.item_code ?? '' },
    { header: 'Nama Pekerjaan', accessor: r => r.name ?? r.item_name ?? '' },
    { header: 'Satuan', accessor: r => r.unit ?? '' },
    { header: 'Volume', accessor: r => r.volume ?? 0 },
    { header: 'Harga Satuan', accessor: r => r.unit_price ?? 0 },
    { header: 'Total', accessor: r => (r.volume ?? 0) * (r.unit_price ?? 0) },
    { header: 'Kategori', accessor: r => (r as any).category ?? '' },
    { header: 'Overhead', accessor: r => r.is_overhead ? 'Ya' : 'Tidak' },
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
      addItem(projectId, {
        item_code: ahsp.code,
        name: ahsp.name,
        unit: ahsp.unit,
        unit_price: ahsp.finalPrice || ahsp.total_price || 0,
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
    setTasks(projectId, tasks)
    setConfirmScheduleOpen(false)
    toast.success(`Generated ${tasks.length} tasks from RAB items`)
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
  let totalMaterial = 0, totalLabor = 0, totalEquip = 0, totalSubcon = 0, total = 0
  items.forEach(item => {
    const v = item.volume || 0
    totalMaterial += (item.cost_material || 0) * v
    totalLabor += (item.cost_labor || 0) * v
    totalEquip += (item.cost_equipment || 0) * v
    totalSubcon += (item.cost_subcon || 0) * v
    total += (item.unit_price || 0) * v
  })

  const columns = useMemo(() => getRABColumns({
    onSelectRow: (id, checked) => setRowSelection(prev => ({ ...prev, [id]: checked })),
    onVolumeChange: (id, val) => updateItem(projectId, id, { volume: parseFloat(val) || 0 }),
    onPriceChange: (id, val) => updateItem(projectId, id, { unit_price: parseFloat(val) || 0 }),
    onRemoveRow: (id) => removeItem(projectId, id),
    onToggleExpand: (id) => {}, // Handled by DataTable internally
    paretoMap,
    projectLocked,
    validLinksByRabItem: linksByRabItem
  }), [projectId, paretoMap, projectLocked, linksByRabItem, updateItem, removeItem, setRowSelection])

  useUnsavedChanges(hasUnsavedChanges, 'RAB has unpublished drafts. Leave without saving?')

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-2 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 relative z-0">
      
      {showDriftAnalysis && currentZone && (
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
          { id: 'pareto', label: 'Kelas Pareto' },
          { id: 'item_code', label: 'Kode Item' },
          { id: 'name', label: 'Deskripsi Pekerjaan' },
          { id: 'volume', label: 'Volume' },
          { id: 'unit', label: 'Satuan' },
          { id: 'unit_price', label: 'Harga Satuan' },
          { id: 'total', label: 'Total Harga' },
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
               <tfoot className="sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-20 border-t-2 border-slate-200 dark:border-slate-800">
                  <tr className="hover:bg-transparent">
                    <td colSpan={5} className="py-3 px-4 text-right font-black text-[10px] text-slate-500 uppercase tracking-wider">Sub-Totals</td>
                    <td className="py-3" />
                    <td className="py-3" />
                    <td className="py-3" />
                    <td className="py-3 px-4 text-right font-mono text-sm font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/50 border-l border-slate-200">
                      {formatIDR(total)}
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
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-red-500 rounded-full" /> <span className="text-slate-500">Class A:</span> <span className="text-slate-900 dark:text-slate-200">80% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-yellow-400 rounded-full" /> <span className="text-slate-500">Class B:</span> <span className="text-slate-900 dark:text-slate-200">15% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 border border-slate-400 rounded-full" /> <span className="text-slate-500">Class C:</span> <span className="text-slate-900 dark:text-slate-200">Non-Critical</span></div>
          </div>
          <div className="flex items-end gap-4">
            <ExportMenu
              data={items}
              columns={rabExportColumns}
              filename={`RAB_${projectId}_${new Date().toISOString().slice(0, 10)}`}
            />
            <div className="flex flex-col items-end">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 opacity-80">
                <Calculator size={12} /> Grand Total Estimated
              </div>
              <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1 drop-shadow-sm tracking-tighter">
                {formatIDR(total)}
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
            <AlertDialogAction onClick={() => { takeSnapshot(projectId); setShowLockConfirm(false); toast.success('Baseline locked') }} className="bg-amber-600 hover:bg-amber-700">Lock Baseline</AlertDialogAction>
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
