
/**
 * AHSPCatalog.tsx
 * Main AHSP catalog component with search, filter, and management
 */

import React, { useState, useMemo } from 'react'
import { Search, Filter, Plus, Edit2, Trash2, Calculator, Download, Upload } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useAHSPStore, getAHSPSummary, validateAHSP } from '../../store/ahspStore'
import { AHSPItemEditor } from './AHSPItemEditor'
import { formatIDR } from '../../lib/utils'
import type { AHSPItem } from '../../types/ahsp'

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
  const [showEditor, setShowEditor] = useState(false)
  const [editingItem, setEditingItem] = useState<AHSPItem | null>(null)
  
  const {
    ahspItems,
    resources,
    loading,
    errors,
    addAHSPItem,
    updateAHSPItem,
    deleteAHSPItem,
    searchAHSPItems,
    filterByCategory,
    exportAHSPItems,
  } = useAHSPStore()

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

  // Handle actions
  const handleAddItem = () => {
    setEditingItem(null)
    setShowEditor(true)
  }

  const handleEditItem = (item: AHSPItem) => {
    setEditingItem(item)
    setShowEditor(true)
  }

  const handleDeleteItem = (item: AHSPItem) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      deleteAHSPItem(item.id)
    }
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
          alert('Some items were skipped due to missing required fields')
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
        alert('Failed to import AHSP catalog. Please check the file format.')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-4">
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search AHSP items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
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
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" size="sm" asChild>
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

          <Button size="sm" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Error messages */}
      {errors.ahspItems && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors.ahspItems}
        </div>
      )}

      {/* AHSP Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>AHSP Catalog ({filteredItems.length} items)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading.ahspItems ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No AHSP items found. Create your first item to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Base Price</TableHead>
                  <TableHead className="text-right">Final Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow 
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEditItem(item)}
                  >
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="uppercase">{item.unit}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatIDR(item.basePrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatIDR(item.finalPrice)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}

export default AHSPCatalog
