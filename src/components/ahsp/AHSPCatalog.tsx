
/**
 * AHSPCatalog.tsx
 * Main AHSP catalog component with search, filter, and management
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
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
import { useAHSPStore, getAHSPSummary } from '../../store/ahspStore'
import { useRabStore } from '@/store/rabStore'
import { AHSPItemEditor } from './AHSPItemEditor'
import { ZonePriceEditor } from './ZonePriceEditor'
import { PriceHistoryDialog } from './PriceHistoryDialog'
import { AHSPCreationModeDialog, type AHSPCreationMode } from './AHSPCreationModeDialog'
import { ahspDataService } from '../../services/ahspService'
import { exportAHSPToXLSX } from '../../lib/ahspExport'
import type { AHSPItem } from '../../types/ahsp'
import { toast } from 'sonner'
import { AHSPCatalogSummaryCards } from './AHSPCatalogSummaryCards'
import { AHSPCatalogFilters } from './AHSPCatalogFilters'
import { AHSPCatalogTable } from './AHSPCatalogTable'

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
  // Debounced copy used for the (2475-item) filter so typing stays responsive.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200)
    return () => clearTimeout(t)
  }, [searchQuery])
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
    const query = debouncedQuery.toLowerCase()
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
  }, [ahspItems, showInactive, selectedCategory, debouncedQuery])

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

    // Spreadsheet-style section labels (A..Z, AA, AB, …) so they never repeat — the
    // catalog has 37 categories, so a plain A–Z (mod 26) would duplicate letters.
    const colLabel = (n: number) => {
      let s = ''
      let x = n + 1
      while (x > 0) { x--; s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26) }
      return s
    }

    for (let i = 0; i < categoriesSorted.length; i++) {
      const category = categoriesSorted[i]
      const items = groups[category]
      const prefix = colLabel(i)

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
        <AHSPCatalogSummaryCards
          totalAHSPItems={summary.totalAHSPItems}
          activeAHSPItems={ahspItems.filter(item => item.isActive).length}
          totalResources={summary.totalResources}
          averagePrice={summary.averagePrice}
          categoryCount={categories.length}
        />
      )}

      {/* Filter + Action Toolbar */}
      <AHSPCatalogFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
        selectedZone={selectedZone}
        onZoneChange={setSelectedZone}
        zones={zones}
        onExport={() => handleExport()}
        onExportXLSX={() => {
          try {
            exportAHSPToXLSX(filteredItems, resources, componentsByAHSP)
          } catch (err) {
            toast.error('Export Gagal', { description: (err as Error).message })
          }
        }}
        exportXLSXDisabled={loading.ahspItems || ahspItems.length === 0}
        onImport={handleImport}
        onAddItem={handleAddItem}
        onExportSelected={() => handleExport(selectedIds.size > 0 ? displayItems.filter((i: AHSPItem) => selectedIds.has(i.id)) : undefined)}
        exportSelectedDisabled={ahspItems.length === 0}
        onResetClick={() => setShowResetConfirm(true)}
        resetDisabled={ahspItems.length === 0 && resources.length === 0}
        activeZoneName={zones.find(z => z.id === selectedZone)?.name}
      />

      {errors.ahspItems && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors.ahspItems}
        </div>
      )}

      {/* Main Table Content */}
      <AHSPCatalogTable
        loading={loading.ahspItems}
        displayItems={displayItems}
        groupedDisplayRows={groupedDisplayRows}
        parentRef={parentRef}
        hasZoneOverride={selectedZone !== 'default'}
        ahspUsageMap={ahspUsageMap}
        showBidPrice={showBidPrice}
        bidMarginPct={bidMarginPct}
        compact={compact}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        totals={totals}
        onEditItem={handleEditItem}
        onHistoryClick={handleHistoryClick}
        onDeleteItem={handleDeleteItem}
        onAddItem={handleAddItem}
        onBulkDelete={handleBulkDelete}
        onExport={handleExport}
      />

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
