
/**
 * AHSPCatalog.tsx
 * Main AHSP catalog component with search, filter, and management
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Filter, Plus, Edit2, Trash2, Calculator, Download, Upload, History, X, RotateCcw, MoreHorizontal, MapPin } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
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
import { TooltipProvider } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useAHSPStore, getAHSPSummary } from '../../store/ahspStore'
import { useRabStore } from '@/store/rabStore'
import { AHSPItemEditor } from './AHSPItemEditor'
import { ZoneManager } from './ZoneManager'
import { ZonePriceEditor } from './ZonePriceEditor'
import { PriceHistoryDialog } from './PriceHistoryDialog'
import { AHSPCreationModeDialog, type AHSPCreationMode } from './AHSPCreationModeDialog'
import { ahspDataService } from '../../services/ahspService'
import { formatIDR } from '../../lib/utils'
import type { AHSPItem } from '../../types/ahsp'
import { toast } from 'sonner'
import { DataTable } from '../shared/DataTable'
import { getAHSPColumns } from './AHSPColumns'

/**
 * Mini horizontal stacked bar showing cost composition (material/labor/equipment/subcon)
 */
function CostMixBar({ mat, lab, eqp, sub }: { mat: number; lab: number; eqp: number; sub: number }) {
  const total = mat + lab + eqp + sub
  if (total === 0) return null
  const matPct = (mat / total) * 100
  const labPct = (lab / total) * 100
  const eqpPct = (eqp / total) * 100
  const subPct = (sub / total) * 100
  const tip = `Material ${Math.round(matPct)}% · Labor ${Math.round(labPct)}% · Equip ${Math.round(eqpPct)}% · Subcon ${Math.round(subPct)}%`
  return (
    <div
      className="flex h-1.5 w-full max-w-[160px] rounded-full overflow-hidden mt-1 opacity-70"
      title={tip}
    >
      {matPct > 0 && <div className="bg-primary h-full" style={{ width: `${matPct}%` }} />}
      {labPct > 0 && <div className="bg-orange-400 h-full" style={{ width: `${labPct}%` }} />}
      {eqpPct > 0 && <div className="bg-indigo-400 h-full" style={{ width: `${eqpPct}%` }} />}
      {subPct > 0 && <div className="bg-purple-400 h-full" style={{ width: `${subPct}%` }} />}
    </div>
  )
}

/** Extended AHSPItem with zone price breakdown fields */
interface AHSPItemWithPrices extends AHSPItem {
  price_material?: number
  price_labor?: number
  price_equipment?: number
  price_subcon?: number
  originalFinalPrice?: number
}

/** Props for AHSPCatalog component */
export interface AHSPCatalogProps {
  /** Show inactive items */
  showInactive?: boolean
  /** Default category filter */
  defaultCategory?: string
  /** Compact view mode */
  compact?: boolean
  /** Toggle derived bid price display (read-only) */
  showBidPrice?: boolean
  /** Default project margin percentage for derived bid price */
  bidMarginPct?: number
}

/**
 * AHSPCatalog Component
 */
export function AHSPCatalog({
  showInactive = false,
  defaultCategory,
  compact = false,
  showBidPrice = false,
  bidMarginPct = 0,
}: AHSPCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory || 'all')
  const [selectedZone, setSelectedZone] = useState<string>('default')

  const [showEditor, setShowEditor] = useState(false)
  const [showZoneEditor, setShowZoneEditor] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)

  const [editingItem, setEditingItem] = useState<AHSPItem | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<AHSPItem | null>(null)
  const [selectedMode, setSelectedMode] = useState<AHSPCreationMode | null>(null)
  const [sourceReference, setSourceReference] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[]>([])
  const parentRef = useRef<HTMLDivElement>(null)

  const {
    ahspItems,
    resources,
    zones,
    componentsByAHSP,
    zonePricesByZone,
    loading,
    errors,
    addAHSPItem,
    updateAHSPItem,
    deleteAHSPItem,
    exportAHSPItems,
    importAHSPItems,
    fetchZones,
    fetchZonePrices,
    fetchComponents,
    clearAllData
  } = useAHSPStore()

  // Load zones on mount
  useEffect(() => {
    fetchZones()
  }, [fetchZones])

  // Load zone prices when zone changes
  useEffect(() => {
    if (selectedZone && selectedZone !== 'default') {
      fetchZonePrices(selectedZone)
    }
  }, [selectedZone, fetchZonePrices])

  useEffect(() => {
    // Scroll to top when search/filter changed
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
  }, [searchQuery, selectedCategory, selectedZone])

  // Calculate summary
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => {
    const state = useAHSPStore.getState()
    return getAHSPSummary(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahspItems, resources])

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(ahspItems.map(item => item.category)))
    return cats.sort()
  }, [ahspItems])

  const sniItemsPreview = useMemo(() => {
    return ahspItems
      .filter(item => item.isActive && item.creationMode === 'sni')
      .slice(0, 8)
      .map(item => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        finalPrice: item.finalPrice,
        componentCount: (componentsByAHSP[item.id] || []).length,
        updatedAt: item.updatedAt,
      }))
  }, [ahspItems, componentsByAHSP])

  // Filter and search items
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const isAllCategory = selectedCategory === 'all'

    return ahspItems.filter(item => {
      // 1. Status filter
      if (!showInactive && !item.isActive) return false

      // 2. Category filter
      if (!isAllCategory && item.category !== selectedCategory) return false

      // 3. Search filter
      if (query) {
        const nameMatch = item.name.toLowerCase().includes(query)
        const codeMatch = item.code.toLowerCase().includes(query)
        const categoryMatch = item.category?.toLowerCase().includes(query)
        if (!nameMatch && !codeMatch && !categoryMatch) return false
      }

      return true
    })
  }, [ahspItems, showInactive, selectedCategory, searchQuery])

  // Apply Zone Overrides
  const displayItems = useMemo(() => {
    if (selectedZone === 'default') return filteredItems

    const zonePrices = zonePricesByZone[selectedZone] || []
    if (zonePrices.length === 0) return filteredItems

    const priceMap = new Map(zonePrices.map(p => [p.ahspId, p]))

    return filteredItems.map(item => {
      const override = priceMap.get(item.id)
      if (override) {
        return {
          ...item,
          // Calculate base price from override components
          price_material: override.price_material,
          price_labor: override.price_labor,
          price_equipment: override.price_equipment,
          price_subcon: override.price_subcon,
          basePrice: (override.price_material + override.price_labor + override.price_equipment + override.price_subcon),
          finalPrice: override.finalPrice,
          originalFinalPrice: item.finalPrice // Flag to show difference
        }
      }
      return item
    })
  }, [filteredItems, selectedZone, zonePricesByZone])

  const groupedDisplayRows = useMemo(() => {
    if (displayItems.length === 0) return []

    // Group items by category in a single pass
    const groups: Record<string, AHSPItem[]> = {}
    for (const item of displayItems) {
      const cat = item.category || 'Uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    const categoriesSorted = Object.keys(groups).sort()
    const rows: Array<{ type: 'section'; label: string } | { type: 'item'; item: AHSPItem; rowNumber: number }> = []
    let globalRowIndex = 1

    for (let i = 0; i < categoriesSorted.length; i++) {
      const category = categoriesSorted[i]
      const items = groups[category]
      const prefix = String.fromCharCode(65 + (i % 26))

      rows.push({ type: 'section', label: `${prefix}. ${category.toUpperCase()}` })

      for (const item of items) {
        rows.push({ type: 'item', item, rowNumber: globalRowIndex++ })
      }
    }

    return rows
  }, [displayItems])
  // RAB usage count per AHSP item (Item 13)
  const rabItemsByProject = useRabStore(s => s.itemsByProject)
  const ahspUsageMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const items of Object.values(rabItemsByProject)) {
      for (const ri of items) {
        const aid = (ri as { ahspItemId?: string }).ahspItemId
        if (aid) map.set(aid, (map.get(aid) ?? 0) + 1)
      }
    }
    return map
  }, [rabItemsByProject])
  const totals = useMemo(() => {
    let materialTotal = 0
    let laborTotal = 0
    let equipmentTotal = 0
    let subconTotal = 0
    let unallocatedTotal = 0
    let grandTotal = 0

    displayItems.forEach((item) => {
      const price = item.finalPrice || 0
      grandTotal += price

      const breakSum = (item.price_material || 0) + (item.price_labor || 0) + (item.price_equipment || 0) + (item.price_subcon || 0)

      if (breakSum === 0 && price > 0) {
        unallocatedTotal += price
      } else {
        materialTotal += item.price_material || 0
        laborTotal += item.price_labor || 0
        equipmentTotal += item.price_equipment || 0
        subconTotal += item.price_subcon || 0
      }
    })

    return { materialTotal, laborTotal, equipmentTotal, subconTotal, unallocatedTotal, grandTotal }
  }, [displayItems])

  // Handle Select All
  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayItems.map(item => item.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  // Handle Select One
  const handleToggleOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  // Handle Bulk Delete  — uses AlertDialog instead of browser confirm()
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setPendingBulkDeleteIds(Array.from(selectedIds))
    setShowBulkDeleteConfirm(true)
  }

  const confirmBulkDelete = () => {
    pendingBulkDeleteIds.forEach(id => deleteAHSPItem(id))
    setSelectedIds(new Set())
    toast.success(`${pendingBulkDeleteIds.length} item berhasil dihapus`)
    setPendingBulkDeleteIds([])
    setShowBulkDeleteConfirm(false)
  }

  // Handle actions
  const handleAddItem = () => {
    setShowModeDialog(true)
  }

  const handleModeSelect = (mode: AHSPCreationMode) => {
    setSelectedMode(mode)
    // Set source reference based on mode
    if (mode === 'sni') {
      setSourceReference('SNI') // Will be updated when specific preset is selected
    } else if (mode === 'historical') {
      setSourceReference('historical') // Will be updated when project is selected
    } else {
      setSourceReference('custom')
    }
    setEditingItem(null)
    setShowModeDialog(false)
    setShowEditor(true)
    toast.info(`Membuat AHSP dengan mode ${mode.toUpperCase()}`)
  }

  const handleEditItem = async (item: AHSPItem) => {
    setEditingItem(item)
    // Fetch components for this AHSP item
    await fetchComponents(item.id)
    if (selectedZone !== 'default') {
      setShowZoneEditor(true)
    } else {
      setShowEditor(true)
    }
  }

  const handleHistoryClick = (item: AHSPItem) => {
    setEditingItem(item)
    setShowHistoryDialog(true)
  }

  const handleDeleteItem = (item: AHSPItem) => {
    setPendingDeleteItem(item)
  }

  const handleDeleteConfirm = () => {
    if (!pendingDeleteItem) return
    deleteAHSPItem(pendingDeleteItem.id)
    toast.success('Item AHSP berhasil dihapus')
    setPendingDeleteItem(null)
  }

  const handleExport = (itemsToExport?: AHSPItem[]) => {
    try {
      const data = itemsToExport || exportAHSPItems()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().split('T')[0]
      a.download = itemsToExport ? `ahsp-selected-${timestamp}.json` : `ahsp-catalog-${timestamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Failed to export AHSP catalog', { description: (error as Error).message })
    }
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)

        if (!Array.isArray(data)) {
          throw new Error('Invalid file format')
        }

        const validItems = data.filter(item =>
          item.code && item.name && item.unit && item.category
        )

        if (validItems.length !== data.length) {
          toast.warning('Some items were skipped due to missing required fields')
        }

        // Dedup check: skip items whose code already exists in the catalog
        const duplicates = validItems.filter(imp =>
          ahspItems.some(ex => ex.code === imp.code)
        )
        if (duplicates.length > 0) {
          const codes = duplicates.map((d: { code?: string }) => d.code).slice(0, 3).join(', ')
          toast.warning(
            `${duplicates.length} kode AHSP duplikat ditemukan: ${codes}${duplicates.length > 3 ? '...' : ''}. Item tersebut dilewati.`
          )
        }
        const uniqueItems = validItems.filter(imp =>
          !ahspItems.some(ex => ex.code === imp.code)
        )

        const itemsToImport = uniqueItems.map(item => {
          const basePrice = item.basePrice || 0
          const overhead = item.overheadPercentage || 0
          const profit = item.profitPercentage || 0
          const finalPrice = basePrice * (1 + overhead / 100 + profit / 100)

          return {
            ...item,
            basePrice,
            overheadPercentage: overhead,
            profitPercentage: profit,
            finalPrice,
            isActive: item.isActive !== false,
            components: item.components || []
          }
        })

        // Import AHSP items (now async - direct to Supabase for large imports >100 items)
        await importAHSPItems(itemsToImport)
        toast.success(`Imported ${itemsToImport.length} AHSP items`)
      } catch (error) {
        toast.error('Failed to import AHSP catalog. Please check the file format.')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-4 density-compact">
      {/* Summary Cards */}
      {!compact && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AHSP Items</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAHSPItems}</div>
              <p className="text-xs text-muted-foreground">
                {ahspItems.filter(item => item.isActive).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalResources}</div>
              <p className="text-xs text-muted-foreground">Across all types</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Harga Rata-rata</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.averagePrice)}</div>
              <p className="text-xs text-muted-foreground">Per item AHSP</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kategori</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Jumlah kategori berbeda</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter + Action Toolbar */}
      <div className="sticky top-0 z-10 bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari item AHSP..."
              className="w-full h-7 pl-7 pr-6 text-xs border border-border rounded bg-muted/30 focus:outline-none focus:border-orange-400 focus:bg-card transition-colors placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-muted-foreground"
              >
                <X size={9} />
              </button>
            )}
          </div>

          {/* Category */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-7 w-[152px] text-xs border-border bg-muted/30 focus:ring-0 focus:border-orange-400 rounded">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Zone */}
          <div className="flex items-center gap-1">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className={`h-7 w-[148px] text-xs focus:ring-0 rounded ${
                selectedZone !== 'default'
                  ? 'border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-400'
                  : 'border-border bg-muted/30 focus:border-orange-400'
              }`}>
                <div className="flex items-center gap-1 min-w-0">
                  <MapPin size={9} className={selectedZone !== 'default' ? 'text-orange-500 shrink-0' : 'text-foreground shrink-0'} />
                  <SelectValue placeholder="Zona" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (Master)</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ZoneManager />
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-muted mx-0.5 shrink-0" />

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleExport()}
              title="Ekspor katalog AHSP"
              className="flex items-center gap-1 text-xs text-muted-foreground h-7 px-2.5 rounded border border-border hover:border-border hover:bg-muted/30 transition-all"
            >
              <Download size={11} />
              <span>Ekspor</span>
            </button>

            <label className="flex items-center gap-1 text-xs text-muted-foreground h-7 px-2.5 rounded border border-border hover:border-border hover:bg-muted/30 transition-all cursor-pointer">
              <Upload size={11} />
              <span>Impor</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

            <button
              onClick={handleAddItem}
              className="flex items-center gap-1 text-xs bg-orange-500 text-white font-semibold h-7 px-3 rounded hover:bg-orange-600 transition-all"
            >
              <Plus size={11} />
              <span>Tambah Item</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center text-muted-foreground h-7 w-7 rounded border border-border hover:border-border hover:bg-muted/30 hover:text-muted-foreground transition-all">
                  <MoreHorizontal size={12} />
                  <span className="sr-only">More actions</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => handleExport(selectedIds.size > 0 ? displayItems.filter((i: AHSPItem) => selectedIds.has(i.id)) : undefined)}
                  disabled={ahspItems.length === 0}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Ekspor Terpilih
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-900/20"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={ahspItems.length === 0 && resources.length === 0}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reset Sistem
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Zone active banner */}
        {selectedZone !== 'default' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border-t border-orange-100 text-xs text-orange-700">
            <MapPin size={10} className="text-orange-500 shrink-0" />
            <span>Zona: <strong>{zones.find(z => z.id === selectedZone)?.name}</strong> — harga zona menimpa harga master.</span>
          </div>
        )}
      </div>

      {errors.ahspItems && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors.ahspItems}
        </div>
      )}

      {/* Main Table Content */}
      <div className="hidden rounded-lg border border-border overflow-hidden shadow-sm bg-card md:block">
        <div
          ref={parentRef}
          className="relative"
        >
          {loading.ahspItems ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Belum ada item AHSP.</p>
              <Button variant="link" onClick={handleAddItem} className="mt-2 text-blue-600">Buat item baru</Button>
            </div>
          ) : (
            <DataTable
              columns={getAHSPColumns({
                onEditItem: handleEditItem,
                onHistoryClick: handleHistoryClick,
                onDeleteItem: handleDeleteItem,
                hasZoneOverride: selectedZone !== 'default',
                ahspUsageMap,
                showBidPrice,
                bidMarginPct,
              })}
              data={groupedDisplayRows.map(r => r.type === 'section' ? r : r.item)}
              virtualized={true}
              // Embedded (compact) view has extra chrome above (pipeline tabs + budget
              // strip), so reserve more height there to keep the last rows reachable.
              maxHeight={compact ? 'calc(100vh - 420px)' : 'calc(100vh - 280px)'}
              enableRowSelection={true}
              rowSelection={Object.fromEntries(Array.from(selectedIds).map(id => [id, true]))}
              onRowSelectionChange={(updater) => {
                const newSelection = typeof updater === 'function' ? updater(Object.fromEntries(Array.from(selectedIds).map(id => [id, true]))) : updater;
                const newIds = new Set<string>();
                for (const key in newSelection) {
                   if (newSelection[key]) newIds.add(key);
                }
                setSelectedIds(newIds);
              }}
              getRowId={(row: any) => row.id || `section-${row.label}`}
              isCustomRow={(row: any) => row.type === 'section'}
              renderCustomRow={(row: any) => (
                <TableRow
                  key={`section-${row.label}`}
                  className="bg-muted/30 hover:bg-accent/40"
                >
                  <TableCell colSpan={10} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </TableCell>
                </TableRow>
              )}
            />
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-background text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-border ring-4 ring-slate-900/10 backdrop-blur-md">
              <div className="flex items-center gap-3 pr-6 border-r border-border">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-bold tracking-tight">
                  <span className="text-primary pr-1">{selectedIds.size}</span> Item Dipilih
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-foreground hover:text-white hover:bg-muted gap-2 h-9 px-4 font-semibold text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                  Bersihkan
                </Button>

                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-red-900/20"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Terpilih
                </Button>

                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-blue-900/20"
                  onClick={() => {
                    handleExport(displayItems.filter(i => selectedIds.has(i.id)))
                    toast.success('Mengekspor item terpilih...')
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading.ahspItems && displayItems.length > 0 && (
          <div className="border-t border-border bg-white/80 backdrop-blur-sm px-6 py-4 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6 items-center">
              <div className="md:col-span-1">
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Material</div>
                <div className="font-mono text-xs font-bold text-primary">{formatIDR(totals.materialTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Labor</div>
                <div className="font-mono text-xs font-bold text-orange-700">{formatIDR(totals.laborTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Equipment</div>
                <div className="font-mono text-xs font-bold text-indigo-700">{formatIDR(totals.equipmentTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Subcon</div>
                <div className="font-mono text-xs font-bold text-purple-700">{formatIDR(totals.subconTotal)}</div>
              </div>
              {totals.unallocatedTotal > 0 && (
                <div className="md:col-span-1">
                  <div className="text-xs uppercase font-bold tracking-widest text-red-400 mb-1">Belum Teralokasi</div>
                  <div className="font-mono text-xs font-bold text-red-600">{formatIDR(totals.unallocatedTotal)}</div>
                </div>
              )}
              <div className={totals.unallocatedTotal > 0 ? "md:col-span-1 text-right" : "md:col-span-2 text-right"}>
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Grand Total Katalog</div>
                <div className="font-mono text-lg font-black text-foreground tabular-nums">
                  {formatIDR(totals.grandTotal)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AHSPCreationModeDialog
        open={showModeDialog}
        onClose={() => setShowModeDialog(false)}
        onSelect={handleModeSelect}
        sniItemsPreview={sniItemsPreview}
      />

      <AHSPItemEditor
        item={editingItem}
        mode={selectedMode || undefined}
        sourceReference={sourceReference}
        open={showEditor}
        onClose={() => {
          setShowEditor(false)
          setSelectedMode(null)
          setSourceReference(undefined)
        }}
        onSave={async (data) => {
          let itemId: string
          if (editingItem) {
            updateAHSPItem(editingItem.id, data)
            itemId = editingItem.id
          } else {
            itemId = addAHSPItem(data)

            // Save creation log for new items
            if (selectedMode) {
              try {
                await ahspDataService.saveCreationLog({
                  ahsp_id: itemId,
                  creation_mode: selectedMode,
                  source_reference: sourceReference || '',
                  metadata: {
                    created_via: 'ahsp_catalog',
                    timestamp: new Date().toISOString()
                  }
                })
              } catch {
                // Non-critical: creation log failure silently ignored
              }
            }
          }
          return itemId
        }}
      />

      {editingItem && (
        <ZonePriceEditor
          item={editingItem}
          zoneId={selectedZone}
          open={showZoneEditor}
          onClose={() => setShowZoneEditor(false)}
        />
      )}

      {editingItem && (
        <PriceHistoryDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
          ahspId={editingItem.id}
          zoneId={selectedZone === 'default' ? undefined : selectedZone}
          itemName={editingItem.name}
        />
      )}

      <AlertDialog open={!!pendingDeleteItem} onOpenChange={(open) => !open && setPendingDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus permanen item AHSP
              &quot;{pendingDeleteItem?.name}&quot; beserta seluruh mapping komponennya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 focus:ring-red-600">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation — Item 12 */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Hapus {pendingBulkDeleteIds.length} Item AHSP?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Semua item yang dipilih beserta komponen analisanya akan dihapus permanen dari katalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Reset Semua Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan <strong>menghapus permanen</strong> semua data AHSP, Komponen, dan Resources (DKH) dari database.
              Data yang sudah ada di RAB proyek tidak akan terhapus, namun referensi ke katalog akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await clearAllData()
                setShowResetConfirm(false)
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
