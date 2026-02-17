
/**
 * AHSPCatalog.tsx
 * Main AHSP catalog component with search, filter, and management
 */

import React, { useState, useMemo, useEffect } from 'react'
import { Search, Filter, Plus, Edit2, Trash2, Calculator, Download, Upload, History, Info, X } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useAHSPStore, getAHSPSummary, validateAHSP } from '../../store/ahspStore'
import { AHSPItemEditor } from './AHSPItemEditor'
import { ZoneManager } from './ZoneManager'
import { ZonePriceEditor } from './ZonePriceEditor'
import { PriceHistoryDialog } from './PriceHistoryDialog'
import { AHSPCreationModeDialog, type AHSPCreationMode } from './AHSPCreationModeDialog'
import { formatIDR } from '../../lib/utils'
import type { AHSPItem, Zone } from '../../types/ahsp'
import { toast } from 'sonner'

/** Props for AHSPCatalog component */
export interface AHSPCatalogProps {
  /** Show inactive items */
  showInactive?: boolean
  /** Default category filter */
  defaultCategory?: string
  /** Compact view mode */
  compact?: boolean
}

/**
 * AHSPCatalog Component
 */
export function AHSPCatalog({
  showInactive = false,
  defaultCategory,
  compact = false,
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
  const [visibleCount, setVisibleCount] = useState(50)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const {
    ahspItems,
    resources,
    zones,
    zonePricesByZone,
    loading,
    errors,
    addAHSPItem,
    updateAHSPItem,
    deleteAHSPItem,
    searchAHSPItems,
    filterByCategory,
    exportAHSPItems,
    importAHSPItems,
    fetchZones,
    fetchZonePrices
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

  // Reset visible items on search/filter change
  useEffect(() => {
    setVisibleCount(50)
  }, [searchQuery, selectedCategory, selectedZone])

  // Calculate summary
  const summary = useMemo(() => {
    const state = useAHSPStore.getState()
    return getAHSPSummary(state)
  }, [ahspItems, resources])

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(ahspItems.map(item => item.category)))
    return cats.sort()
  }, [ahspItems])

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

  const visibleRows = useMemo(() => {
    return groupedDisplayRows.slice(0, visibleCount)
  }, [groupedDisplayRows, visibleCount])

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

  // Handle Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const idsToDelete = Array.from(selectedIds)

    // In a real app, we might want a bulk delete confirmation
    if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
      idsToDelete.forEach(id => deleteAHSPItem(id))
      setSelectedIds(new Set())
      toast.success(`Deleted ${idsToDelete.length} items`)
    }
  }

  // Handle actions
  const handleAddItem = () => {
    setShowModeDialog(true)
  }

  const handleModeSelect = (mode: AHSPCreationMode) => {
    setSelectedMode(mode)
    setEditingItem(null)
    setShowModeDialog(false)
    setShowEditor(true)
    toast.info(`Creating AHSP in ${mode.toUpperCase()} mode`)
  }

  const handleEditItem = (item: AHSPItem) => {
    setEditingItem(item)
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
    toast.success('AHSP item deleted')
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
      console.error('Failed to export AHSP catalog:', error)
    }
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
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

        const itemsToImport = validItems.map(item => {
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

        // Clear localStorage for large imports to prevent quota exceeded
        if (itemsToImport.length > 1000) {
          try {
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
              if (key.includes('mlphoma:rab:') || key.includes('import-presets') || key.includes('sync-queue')) {
                try {
                  localStorage.removeItem(key)
                } catch (e) {
                  console.error(`Failed to remove ${key}:`, e)
                }
              }
            })
            toast.info(`Import besar (${itemsToImport.length} items) - membersihkan cache lama...`)
          } catch (e) {
            console.warn('Failed to clear old cache:', e)
          }
        }

        importAHSPItems(itemsToImport)
        toast.success(`Imported ${itemsToImport.length} AHSP items`)
      } catch (error) {
        console.error('Failed to import AHSP catalog:', error)
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
              <CardTitle className="text-sm font-medium">Average Price</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.averagePrice)}</div>
              <p className="text-xs text-muted-foreground">Per AHSP item</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Different categories</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="sticky-glass-panel flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search AHSP items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-[180px] border-blue-200 dark:border-blue-900">
                <SelectValue placeholder="Select Zone" />
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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport()} className="h-8 text-xs">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </Button>

            <Button size="sm" onClick={handleAddItem} className="h-8 text-xs">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {selectedZone !== 'default' && (
          <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center">
            <Calculator className="h-4 w-4 mr-2" />
            Showing prices for zone: <strong>{zones.find(z => z.id === selectedZone)?.name}</strong>.
            Edits will override base prices for this zone.
          </div>
        )}
      </div>

      {errors.ahspItems && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors.ahspItems}
        </div>
      )}

      {/* Main Table Content */}
      <div className="hidden rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900 md:block">
        <div className="max-h-[600px] overflow-auto relative">
          {loading.ahspItems ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No AHSP items found.</p>
              <Button variant="link" onClick={handleAddItem} className="mt-2 text-blue-600">Create new item</Button>
            </div>
          ) : (
            <TooltipProvider delayDuration={120}>
              <Table>
                <TableHeader className="sticky-glass-tablehead">
                  <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                    <TableHead className="w-12 text-center py-4">
                      <Checkbox
                        checked={selectedIds.size > 0 && selectedIds.size === displayItems.length}
                        onCheckedChange={handleToggleAll}
                        aria-label="Select all"
                        className="translate-y-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </TableHead>
                    <TableHead className="w-[56px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">No.</TableHead>
                    <TableHead className="min-w-[280px] font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Resource Description</TableHead>
                    <TableHead className="w-[70px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Unit</TableHead>
                    <TableHead className="w-[110px] text-right font-semibold text-blue-600 dark:text-blue-400 h-9 text-xs uppercase tracking-wider bg-blue-50/30">Material</TableHead>
                    <TableHead className="w-[110px] text-right font-semibold text-orange-600 dark:text-orange-400 h-9 text-xs uppercase tracking-wider bg-orange-50/30">Labor</TableHead>
                    <TableHead className="w-[110px] text-right font-semibold text-indigo-600 dark:text-indigo-400 h-9 text-xs uppercase tracking-wider bg-indigo-50/30">Equipment</TableHead>
                    <TableHead className="w-[110px] text-right font-semibold text-purple-600 dark:text-purple-400 h-9 text-xs uppercase tracking-wider bg-purple-50/30">Subcon</TableHead>
                    <TableHead className="w-[130px] text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Total Price</TableHead>
                    <TableHead className="w-[90px] text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => {
                    if (row.type === 'section') {
                      return (
                        <TableRow key={`section-${row.label}`} className="bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <TableCell colSpan={10} className="py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {row.label}
                          </TableCell>
                        </TableRow>
                      )
                    }

                    const item = row.item
                    const matPrice = (item as any).price_material || 0
                    const labPrice = (item as any).price_labor || 0
                    const eqpPrice = (item as any).price_equipment || 0
                    const subPrice = (item as any).price_subcon || 0

                    const breakSum = (matPrice + labPrice + eqpPrice + subPrice)
                    const isUnallocated = breakSum === 0 && (item.finalPrice || 0) > 0

                    const totalPrice = isUnallocated ? item.finalPrice : breakSum

                    const hasZoneOverride = selectedZone !== 'default' && (item as any).originalFinalPrice !== undefined

                    return (
                      <TableRow
                        key={item.id}
                        className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 ${selectedIds.has(item.id) ? 'bg-blue-50/50 hover:bg-blue-50/80 shadow-[inset_4px_0_0_0_#2563eb]' : ''}`}
                        onClick={() => handleEditItem(item)}
                      >
                        <TableCell className="w-12 text-center py-1.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(checked) => handleToggleOne(item.id, !!checked)}
                            aria-label={`Select ${item.name}`}
                            className="translate-y-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </TableCell>
                        <TableCell className="text-center font-mono text-[10px] text-slate-400 py-1.5">{row.rowNumber}</TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs text-slate-800 dark:text-slate-200">{item.name}</span>
                              {hasZoneOverride && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">Zone Adj</Badge>}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-[11px] text-slate-500 py-1.5">{item.unit}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 py-1.5 bg-blue-50/10">
                          {isUnallocated ? (
                            <span className="text-amber-600 font-bold" title="Components not linked. Price from master data.">
                              {formatIDR(item.finalPrice)} (!)
                            </span>
                          ) : (
                            matPrice > 0 ? formatIDR(matPrice) : '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 py-1.5 bg-orange-50/10">{!isUnallocated && labPrice > 0 ? formatIDR(labPrice) : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 py-1.5 bg-indigo-50/10">{!isUnallocated && eqpPrice > 0 ? formatIDR(eqpPrice) : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-600 py-1.5 bg-purple-50/10">{!isUnallocated && subPrice > 0 ? formatIDR(subPrice) : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200 py-1.5">{formatIDR(totalPrice)}</TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleHistoryClick(item)}><History className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditItem(item)}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteItem(item)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {visibleCount < groupedDisplayRows.length && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="py-4 text-center">
                        <Button variant="outline" size="sm" onClick={() => setVisibleCount(prev => prev + 100)}>
                          Load More ({groupedDisplayRows.length - visibleCount} items remaining)
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-800 ring-4 ring-slate-900/10 backdrop-blur-md">
              <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-bold tracking-tight">
                  <span className="text-blue-400 pr-1">{selectedIds.size}</span> Items Selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:text-white hover:bg-slate-800 gap-2 h-9 px-4 font-semibold text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>

                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-red-900/20"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected
                </Button>

                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-blue-900/20"
                  onClick={() => {
                    handleExport(displayItems.filter(i => selectedIds.has(i.id)))
                    toast.success('Exporting selected items...')
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading.ahspItems && displayItems.length > 0 && (
          <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6 items-center">
              <div className="md:col-span-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Material</div>
                <div className="font-mono text-xs font-bold text-blue-700">{formatIDR(totals.materialTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Labor</div>
                <div className="font-mono text-xs font-bold text-orange-700">{formatIDR(totals.laborTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Equipment</div>
                <div className="font-mono text-xs font-bold text-indigo-700">{formatIDR(totals.equipmentTotal)}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Subcon</div>
                <div className="font-mono text-xs font-bold text-purple-700">{formatIDR(totals.subconTotal)}</div>
              </div>
              {totals.unallocatedTotal > 0 && (
                <div className="md:col-span-1">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-red-400 mb-1">Unallocated</div>
                  <div className="font-mono text-xs font-bold text-red-600">{formatIDR(totals.unallocatedTotal)}</div>
                </div>
              )}
              <div className={totals.unallocatedTotal > 0 ? "md:col-span-1 text-right" : "md:col-span-2 text-right"}>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Grand Total Catalog</div>
                <div className="font-mono text-lg font-black text-slate-900 dark:text-white tabular-nums">
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
      />

      <AHSPItemEditor
        item={editingItem}
        open={showEditor}
        onClose={() => {
          setShowEditor(false)
          setSelectedMode(null)
        }}
        onSave={(data) => {
          if (editingItem) {
            updateAHSPItem(editingItem.id, data)
            return editingItem.id
          } else {
            return addAHSPItem(data)
          }
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the AHSP item
              "{pendingDeleteItem?.name}" and all its component mappings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 focus:ring-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
