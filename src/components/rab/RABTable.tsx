import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow
} from '../ui/table'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Calculator, CheckCircle2, ChevronDown, ChevronRight, History, Info, Layers, Lock,
  LockKeyhole, MapPin, Plus, Save, Search, Settings2, ShoppingCart, Trash2, TrendingUp, X, Zap
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { RABPriceDriftDashboard } from './RABPriceDriftDashboard'
import { useRabStore, RABItem, calculatePareto } from '../../store/rabStore'
import { formatIDR } from '../../lib/utils'
import { useAHSPStore } from '../../store/ahspStore'
import { useRABVersionStore } from '../../store/rabVersionStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { SAMPLE_AHSP_ITEMS, SAMPLE_RESOURCES } from '../../lib/sampleData/ahspSample'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { ScrollArea } from '../ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { RABVersionHistory } from './RABVersionHistory'

import { useTimelineStore } from '../../store/timelineStore'
import { generateScheduleFromRAB } from '../../lib/autoScheduler'
import { CalendarClock } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

import { useWBSStore } from '../../store/wbsStore'

interface RABTableProps {
  projectId: string
}

// Column definitions for the RAB Table
const COLUMN_DEFS = [
  { key: 'select', label: 'Select', defaultVisible: true, alwaysVisible: false },
  { key: 'no', label: 'No', defaultVisible: true, alwaysVisible: false },
  { key: 'cls', label: 'Pareto', defaultVisible: true, alwaysVisible: false },
  { key: 'code', label: 'Code', defaultVisible: true, alwaysVisible: false },
  { key: 'description', label: 'Description & Specification', defaultVisible: true, alwaysVisible: true },
  { key: 'task', label: 'Linked Task', defaultVisible: false, alwaysVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: true, alwaysVisible: false },
  { key: 'volume', label: 'Volume', defaultVisible: true, alwaysVisible: false },
  { key: 'tkdn', label: 'TKDN %', defaultVisible: false, alwaysVisible: false },
  { key: 'cost_material', label: 'Material', defaultVisible: false, alwaysVisible: false },
  { key: 'cost_labor', label: 'Labor', defaultVisible: false, alwaysVisible: false },
  { key: 'cost_equipment', label: 'Equipment', defaultVisible: false, alwaysVisible: false },
  { key: 'cost_subcon', label: 'Subcon', defaultVisible: false, alwaysVisible: false },
  { key: 'unit_price', label: 'Unit Price', defaultVisible: true, alwaysVisible: true },
  { key: 'total', label: 'Total Amount', defaultVisible: true, alwaysVisible: true },
  { key: 'actions', label: 'Aksi', defaultVisible: true, alwaysVisible: true },
] as const

type ColumnKey = typeof COLUMN_DEFS[number]['key']

const STORAGE_KEY_COLS = 'rabTable:visibleColumns'
function loadColumnPrefs(): Set<ColumnKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLS)
    if (raw) return new Set(JSON.parse(raw))
  } catch { }
  return new Set(COLUMN_DEFS.filter(c => c.defaultVisible).map(c => c.key))
}
function saveColumnPrefs(cols: Set<ColumnKey>) {
  localStorage.setItem(STORAGE_KEY_COLS, JSON.stringify([...cols]))
}

export function RABTable({ projectId }: RABTableProps) {
  const {
    ahspItems,
    searchAHSPItems,
    importAHSPItems,
    importResources,
    resources,
    componentsByAHSP,
    fetchComponents,
    zonePricesByZone,
    fetchZonePrices,
    zones,
    loading
  } = useAHSPStore()

  const { getItems, addItem, updateItem, removeItem, publishDrafts, getDraftCount, hasUnsaved, isLocked, takeSnapshot } = useRabStore()
  const [activeTab, setActiveTab] = useState<'direct' | 'overhead'>('direct')
  const allItems = getItems(projectId)
  const items = allItems.filter(i => activeTab === 'direct' ? !i.is_overhead : i.is_overhead)
  const draftCount = getDraftCount(projectId)
  const hasUnsavedChanges = hasUnsaved(projectId)
  const projectLocked = isLocked(projectId)

  // Get tasks for linking
  const { getTasks, setTasks } = useTimelineStore()
  const tasks = getTasks(projectId)

  // Get Project for Zone Info
  const project = useProjectStore(s => s.projects[projectId])

  // Get zone name
  const currentZone = project?.zoneId ? zones.find(z => z.id === project.zoneId) : null

  // WBS Store
  const { importWBS } = useWBSStore()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [confirmScheduleOpen, setConfirmScheduleOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadColumnPrefs)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [showDriftAnalysis, setShowDriftAnalysis] = useState(false)
  const [showSaveScenario, setShowSaveScenario] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [selectedScenarioVersion, setSelectedScenarioVersion] = useState<number | null>(null)

  const mainParentRef = useRef<HTMLDivElement>(null)
  const ahspParentRef = useRef<HTMLDivElement>(null)

  const { fetchVersionsFromSupabase: fetchVersions, createVersion, versionsByProject } = useRABVersionStore()
  const scenarios = useMemo(() =>
    (versionsByProject[projectId] || []).filter(v => v.tags?.includes('scenario')),
    [versionsByProject, projectId]
  )

  useEffect(() => {
    fetchVersions(projectId)
  }, [projectId, fetchVersions])

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      toast.error('Please enter a scenario name')
      return
    }

    const snapshot = {
      items,
      totalItems: items.length,
      totalCost: items.reduce((sum, i) => sum + (i.total_price || 0), 0),
      metadata: {
        createdAt: new Date().toISOString(),
        categories: Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[]
      }
    }

    await createVersion(
      projectId,
      scenarioName,
      'create',
      [],
      snapshot,
      ['scenario']
    )

    setShowSaveScenario(false)
    setScenarioName('')
  }

  const handleSwitchScenario = (version: number | null) => {
    if (version === null) {
      setSelectedScenarioVersion(null)
      return
    }

    const ver = (versionsByProject[projectId] || []).find(v => v.version === version)
    if (ver) {
      setSelectedScenarioVersion(version)
      toast.info(`Switched to scenario: ${ver.description}`)
    }
  }

  // Derived: is a column visible?
  const isColVisible = (key: ColumnKey) => visibleColumns.has(key)
  const toggleColumn = (key: ColumnKey) => {
    const col = COLUMN_DEFS.find(c => c.key === key)
    if (col?.alwaysVisible) return
    const next = new Set(visibleColumns)
    if (next.has(key)) next.delete(key); else next.add(key)
    setVisibleColumns(next)
    saveColumnPrefs(next)
  }
  const visibleColCount = COLUMN_DEFS.filter(c => visibleColumns.has(c.key)).length

  // Expand/collapse row — fetch components on expand
  const toggleExpand = (id: string, itemCode?: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Trigger component fetch for this AHSP item
        if (itemCode) {
          const ahsp = ahspItems.find(a => a.code === itemCode)
          if (ahsp && (!componentsByAHSP[ahsp.id] || componentsByAHSP[ahsp.id].length === 0)) {
            fetchComponents(ahsp.id)
          }
        }
      }
      return next
    })
  }

  // AHSP lookup: find components for an RAB item
  const getAhspAnalysis = (itemCode: string | undefined) => {
    if (!itemCode) return null
    const ahsp = ahspItems.find(a => a.code === itemCode)
    if (!ahsp) return null
    const components = componentsByAHSP[ahsp.id] || []
    return { ahsp, components }
  }

  // showDetails derived from visible columns (backward compat)
  const showDetails = isColVisible('cost_material') || isColVisible('cost_labor') || isColVisible('cost_equipment') || isColVisible('cost_subcon')

  // Seed AHSP store with sample data if empty (DISABLED - User requested clean start)
  // useEffect(() => {
  //   if (ahspItems.length === 0 && resources.length === 0) {
  //     importResources(SAMPLE_RESOURCES as any)
  //     importAHSPItems(SAMPLE_AHSP_ITEMS as any)
  //   }
  // }, [ahspItems.length, resources.length, importResources, importAHSPItems])

  // Fetch Zone Prices if needed
  useEffect(() => {
    if (project?.zoneId) {
      fetchZonePrices(project.zoneId)
    }
  }, [project?.zoneId])

  useEffect(() => {
    if (ahspParentRef.current) {
      ahspParentRef.current.scrollTop = 0
    }
    setSelectedItems(new Set()) // Clear selection on filter change
  }, [searchQuery, selectedCategory, selectedUnit])

  // Checkbox handlers for RAB items
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(i => i.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectOne = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleBulkDelete = () => {
    selectedItems.forEach(id => removeItem(projectId, id))
    setSelectedItems(new Set())
    setConfirmBulkDelete(false)
    toast.success(`Deleted ${selectedItems.size} items`)
  }

  const isAllSelected = items.length > 0 && selectedItems.size === items.length
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < items.length

  const filteredAHSP = useMemo(() => {
    let baseItems = searchQuery ? searchAHSPItems(searchQuery) : ahspItems

    // Apply category filter (Case-Insensitive)
    if (selectedCategory !== 'all') {
      baseItems = baseItems.filter(item =>
        item.category?.toUpperCase() === selectedCategory.toUpperCase()
      )
    }

    // Apply unit filter (Case-Insensitive)
    if (selectedUnit !== 'all') {
      baseItems = baseItems.filter(item =>
        item.unit?.toUpperCase() === selectedUnit.toUpperCase()
      )
    }

    if (!project?.zoneId) return baseItems

    const zonePrices = zonePricesByZone[project.zoneId] || []
    const priceMap = new Map(zonePrices.map(p => [p.ahspId, p]))

    return baseItems.map(item => {
      const override = priceMap.get(item.id)
      if (override) {
        return {
          ...item,
          price_material: override.price_material,
          price_labor: override.price_labor,
          price_equipment: override.price_equipment,
          price_subcon: override.price_subcon,
          finalPrice: override.finalPrice,
          basePrice: (override.price_material + override.price_labor + override.price_equipment + override.price_subcon)
        }
      }
      return item
    })
  }, [searchQuery, ahspItems, project?.zoneId, zonePricesByZone, searchAHSPItems, selectedCategory, selectedUnit])

  // Flatten items for virtualization with expansion rows
  const virtualRows = useMemo(() => {
    const rows: { type: 'item' | 'expansion'; item: any; index: number }[] = []
    items.forEach((item, idx) => {
      rows.push({ type: 'item', item, index: idx })
      if (expandedRows.has(item.id)) {
        rows.push({ type: 'expansion', item, index: idx })
      }
    })
    return rows
  }, [items, expandedRows])

  // Main Table Virtualizer
  const mainVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => mainParentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index]
      return row.type === 'item' ? 60 : 300
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  })

  // AHSP Dialog Virtualizer
  const ahspVirtualizer = useVirtualizer({
    count: filteredAHSP.length,
    getScrollElement: () => {
      // Find the scrollable viewport within ScrollArea
      return ahspParentRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement || ahspParentRef.current
    },
    estimateSize: () => 64,
    overscan: 20,
  })

  // Refresh main virtualizer when expansion changes
  useEffect(() => {
    mainVirtualizer.measure()
  }, [expandedRows, mainVirtualizer])

  // Get unique categories from AHSP items dynamically
  const ahspCategories = useMemo(() => {
    const cats = Array.from(new Set(ahspItems.map(item => item.category).filter(Boolean)))
    return cats.sort()
  }, [ahspItems])

  const handleVolumeChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const item = items.find(i => i.id === id)
    const price = item?.unit_price || 0
    updateItem(projectId, id, {
      volume: num,
      finalTotal: num * price,
      final_total: num * price,
      finalPrice: num * price
    })
  }

  const handlePriceChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const item = items.find(i => i.id === id)
    const vol = item?.volume || 0
    updateItem(projectId, id, {
      unit_price: num,
      finalTotal: vol * num,
      final_total: vol * num,
      finalPrice: vol * num
    })
  }

  const handleSplitCostChange = (id: string, field: keyof RABItem, val: string) => {
    const num = parseFloat(val) || 0
    const item = items.find(i => i.id === id)
    if (!item) return

    const updates: any = { [field]: num }

    // Recalculate unit_price
    const mat = field === 'cost_material' ? num : (item.cost_material || 0)
    const lab = field === 'cost_labor' ? num : (item.cost_labor || 0)
    const eqp = field === 'cost_equipment' ? num : (item.cost_equipment || 0)
    const sub = field === 'cost_subcon' ? num : (item.cost_subcon || 0)

    const newUnitPrice = mat + lab + eqp + sub
    const vol = item.volume || 0

    updates.unit_price = newUnitPrice
    updates.finalTotal = vol * newUnitPrice
    updates.final_total = vol * newUnitPrice
    updates.finalPrice = vol * newUnitPrice

    updateItem(projectId, id, updates)
  }

  const handleAddFromAhsp = (ahspItem: any) => {
    // Determine split costs from AHSP if available (requires mapping or store support)
    // For now, mapping from typical AHSP naming if present
    const price = ahspItem.finalPrice || ahspItem.basePrice || 0

    addItem(projectId, {
      item_code: ahspItem.code,
      name: ahspItem.name,
      unit: ahspItem.unit,
      unit_price: price,
      volume: 1,
      finalTotal: price * 1,
      cost_material: ahspItem.price_material || 0,
      cost_labor: ahspItem.price_labor || 0,
      cost_equipment: ahspItem.price_equipment || 0,
      cost_subcon: ahspItem.price_subcon || 0,
      is_overhead: activeTab === 'overhead'
    })

    setIsAddDialogOpen(false)
    toast.success(project?.zoneId ? 'Item added with Zone Price' : 'Item added from AHSP')
  }

  const handleAutoSchedule = () => {
    if (items.length === 0) {
      toast.error('No items in RAB to schedule')
      return
    }
    setConfirmScheduleOpen(true)
  }

  const executeAutoSchedule = () => {
    // Index AHSP items
    const ahspMap = new Map(ahspItems.map(i => [i.code, i]))

    // 1. Generate WBS Structure
    const wbsItems: any[] = []
    const categories = Array.from(new Set(items.map(i => {
      const ahsp = ahspMap.get(i.item_code || i.code || '')
      return ahsp?.category || 'Uncategorized'
    })))

    const categoryIdMap = new Map<string, string>()
    const rabToWbsMap = new Map<string, string>()

    // Create Category Roots (Level 1)
    categories.forEach((cat, idx) => {
      const catId = `wbs-cat-${Date.now()}-${idx}`
      categoryIdMap.set(cat, catId)
      wbsItems.push({
        id: catId,
        code: (idx + 1).toString(),
        name: cat,
        level: 1,
        parentId: null,
        sortOrder: idx
      })
    })

    // Create Item Nodes (Level 2)
    items.forEach((item, idx) => {
      const ahsp = ahspMap.get(item.item_code || item.code || '')
      const cat = ahsp?.category || 'Uncategorized'
      const parentId = categoryIdMap.get(cat)
      const wbsId = `wbs-item-${Date.now()}-${idx}`

      rabToWbsMap.set(item.id, wbsId)

      wbsItems.push({
        id: wbsId,
        code: '', // Will be generated by store
        name: item.name || item.item_name || 'Untitled',
        level: 2,
        parentId: parentId,
        sortOrder: idx
      })
    })

    // Import WBS
    importWBS(projectId, wbsItems)

    // 2. Generate Timeline Tasks
    const newTasks = generateScheduleFromRAB(
      projectId,
      new Date().toISOString().split('T')[0], // Start today
      items,
      ahspMap,
      componentsByAHSP
    )

    // Link Tasks to WBS
    const linkedTasks = newTasks.map(task => ({
      ...task,
      wbsId: task.rabId ? rabToWbsMap.get(task.rabId) : undefined
    }))

    // Update Timeline Store
    setTasks(projectId, linkedTasks)

    // Update RAB items with new Task IDs
    linkedTasks.forEach(task => {
      if (task.rabId) {
        updateItem(projectId, task.rabId, { taskId: task.id })
      }
    })

    setConfirmScheduleOpen(false)
    toast.success(`Generated WBS and ${linkedTasks.length} tasks in Timeline`)
  }

  const handleGenerateWBS = () => {
    if (items.length === 0) {
      toast.error('No Direct Cost items to generate WBS from')
      return
    }

    const wbsItems: any[] = []

    // Group by category, then by name for a simple 2-level WBS if needed, 
    // but the task says: convert imported RAB to WBS directly.
    const categories = Array.from(new Set(items.map(i => i.category || 'Pekerjaan Utama')))
    const categoryIdMap = new Map<string, string>()

    // Level 1: Categories
    categories.forEach((cat, idx) => {
      const catId = `wbs-cat-${Date.now()}-${idx}`
      categoryIdMap.set(cat, catId)
      wbsItems.push({
        id: catId,
        code: (idx + 1).toString(),
        name: cat,
        level: 1,
        parentId: null,
        sortOrder: idx
      })
    })

    // Level 2: Items
    items.forEach((item, idx) => {
      const cat = item.category || 'Pekerjaan Utama'
      const parentId = categoryIdMap.get(cat)
      const wbsId = `wbs-item-${Date.now()}-${idx}`

      wbsItems.push({
        id: wbsId,
        code: '', // Auto-generated
        name: item.name || item.item_name || 'Untitled',
        level: 2,
        parentId: parentId,
        sortOrder: idx
      })

      // Link RAB back to WBS implicitly or explicitly if needed
      // updateItem(projectId, item.id, { wbsId }) // if we add wbsId to RABItem
    })

    importWBS(projectId, wbsItems)
    toast.success(`Generated ${wbsItems.length} WBS nodes from RAB`)
  }

  const total = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)
  const totalMaterial = items.reduce((sum, i) => sum + ((i.volume || 0) * (i.cost_material || 0)), 0)
  const totalLabor = items.reduce((sum, i) => sum + ((i.volume || 0) * (i.cost_labor || 0)), 0)
  const totalEquip = items.reduce((sum, i) => sum + ((i.volume || 0) * (i.cost_equipment || 0)), 0)
  const totalSubcon = items.reduce((sum, i) => sum + ((i.volume || 0) * (i.cost_subcon || 0)), 0)

  const paretoItems = useMemo(() => calculatePareto(items), [items])
  const paretoMap = useMemo(() => new Map(paretoItems.map(i => [i.id, i.paretoClass])), [paretoItems])

  const handleLockBaseline = async () => {
    setIsLocking(true)
    try {
      await takeSnapshot(projectId)
      setShowLockConfirm(false)
    } finally {
      setIsLocking(false)
    }
  }

  return (
    <div className="space-y-3 density-compact">
      <AlertDialog open={confirmScheduleOpen} onOpenChange={setConfirmScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate WBS and Timeline automatically?</AlertDialogTitle>
            <AlertDialogDescription>
              This action overwrites current Timeline and WBS with a new structure generated from current RAB items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAutoSchedule}>Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedItems.size} RAB items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedItems.size} selected item(s) from the RAB. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {draftCount} Draft Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will publish all draft items to the database and make them permanent. Draft status will be removed and items will be synced to Supabase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                publishDrafts(projectId)
                setShowPublishConfirm(false)
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Lock RAB Baseline?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will capture the current AHSP prices and store them as a "Snapshot" for this project.
              Future changes to global AHSP prices will not affect this project's RAB.
              Price editing will be disabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLockBaseline}
              disabled={isLocking}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLocking ? 'Locking...' : 'Lock & Snapshot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showDriftAnalysis && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Price Drift & Living Price Analysis
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDriftAnalysis(false)}>
              <X size={14} />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <RABPriceDriftDashboard projectId={projectId} />
          </CardContent>
        </Card>
      )}


      <div className="sticky-glass-panel flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="control-compact gap-1.5">
                <Settings2 size={14} />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Toggle Columns</p>
              {COLUMN_DEFS.filter(c => c.key !== 'actions').map(col => (
                <label key={col.key} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${col.alwaysVisible ? 'opacity-50' : ''}`}>
                  <Checkbox
                    checked={isColVisible(col.key)}
                    disabled={col.alwaysVisible}
                    onCheckedChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{col.label}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <h3 className="text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-300 uppercase">Cost Items</h3>
          <Badge variant="secondary" className="ml-2 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800">{items.length}</Badge>
          {draftCount > 0 && (
            <Badge variant="outline" className="ml-2 font-mono text-xs text-yellow-700 bg-yellow-50 border-yellow-300">
              <Save className="h-3 w-3 mr-1" />
              {draftCount} Draft{draftCount > 1 ? 's' : ''}
            </Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="ml-2 font-mono text-xs text-orange-700 bg-orange-50 border-orange-300 animate-pulse">
              Unsaved
            </Badge>
          )}
          {loading.zonePrices && (
            <LoadingSpinner size="sm" text="Loading zone prices..." className="ml-2" />
          )}
          {projectLocked && (
            <Badge variant="outline" className="ml-2 font-mono text-xs text-amber-700 bg-amber-50 border-amber-300">
              <Lock className="h-3 w-3 mr-1" />
              Locked Baseline
            </Badge>
          )}
          {selectedScenarioVersion && (
            <Badge variant="outline" className="ml-2 font-mono text-xs text-blue-700 bg-blue-50 border-blue-300">
              <Layers className="h-3 w-3 mr-1" />
              Scenario: v{selectedScenarioVersion}
            </Badge>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex bg-neutral-100/50 p-1 rounded-md border border-neutral-200 mt-2">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 text-sm font-medium px-4 py-1.5 rounded transition-all ${activeTab === 'direct' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'}`}
          >
            Direct Costs (Fisik)
          </button>
          <button
            onClick={() => setActiveTab('overhead')}
            className={`flex-1 text-sm font-medium px-4 py-1.5 rounded transition-all ${activeTab === 'overhead' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'}`}
          >
            Overhead (Tak Langsung)
          </button>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2 text-xs h-8">
                <Layers className="h-3.5 w-3.5" />
                {selectedScenarioVersion ? `Scenario: v${selectedScenarioVersion}` : 'RAB Scenarios'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Project Scenarios</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSwitchScenario(null)} className="flex items-center justify-between">
                <span>Live RAB</span>
                {!selectedScenarioVersion && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              </DropdownMenuItem>
              {scenarios.map(s => (
                <DropdownMenuItem key={s.id} onClick={() => handleSwitchScenario(s.version)} className="flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">v{s.version}: {s.description}</span>
                    <span className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  {selectedScenarioVersion === s.version && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveScenario(true)} className="text-blue-600 focus:text-blue-700 font-medium">
                <Plus className="h-3.5 w-3.5 mr-2" />
                Save as New Scenario
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedItems.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulkDelete(true)}
              className="gap-2 text-xs h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedItems.size} Selected
            </Button>
          )}

          {activeTab === 'direct' && items.length > 0 && (
            <Button size="sm" variant="default" className="gap-2 text-xs h-8 bg-indigo-600 hover:bg-indigo-700" onClick={handleGenerateWBS}>
              <Layers className="h-3.5 w-3.5" />
              Generate WBS
            </Button>
          )}

          <Button size="sm" variant="outline" className="gap-2 text-xs h-8" onClick={handleAutoSchedule}>
            <CalendarClock className="h-3.5 w-3.5" />
            Auto-Schedule
          </Button>
          <Button
            size="sm"
            variant={showDriftAnalysis ? 'default' : 'outline'}
            className={`gap-2 text-xs h-8 ${showDriftAnalysis ? '' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
            onClick={() => setShowDriftAnalysis(!showDriftAnalysis)}
          >
            <Zap className="h-3.5 w-3.5" />
            Price Drift
          </Button>
          {!projectLocked ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-xs h-8 text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => setShowLockConfirm(true)}
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Baseline
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled
              className="gap-2 text-xs h-8 opacity-50"
            >
              <LockKeyhole className="h-3.5 w-3.5" />
              Locked
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs h-8"
            onClick={() => setShowVersionHistory(true)}
          >
            <History className="h-3.5 w-3.5" />
            Version History
          </Button>
          {draftCount > 0 && (
            <Button
              size="sm"
              variant="default"
              className="gap-2 text-xs h-8 bg-green-600 hover:bg-green-700"
              onClick={() => setShowPublishConfirm(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Publish {draftCount} Draft{draftCount > 1 ? 's' : ''}
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] lg:max-w-screen-2xl max-h-[95vh] flex flex-col p-0 overflow-hidden bg-slate-50/50 border-none shadow-2xl">
              <DialogHeader className="p-6 pb-4 bg-white border-b shrink-0">
                <DialogTitle className="flex items-center justify-between gap-4 text-2xl font-black tracking-tight text-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                      <Calculator className="h-6 w-6" />
                    </div>
                    <span>Add Item from AHSP Catalog</span>
                  </div>
                  {currentZone && (
                    <Badge variant="secondary" className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      {currentZone.name}
                    </Badge>
                  )}
                </DialogTitle>
                <div className="mt-4 flex flex-col gap-4">
                  {/* Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative flex-1 group w-full">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <Input
                        placeholder="Search by code, name, or category..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 text-lg border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all rounded-xl bg-slate-50/50 focus:bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="bg-white px-3 py-2 text-slate-600 border-slate-200 font-mono">
                        {filteredAHSP.length} Items Found
                      </Badge>
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 flex gap-3">
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-48 bg-white border-slate-200">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80 overflow-y-auto">
                          <SelectItem value="all">All Categories</SelectItem>
                          {ahspCategories.map(cat => (
                            <SelectItem key={cat} value={cat || ''}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                        <SelectTrigger className="w-32 bg-white border-slate-200">
                          <SelectValue placeholder="All Units" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Units</SelectItem>
                          <SelectItem value="m3">mÂ³</SelectItem>
                          <SelectItem value="m2">mÂ²</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ltr">ltr</SelectItem>
                          <SelectItem value="bh">bh</SelectItem>
                          <SelectItem value="oh">oh</SelectItem>
                          <SelectItem value="unit">unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(selectedCategory !== 'all' || selectedUnit !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory('all')
                          setSelectedUnit('all')
                        }}
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Main Content Area with Controlled Height */}
              <div className="flex-1 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(85vh - 240px)', minHeight: '400px' }}>
                <ScrollArea
                  ref={ahspParentRef}
                  className="flex-1 w-full"
                >
                  <div className="p-6 pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-md z-20 shadow-sm">
                            <TableRow className="hover:bg-transparent border-b">
                              <TableHead className="w-[120px] font-bold text-slate-900 py-4 px-6">Code</TableHead>
                              <TableHead className="min-w-[400px] font-bold text-slate-900 py-4">Pekerjaan / Item Description</TableHead>
                              <TableHead className="w-[100px] text-center font-bold text-slate-900 py-4">Unit</TableHead>
                              <TableHead className="text-right w-[150px] font-bold text-slate-900 py-4">Material</TableHead>
                              <TableHead className="text-right w-[150px] font-bold text-slate-900 py-4">Labor</TableHead>
                              <TableHead className="text-right w-[150px] font-bold text-slate-900 py-4">Tools & Others</TableHead>
                              <TableHead className="text-right w-[200px] font-bold text-slate-900 py-4 px-6">Total Unit Price</TableHead>
                              <TableHead className="w-[100px] py-4 px-6"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody style={{ height: `${ahspVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                            {filteredAHSP.length === 0 ? (
                              <TableRow style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '256px' }}>
                                <TableCell colSpan={8} className="text-center text-slate-400">
                                  <div className="flex flex-col items-center gap-2">
                                    <Search className="h-10 w-10 opacity-20" />
                                    <p className="text-lg font-medium">No matching items found.</p>
                                    <p className="text-sm">Try adjusting your search criteria.</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              ahspVirtualizer.getVirtualItems().map(virtualRow => {
                                const ahsp = filteredAHSP[virtualRow.index]
                                return (
                                  <TableRow
                                    key={ahsp.id}
                                    className="group hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0"
                                    onClick={() => handleAddFromAhsp(ahsp)}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: `${virtualRow.size}px`,
                                      transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                  >
                                    <TableCell className="py-4 px-6 font-mono text-[11px] text-slate-500 group-hover:text-blue-600 font-semibold">{ahsp.code}</TableCell>
                                    <TableCell className="py-4">
                                      <div className="flex flex-col gap-1">
                                        <span className="font-bold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">{ahsp.name}</span>
                                        {ahsp.category && (
                                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                                            <div className="h-1 w-1 rounded-full bg-slate-300" />
                                            {ahsp.category}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-4 text-center">
                                      <Badge variant="outline" className="text-[10px] h-6 bg-slate-50 font-black uppercase text-slate-600 border-slate-200">
                                        {ahsp.unit}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 text-right font-mono text-[11px] text-slate-500">
                                      {formatIDR(ahsp.price_material || 0)}
                                    </TableCell>
                                    <TableCell className="py-4 text-right font-mono text-[11px] text-slate-500">
                                      {formatIDR(ahsp.price_labor || 0)}
                                    </TableCell>
                                    <TableCell className="py-4 text-right font-mono text-[11px] text-slate-500">
                                      {formatIDR((ahsp.price_equipment || 0) + (ahsp.price_subcon || 0))}
                                    </TableCell>
                                    <TableCell className="py-4 text-right px-6">
                                      <span className="font-mono text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                                        {formatIDR(ahsp.finalPrice || 0)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-4 px-6 text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-9 w-9 p-0 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all"
                                      >
                                        <Plus className="h-5 w-5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>


                </ScrollArea>
              </div>
              <div className="px-6 py-4 bg-white border-t shrink-0 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="text-slate-500 hover:text-slate-900 font-semibold px-6">
                  Cancel
                </Button>
                <div className="h-10 w-[1px] bg-slate-200 mx-1 shrink-0" />
                <p className="text-xs text-slate-400 italic max-w-[200px] text-right mr-4 leading-tight">
                  Click on any row to immediately add the item to your project RAB.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="md:hidden space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/30">
            No items in RAB. Tap Add Item to start.
          </div>
        ) : (
          items.map((item, idx) => {
            const lineTotal = (item.volume || 0) * (item.unit_price || 0)
            const pClass = paretoMap.get(item.id) || 'C'
            return (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400">#{idx + 1} â€¢ {item.item_code || '-'}</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name || 'Untitled Item'}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{item.notes || 'No specification'}</div>
                  </div>
                  <Badge variant={pClass === 'A' ? 'destructive' : pClass === 'B' ? 'secondary' : 'outline'} className="h-5 min-w-5 px-1 text-[10px] font-mono">
                    {pClass}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={item.volume || ''}
                    onChange={e => handleVolumeChange(item.id, e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Volume"
                  />
                  <Input
                    type="number"
                    value={item.unit_price || ''}
                    disabled={projectLocked || !!item.snapshot_price}
                    onChange={e => handlePriceChange(item.id, e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Unit Price"
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Unit: {item.unit || '-'}</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{formatIDR(lineTotal)}</span>
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    onClick={() => removeItem(projectId, item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <TooltipProvider delayDuration={120}>
        <div className="hidden rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm md:block">
          <div
            ref={mainParentRef}
            className="max-h-[600px] overflow-auto relative"
          >
            <Table className="w-full table-fixed border-collapse">
              <TableHeader className="sticky-glass-tablehead">
                <TableRow className="border-b-2 border-slate-200 dark:border-slate-700 hover:bg-transparent shadow-sm">
                  {isColVisible('select') && <TableHead className="w-[48px] text-center font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">
                    <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                  </TableHead>}
                  {isColVisible('no') && <TableHead className="w-[56px] text-center font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4 text-center">No.</TableHead>}
                  {isColVisible('cls') && <TableHead className="w-[48px] text-center font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4 text-center">
                    <div className="inline-flex items-center gap-1 justify-center w-full">
                      <span>Cls</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" onClick={e => e.stopPropagation()} aria-label="Pareto class info"><Info className="h-3 w-3" /></button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-[11px] leading-snug">Class A contributes most of cost impact, then B, then C.</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>}
                  {isColVisible('code') && <TableHead className="w-[100px] font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Code</TableHead>}
                  {isColVisible('description') && <TableHead className="w-[320px] font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Pekerjaan / Item Description</TableHead>}
                  {isColVisible('task') && <TableHead className="w-[150px] font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Linked Task</TableHead>}
                  {isColVisible('unit') && <TableHead className="w-[64px] text-center font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Unit</TableHead>}
                  {isColVisible('volume') && <TableHead className="w-[100px] text-right font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Volume</TableHead>}
                  {isColVisible('tkdn') && <TableHead className="w-[80px] text-right font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">TKDN %</TableHead>}
                  {isColVisible('cost_material') && <TableHead className="w-[110px] text-right bg-blue-50/50 dark:bg-blue-900/20 font-bold text-blue-700 dark:text-blue-300 text-[10px] uppercase py-4 border-l-2 border-blue-200 dark:border-blue-800">Material</TableHead>}
                  {isColVisible('cost_labor') && <TableHead className="w-[110px] text-right bg-green-50/50 dark:bg-green-900/20 font-bold text-green-700 dark:text-green-300 text-[10px] uppercase py-4">Labor</TableHead>}
                  {isColVisible('cost_equipment') && <TableHead className="w-[110px] text-right bg-orange-50/50 dark:bg-orange-900/20 font-bold text-orange-700 dark:text-orange-300 text-[10px] uppercase py-4">Equip</TableHead>}
                  {isColVisible('cost_subcon') && <TableHead className="w-[110px] text-right bg-purple-50/50 dark:bg-purple-900/20 font-bold text-purple-700 dark:text-purple-300 text-[10px] uppercase py-4">Subcon</TableHead>}
                  {isColVisible('unit_price') && <TableHead className="w-[140px] text-right font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Unit Price</TableHead>}
                  {isColVisible('total') && <TableHead className="w-[144px] text-right font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Total Amount</TableHead>}
                  {isColVisible('actions') && <TableHead className="w-[64px] text-center font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase bg-transparent py-4">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody style={{ height: `${mainVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualRows.length === 0 ? (
                  <TableRow style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '128px' }}>
                    <TableCell colSpan={visibleColCount} className="text-center py-12 text-slate-400 bg-slate-50/20 w-full">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p>No items in RAB. Click "Add Item" to start.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  mainVirtualizer.getVirtualItems().map((vRow) => {
                    const row = virtualRows[vRow.index]
                    const item = row.item
                    const idx = row.index

                    if (row.type === 'expansion') {
                      const analysis = getAhspAnalysis(item.item_code || item.code)
                      return (
                        <TableRow
                          key={`${item.id}-expansion`}
                          ref={mainVirtualizer.measureElement}
                          data-index={vRow.index}
                          className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${vRow.start}px)`,
                          }}
                        >
                          <TableCell colSpan={visibleColCount} className="p-0">
                            <div className="px-6 py-3 ml-8">
                              {analysis ? (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                    <Layers size={12} className="text-blue-500" />
                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">AHSP Analysis: {analysis.ahsp.code} — {analysis.ahsp.name}</span>
                                  </div>
                                  {(() => {
                                    const grouped: Record<string, typeof analysis.components> = {}
                                    analysis.components.forEach(c => {
                                      const type = c.type || (c as any).resource?.type || 'other'
                                      if (!grouped[type]) grouped[type] = []
                                      grouped[type].push(c)
                                    })
                                    const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
                                      material: { label: 'MATERIAL', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/60 dark:bg-blue-900/20' },
                                      labor: { label: 'TENAGA KERJA', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/60 dark:bg-emerald-900/20' },
                                      equipment: { label: 'PERALATAN', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50/60 dark:bg-amber-900/20' },
                                      subcontractor: { label: 'SUBKONTRAKTOR', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50/60 dark:bg-purple-900/20' },
                                      other: { label: 'LAIN-LAIN', color: 'text-slate-600', bg: 'bg-slate-50' },
                                    }
                                    let runningTotal = 0
                                    return (
                                      <div>
                                        {Object.entries(grouped).map(([type, comps]) => {
                                          const cfg = typeConfig[type] || typeConfig.other
                                          return (
                                            <div key={type}>
                                              <div className={`px-4 py-1.5 ${cfg.bg} border-b border-slate-100 dark:border-slate-800`}>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                                              </div>
                                              {comps.map((comp: any, ci: number) => {
                                                const name = comp.resource?.name || comp.resourceName || comp.name || '-'
                                                const unit = comp.unit || comp.resource?.unit || '-'
                                                const coeff = comp.coefficient || 0
                                                const price = comp.unitPrice || comp.resource?.unitPrice || 0
                                                const sub = coeff * price
                                                runningTotal += sub
                                                return (
                                                  <div key={ci} className="flex items-center px-4 py-1 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <span className="w-[220px] text-[10px] text-slate-700 dark:text-slate-300 truncate">{name}</span>
                                                    <span className="w-[50px] text-[10px] text-center text-slate-500 font-mono">{unit}</span>
                                                    <span className="w-[80px] text-[10px] text-right text-slate-600 dark:text-slate-400 font-mono">{Number(coeff).toFixed(4)}</span>
                                                    <span className="w-[16px] text-[10px] text-center text-slate-400">×</span>
                                                    <span className="w-[100px] text-[10px] text-right text-slate-600 dark:text-slate-400 font-mono">{formatIDR(price)}</span>
                                                    <span className="w-[16px] text-[10px] text-center text-slate-400">=</span>
                                                    <span className="w-[110px] text-[11px] text-right font-mono font-semibold text-slate-700 dark:text-slate-300">{formatIDR(sub)}</span>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )
                                        })}
                                        <div className="flex items-center justify-end px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-3">Harga Satuan Analisa</span>
                                          <span className="text-[12px] font-mono font-black text-slate-900 dark:text-white">{formatIDR(runningTotal)}</span>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400 italic py-2">No AHSP analysis linked — item code not found in catalog.</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }

                    const lineTotal = (item.volume || 0) * (item.unit_price || 0)
                    const pClass = paretoMap.get(item.id) || 'C'
                    const isExpanded = expandedRows.has(item.id)

                    const rowClass = pClass === 'A'
                      ? "bg-red-50/30 dark:bg-red-900/10 border-l-[3px] border-l-red-500 hover:bg-red-50/50"
                      : pClass === 'B'
                        ? "bg-yellow-50/30 dark:bg-yellow-900/10 border-l-[3px] border-l-yellow-400 hover:bg-yellow-50/50"
                        : "border-l-[3px] border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"

                    return (
                      <TableRow
                        key={item.id}
                        ref={mainVirtualizer.measureElement}
                        data-index={vRow.index}
                        className={`${rowClass} group transition-colors border-b border-slate-100 dark:border-slate-800`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${vRow.start}px)`,
                        }}
                      >
                        {isColVisible('select') && <TableCell className="w-[48px] text-center py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={(checked) => handleSelectOne(item.id, checked as boolean)} className="border-slate-300" />
                        </TableCell>}
                        {isColVisible('no') && <TableCell className="w-[56px] text-center py-2.5">
                          <button type="button" onClick={() => toggleExpand(item.id, item.item_code || (item as any).code)} className="inline-flex items-center gap-0.5 text-center font-mono text-[10px] text-slate-400 hover:text-blue-600 transition-colors w-full justify-center">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {idx + 1}
                          </button>
                        </TableCell>}
                        {isColVisible('cls') && <TableCell className="w-[48px] text-center py-2.5">
                          <div className="flex justify-center">
                            <Badge variant={pClass === 'A' ? 'destructive' : pClass === 'B' ? 'secondary' : 'outline'} className={`h-4 w-4 p-0 flex items-center justify-center text-[9px] font-mono border-none shadow-none ${pClass === 'B' ? 'bg-yellow-100 text-yellow-800' : ''}`}>{pClass}</Badge>
                          </div>
                        </TableCell>}
                        {isColVisible('code') && <TableCell className="w-[100px] font-mono text-[10px] text-slate-500 py-2.5">{item.item_code || '-'}</TableCell>}
                        {isColVisible('description') && <TableCell className="w-[320px] py-2.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Input value={item.name || ''} onChange={e => updateItem(projectId, item.id, { name: e.target.value })} className="h-7 text-xs border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-slate-200 focus:border-blue-500 font-bold px-2 shadow-none transition-all truncate" placeholder="Item Name" />
                              {(item as any).isDraft && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-yellow-50 text-yellow-700 border-yellow-300 shrink-0 font-bold uppercase tracking-tight">Draft</Badge>}
                            </div>
                            <Input value={item.notes || ''} onChange={e => updateItem(projectId, item.id, { notes: e.target.value })} className="h-5 text-[10px] text-slate-500 border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-slate-200 focus:border-blue-500 px-2 shadow-none transition-all font-medium italic" placeholder="Brand / Spec..." />
                          </div>
                        </TableCell>}
                        {isColVisible('task') && <TableCell className="w-[150px] py-2.5">
                          <Select value={item.taskId || 'unassigned'} onValueChange={(val) => updateItem(projectId, item.id, { taskId: val === 'unassigned' ? undefined : val })}>
                            <SelectTrigger className="h-7 text-[11px] border-slate-200 bg-slate-50/50 hover:bg-white focus:ring-0 focus:border-blue-500 shadow-none"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {tasks.map(t => <SelectItem key={t.id} value={t.id} className="text-[11px]">{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>}
                        {isColVisible('unit') && <TableCell className="w-[64px] py-2.5 text-center px-0">
                          <Badge variant="outline" className="text-[10px] h-6 bg-slate-50 font-black uppercase text-slate-600 border-slate-200 min-w-[32px] justify-center mx-auto">
                            {item.unit || '-'}
                          </Badge>
                        </TableCell>}
                        {isColVisible('volume') && <TableCell className="w-[100px] py-2.5">
                          <Input type="number" value={item.volume || ''} onChange={e => handleVolumeChange(item.id, e.target.value)} className="h-7 text-right font-mono text-[11px] border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-slate-200 focus:border-blue-500 shadow-none font-bold" />
                        </TableCell>}
                        {isColVisible('tkdn') && <TableCell className="w-[80px] py-2.5">
                          <Input type="number" placeholder="0" value={item.tkdn_percent || ''} onChange={e => updateItem(projectId, item.id, { tkdn_percent: parseFloat(e.target.value) || 0 })} className="h-7 text-right font-mono text-[11px] border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-slate-200 focus:border-blue-500 shadow-none text-slate-500" />
                        </TableCell>}
                        {isColVisible('cost_material') && <TableCell className="w-[110px] bg-blue-50/10 py-2.5 border-l-2 border-blue-100">
                          <Input type="number" disabled={projectLocked || !!item.snapshot_price} className="h-7 text-right font-mono text-[11px] bg-transparent border-transparent hover:bg-white focus:bg-white hover:border-blue-200 focus:border-blue-500 shadow-none text-blue-700 disabled:opacity-50" value={item.cost_material || 0} onChange={(e) => handleSplitCostChange(item.id, 'cost_material', e.target.value)} />
                        </TableCell>}
                        {isColVisible('cost_labor') && <TableCell className="w-[110px] bg-green-50/10 py-2.5">
                          <Input type="number" disabled={projectLocked || !!item.snapshot_price} className="h-7 text-right font-mono text-[11px] bg-transparent border-transparent hover:bg-white focus:bg-white hover:border-green-200 focus:border-green-500 shadow-none text-green-700 disabled:opacity-50" value={item.cost_labor || 0} onChange={(e) => handleSplitCostChange(item.id, 'cost_labor', e.target.value)} />
                        </TableCell>}
                        {isColVisible('cost_equipment') && <TableCell className="w-[110px] bg-orange-50/10 py-2.5">
                          <Input type="number" disabled={projectLocked || !!item.snapshot_price} className="h-7 text-right font-mono text-[11px] bg-transparent border-transparent hover:bg-white focus:bg-white hover:border-orange-200 focus:border-orange-500 shadow-none text-orange-700 disabled:opacity-50" value={item.cost_equipment || 0} onChange={(e) => handleSplitCostChange(item.id, 'cost_equipment', e.target.value)} />
                        </TableCell>}
                        {isColVisible('cost_subcon') && <TableCell className="w-[110px] bg-purple-50/10 py-2.5">
                          <Input type="number" disabled={projectLocked || !!item.snapshot_price} className="h-7 text-right font-mono text-[11px] bg-transparent border-transparent hover:bg-white focus:bg-white hover:border-purple-200 focus:border-blue-500 shadow-none text-purple-700 disabled:opacity-50" value={item.cost_subcon || 0} onChange={(e) => handleSplitCostChange(item.id, 'cost_subcon', e.target.value)} />
                        </TableCell>}
                        {isColVisible('unit_price') && <TableCell className="w-[140px] py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {item.snapshot_price && <Lock size={10} className="text-amber-500 shrink-0" />}
                            <Input type="number" disabled={projectLocked || !!item.snapshot_price} value={item.unit_price || ''} onChange={e => handlePriceChange(item.id, e.target.value)} className="h-7 text-right font-mono text-[11px] border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-slate-200 focus:border-blue-500 shadow-none font-bold text-slate-900 disabled:opacity-50" />
                          </div>
                        </TableCell>}
                        {isColVisible('total') && <TableCell className="w-[144px] text-right font-mono text-xs font-black text-slate-900 py-2.5">{formatIDR(lineTotal)}</TableCell>}
                        {isColVisible('actions') && <TableCell className="w-[64px] py-2.5 text-center">
                          <div className="flex justify-center">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-100 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(projectId, item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              {items.length > 0 && (
                <TableFooter className="sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md z-30 border-t-2 border-slate-200 dark:border-slate-800">
                  <TableRow className="hover:bg-transparent border-t-2 border-slate-200 dark:border-slate-700">
                    {isColVisible('select') && <TableCell className="w-[48px] py-3" />}
                    {isColVisible('no') && <TableCell className="w-[56px] py-3" />}
                    {isColVisible('cls') && <TableCell className="w-[48px] py-3" />}
                    {isColVisible('code') && <TableCell className="w-[100px] py-3" />}
                    {isColVisible('description') && <TableCell className="w-[320px] py-3 text-right font-black text-[10px] text-slate-500 uppercase tracking-wider">Sub-Totals</TableCell>}
                    {isColVisible('task') && <TableCell className="w-[150px] py-3" />}
                    {isColVisible('unit') && <TableCell className="w-[64px] py-3" />}
                    {isColVisible('volume') && <TableCell className="w-[100px] py-3" />}
                    {isColVisible('tkdn') && <TableCell className="w-[80px] py-3" />}

                    {isColVisible('cost_material') && (
                      <TableCell className="w-[110px] py-3 text-right font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/30 border-l-2 border-blue-100 dark:border-blue-900/50">
                        {formatIDR(totalMaterial)}
                      </TableCell>
                    )}
                    {isColVisible('cost_labor') && (
                      <TableCell className="w-[110px] py-3 text-right font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30">
                        {formatIDR(totalLabor)}
                      </TableCell>
                    )}
                    {isColVisible('cost_equipment') && (
                      <TableCell className="w-[110px] py-3 text-right font-mono text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50/30">
                        {formatIDR(totalEquip)}
                      </TableCell>
                    )}
                    {isColVisible('cost_subcon') && (
                      <TableCell className="w-[110px] py-3 text-right font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50/30">
                        {formatIDR(totalSubcon)}
                      </TableCell>
                    )}

                    {isColVisible('unit_price') && <TableCell className="w-[140px] py-3" />}
                    {isColVisible('total') && (
                      <TableCell className="w-[144px] py-3 text-right font-mono text-sm font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/50">
                        {formatIDR(total)}
                      </TableCell>
                    )}
                    {isColVisible('actions') && <TableCell className="w-[64px] py-3" />}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>
      </TooltipProvider>

      <div className="sticky-glass-footer flex flex-col gap-4 rounded-lg p-3 md:p-4 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-wider">
            <div className="flex items-center gap-1.5"><Badge variant="destructive" className="h-2.5 w-2.5 p-0 rounded-full" /> <span className="text-slate-500">Class A:</span> <span className="text-slate-900 dark:text-slate-200">80% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><Badge className="h-2.5 w-2.5 p-0 rounded-full bg-yellow-500 hover:bg-yellow-600" /> <span className="text-slate-500">Class B:</span> <span className="text-slate-900 dark:text-slate-200">15% Cost Baseline</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="outline" className="h-2.5 w-2.5 p-0 rounded-full border-slate-400" /> <span className="text-slate-500">Class C:</span> <span className="text-slate-900 dark:text-slate-200">Non-Critical</span></div>
          </div>

          <div className="flex flex-col items-end">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <Calculator size={12} /> Grand Total Estimated
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white drop-shadow-sm">
              {formatIDR(total)}
            </div>
          </div>
        </div>
      </div>

      <RABVersionHistory
        projectId={projectId}
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
      />
    </div>
  )
}
