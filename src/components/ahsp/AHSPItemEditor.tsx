
/**
 * AHSPItemEditor.tsx
 * Editor for creating and editing AHSP items with component management
 */

import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Calculator, Edit2, Check, Database } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { useAHSPStore } from '../../store/ahspStore'
import { formatIDR } from '../../lib/utils'
import { toast } from 'sonner'
import type { AHSPItem, AHSPComponent, ResourceType, ResourceUnit } from '../../types/ahsp'
import { getMainCategories, getSubcategories, getCategoryPath } from '../../lib/workCategories'

/** Props for AHSPItemEditor component */
export interface AHSPItemEditorProps {
  /** Current item being edited (null for new item) */
  item?: AHSPItem | null
  /** Whether dialog is open */
  open: boolean
  /** Dialog close handler */
  onClose: () => void
  /** Save handler - returns the saved item ID for new items */
  onSave: (item: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>) => string | Promise<string>
}

/**
 * AHSPItemEditor Component
 */
export function AHSPItemEditor({
  item,
  open,
  onClose,
  onSave,
}: AHSPItemEditorProps) {
  const [formData, setFormData] = useState<{
    code: string
    name: string
    description: string
    unit: ResourceUnit
    category: string
    overheadPercentage: number
    profitPercentage: number
    isActive: boolean
  }>({
    code: '',
    name: '',
    description: '',
    unit: 'm3',
    category: '',
    overheadPercentage: 0,
    profitPercentage: 0,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedComponentType, setSelectedComponentType] = useState<ResourceType>('material')
  const [manualComponents, setManualComponents] = useState<Array<{
    tempId: string
    type: ResourceType
    resourceName: string
    unit: ResourceUnit
    coefficient: number
    unitPrice: number
    editing: boolean
  }>>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')

  const mainCategories = getMainCategories()

  const {
    resources,
    componentsByAHSP,
    addComponent,
    updateComponent,
    deleteComponent,
    calculateAHSPPrice,
    addResource,
  } = useAHSPStore()

  const currentAHSPId = item?.id || 'temp'
  const components = componentsByAHSP[currentAHSPId] || []

  // Load resources when dialog opens
  React.useEffect(() => {
    if (open && resources.length === 0) {
      // Resources will be loaded automatically by store initialization
      console.log('Dialog opened, resources available:', resources.length)
    }
  }, [open, resources.length])

  // Calculate totals including manual components
  const totals = React.useMemo(() => {
    const materialTotal = components
      .filter(c => c.type === 'material')
      .reduce((sum, c) => sum + c.subtotal, 0) +
      manualComponents
        .filter(c => c.type === 'material' && !c.editing)
        .reduce((sum, c) => sum + (c.coefficient * c.unitPrice), 0)

    const laborTotal = components
      .filter(c => c.type === 'labor')
      .reduce((sum, c) => sum + c.subtotal, 0) +
      manualComponents
        .filter(c => c.type === 'labor' && !c.editing)
        .reduce((sum, c) => sum + (c.coefficient * c.unitPrice), 0)

    const equipmentTotal = components
      .filter(c => c.type === 'equipment')
      .reduce((sum, c) => sum + c.subtotal, 0) +
      manualComponents
        .filter(c => c.type === 'equipment' && !c.editing)
        .reduce((sum, c) => sum + (c.coefficient * c.unitPrice), 0)

    const subcontractorTotal = components
      .filter(c => c.type === 'subcontractor')
      .reduce((sum, c) => sum + c.subtotal, 0) +
      manualComponents
        .filter(c => c.type === 'subcontractor' && !c.editing)
        .reduce((sum, c) => sum + (c.coefficient * c.unitPrice), 0)

    const basePrice = materialTotal + laborTotal + equipmentTotal + subcontractorTotal

    let finalPrice = basePrice
    if (formData.overheadPercentage > 0) {
      finalPrice *= (1 + formData.overheadPercentage / 100)
    }
    if (formData.profitPercentage > 0) {
      finalPrice *= (1 + formData.profitPercentage / 100)
    }

    return {
      material: materialTotal,
      labor: laborTotal,
      equipment: equipmentTotal,
      subcontractor: subcontractorTotal,
      base: basePrice,
      final: finalPrice,
    }
  }, [components, manualComponents, formData.overheadPercentage, formData.profitPercentage])

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        unit: item.unit as ResourceUnit,
        category: item.category || '',
        overheadPercentage: item.overheadPercentage || 0,
        profitPercentage: item.profitPercentage || 0,
        isActive: item.isActive !== false,
      })
    } else {
      // New item
      setFormData({
        code: '',
        name: '',
        description: '',
        unit: 'm3',
        category: '',
        overheadPercentage: 0,
        profitPercentage: 0,
        isActive: true,
      })
    }
    setErrors({})
  }, [item])

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.code) newErrors.code = 'Code is required'
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.category) newErrors.category = 'Category is required'

    // Component validation
    const totalComponents = components.length + manualComponents.filter(c => !c.editing).length
    if (totalComponents === 0) {
      newErrors.components = 'At least one component is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Save AHSP item first
      const savedId = await onSave({
        ...formData,
        basePrice: totals.base,
        finalPrice: totals.final,
      })

      // Save manual components (both for new and existing items)
      const ahspId = savedId || item?.id
      if (ahspId) {
        // Add manual components as resources first, then as components
        for (const manualComp of manualComponents.filter(c => !c.editing)) {
          // Create temporary resource for manual component
          const tempResourceCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          addResource({
            code: tempResourceCode,
            name: manualComp.resourceName,
            type: manualComp.type,
            unit: manualComp.unit,
            unitPrice: manualComp.unitPrice,
            specifications: 'Manual entry from AHSP',
            isActive: true,
          })

          // Find the resource we just added by code
          const tempResource = resources.find(r => r.code === tempResourceCode)

          // Add as component to AHSP
          if (tempResource) {
            addComponent(ahspId, {
              type: manualComp.type,
              resourceId: tempResource.id,
              coefficient: manualComp.coefficient,
              unit: manualComp.unit,
              unitPrice: manualComp.unitPrice,
              subtotal: manualComp.coefficient * manualComp.unitPrice,
            })
          }
        }
      }

      toast.success('AHSP item saved successfully')
      onClose()
    } catch (error) {
      console.error('Failed to save AHSP item:', error)
      setErrors({ submit: 'Failed to save item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle input changes
   */
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  /**
   * Handle adding manual component
   */
  const handleAddManualComponent = () => {
    setManualComponents(prev => [...prev, {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      type: 'material',
      resourceName: '',
      unit: 'm3',
      coefficient: 1,
      unitPrice: 0,
      editing: true,
    }])
  }

  /**
   * Handle updating manual component
   */
  const handleUpdateManualComponent = (tempId: string, field: string, value: any) => {
    setManualComponents(prev =>
      prev.map(c => c.tempId === tempId ? { ...c, [field]: value } : c)
    )
  }

  /**
   * Handle saving manual component
   */
  const handleSaveManualComponent = (tempId: string) => {
    const component = manualComponents.find(c => c.tempId === tempId)
    if (!component || !component.resourceName) {
      toast.error('Resource name is required')
      return
    }

    setManualComponents(prev =>
      prev.map(c => c.tempId === tempId ? { ...c, editing: false } : c)
    )
    toast.success('Component added')
  }

  /**
   * Handle deleting manual component
   */
  const handleDeleteManualComponent = (tempId: string) => {
    setManualComponents(prev => prev.filter(c => c.tempId !== tempId))
  }

  /**
   * Handle adding component
   */
  const handleAddComponent = (resourceId: string) => {
    const resource = resources.find(r => r.id === resourceId)
    if (!resource || !item) return

    addComponent(item.id, {
      type: resource.type,
      resourceId: resource.id,
      coefficient: 1,
      unit: resource.unit,
      unitPrice: resource.unitPrice,
      subtotal: resource.unitPrice,
    })
  }

  /**
   * Handle updating component
   */
  const handleUpdateComponent = (componentId: string, field: string, value: any) => {
    updateComponent(componentId, { [field]: value })
  }

  /**
   * Handle deleting component
   */
  const handleDeleteComponent = (componentId: string) => {
    if (window.confirm('Are you sure you want to remove this component?')) {
      deleteComponent(componentId)
    }
  }

  // Filter resources by type
  const resourcesByType = React.useMemo(() => {
    const grouped: Record<ResourceType, typeof resources> = {
      material: [],
      labor: [],
      equipment: [],
      subcontractor: [],
    }

    resources.forEach(resource => {
      if (resource.isActive) {
        grouped[resource.type].push(resource)
      }
    })

    return grouped
  }, [resources])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] max-h-[98vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl">
            {item ? 'Edit AHSP Item' : 'Add New AHSP Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <Tabs defaultValue="master" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/30 shrink-0 rounded-none border-b">
              <TabsTrigger value="master" className="data-[state=active]:bg-background">Master Data</TabsTrigger>
              <TabsTrigger value="components" className="data-[state=active]:bg-background">Analisa Komponen</TabsTrigger>
              <TabsTrigger value="summary" className="data-[state=active]:bg-background">Cost Summary</TabsTrigger>
            </TabsList>

            {/* Tab 1: Master Data */}
            <TabsContent value="master" className="flex-1 overflow-y-auto p-6 space-y-6 m-0">
              {/* Basic Information */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-semibold">AHSP Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                    placeholder="e.g., 6.3.2.7"
                    className={errors.code ? 'border-red-500 shadow-sm' : 'shadow-sm'}
                    disabled={isSubmitting}
                  />
                  {errors.code && (
                    <p className="text-xs text-red-500 font-medium">{errors.code}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm font-semibold">Unit Satuan *</Label>
                  <Select value={formData.unit} onValueChange={(value: any) => handleChange('unit', value)}>
                    <SelectTrigger className={errors.unit ? 'border-red-500' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m3">m³</SelectItem>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="m">m (meter)</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ltr">liter</SelectItem>
                      <SelectItem value="bh">buah</SelectItem>
                      <SelectItem value="oh">OH (orang-hari)</SelectItem>
                      <SelectItem value="jam">jam</SelectItem>
                      <SelectItem value="unit">unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mainCategory" className="text-sm font-semibold">Main Category *</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value)
                      setSelectedSubcategory('')
                      const category = mainCategories.find(c => c.id === value)
                      if (category) {
                        handleChange('category', category.name)
                      }
                    }}
                  >
                    <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {mainCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.code} - {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory && getSubcategories(selectedCategory).length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory" className="text-sm font-semibold">Subcategory</Label>
                    <Select
                      value={selectedSubcategory}
                      onValueChange={(value) => {
                        setSelectedSubcategory(value)
                        const subcats = getSubcategories(selectedCategory)
                        const subcat = subcats.find(c => c.id === value)
                        if (subcat) {
                          const path = getCategoryPath(value)
                          handleChange('category', path.map(p => p.name).join(' > '))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSubcategories(selectedCategory).map(subcat => (
                          <SelectItem key={subcat.id} value={subcat.id}>
                            {subcat.code} - {subcat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Pekerjaan / Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Pasangan Dinding Bata Merah 1:4"
                  className={errors.name ? 'border-red-500 shadow-sm' : 'shadow-sm'}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 font-medium">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">Description / Spesifikasi Teknik</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Detail spesifikasi material atau cara pengerjaan..."
                  rows={3}
                  className="resize-none shadow-sm"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-6 bg-slate-50/50 p-4 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="overhead" className="text-sm font-semibold">Overhead (%)</Label>
                  <div className="relative">
                    <Input
                      id="overhead"
                      type="number"
                      value={formData.overheadPercentage}
                      onChange={(e) => handleChange('overheadPercentage', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.1"
                      className="pr-8 shadow-sm"
                      disabled={isSubmitting}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profit" className="text-sm font-semibold">Profit (%)</Label>
                  <div className="relative">
                    <Input
                      id="profit"
                      type="number"
                      value={formData.profitPercentage}
                      onChange={(e) => handleChange('profitPercentage', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.1"
                      className="pr-8 shadow-sm"
                      disabled={isSubmitting}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Components Analysis */}
            <TabsContent value="components" className="flex-1 overflow-y-auto p-6 m-0">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Analisa Komponen Pekerjaan</CardTitle>
                      <p className="text-sm text-muted-foreground">Daftar material, tenaga kerja, dan peralatan.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddManualComponent}
                      className="border-primary text-primary hover:bg-primary/5"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Komponen Manual
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pt-4">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-24">Tipe</TableHead>
                          <TableHead className="min-w-[200px]">Nama Komponen</TableHead>
                          <TableHead className="w-20 text-center">Satuan</TableHead>
                          <TableHead className="w-32 text-right">Harga Satuan</TableHead>
                          <TableHead className="w-24 text-center">Koefisien</TableHead>
                          <TableHead className="w-32 text-right">Subtotal</TableHead>
                          <TableHead className="w-12 text-center"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Manual Components */}
                        {manualComponents.map((comp) => (
                          <TableRow key={comp.tempId} className="group hover:bg-blue-50/30">
                            <TableCell>
                              <Badge variant="secondary" className="font-normal capitalize h-6">
                                {comp.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {comp.editing ? (
                                <Input
                                  value={comp.resourceName}
                                  onChange={(e) => handleUpdateManualComponent(comp.tempId, 'resourceName', e.target.value)}
                                  className="h-8 py-0"
                                />
                              ) : (
                                <div className="font-medium text-slate-700">{comp.resourceName}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-xs uppercase text-slate-500 font-medium">{comp.unit}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-600">
                              {formatIDR(comp.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={comp.coefficient}
                                onChange={(e) => handleUpdateManualComponent(comp.tempId, 'coefficient', parseFloat(e.target.value) || 0)}
                                className="h-8 py-0 text-right font-medium"
                              />
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-950 font-mono">
                              {formatIDR(comp.coefficient * comp.unitPrice)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteManualComponent(comp.tempId)}
                                className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Resource Components */}
                        {components.map((component) => (
                          <TableRow key={component.id} className="hover:bg-slate-50 group">
                            <TableCell>
                              <Badge variant="outline" className="font-normal capitalize h-6">
                                {component.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-700">{component.resource?.name}</div>
                            </TableCell>
                            <TableCell className="text-center text-xs uppercase text-slate-500 font-medium">
                              {component.unit}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-600">
                              {formatIDR(component.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={component.coefficient}
                                onChange={(e) => handleUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                                className="h-8 py-0 text-right font-bold text-slate-800"
                              />
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-950 font-mono">
                              {formatIDR(component.subtotal)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteComponent(component.id)}
                                className="h-7 w-7 text-red-300 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Add from DKH Selector in Tab 2 instead of separate card */}
                  <div className="mt-8 pt-8 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <Database className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold">Import dari DKH Resources</h4>
                    </div>
                    <div className="flex gap-2">
                      <Select value={selectedComponentType} onValueChange={(value: ResourceType) => setSelectedComponentType(value)}>
                        <SelectTrigger className="w-32 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="labor">Labor</SelectItem>
                          <SelectItem value="equipment">Alat</SelectItem>
                          <SelectItem value="subcontractor">Subcon</SelectItem>
                        </SelectContent>
                      </Select>

                      {item && (
                        <Select onValueChange={handleAddComponent}>
                          <SelectTrigger className="flex-1 h-9">
                            <SelectValue placeholder="Pilih resource dari master price list..." />
                          </SelectTrigger>
                          <SelectContent>
                            {resourcesByType[selectedComponentType].length === 0 ? (
                              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                Tidak ada data {selectedComponentType}
                              </div>
                            ) : (
                              resourcesByType[selectedComponentType].map(resource => (
                                <SelectItem key={resource.id} value={resource.id}>
                                  {resource.name} - {formatIDR(resource.unitPrice)} / {resource.unit}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Detailed Summary */}
            <TabsContent value="summary" className="flex-1 overflow-y-auto p-6 m-0">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-slate-50/50 border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Struktur Biaya Dasar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                          <span>Material (Bahan)</span>
                        </div>
                        <span className="font-mono font-semibold">{formatIDR(totals.material)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-400 mr-2" />
                          <span>Tenaga Kerja (Upah)</span>
                        </div>
                        <span className="font-mono font-semibold">{formatIDR(totals.labor)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2" />
                          <span>Peralatan (Alat)</span>
                        </div>
                        <span className="font-mono font-semibold">{formatIDR(totals.equipment)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-slate-400 mr-2" />
                          <span>Subkontraktor</span>
                        </div>
                        <span className="font-mono font-semibold">{formatIDR(totals.subcontractor)}</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t flex justify-between items-baseline font-bold text-slate-900 mt-2">
                      <span>Total Biaya Dasar</span>
                      <span className="text-xl font-mono">{formatIDR(totals.base)}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-base text-primary font-semibold flex items-center">
                        <Calculator className="h-4 w-4 mr-2" />
                        Harga Akhir Satuan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="pt-2 text-center pb-4">
                        <Label className="text-[10px] uppercase tracking-widest text-primary/70 font-black mb-1 block">
                          ESTIMASI AHSP AKHIR
                        </Label>
                        <div className="text-4xl font-black text-primary font-mono tabular-nums">
                          {formatIDR(totals.final)}
                        </div>
                        <span className="text-xs text-muted-foreground">per {formData.unit}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-primary/10 pt-4 text-sm font-medium">
                        <div className="flex justify-between">
                          <span className="opacity-60 font-normal">Overhead:</span>
                          <span>{formData.overheadPercentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-60 font-normal">Profit:</span>
                          <span>{formData.profitPercentage}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="shrink-0 px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <div className="flex gap-3">
              {errors.submit && (
                <p className="text-sm text-red-500 self-center font-medium mr-4">{errors.submit}</p>
              )}
              <Button type="submit" size="lg" className="px-10 shadow-md" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Database className="animate-spin h-4 w-4 mr-2" />
                    Menyimpan...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Simpan Perubahan
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog >
  )
}

export default AHSPItemEditor
