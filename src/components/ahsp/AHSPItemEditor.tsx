
/**
 * AHSPItemEditor.tsx
 * Editor for creating and editing AHSP items with component management
 */

import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Calculator } from 'lucide-react'
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
import type { AHSPItem, AHSPComponent, ResourceType } from '../../types/ahsp'

/** Props for AHSPItemEditor component */
export interface AHSPItemEditorProps {
  /** Current item being edited (null for new item) */
  item?: AHSPItem | null
  /** Whether dialog is open */
  open: boolean
  /** Dialog close handler */
  onClose: () => void
  /** Save handler */
  onSave: (item: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>) => void
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
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    unit: 'm3' as const,
    category: '',
    overheadPercentage: 0,
    profitPercentage: 0,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResourceSelector, setShowResourceSelector] = useState(false)
  const [selectedComponentType, setSelectedComponentType] = useState<ResourceType>('material')

  const {
    resources,
    componentsByAHSP,
    addComponent,
    updateComponent,
    deleteComponent,
    calculateAHSPPrice,
  } = useAHSPStore()

  const currentAHSPId = item?.id || 'temp'
  const components = componentsByAHSP[currentAHSPId] || []

  // Calculate totals
  const totals = React.useMemo(() => {
    const materialTotal = components
      .filter(c => c.type === 'material')
      .reduce((sum, c) => sum + c.subtotal, 0)
    
    const laborTotal = components
      .filter(c => c.type === 'labor')
      .reduce((sum, c) => sum + c.subtotal, 0)
    
    const equipmentTotal = components
      .filter(c => c.type === 'equipment')
      .reduce((sum, c) => sum + c.subtotal, 0)
    
    const subcontractorTotal = components
      .filter(c => c.type === 'subcontractor')
      .reduce((sum, c) => sum + c.subtotal, 0)

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
  }, [components, formData.overheadPercentage, formData.profitPercentage])

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        unit: item.unit,
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

    // Required fields
    if (!formData.code.trim()) {
      newErrors.code = 'Code is required'
    } else if (!/^[0-9\.]+$/.test(formData.code)) {
      newErrors.code = 'Code must contain only numbers and dots'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name must be less than 200 characters'
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required'
    }

    // Component validation
    if (components.length === 0) {
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
      await onSave({
        ...formData,
        basePrice: totals.base,
        finalPrice: totals.final,
      })
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
   * Handle adding component
   */
  const handleAddComponent = (resourceId: string) => {
    const resource = resources.find(r => r.id === resourceId)
    if (!resource || !item) return

    addComponent(item.id, {
      type: resource.type,
      resourceId: resource.id,
      coefficient: 1,
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit AHSP Item' : 'Add New AHSP Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
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
                  <SelectItem value="m">m</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ltr">ltr</SelectItem>
                  <SelectItem value="bh">bh</SelectItem>
                  <SelectItem value="oh">OH</SelectItem>
                  <SelectItem value="jam">jam</SelectItem>
                  <SelectItem value="hr">hr</SelectItem>
                  <SelectItem value="hari">hari</SelectItem>
                  <SelectItem value="unit">unit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
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

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="e.g., Pekerjaan Beton"
                className={errors.category ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category}</p>
              )}
            </div>

            <div className="space-y-2">
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
          </div>

          {/* Pricing */}
          <div className="grid gap-4 md:grid-cols-2">
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
                <CardTitle>Components</CardTitle>
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
                      <SelectTrigger className="w-60">
                        <SelectValue placeholder="Add resource..." />
                      </SelectTrigger>
                      <SelectContent>
                        {resourcesByType[selectedComponentType].map(resource => (
                          <SelectItem key={resource.id} value={resource.id}>
                            {resource.name} ({formatIDR(resource.unitPrice)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {errors.components && (
                <p className="text-sm text-red-500 mb-4">{errors.components}</p>
              )}

              {components.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No components added. Add resources to calculate the AHSP price.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Coefficient</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map((component) => (
                      <TableRow key={component.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {component.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{component.resource?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {component.unit}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatIDR(component.unitPrice)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={component.coefficient}
                            onChange={(e) => handleUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                            step="0.001"
                            min="0"
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatIDR(component.subtotal)}
                        </TableCell>
                        <TableCell>
                          <Button
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

          {/* Error message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
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
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AHSPItemEditor
