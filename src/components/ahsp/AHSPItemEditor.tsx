
/**
 * AHSPItemEditor.tsx
 * Editor for creating and editing AHSP items with component management
 */

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Calculator, Edit2, Check, Database, Search, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { ChevronsUpDown } from 'lucide-react'
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
import type { AHSPItem, ResourceType, ResourceUnit } from '../../types/ahsp'
import type { AHSPCreationMode } from './AHSPCreationModeDialog'
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

      // Save manual components (both for new and existing items)
      const ahspId = savedId || item?.id
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
        unit: sniItem.unit,
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
              {components.length + manualComponents.filter(c => !c.editing).length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-xs font-bold bg-white/20 text-white">
                  {components.length + manualComponents.filter(c => !c.editing).length}
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
            <div className="border-b border-border bg-background p-4 sm:p-5 space-y-5 lg:col-[1]">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="bg-blue-500/10 p-2 rounded-xl ring-1 ring-blue-500/20">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Master Data</h3>
                  <p className="text-xs text-muted-foreground font-medium">Identifikasi umum dan kategorisasi</p>
                </div>
              </div>
              <div className="grid gap-5">
                {/* Identification Grid */}
                <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <div className="h-4 w-1 bg-blue-500 rounded-full" />
                    <span className="text-foreground">Identifikasi Umum</span>
                  </div>

                  {/* SNI AHSP Selector */}
                  {mode === 'sni' && !item && (
                    <div className="bg-card p-5 rounded-xl border border-blue-500/30 space-y-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2 rounded-xl ring-1 ring-blue-500/20">
                          <Database className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="text-foreground font-bold text-sm">Pilih dari AHSP SNI yang Ada</h3>
                          <p className="text-muted-foreground text-xs">Template dari database proyek Anda</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Pilih AHSP SNI yang sudah ada untuk menyalin semua component & coefficient-nya
                      </p>
                      {(() => {
                        const picked = sniAHSPItems.find(i => i.id === selectedSNIPreset)
                        return (
                          <Popover open={sniPickerOpen} onOpenChange={setSniPickerOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                role="combobox"
                                aria-expanded={sniPickerOpen}
                                className="flex w-full items-center gap-2 h-10 rounded-lg border border-border bg-background px-3 text-left hover:border-blue-400/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/10"
                              >
                                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className={`flex-1 truncate text-sm ${picked ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                  {picked ? `${picked.code} — ${picked.name}` : 'Cari & pilih AHSP SNI dari database...'}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
                              <Command
                                filter={(value, search) => {
                                  // value carries "code name category" lowercased for matching
                                  return value.includes(search.toLowerCase()) ? 1 : 0
                                }}
                              >
                                <CommandInput placeholder="Ketik kode / nama / kategori..." className="text-sm" />
                                <CommandList className="max-h-72">
                                  <CommandEmpty>
                                    {sniAHSPItems.length === 0
                                      ? 'Belum ada AHSP SNI di database.'
                                      : 'Tidak ada AHSP yang cocok.'}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {sniAHSPItems.map(it => (
                                      <CommandItem
                                        key={it.id}
                                        value={`${it.code} ${it.name} ${it.category}`.toLowerCase()}
                                        onSelect={async () => {
                                          setSelectedSNIPreset(it.id)
                                          setSniPickerOpen(false)
                                          await handleApplySNIItem(it)
                                        }}
                                        className="flex flex-col items-start gap-1 py-2.5"
                                      >
                                        <span className="font-semibold text-foreground text-sm leading-tight">{it.code} — {it.name}</span>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
                                            {it.category}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground font-mono">{it.unit} • {formatIDR(it.finalPrice)}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )
                      })()}
                      {selectedSNIPreset && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {components.length} komponen tersalin — buka tab <strong>Komponen</strong> untuk meninjau.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="code" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                        AHSP Code
                        <span className="text-blue-500 dark:text-blue-400 normal-case tracking-normal font-medium">· otomatis</span>
                      </Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => handleChange('code', e.target.value)}
                        placeholder="dari kategori / sub-kategori"
                        className={`h-9 text-sm font-mono font-bold rounded-lg border-border transition-all focus:ring-2 focus:ring-primary/10 ${errors.code ? 'border-red-500 bg-red-50' : 'bg-background'}`}
                        disabled={isSubmitting}
                      />
                      {errors.code && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.code}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="unit" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Satuan</Label>
                      <Select value={formData.unit} onValueChange={(value: string) => handleChange('unit', value)}>
                        <SelectTrigger className="h-9 rounded-lg border-border bg-background text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-xl">
                          <SelectItem value="m3" className="font-semibold py-2">m³ (Kubik)</SelectItem>
                          <SelectItem value="m2" className="font-semibold py-2">m² (Luas)</SelectItem>
                          <SelectItem value="m" className="font-semibold py-2">m (Meter Lari)</SelectItem>
                          <SelectItem value="kg" className="font-semibold py-2">kg (Berat)</SelectItem>
                          <SelectItem value="ltr" className="font-semibold py-2">liter</SelectItem>
                          <SelectItem value="bh" className="font-semibold py-2">buah (Item)</SelectItem>
                          <SelectItem value="oh" className="font-semibold py-2">OH (Labor)</SelectItem>
                          <SelectItem value="jam" className="font-semibold py-2">jam (Tool)</SelectItem>
                          <SelectItem value="unit" className="font-semibold py-2">unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Klasifikasi / Kategori</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={(value) => {
                          setSelectedCategory(value)
                          setSelectedSubcategory('')
                          const category = mainCategories.find(c => c.id === value)
                          if (category) {
                            handleChange('category', category.name)
                            // If this category has no sub-classifications, auto-number from the
                            // category code now; otherwise wait for the sub-classification pick.
                            if (getSubcategories(value).length === 0) {
                              handleChange('code', nextAhspCode(category.code))
                            }
                          }
                        }}
                      >
                        <SelectTrigger className={`h-9 rounded-lg border-border bg-background text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/10 ${errors.category ? 'border-red-500 shadow-sm' : ''}`}>
                          <SelectValue placeholder="Pilih kategori pekerjaan..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-xl max-h-80">
                          {mainCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id} className="py-2 font-semibold">
                              {cat.code} - {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.category && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.category}</p>}
                    </div>

                    {selectedCategory && getSubcategories(selectedCategory).length > 0 && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Sub-Klasifikasi</Label>
                        <Select
                          value={selectedSubcategory}
                          onValueChange={(value) => {
                            setSelectedSubcategory(value)
                            const subcat = getSubcategories(selectedCategory).find(c => c.id === value)
                            if (subcat) {
                              const path = getCategoryPath(value)
                              handleChange('category', path.map(p => p.name).join(' > '))
                              // Auto-number the AHSP code from the sub-classification code.
                              handleChange('code', nextAhspCode(subcat.code))
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-lg border-border bg-background text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/10">
                            <SelectValue placeholder="Pilih sub-klasifikasi..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border shadow-xl max-h-80">
                            {getSubcategories(selectedCategory).map(subcat => (
                              <SelectItem key={subcat.id} value={subcat.id} className="py-2 font-semibold">
                                {subcat.code} - {subcat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Judul Item / Uraian Pekerjaan</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g., Pemasangan 1m2 Dinding Bata Merah 1:4"
                      className={`h-9 text-base font-semibold rounded-lg border-border transition-all focus:ring-2 focus:ring-primary/10 ${errors.name ? 'border-red-500 bg-red-50 text-red-900' : 'bg-background text-foreground'}`}
                      disabled={isSubmitting}
                    />
                    {errors.name && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Spesifikasi Teknis Detail</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Detail metode, kebutuhan material, dan standar teknis..."
                      rows={3}
                      className="resize-none rounded-lg border-border bg-background p-3 text-sm text-foreground leading-relaxed transition-all focus:ring-2 focus:ring-primary/10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 border-t pt-6 sm:pt-8">
                  <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                      <Calculator className="h-4 w-4" />
                      Faktor Overhead
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.overheadPercentage}
                        onChange={(e) => handleChange('overheadPercentage', parseFloat(e.target.value) || 0)}
                        className="h-10 pl-4 pr-10 text-xl font-mono font-semibold text-primary rounded-lg border-border bg-background"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-blue-400">%</span>
                    </div>
                    <p className="text-xs text-blue-400 leading-tight font-medium uppercase tracking-wider">Biaya untuk manajemen proyek dan logistik lapangan</p>
                  </div>

                  <div className="bg-card p-6 rounded-xl border border-emerald-200/40 space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                      <Check className="h-4 w-4" />
                      Margin Keuntungan
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.profitPercentage}
                        onChange={(e) => handleChange('profitPercentage', parseFloat(e.target.value) || 0)}
                        className="h-10 pl-4 pr-10 text-xl font-mono font-semibold text-emerald-700 rounded-lg border-border bg-background"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-400">%</span>
                    </div>
                    <p className="text-xs text-emerald-400 leading-tight font-medium uppercase tracking-wider">Margin keuntungan bersih untuk keseluruhan item AHSP</p>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Section 2: Component Analysis — shown on Step 2 */}
            {currentStep === 2 && (
            <div className="min-h-[600px] border-b border-border bg-background lg:col-[1]">
              <div className="px-4 sm:px-6 lg:px-8 py-5 bg-card border-b border-border flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-xl ring-1 ring-amber-500/20">
                  <Calculator className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Analisa Komponen</h3>
                  <p className="text-xs text-muted-foreground font-medium">Struktur rincian biaya pekerjaan</p>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-border bg-background flex items-center justify-end shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddManualComponent}
                    className="h-8 px-3 rounded-lg border-border text-blue-600 hover:bg-blue-500/10 hover:border-blue-400/50 font-bold text-xs dark:text-blue-400"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Komponen Kustom
                  </Button>
                </div>

                <div className="p-4 md:p-6 min-h-[400px]">
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <Table className="w-full min-w-[680px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border">
                          <TableRow className="hover:bg-transparent border-0">
                            <TableHead className="w-24 text-xs font-bold uppercase tracking-widest text-muted-foreground py-3 pl-6">Type</TableHead>
                            <TableHead className="min-w-[180px] text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Deskripsi Resource</TableHead>
                            <TableHead className="w-16 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Unit</TableHead>
                            <TableHead className="w-28 text-right text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Rate</TableHead>
                            <TableHead className="w-24 text-center text-xs font-bold uppercase tracking-widest text-blue-600 py-3 bg-blue-500/5 italic dark:text-blue-400">Koef</TableHead>
                            <TableHead className="w-32 text-right text-xs font-bold uppercase tracking-widest text-amber-600 py-3 pr-6 dark:text-amber-400">Subtotal</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {manualComponents.length === 0 && components.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center bg-muted/30/30">
                              <div className="flex flex-col items-center gap-2 opacity-30">
                                <Plus className="h-10 w-10" />
                                <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">Belum ada komponen analisa.</p>
                                <p className="text-xs text-muted-foreground">Cari resource di bawah untuk memulai analisa.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {/* Manual Components */}
                            {manualComponents.map((comp) => (
                              <TableRow key={comp.tempId} className="group hover:bg-muted/30/30 transition-colors border-b border-border last:border-0">
                                <TableCell className="pl-6">
                                  <Badge variant="secondary" className="font-semibold text-xs uppercase tracking-wider h-5 bg-muted/50 text-muted-foreground border-none">
                                    {comp.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {comp.editing ? (
                                    <Input
                                      value={comp.resourceName}
                                      onChange={(e) => handleUpdateManualComponent(comp.tempId, 'resourceName', e.target.value)}
                                      className="h-9 border-border rounded-lg text-sm font-bold bg-background"
                                    />
                                  ) : (
                                    <div className="font-bold text-muted-foreground text-sm flex items-center gap-2">
                                      {comp.resourceName}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">{comp.unit}</span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                  {formatIDR(comp.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right bg-blue-50/20">
                                  <Input
                                    type="number"
                                    value={comp.coefficient}
                                    onChange={(e) => handleUpdateManualComponent(comp.tempId, 'coefficient', parseFloat(e.target.value) || 0)}
                                    className="h-8 py-0 text-right font-semibold border-transparent bg-transparent hover:border-border focus:bg-background focus:border-primary/40 transition-all rounded-lg"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm font-semibold text-foreground pr-6">
                                  {formatIDR(comp.coefficient * comp.unitPrice)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Hapus komponen"
                                    onClick={() => handleDeleteManualComponent(comp.tempId)}
                                    className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-80 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* Resource-based Components */}
                            {components.map((component) => (
                              <TableRow key={component.id} className="group hover:bg-accent/40/20 transition-colors border-b border-border last:border-0">
                                <TableCell className="pl-6">
                                  <Badge
                                    className={`font-semibold text-xs uppercase tracking-wider h-5 border-none ${component.type === 'material' ? 'bg-primary/10 text-primary' :
                                      component.type === 'labor' ? 'bg-orange-100 text-orange-700' :
                                        'bg-indigo-100 text-indigo-700'
                                      }`}
                                  >
                                    {component.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const res = component.resource ?? resources.find(r => r.id === component.resourceId)
                                    return (
                                      <div className="flex flex-col">
                                        <span className="font-bold text-foreground text-sm">{res?.name || 'Komponen tanpa nama'}</span>
                                        <span className="text-xs font-mono text-muted-foreground tracking-wide">{res?.code || '—'}</span>
                                      </div>
                                    )
                                  })()}
                                </TableCell>
                                <TableCell className="text-center font-semibold text-xs text-muted-foreground uppercase">
                                  {component.unit}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                  {formatIDR(component.unitPrice)}
                                </TableCell>
                                <TableCell className="bg-blue-50/10">
                                  <Input
                                    type="number"
                                    value={component.coefficient}
                                    onChange={(e) => handleUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                                    className="h-8 px-2 text-right font-semibold text-foreground border-transparent bg-transparent hover:border-border focus:bg-background focus:border-primary/40 transition-all rounded-lg"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm font-semibold text-foreground pr-6">
                                  {formatIDR(component.subtotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Hapus komponen"
                                    onClick={() => handleDeleteComponent(component.id)}
                                    className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-80 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
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
                <div className="shrink-0 p-4 sm:p-6 lg:p-8 border-t bg-card z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-600" />
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Integrasi Resource Library</h4>
                      </div>
                      <Badge variant="outline" className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-border">
                        {filteredResources.length} tersedia di katalog
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Select value={selectedComponentType} onValueChange={(value: string) => setSelectedComponentType(value as ResourceType)}>
                        <SelectTrigger className="w-full sm:w-40 h-10 rounded-lg border-border bg-muted/30 font-bold text-xs uppercase tracking-wider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-xl">
                          <SelectItem value="material" className="py-3 font-semibold">MATERIAL</SelectItem>
                          <SelectItem value="labor" className="py-3 font-semibold">LABOR / TENAGA</SelectItem>
                          <SelectItem value="equipment" className="py-3 font-semibold">EQUIPMENT / ALAT</SelectItem>
                          <SelectItem value="subcontractor" className="py-3 font-semibold">SUBCONTRACTOR</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                        <Input
                          placeholder={`Cari resource ${selectedComponentType}...`}
                          value={resourceSearch}
                          onChange={(e) => setResourceSearch(e.target.value)}
                          className="h-10 pl-12 pr-4 rounded-lg border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                        />
                      </div>
                    </div>

                    {resourceSearch && filteredResources.length > 0 && (
                      <div className="mt-2 rounded-lg border border-border bg-background shadow-2xl max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-300 divide-y divide-border z-50 relative pointer-events-auto">
                        {filteredResources.map((res) => (
                          <div
                            key={res.id}
                            className="px-6 py-4 flex items-center justify-between hover:bg-accent/40/50 cursor-pointer transition-colors group"
                            onClick={() => handleAddResource(res)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground font-semibold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                {res.name[0]}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-muted-foreground text-sm group-hover:text-blue-700">{res.name}</span>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-xs font-mono font-medium text-muted-foreground uppercase">{res.code}</span>
                                  <div className="h-1 w-1 rounded-full bg-muted" />
                                  <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground font-semibold uppercase">{res.unit}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-semibold text-foreground">{formatIDR(res.unitPrice)}</span>
                              <Button size="sm" variant="ghost" className="h-8 px-4 text-xs font-semibold uppercase text-blue-600 opacity-100 transition-opacity">
                                Tambahkan
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Section 3: Cost Distribution Summary — always visible right sidebar */}
            <div className="bg-card p-4 sm:p-5 space-y-5 lg:col-[2] lg:row-[1/span_2] lg:border-l lg:border-border lg:sticky lg:top-0 lg:h-fit lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="bg-emerald-500/10 p-2 rounded-xl ring-1 ring-emerald-500/20">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Distribusi Biaya</h3>
                  <p className="text-xs text-muted-foreground font-medium">Ringkasan komposisi dan harga</p>
                </div>
              </div>
              <div className="grid gap-6">
                {/* Kalkulasi Akhir — accent hero */}
                <div className="flex flex-col items-center justify-center py-5 px-5 rounded-xl bg-muted/40 border border-border relative overflow-hidden">
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="text-xs uppercase font-bold tracking-[0.2em] text-muted-foreground mb-3">Kalkulasi Akhir AHSP</span>
                    <div className="text-2xl lg:text-3xl font-bold font-mono tracking-tight tabular-nums text-amber-500 dark:text-amber-400 mb-2 break-all">
                      {formatIDR(totals.final)}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase tracking-[0.1em] text-xs">
                      Harga Satuan per <span className="bg-muted px-2 py-0.5 rounded font-mono text-foreground">{formData.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Rincian Biaya Dasar */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-0.5 bg-blue-500 rounded-full" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Rincian Biaya Dasar</h3>
                  </div>
                  <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biaya Material</span>
                        <span className="font-mono text-xs font-bold text-foreground">{formatIDR(totals.material)}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${(totals.material / (totals.base || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biaya Tenaga Kerja</span>
                        <span className="font-mono text-xs font-bold text-foreground">{formatIDR(totals.labor)}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${(totals.labor / (totals.base || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alat / Peralatan</span>
                        <span className="font-mono text-xs font-bold text-foreground">{formatIDR(totals.equipment + totals.subcontractor)}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${((totals.equipment + totals.subcontractor) / (totals.base || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="pt-3 mt-1 border-t border-border flex justify-between items-center">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">Subtotal Biaya Dasar</span>
                      <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">{formatIDR(totals.base)}</span>
                    </div>
                  </div>
                </div>

                {/* Overhead & Keuntungan */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-0.5 bg-emerald-500 rounded-full" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Overhead &amp; Keuntungan</h3>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                    <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overhead</span>
                        <span className="text-xs text-muted-foreground/60 ml-2">{formData.overheadPercentage}%</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatIDR(totals.base * (formData.overheadPercentage / 100))}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Keuntungan</span>
                        <span className="text-xs text-muted-foreground/60 ml-2">{formData.profitPercentage}%</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatIDR(totals.base * (formData.profitPercentage / 100))}</span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Penyesuaian</span>
                      <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatIDR(totals.final - totals.base)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
