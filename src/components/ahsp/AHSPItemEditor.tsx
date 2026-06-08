
/**
 * AHSPItemEditor.tsx
 * Editor for creating and editing AHSP items with component management.
 * Thin orchestrator: holds state + handlers, delegates UI to sub-components
 * (AHSPMasterDataForm, AHSPComponentsTable, AHSPCostSummary, SNIPresetPicker).
 */

import React, { useState, useEffect } from 'react'
import { Database, Check, ChevronRight, ChevronLeft, Edit2 } from 'lucide-react'
import { Button } from '../ui/button'
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
import { toast } from 'sonner'
import type { AHSPItem, ResourceType, ResourceUnit } from '../../types/ahsp'
import type { AHSPCreationMode } from './AHSPCreationModeDialog'
import { getMainCategories } from '../../lib/workCategories'
import { AHSPMasterDataForm } from './AHSPMasterDataForm'
import { AHSPComponentsTable, type ManualComponent } from './AHSPComponentsTable'
import { AHSPCostSummary } from './AHSPCostSummary'

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
  /** Creation mode (SNI/Custom/Historical) */
  mode?: AHSPCreationMode
  /** Source reference for SNI or historical items */
  sourceReference?: string
}

/**
 * AHSPItemEditor Component
 */
export function AHSPItemEditor({
  item,
  open,
  onClose,
  onSave,
  mode,
  sourceReference: _sourceReference,
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
  const [manualComponents, setManualComponents] = useState<ManualComponent[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [pendingDeleteComponentId, setPendingDeleteComponentId] = useState<string | null>(null)
  const [resourceSearch, setResourceSearch] = useState('')
  const [selectedSNIPreset, setSelectedSNIPreset] = useState<string | null>(null)
  const [sniPickerOpen, setSniPickerOpen] = useState(false)
  const [_showSNIHelp, setShowSNIHelp] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)

  // Update SNI help visibility when mode changes
  useEffect(() => {
    setShowSNIHelp(mode === 'sni' && !item)
  }, [mode, item])

  // Reset step to 1 when dialog opens or item changes
  useEffect(() => {
    if (open) setCurrentStep(1)
  }, [open, item])

  const mainCategories = getMainCategories()

  const {
    resources,
    ahspItems,
    componentsByAHSP,
    addComponent,
    updateComponent,
    deleteComponent,
    addResource,
    fetchComponents,
    commitDraftComponents,
    clearDraftComponents,
  } = useAHSPStore()

  // AHSP items usable as SNI templates. Seeded SNI master data has no creation log,
  // so creationMode is undefined for it — treat anything not explicitly 'custom' as a
  // usable template (covers the 2475 seeded SNI items + items flagged 'sni').
  const sniAHSPItems = React.useMemo(() => {
    return ahspItems.filter(item => item.isActive && item.creationMode !== 'custom')
  }, [ahspItems])

  const currentAHSPId = item?.id || 'temp'
  const components = React.useMemo(
    () => componentsByAHSP[currentAHSPId] || [],
    [componentsByAHSP, currentAHSPId]
  )

  // For a NEW item, clear any leftover draft components from a previous cancelled
  // session so the 'temp' bucket starts empty.
  useEffect(() => {
    if (open && !item) clearDraftComponents()
  }, [open, item, clearDraftComponents])

  // Auto-generate the next AHSP code for a given category/sub code prefix, e.g.
  // prefix "1.1" → scans existing items "1.1.N" and returns "1.1.<max+1>".
  const nextAhspCode = React.useCallback((prefixCode: string) => {
    const prefix = `${prefixCode}.`
    const maxN = ahspItems.reduce((max, it) => {
      if (!it.code?.startsWith(prefix)) return max
      const tail = it.code.slice(prefix.length).split('.')[0]
      const n = parseInt(tail, 10)
      return Number.isFinite(n) && n > max ? n : max
    }, 0)
    return `${prefixCode}.${maxN + 1}`
  }, [ahspItems])

  // Guarantee a code not already used by another AHSP item (ahsp_items.code is UNIQUE).
  // Increments a trailing number, otherwise appends .2/.3… until free. Skips the
  // currently-edited item so re-saving an existing code is allowed.
  const makeUniqueCode = React.useCallback((desired: string) => {
    const taken = new Set(
      ahspItems.filter(i => i.id !== item?.id).map(i => i.code).filter(Boolean) as string[]
    )
    if (!desired || !taken.has(desired)) return desired
    const m = desired.match(/^(.*?)(\d+)$/)
    if (m) {
      let n = parseInt(m[2], 10) + 1
      while (taken.has(`${m[1]}${n}`)) n++
      return `${m[1]}${n}`
    }
    let n = 2
    while (taken.has(`${desired}.${n}`)) n++
    return `${desired}.${n}`
  }, [ahspItems, item?.id])

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!formData.unit || !String(formData.unit).trim()) newErrors.unit = 'Satuan wajib dipilih'

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
      // Final safety: guarantee the code is unique before insert (ahsp_items.code is
      // UNIQUE). Covers manual entry, auto-numbering gaps, and SNI-template copies.
      const uniqueCode = makeUniqueCode(formData.code)
      if (uniqueCode !== formData.code) {
        handleChange('code', uniqueCode)
        toast.info(`Kode AHSP disesuaikan menjadi ${uniqueCode} (kode sebelumnya sudah dipakai)`)
      }

      // Save AHSP item first
      const savedId = await onSave({
        ...formData,
        code: uniqueCode,
        basePrice: totals.base,
        finalPrice: totals.final,
      })

      // onSave returns '' when addAHSPItem validation fails. Don't falsely claim
      // success (and don't try to attach components to a non-existent parent).
      const ahspId = savedId || item?.id
      if (!ahspId) {
        setErrors({ submit: 'Gagal menyimpan AHSP — periksa kembali isian (kode, satuan, kategori).' })
        setIsSubmitting(false)
        return
      }
      if (ahspId) {
        // For a NEW item the parent ahsp_item is now enqueued (via onSave), so migrate
        // the draft 'temp' components onto the real id and sync them after the parent.
        if (!item) {
          commitDraftComponents(ahspId)
        }

        // Add manual components as resources first, then as components
        for (const manualComp of manualComponents.filter(c => !c.editing)) {
          // Create resource for the manual component. addResource is async (persists
          // via the data service) and returns the new id — await it and use that id
          // directly. Reading from store state right after would be stale/empty.
          const tempResourceCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const newResourceId = await addResource({
            code: tempResourceCode,
            name: manualComp.resourceName,
            type: manualComp.type,
            unit: manualComp.unit,
            unitPrice: manualComp.unitPrice,
            specifications: 'Manual entry from AHSP',
            isActive: true,
          })

          // Add as component to AHSP (only if the resource was created successfully)
          if (newResourceId) {
            addComponent(ahspId, {
              type: manualComp.type,
              resourceId: newResourceId,
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
      setErrors({ submit: 'Failed to save item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle input changes
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateManualComponent = (tempId: string, field: string, value: any) => {
    setManualComponents(prev =>
      prev.map(c => c.tempId === tempId ? { ...c, [field]: value } : c)
    )
  }

  /**
   * Handle saving manual component
   */
  const _handleSaveManualComponent = (tempId: string) => {
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
  const _handleAddComponent = (resourceId: string) => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateComponent = (componentId: string, field: string, value: any) => {
    updateComponent(componentId, { [field]: value })
  }

  /**
   * Handle deleting component
   */
  const handleDeleteComponent = (componentId: string) => {
    setPendingDeleteComponentId(componentId)
  }

  /**
   * Handle applying SNI AHSP item from database
   */
  const handleApplySNIItem = async (sniItem: AHSPItem) => {
    try {
      // Auto-fill master data from selected SNI item. The code must be NEW & unique —
      // copying the template's code verbatim would violate ahsp_items.code UNIQUE.
      setFormData(prev => ({
        ...prev,
        code: makeUniqueCode(sniItem.code),
        name: sniItem.name,
        category: sniItem.category,
        unit: (sniItem.unit && String(sniItem.unit).trim()) ? sniItem.unit : 'unit',
        description: sniItem.description || '',
        overheadPercentage: sniItem.overheadPercentage || 0,
        profitPercentage: sniItem.profitPercentage || 0,
      }))

      // Fetch components from the selected SNI item
      await fetchComponents(sniItem.id)

      // Read FRESH store state — the `componentsByAHSP` render closure is stale right
      // after the await, so reading it would copy 0 components.
      const sniComponents = useAHSPStore.getState().componentsByAHSP[sniItem.id] || []

      // Copy components to new AHSP
      sniComponents.forEach(comp => {
        addComponent(currentAHSPId, {
          resourceId: comp.resourceId,
          type: comp.type,
          coefficient: comp.coefficient,
          unit: comp.unit,
          unitPrice: comp.unitPrice,
          subtotal: comp.subtotal,
          notes: comp.notes,
        })
      })

      toast.success(`SNI AHSP "${sniItem.code}" diterapkan dengan ${sniComponents.length} components`, {
        description: sniItem.name
      })
      setShowSNIHelp(false)
    } catch (error) {
      toast.error('Gagal menerapkan SNI AHSP', {
        description: 'Terjadi kesalahan saat memuat components'
      })
    }
  }

  /**
   * Handle selecting an SNI preset from the picker — sets selection state, closes the
   * picker, then applies the chosen template.
   */
  const handleSelectSNIPreset = async (sniItem: AHSPItem) => {
    setSelectedSNIPreset(sniItem.id)
    setSniPickerOpen(false)
    await handleApplySNIItem(sniItem)
  }

  // Filter resources by type
  const _resourcesByType = React.useMemo(() => {
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

  const componentsCount = components.length + manualComponents.filter(c => !c.editing).length

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[95vw] lg:max-w-[90vw] xl:max-w-[85vw] p-0 gap-0 border-l border-border flex flex-col top-14 h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden bg-background shadow-2xl">
        <SheetHeader className="px-8 py-5 border-b border-border shrink-0 bg-card z-20 relative shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/10 p-2.5 rounded-xl ring-1 ring-blue-500/20">
              <Edit2 className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <SheetTitle className="font-display text-xl font-bold text-foreground tracking-tight">
                  {item ? 'Ubah Analisa AHSP' : 'Buat AHSP Baru'}
                </SheetTitle>
                {mode && !item && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider border ${
                    mode === 'sni'
                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400'
                      : mode === 'historical'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
                  }`}>
                    MODE {mode.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Atur detail item dan komponen biaya</p>
            </div>
          </div>
          {/* Step indicator — cobalt active, muted idle */}
          <div className="flex items-center gap-0 mt-5">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 px-5 py-2 rounded-l-lg border text-xs font-bold transition-all ${
                currentStep === 1
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-blue-400/40'
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 1 ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>1</span>
              Info Dasar
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-2 px-5 py-2 rounded-r-lg border-t border-b border-r text-xs font-bold transition-all ${
                currentStep === 2
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-blue-400/40'
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 2 ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>2</span>
              Komponen
              {componentsCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-xs font-bold bg-white/20 text-white">
                  {componentsCount}
                </span>
              )}
            </button>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Unified Content - Sections shown based on current step */}
          <div className="flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-0">
            {/* Section 1: Master Data — shown on Step 1 */}
            {currentStep === 1 && (
              <AHSPMasterDataForm
                formData={formData}
                errors={errors}
                onChange={handleChange}
                isSubmitting={isSubmitting}
                item={item}
                mode={mode}
                mainCategories={mainCategories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectedSubcategory={selectedSubcategory}
                setSelectedSubcategory={setSelectedSubcategory}
                nextAhspCode={nextAhspCode}
                sniAHSPItems={sniAHSPItems}
                sniPickerOpen={sniPickerOpen}
                setSniPickerOpen={setSniPickerOpen}
                selectedSNIPreset={selectedSNIPreset}
                onSelectSNIPreset={handleSelectSNIPreset}
                componentsCount={componentsCount}
              />
            )}

            {/* Section 2: Component Analysis — shown on Step 2 */}
            {currentStep === 2 && (
              <AHSPComponentsTable
                components={components}
                resources={resources}
                manualComponents={manualComponents}
                onAddManualComponent={handleAddManualComponent}
                onUpdateManualComponent={handleUpdateManualComponent}
                onDeleteManualComponent={handleDeleteManualComponent}
                onUpdateComponent={handleUpdateComponent}
                onDeleteComponent={handleDeleteComponent}
                onAddResource={handleAddResource}
                selectedComponentType={selectedComponentType}
                setSelectedComponentType={setSelectedComponentType}
                resourceSearch={resourceSearch}
                setResourceSearch={setResourceSearch}
                filteredResources={filteredResources}
              />
            )}

            {/* Section 3: Cost Distribution Summary — always visible right sidebar */}
            <AHSPCostSummary
              basePrice={totals.base}
              finalPrice={totals.final}
              price_material={totals.material}
              price_labor={totals.labor}
              price_equipment={totals.equipment}
              price_subcon={totals.subcontractor}
              overheadPercentage={formData.overheadPercentage}
              profitPercentage={formData.profitPercentage}
              unit={formData.unit}
            />
          </div>

          <div className="shrink-0 px-4 sm:px-8 py-4 sm:py-5 border-t border-border bg-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-10 w-full sm:w-auto px-5 font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
              >
                Batalkan
              </Button>
              {currentStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={isSubmitting}
                  className="h-10 px-4 font-bold rounded-lg border-border text-foreground hover:bg-muted/50"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Info Dasar
                </Button>
              )}
            </div>
            <div className="flex w-full sm:w-auto flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              {errors.submit && (
                <p className="text-sm text-red-500 self-center font-bold mr-4 animate-bounce">⚠️ {errors.submit}</p>
              )}
              {currentStep === 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting}
                  className="h-10 w-full sm:w-auto px-5 font-bold rounded-lg border-blue-500/30 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                >
                  Komponen
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              <Button type="submit" size="lg" className="h-10 w-full sm:w-auto px-8 sm:px-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-3">
                    <Database className="animate-spin h-5 w-5" />
                    Menyimpan...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <Check className="h-5 w-5" />
                    Simpan
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>

        <AlertDialog open={!!pendingDeleteComponentId} onOpenChange={(open) => { if (!open) setPendingDeleteComponentId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus komponen ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Komponen akan dihapus dari analisa AHSP ini.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingDeleteComponentId) return
                  deleteComponent(pendingDeleteComponentId)
                  setPendingDeleteComponentId(null)
                }}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet >
  )
}

export default AHSPItemEditor
