
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

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code">AHSP Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                    placeholder="e.g., 6.3.2.7"
                    className={errors.code ? 'border-red-500' : ''}
                    disabled={isSubmitting}
                  />
                  {errors.code && (
                    <p className="text-sm text-red-500">{errors.code}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
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
                      <SelectItem value="hr">hr</SelectItem>
                      <SelectItem value="hari">hari</SelectItem>
                      <SelectItem value="unit">unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mainCategory">Main Category *</Label>
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
                      <SelectValue placeholder="Select main category" />
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
                    <Label htmlFor="subcategory">Subcategory</Label>
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
                        <SelectValue placeholder="Select subcategory (optional)" />
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

                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter AHSP item name"
                    className={errors.name ? 'border-red-500' : ''}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2 lg:col-span-3">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Enter optional description"
                    rows={2}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overhead">Overhead %</Label>
                  <Input
                    id="overhead"
                    type="number"
                    value={formData.overheadPercentage}
                    onChange={(e) => handleChange('overheadPercentage', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profit">Profit %</Label>
                  <Input
                    id="profit"
                    type="number"
                    value={formData.profitPercentage}
                    onChange={(e) => handleChange('profitPercentage', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Components */}
              <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Components - Analisa Komponen</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddManualComponent}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Manual Component
                  </Button>
                </div>
              </div>
              {errors.components && (
                <p className="text-sm text-red-500 mt-2">{errors.components}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {components.length === 0 && manualComponents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Calculator className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium">No components added yet</p>
                  <p className="text-sm">Click "Add Manual Component" to start building your AHSP analysis</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead className="min-w-[250px]">Resource Name</TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                        <TableHead className="w-32 text-right">Unit Price (Rp)</TableHead>
                        <TableHead className="w-32 text-right">Coefficient</TableHead>
                        <TableHead className="w-32 text-right">Subtotal (Rp)</TableHead>
                        <TableHead className="w-24 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Manual Components */}
                      {manualComponents.map((comp) => (
                        <TableRow key={comp.tempId} className="bg-blue-50/50 dark:bg-blue-950/20">
                          <TableCell>
                            {comp.editing ? (
                              <Select 
                                value={comp.type} 
                                onValueChange={(value: ResourceType) => handleUpdateManualComponent(comp.tempId, 'type', value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="material">Material</SelectItem>
                                  <SelectItem value="labor">Labor</SelectItem>
                                  <SelectItem value="equipment">Equipment</SelectItem>
                                  <SelectItem value="subcontractor">Subcon</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{comp.type}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {comp.editing ? (
                              <Input
                                value={comp.resourceName}
                                onChange={(e) => handleUpdateManualComponent(comp.tempId, 'resourceName', e.target.value)}
                                placeholder="Enter resource name"
                                className="h-9"
                              />
                            ) : (
                              <div className="font-medium">{comp.resourceName}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {comp.editing ? (
                              <Select 
                                value={comp.unit} 
                                onValueChange={(value: ResourceUnit) => handleUpdateManualComponent(comp.tempId, 'unit', value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="m3">m³</SelectItem>
                                  <SelectItem value="m2">m²</SelectItem>
                                  <SelectItem value="m">m</SelectItem>
                                  <SelectItem value="kg">kg</SelectItem>
                                  <SelectItem value="ltr">ltr</SelectItem>
                                  <SelectItem value="bh">bh</SelectItem>
                                  <SelectItem value="oh">OH</SelectItem>
                                  <SelectItem value="jam">jam</SelectItem>
                                  <SelectItem value="hari">hari</SelectItem>
                                  <SelectItem value="unit">unit</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="uppercase text-sm">{comp.unit}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.editing ? (
                              <Input
                                type="number"
                                value={comp.unitPrice}
                                onChange={(e) => handleUpdateManualComponent(comp.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="h-9 text-right"
                                step="0.01"
                                min="0"
                              />
                            ) : (
                              <span className="font-mono text-sm">{formatIDR(comp.unitPrice)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.editing ? (
                              <Input
                                type="number"
                                value={comp.coefficient}
                                onChange={(e) => handleUpdateManualComponent(comp.tempId, 'coefficient', parseFloat(e.target.value) || 0)}
                                className="h-9 text-right"
                                step="0.001"
                                min="0"
                              />
                            ) : (
                              <span className="font-mono text-sm">{comp.coefficient.toFixed(3)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-semibold">
                              {formatIDR(comp.coefficient * comp.unitPrice)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              {comp.editing ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveManualComponent(comp.tempId)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateManualComponent(comp.tempId, 'editing', true)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteManualComponent(comp.tempId)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Existing Components from Resources */}
                      {components.map((component) => (
                        <TableRow key={component.id}>
                          <TableCell>
                            <Badge variant="outline">{component.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{component.resource?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                From DKH Resources
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="uppercase text-sm">
                            {component.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatIDR(component.unitPrice)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={component.coefficient}
                              onChange={(e) => handleUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                              step="0.001"
                              min="0"
                              className="w-28 text-right h-9"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {formatIDR(component.subtotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteComponent(component.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Cost Summary */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Cost Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Material:</span>
                      <span className="font-mono">{formatIDR(totals.material)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labor:</span>
                      <span className="font-mono">{formatIDR(totals.labor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equipment:</span>
                      <span className="font-mono">{formatIDR(totals.equipment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subcontractor:</span>
                      <span className="font-mono">{formatIDR(totals.subcontractor)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Base Price:</span>
                      <span className="font-mono">{formatIDR(totals.base)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Final Price</h4>
                  <div className="space-y-1 text-sm">
                    {formData.overheadPercentage > 0 && (
                      <div className="flex justify-between">
                        <span>Overhead ({formData.overheadPercentage}%):</span>
                        <span className="font-mono">
                          {formatIDR(totals.base * formData.overheadPercentage / 100)}
                        </span>
                      </div>
                    )}
                    {formData.profitPercentage > 0 && (
                      <div className="flex justify-between">
                        <span>Profit ({formData.profitPercentage}%):</span>
                        <span className="font-mono">
                          {formatIDR((totals.base * (1 + formData.overheadPercentage / 100)) * formData.profitPercentage / 100)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t text-lg">
                      <span>Final Price:</span>
                      <span className="font-mono">{formatIDR(totals.final)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

              {/* Resource Selector - Add Components from DKH */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Add Component from DKH Resources
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select resources from your master price list (DKH) to add to this AHSP analysis
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedComponentType} onValueChange={(value: ResourceType) => setSelectedComponentType(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>

                {item && (
                  <Select onValueChange={handleAddComponent}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select resource from DKH..." />
                    </SelectTrigger>
                    <SelectContent>
                      {resourcesByType[selectedComponentType].length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No {selectedComponentType} resources in DKH
                        </div>
                      ) : (
                        resourcesByType[selectedComponentType].map(resource => (
                          <SelectItem key={resource.id} value={resource.id}>
                            {resource.name} - {formatIDR(resource.unitPrice)} per {resource.unit}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.submit}
            </div>
          )}
            </div>
          </div>

          {/* Actions - Sticky Footer */}
          <div className="sticky bottom-0 bg-white border-t px-6 py-4">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !item}
                className="min-w-[100px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    {item ? 'Update' : 'Add'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AHSPItemEditor
