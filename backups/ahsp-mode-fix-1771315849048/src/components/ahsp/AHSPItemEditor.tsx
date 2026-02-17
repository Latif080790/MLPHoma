
/**
 * AHSPItemEditor.tsx
 * Editor for creating and editing AHSP items with component management
 */

import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Calculator, Edit2, Check, Database, Search, Info } from 'lucide-react'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
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
  const [pendingDeleteComponentId, setPendingDeleteComponentId] = useState<string | null>(null)
  const [resourceSearch, setResourceSearch] = useState('')

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

  // Filtered resources for the library search
  const filteredResources = React.useMemo(() => {
    return resources.filter(res => {
      const matchesType = res.type === selectedComponentType
      const matchesSearch = res.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        res.code.toLowerCase().includes(resourceSearch.toLowerCase())
      return matchesType && matchesSearch
    })
  }, [resources, selectedComponentType, resourceSearch])

  // Handle adding a resource from the library
  const handleAddResource = (resource: any) => {
    addComponent(currentAHSPId, {
      resourceId: resource.id,
      type: resource.type,
      coefficient: 0,
      unit: resource.unit,
      unitPrice: resource.unitPrice,
      subtotal: 0,
    })
    setResourceSearch('')
  }

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
    setPendingDeleteComponentId(componentId)
  }

  // Filter resources by type
  const resourcesByType = React.useMemo(() => {
    const grouped: Record<ResourceType, typeof resources> = {
      material: [],
      labor: [],
      equipment: [],
      subcontractor: [],
    }

    const normalizeType = (type?: string): ResourceType | null => {
      if (!type) return null
      if (type === 'subcon') return 'subcontractor'
      if (type === 'material' || type === 'labor' || type === 'equipment' || type === 'subcontractor') {
        return type
      }
      return null
    }

    resources.forEach(resource => {
      if (resource.isActive) {
        const normalizedType = normalizeType(resource.type as string)
        if (!normalizedType) return
        grouped[normalizedType].push(resource)
      }
    })

    return grouped
  }, [resources])
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[95vw] lg:max-w-[90vw] xl:max-w-[85vw] p-0 gap-0 border-l border-slate-200 flex flex-col h-screen max-h-screen overflow-hidden bg-white shadow-2xl">
        <SheetHeader className="px-8 py-6 border-b shrink-0 bg-white z-20 shadow-sm relative">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
              <Edit2 className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-2xl font-black tracking-tight text-slate-900">
                {item ? 'Edit AHSP Analysis' : 'Create New AHSP'}
              </SheetTitle>
              <p className="text-sm text-slate-400 font-medium">Configure item details and cost components</p>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <Tabs defaultValue="master" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="bg-slate-50/50 p-2 border-b shrink-0">
              <TabsList className="flex w-full bg-slate-200/50 p-1 h-11 rounded-xl">
                <TabsTrigger value="master" className="flex-1 rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                  <Database className="h-3.5 w-3.5 mr-2" />
                  Master Data
                </TabsTrigger>
                <TabsTrigger value="components" className="flex-1 rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                  <Calculator className="h-3.5 w-3.5 mr-2" />
                  Component Analysis
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex-1 rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                  <Check className="h-3.5 w-3.5 mr-2" />
                  Cost Distribution
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Master Data */}
            <TabsContent value="master" className="flex-1 overflow-y-auto p-8 space-y-8 m-0 bg-white">
              <div className="grid gap-8">
                {/* Identification Grid */}
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-4">
                    <div className="h-4 w-1 bg-blue-600 rounded-full" />
                    General Identification
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">AHSP Code</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => handleChange('code', e.target.value)}
                        placeholder="e.g., A.2.2.1"
                        className={`h-12 text-lg font-mono font-bold rounded-2xl border-slate-200 transition-all focus:ring-4 focus:ring-blue-100 ${errors.code ? 'border-red-500 bg-red-50' : 'bg-white'}`}
                        disabled={isSubmitting}
                      />
                      {errors.code && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.code}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit" className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Unit of Measure</Label>
                      <Select value={formData.unit} onValueChange={(value: any) => handleChange('unit', value)}>
                        <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white font-bold transition-all focus:ring-4 focus:ring-blue-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          <SelectItem value="m3" className="font-bold py-3">m³ (Kubik)</SelectItem>
                          <SelectItem value="m2" className="font-bold py-3">m² (Luas)</SelectItem>
                          <SelectItem value="m" className="font-bold py-3">m (Meter Lari)</SelectItem>
                          <SelectItem value="kg" className="font-bold py-3">kg (Berat)</SelectItem>
                          <SelectItem value="ltr" className="font-bold py-3">liter</SelectItem>
                          <SelectItem value="bh" className="font-bold py-3">buah (Item)</SelectItem>
                          <SelectItem value="oh" className="font-bold py-3">OH (Labor)</SelectItem>
                          <SelectItem value="jam" className="font-bold py-3">jam (Tool)</SelectItem>
                          <SelectItem value="unit" className="font-bold py-3">unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Classification / Category</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={(value) => {
                          setSelectedCategory(value)
                          setSelectedSubcategory('')
                          const category = mainCategories.find(c => c.id === value)
                          if (category) handleChange('category', category.name)
                        }}
                      >
                        <SelectTrigger className={`h-12 rounded-2xl border-slate-200 bg-white font-bold transition-all focus:ring-4 focus:ring-blue-100 ${errors.category ? 'border-red-500 shadow-sm' : ''}`}>
                          <SelectValue placeholder="Select work category..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-80">
                          {mainCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id} className="py-3 font-semibold">
                              {cat.code} - {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.category && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.category}</p>}
                    </div>

                    {selectedCategory && getSubcategories(selectedCategory).length > 0 && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Sub-Classification</Label>
                        <Select
                          value={selectedSubcategory}
                          onValueChange={(value) => {
                            setSelectedSubcategory(value)
                            const subcat = getSubcategories(selectedCategory).find(c => c.id === value)
                            if (subcat) {
                              const path = getCategoryPath(value)
                              handleChange('category', path.map(p => p.name).join(' > '))
                            }
                          }}
                        >
                          <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white font-bold transition-all focus:ring-4 focus:ring-blue-100">
                            <SelectValue placeholder="Select specialized sub-type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-80">
                            {getSubcategories(selectedCategory).map(subcat => (
                              <SelectItem key={subcat.id} value={subcat.id} className="py-3 font-semibold">
                                {subcat.code} - {subcat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Item Title / Work Description</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g., Pemasangan 1m2 Dinding Bata Merah 1:4"
                      className={`h-14 text-xl font-black rounded-2xl border-slate-200 transition-all focus:ring-4 focus:ring-blue-100 ${errors.name ? 'border-red-500 bg-red-50 text-red-900' : 'bg-white text-slate-900'}`}
                      disabled={isSubmitting}
                    />
                    {errors.name && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Detailed Technical Specifications</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Detail methods, materials requirements, and technical standards..."
                      rows={5}
                      className="resize-none rounded-3xl border-slate-200 bg-white p-4 text-slate-700 leading-relaxed transition-all focus:ring-4 focus:ring-blue-100"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 border-t pt-8">
                  <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                      <Calculator className="h-4 w-4" />
                      Overhead Factor
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.overheadPercentage}
                        onChange={(e) => handleChange('overheadPercentage', parseFloat(e.target.value) || 0)}
                        className="h-12 pl-4 pr-10 text-xl font-mono font-black text-blue-700 rounded-2xl border-blue-200 bg-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-blue-400">%</span>
                    </div>
                    <p className="text-[10px] text-blue-400 leading-tight font-medium uppercase tracking-wider">Costs for project management and site logistics</p>
                  </div>

                  <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <Check className="h-4 w-4" />
                      Profit Margin
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.profitPercentage}
                        onChange={(e) => handleChange('profitPercentage', parseFloat(e.target.value) || 0)}
                        className="h-12 pl-4 pr-10 text-xl font-mono font-black text-emerald-700 rounded-2xl border-emerald-200 bg-white"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-400">%</span>
                    </div>
                    <p className="text-[10px] text-emerald-400 leading-tight font-medium uppercase tracking-wider">Net profit margin for the overall AHSP item</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Components Analysis */}
            <TabsContent value="components" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-slate-50/50">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-8 py-4 border-b bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Component Breakdown</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Detail labor, materials, and equipment factors</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddManualComponent}
                    className="h-9 px-4 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Custom Component
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[1200px]">
                        <TableHeader className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-32 text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 pl-6">Type</TableHead>
                            <TableHead className="min-w-[400px] text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Resource Description</TableHead>
                            <TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Unit</TableHead>
                            <TableHead className="w-40 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Rate</TableHead>
                            <TableHead className="w-36 text-center text-[10px] font-black uppercase tracking-widest text-slate-800 py-4 bg-blue-50/50 italic">Coeff</TableHead>
                            <TableHead className="w-40 text-right text-[10px] font-black uppercase tracking-widest text-slate-900 py-4 pr-6">Subtotal</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {manualComponents.length === 0 && components.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center bg-slate-50/50">
                              <div className="flex flex-col items-center gap-2 opacity-30">
                                <Plus className="h-10 w-10" />
                                <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">No analysis components added yet.</p>
                                <p className="text-[10px] text-slate-400">Search for resources below to begin your analysis.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {/* Manual Components */}
                            {manualComponents.map((comp) => (
                              <TableRow key={comp.tempId} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                <TableCell className="pl-6">
                                  <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-wider h-5 bg-slate-100 text-slate-500 border-none">
                                    {comp.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {comp.editing ? (
                                    <Input
                                      value={comp.resourceName}
                                      onChange={(e) => handleUpdateManualComponent(comp.tempId, 'resourceName', e.target.value)}
                                      className="h-9 border-slate-200 rounded-lg text-sm font-bold bg-white"
                                    />
                                  ) : (
                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                      {comp.resourceName}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">{comp.unit}</span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-slate-500">
                                  {formatIDR(comp.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right bg-blue-50/20">
                                  <Input
                                    type="number"
                                    value={comp.coefficient}
                                    onChange={(e) => handleUpdateManualComponent(comp.tempId, 'coefficient', parseFloat(e.target.value) || 0)}
                                    className="h-8 py-0 text-right font-black border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-blue-300 transition-all rounded-lg"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm font-black text-slate-900 pr-6">
                                  {formatIDR(comp.coefficient * comp.unitPrice)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteManualComponent(comp.tempId)}
                                    className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* Resource-based Components */}
                            {components.map((component) => (
                              <TableRow key={component.id} className="group hover:bg-blue-50/20 transition-colors border-b border-slate-100 last:border-0">
                                <TableCell className="pl-6">
                                  <Badge
                                    className={`font-black text-[9px] uppercase tracking-wider h-5 border-none ${component.type === 'material' ? 'bg-blue-100 text-blue-700' :
                                      component.type === 'labor' ? 'bg-orange-100 text-orange-700' :
                                        'bg-indigo-100 text-indigo-700'
                                      }`}
                                  >
                                    {component.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 text-sm">{component.resource?.name}</span>
                                    <span className="text-[9px] font-mono text-slate-400 lowercase tracking-widest">{component.resourceId}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">
                                  {component.unit}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-slate-500">
                                  {formatIDR(component.unitPrice)}
                                </TableCell>
                                <TableCell className="bg-blue-50/10">
                                  <Input
                                    type="number"
                                    value={component.coefficient}
                                    onChange={(e) => handleUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                                    className="h-8 px-2 text-right font-black text-slate-900 border-transparent bg-transparent hover:border-blue-200 focus:bg-white focus:border-blue-400 transition-all rounded-lg"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm font-black text-slate-900 pr-6">
                                  {formatIDR(component.subtotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteComponent(component.id)}
                                    className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </div>

                {/* Integrated Import / Resource Search */}
                <div className="shrink-0 p-8 border-t bg-white z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-600" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Library Resources Integration</h4>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border-slate-200">
                        {filteredResources.length} Available in Catalog
                      </Badge>
                    </div>

                    <div className="flex gap-3">
                      <Select value={selectedComponentType} onValueChange={(value: any) => setSelectedComponentType(value)}>
                        <SelectTrigger className="w-40 h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold text-xs uppercase tracking-wider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          <SelectItem value="material" className="py-3 font-semibold">MATERIAL</SelectItem>
                          <SelectItem value="labor" className="py-3 font-semibold">LABOR / TENAGA</SelectItem>
                          <SelectItem value="equipment" className="py-3 font-semibold">EQUIPMENT / ALAT</SelectItem>
                          <SelectItem value="subcontractor" className="py-3 font-semibold">SUBCONTRACTOR</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                          placeholder={`Search ${selectedComponentType} resources...`}
                          value={resourceSearch}
                          onChange={(e) => setResourceSearch(e.target.value)}
                          className="h-12 pl-12 pr-4 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium"
                        />
                      </div>
                    </div>

                    {resourceSearch && filteredResources.length > 0 && (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-300 divide-y divide-slate-100 z-50 relative pointer-events-auto">
                        {filteredResources.map((res) => (
                          <div
                            key={res.id}
                            className="px-6 py-4 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-colors group"
                            onClick={() => handleAddResource(res)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                {res.name[0]}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700">{res.name}</span>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[10px] font-mono font-medium text-slate-400 uppercase">{res.code}</span>
                                  <div className="h-1 w-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black uppercase">{res.unit}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-black text-slate-900">{formatIDR(res.unitPrice)}</span>
                              <Button size="sm" variant="ghost" className="h-8 px-4 text-[10px] font-black uppercase text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                Add to Analysis
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Visual Summary */}
            <TabsContent value="summary" className="flex-1 overflow-y-auto p-8 space-y-8 bg-white m-0">
              <div className="grid gap-8">
                <div className="flex flex-col items-center justify-center py-12 px-6 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <Label className="text-[10px] uppercase font-black tracking-[0.3em] text-blue-400 mb-4 opacity-80 decoration-blue-500/30 underline-offset-8 underline">Final AHSP Calculation</Label>
                    <div className="text-6xl font-black font-mono tracking-tighter tabular-nums mb-2">
                      {formatIDR(totals.final)}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">
                      Unit Price Per <span className="text-white bg-white/10 px-2 py-1 rounded-lg">{formData.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-blue-500 rounded-full" />
                      <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Base Cost Breakdown</h3>
                    </div>

                    <div className="space-y-4 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                      <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material Cost</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{formatIDR(totals.material)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${(totals.material / (totals.base || 1)) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Labor Cost</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{formatIDR(totals.labor)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${(totals.labor / (totals.base || 1)) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tools / Equipment</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{formatIDR(totals.equipment + totals.subcontractor)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${((totals.equipment + totals.subcontractor) / (totals.base || 1)) * 100}%` }} />
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-sm font-black text-slate-900 uppercase">Subtotal Base Cost</span>
                        <span className="text-lg font-black font-mono text-blue-600">{formatIDR(totals.base)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                      <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Overhead & Profit</h3>
                    </div>

                    <div className="bg-emerald-50/20 p-8 rounded-[2rem] border border-emerald-100 space-y-6 h-full flex flex-col justify-between">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-emerald-100/50">
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Overhead Adjusted</span>
                            <span className="text-xs font-bold text-slate-400">{formData.overheadPercentage}% of base</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 text-sm">+{formatIDR(totals.base * (formData.overheadPercentage / 100))}</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-emerald-100/50">
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Target Profit</span>
                            <span className="text-xs font-bold text-slate-400">{formData.profitPercentage}% of base</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 text-sm">+{formatIDR(totals.base * (formData.profitPercentage / 100))}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-600 rounded-2xl text-white text-center">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Total Surcharge</div>
                        <div className="text-2xl font-black font-mono">{formatIDR(totals.final - totals.base)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="shrink-0 px-8 py-6 border-t bg-white flex items-center justify-between z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-12 px-6 font-bold text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl"
            >
              Discard Changes
            </Button>
            <div className="flex gap-4">
              {errors.submit && (
                <p className="text-sm text-red-500 self-center font-bold mr-4 animate-bounce">⚠️ {errors.submit}</p>
              )}
              <Button type="submit" size="lg" className="h-12 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-95" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-3">
                    <Database className="animate-spin h-5 w-5" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <Check className="h-5 w-5" />
                    Finalize & Save
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>

        <AlertDialog open={!!pendingDeleteComponentId} onOpenChange={(open) => { if (!open) setPendingDeleteComponentId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this component?</AlertDialogTitle>
              <AlertDialogDescription>
                The component will be removed from this AHSP analysis.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingDeleteComponentId) return
                  deleteComponent(pendingDeleteComponentId)
                  setPendingDeleteComponentId(null)
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet >
  )
}

export default AHSPItemEditor
