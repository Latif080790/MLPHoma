
/**
 * AHSPCatalog.tsx
 * Main AHSP catalog component with search, filter, and management
 */

import React, { useState, useMemo, useEffect } from 'react'
import { Search, Filter, Plus, Edit2, Trash2, Calculator, Download, Upload, History, Info } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
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

  const [editingItem, setEditingItem] = useState<AHSPItem | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<AHSPItem | null>(null)

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
    let items = ahspItems

    // Filter by active status
    if (!showInactive) {
      items = items.filter(item => item.isActive)
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      items = filterByCategory(selectedCategory)
    }

    // Search
    if (searchQuery) {
      items = searchAHSPItems(searchQuery)
    }

    return items
  }, [ahspItems, showInactive, selectedCategory, searchQuery, filterByCategory, searchAHSPItems])

  // Apply Zone Overrides
  const displayItems = useMemo(() => {
    if (selectedZone === 'default') return filteredItems

    const zonePrices = zonePricesByZone[selectedZone] || []
    const priceMap = new Map(zonePrices.map(p => [p.ahspId, p]))

    return filteredItems.map(item => {
      const override = priceMap.get(item.id)
      if (override) {
        return {
          ...item,
          basePrice: (override.price_material + override.price_labor + override.price_equipment + override.price_subcon),
          finalPrice: override.finalPrice,
          originalFinalPrice: item.finalPrice // Flag to show difference
        }
      }
      return item
    })
  }, [filteredItems, selectedZone, zonePricesByZone])

  const groupedDisplayRows = useMemo(() => {
    const groups = new Map<string, AHSPItem[]>()
    displayItems.forEach((item) => {
      const cat = item.category || 'Uncategorized'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(item)
    })

    const categoriesSorted = Array.from(groups.keys()).sort()
    const rows: Array<{ type: 'section'; label: string } | { type: 'item'; item: AHSPItem; rowNumber: number }> = []
    let rowNumber = 1

    categoriesSorted.forEach((category, idx) => {
      const prefix = String.fromCharCode(65 + (idx % 26))
      rows.push({ type: 'section', label: `${prefix}. ${category.toUpperCase()}` })
      groups.get(category)!.forEach((item) => {
        rows.push({ type: 'item', item, rowNumber })
        rowNumber += 1
      })
    })

    return rows
  }, [displayItems])

  const totals = useMemo(() => {
    let supplyTotal = 0
    let installTotal = 0
    let grandTotal = 0

    displayItems.forEach((item) => {
      const coefficient = (item as any).coefficient || 1
      const supplyUnit = (item as any).price_material || 0
      const installUnit = ((item as any).price_labor || 0) + ((item as any).price_equipment || 0) + ((item as any).price_subcon || 0)
      const itemSupply = supplyUnit * coefficient
      const itemInstall = installUnit * coefficient
      const itemTotal = itemSupply + itemInstall > 0 ? itemSupply + itemInstall : item.finalPrice * coefficient

      supplyTotal += itemSupply
      installTotal += itemInstall
      grandTotal += itemTotal
    })

    return { supplyTotal, installTotal, grandTotal }
  }, [displayItems])

  // Handle actions
  const handleAddItem = () => {
    setEditingItem(null)
    setShowEditor(true)
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

  const handleExport = () => {
    try {
      const data = exportAHSPItems()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ahsp-catalog-${new Date().toISOString().split('T')[0]}.json`
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

        // Add validation for required fields
        const validItems = data.filter(item =>
          item.code && item.name && item.unit && item.category
        )

        if (validItems.length !== data.length) {
          toast.warning('Some items were skipped due to missing required fields')
        }

        validItems.forEach(item => {
          const basePrice = item.basePrice || 0
          const overhead = item.overheadPercentage || 0
          const profit = item.profitPercentage || 0
          const finalPrice = basePrice * (1 + overhead / 100 + profit / 100)
          addAHSPItem({
            code: item.code,
            name: item.name,
            unit: item.unit,
            category: item.category,
            description: item.description,
            basePrice,
            overheadPercentage: overhead,
            profitPercentage: profit,
            finalPrice,
            isActive: item.isActive !== false,
          })
        })
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
              <p className="text-xs text-muted-foreground">
                Across all types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Price</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.averagePrice)}</div>
              <p className="text-xs text-muted-foreground">
                Per AHSP item
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">
                Different categories
              </p>
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


          {/* Zone Selector */}
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
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs">
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
      </div>

      {/* Zone Indicator */}
      {
        selectedZone !== 'default' && (
          <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center">
            <Calculator className="h-4 w-4 mr-2" />
            Showing prices for zone: <strong>{zones.find(z => z.id === selectedZone)?.name}</strong>.
            Edits will override base prices for this zone.
          </div>
        )
      }

      {/* Error messages */}
      {
        errors.ahspItems && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errors.ahspItems}
          </div>
        )
      }

      {/* AHSP Items Table */}
      <div className="space-y-2 md:hidden">
        {loading.ahspItems ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground rounded-lg border border-slate-200 dark:border-slate-800">
            <p className="text-sm">No AHSP items found.</p>
            <Button variant="link" onClick={handleAddItem} className="mt-2 text-blue-600">Create new item</Button>
          </div>
        ) : (
          displayItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900" onClick={() => handleEditItem(item)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.code}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</div>
                  {item.description && <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{item.description}</div>}
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Category:</span> <span className="font-medium">{item.category}</span></div>
                <div><span className="text-slate-500">Unit:</span> <span className="font-medium">{item.unit}</span></div>
                <div><span className="text-slate-500">Base:</span> <span className="font-mono">{formatIDR(item.basePrice)}</span></div>
                <div><span className="text-slate-500">Final:</span> <span className="font-mono font-semibold">{formatIDR(item.finalPrice)}</span></div>
              </div>
              <div className="mt-2 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleHistoryClick(item)} title="Price History">
                  <History className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDeleteItem(item)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`hidden rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900 md:block ${compact ? 'border-0 shadow-none' : ''}`}>
        <div className="max-h-[600px] overflow-auto relative">
          {loading.ahspItems ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No AHSP items found.</p>
              <Button variant="link" onClick={handleAddItem} className="mt-2 text-blue-600">Create new item</Button>
            </div>
          ) : (
            <TooltipProvider delayDuration={120}>
            <Table>
              <TableHeader className="sticky-glass-tablehead">
                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                  <TableHead className="w-[56px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">No.</TableHead>
                  <TableHead className="min-w-[280px] font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Resource Description</TableHead>
                  <TableHead className="w-[70px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Unit</TableHead>
                  <TableHead className="w-[90px] text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Coeff.</TableHead>
                  <TableHead className="text-center bg-blue-50/60 dark:bg-blue-900/20 border-l border-blue-100 dark:border-blue-900/30 font-semibold text-blue-700 dark:text-blue-300 h-9 text-xs uppercase tracking-wider" colSpan={2}>Supply (Material)</TableHead>
                  <TableHead className="text-center bg-orange-50/60 dark:bg-orange-900/20 border-l border-orange-100 dark:border-orange-900/30 font-semibold text-orange-700 dark:text-orange-300 h-9 text-xs uppercase tracking-wider" colSpan={2}>Install (Labor/Tool)</TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Total Price</TableHead>
                  <TableHead className="w-[90px] text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead className="text-right bg-blue-50/40 dark:bg-blue-900/10 border-l border-blue-100 dark:border-blue-900/30">Unit Price</TableHead>
                  <TableHead className="text-right bg-blue-50/40 dark:bg-blue-900/10">Total</TableHead>
                  <TableHead className="text-right bg-orange-50/40 dark:bg-orange-900/10 border-l border-orange-100 dark:border-orange-900/30">Unit Price</TableHead>
                  <TableHead className="text-right bg-orange-50/40 dark:bg-orange-900/10">Total</TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedDisplayRows.map((row) => {
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
                  const coefficient = (item as any).coefficient || 1
                  const supplyUnit = (item as any).price_material || 0
                  const installUnit = ((item as any).price_labor || 0) + ((item as any).price_equipment || 0) + ((item as any).price_subcon || 0)
                  const supplyTotal = supplyUnit * coefficient
                  const installTotal = installUnit * coefficient
                  const totalPrice = supplyTotal + installTotal > 0 ? supplyTotal + installTotal : item.finalPrice * coefficient
                  const hasZoneOverride = selectedZone !== 'default' && (item as any).originalFinalPrice !== undefined
                  const coefficientNote = `Coefficient ${coefficient.toFixed(3)} multiplies unit rates for quantity-based pricing.`

                  return (
                    <TableRow
                      key={item.id}
                      className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                      onClick={() => handleEditItem(item)}
                    >
                      <TableCell className="text-center font-mono text-[10px] text-slate-400 py-1.5">{row.rowNumber}</TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs text-slate-800 dark:text-slate-200">{item.name}</span>
                            {hasZoneOverride && (
                              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">Zone Adj</Badge>
                            )}
                            {!item.isActive && (
                              <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">Inactive</Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                          {item.description && (
                            <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-[11px] text-slate-500 py-1.5 font-medium">{item.unit}</TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center justify-end gap-1 text-xs text-slate-600">
                          <span className="font-mono">{coefficient.toFixed(3)}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                                onClick={(event) => event.stopPropagation()}
                                aria-label="Coefficient details"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-[11px] leading-snug">
                              {coefficientNote}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600 py-1.5 bg-blue-50/20 dark:bg-blue-900/5 border-l border-slate-100 dark:border-slate-800">{supplyUnit > 0 ? formatIDR(supplyUnit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-blue-700 dark:text-blue-400 py-1.5 bg-blue-50/20 dark:bg-blue-900/5">{supplyUnit > 0 ? formatIDR(supplyTotal) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600 py-1.5 bg-orange-50/20 dark:bg-orange-900/5 border-l border-slate-100 dark:border-slate-800">{installUnit > 0 ? formatIDR(installUnit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-orange-700 dark:text-orange-400 py-1.5 bg-orange-50/20 dark:bg-orange-900/5">{installUnit > 0 ? formatIDR(installTotal) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200 py-1.5">{formatIDR(totalPrice)}</TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => handleHistoryClick(item)}
                            title="Price History"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteItem(item)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </TooltipProvider>
          )}
        </div>
        {!loading.ahspItems && displayItems.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="grid grid-cols-1 gap-2 text-right md:grid-cols-3 md:gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Supply Total</div>
                <div className="font-mono text-sm font-bold text-blue-700 dark:text-blue-400">{formatIDR(totals.supplyTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Install Total</div>
                <div className="font-mono text-sm font-bold text-orange-700 dark:text-orange-400">{formatIDR(totals.installTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Grand Total</div>
                <div className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">{formatIDR(totals.grandTotal)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AHSP Item Editor */}
      <AHSPItemEditor
        item={editingItem}
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={(data) => {
          if (editingItem) {
            updateAHSPItem(editingItem.id, data)
            return editingItem.id
          } else {
            const newId = addAHSPItem(data)
            return newId
          }
        }}
      />

      {/* Zone Price Editor */}
      <ZonePriceEditor
        item={editingItem}
        zoneId={selectedZone}
        currentPrice={
          selectedZone !== 'default' && editingItem
            ? zonePricesByZone[selectedZone]?.find(p => p.ahspId === editingItem.id)
            : undefined
        }
        open={showZoneEditor}
        onClose={() => setShowZoneEditor(false)}
      />
      <PriceHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        ahspId={editingItem?.id || ''}
        zoneId={selectedZone === 'default' ? undefined : selectedZone}
        itemName={editingItem?.name || ''}
      />

      <AlertDialog open={!!pendingDeleteItem} onOpenChange={(open) => { if (!open) setPendingDeleteItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AHSP item?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteItem ? `"${pendingDeleteItem.name}" will be removed from the AHSP catalog.` : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  )
}

export default AHSPCatalog
