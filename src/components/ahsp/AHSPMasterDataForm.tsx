/**
 * AHSPMasterDataForm.tsx
 * Step 1 content ("Info Dasar"): master data form for an AHSP item — code, unit,
 * category/sub-category, name, description, overhead & profit. Controlled inputs only.
 */

import { Calculator, Check, Database } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SNIPresetPicker } from './SNIPresetPicker'
import { AHSPStatusBadge } from './AHSPStatusBadge'
import { getSubcategories, getCategoryPath } from '../../lib/workCategories'
import type { AHSPItem, ResourceUnit, AHSPStatus } from '../../types/ahsp'
import type { WorkCategory } from '../../lib/workCategories'
import type { AHSPCreationMode } from './AHSPCreationModeDialog'

/** Form values for the master data section */
export interface MasterFormData {
  code: string
  name: string
  description: string
  unit: ResourceUnit
  category: string
  overheadPercentage: number
  profitPercentage: number
  isActive: boolean
}

/** Props for AHSPMasterDataForm component */
export interface AHSPMasterDataFormProps {
  /** Current form values */
  formData: MasterFormData
  /** Per-field validation errors */
  errors: Record<string, string>
  /** Field change handler */
  onChange: (field: string, value: unknown) => void
  /** Whether a submit is in flight (disables inputs) */
  isSubmitting: boolean
  /** The item being edited (null for new item) */
  item?: AHSPItem | null
  /** Creation mode (controls SNI selector visibility) */
  mode?: AHSPCreationMode
  /** Current approval status (shown when editing an existing item) */
  status?: AHSPStatus
  /** Callback to change the approval status */
  onStatusChange?: (newStatus: AHSPStatus) => void
  /** Whether the form is in edit mode (enables status transitions) */
  isEdit?: boolean

  /** Main category list */
  mainCategories: WorkCategory[]
  /** Selected category id (local hierarchy state) */
  selectedCategory: string
  /** Selected category id setter */
  setSelectedCategory: (value: string) => void
  /** Selected subcategory id (local hierarchy state) */
  selectedSubcategory: string
  /** Selected subcategory id setter */
  setSelectedSubcategory: (value: string) => void
  /** Auto-generate the next AHSP code for a given category/sub code prefix */
  nextAhspCode: (prefixCode: string) => string

  /** SNI templates available for the picker */
  sniAHSPItems: AHSPItem[]
  /** Whether the SNI picker popover is open */
  sniPickerOpen: boolean
  /** SNI picker open-state setter */
  setSniPickerOpen: (open: boolean) => void
  /** Currently selected SNI preset id */
  selectedSNIPreset: string | null
  /** Apply a chosen SNI item */
  onSelectSNIPreset: (preset: AHSPItem) => void
  /** Count of components currently copied (for the SNI success badge) */
  componentsCount: number
}

/**
 * AHSPMasterDataForm Component — Step 1 master data form.
 */
export function AHSPMasterDataForm({
  formData,
  errors,
  onChange,
  isSubmitting,
  item,
  mode,
  status,
  onStatusChange,
  isEdit,
  mainCategories,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory,
  setSelectedSubcategory,
  nextAhspCode,
  sniAHSPItems,
  sniPickerOpen,
  setSniPickerOpen,
  selectedSNIPreset,
  onSelectSNIPreset,
  componentsCount,
}: AHSPMasterDataFormProps) {
  return (
    <div className="border-b border-border bg-background p-4 sm:p-5 space-y-5 lg:col-[1]">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="bg-blue-500/10 p-2 rounded-xl ring-1 ring-blue-500/20">
          <Database className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Master Data</h3>
          <p className="text-xs text-muted-foreground font-medium">Identifikasi umum dan kategorisasi</p>
        </div>
        {status && (
          <AHSPStatusBadge
            status={status}
            onStatusChange={onStatusChange}
            readonly={!isEdit}
          />
        )}
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
            <SNIPresetPicker
              open={sniPickerOpen}
              onOpenChange={setSniPickerOpen}
              presets={sniAHSPItems}
              selectedPresetId={selectedSNIPreset}
              onSelect={onSelectSNIPreset}
              componentsCount={componentsCount}
            />
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
                onChange={(e) => onChange('code', e.target.value)}
                placeholder="dari kategori / sub-kategori"
                className={`h-9 text-sm font-mono font-bold rounded-lg border-border transition-all focus:ring-2 focus:ring-primary/10 ${errors.code ? 'border-red-500 bg-red-50' : 'bg-background'}`}
                disabled={isSubmitting}
              />
              {errors.code && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.code}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pl-1">Satuan</Label>
              <Select value={formData.unit || undefined} onValueChange={(value: string) => onChange('unit', value)}>
                <SelectTrigger className={`h-9 rounded-lg border-border bg-background text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/10 ${errors.unit ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Pilih satuan..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-xl">
                  <SelectItem value="m3" className="font-semibold py-2">m³ (Kubik)</SelectItem>
                  <SelectItem value="m2" className="font-semibold py-2">m² (Luas)</SelectItem>
                  <SelectItem value="m" className="font-semibold py-2">m (Meter Lari)</SelectItem>
                  <SelectItem value="m'" className="font-semibold py-2">{"m' (Meter Panjang)"}</SelectItem>
                  <SelectItem value="kg" className="font-semibold py-2">kg (Berat)</SelectItem>
                  <SelectItem value="ltr" className="font-semibold py-2">liter</SelectItem>
                  <SelectItem value="bh" className="font-semibold py-2">buah (Item)</SelectItem>
                  <SelectItem value="oh" className="font-semibold py-2">OH (Labor)</SelectItem>
                  <SelectItem value="jam" className="font-semibold py-2">jam (Tool)</SelectItem>
                  <SelectItem value="hr" className="font-semibold py-2">hari (hr)</SelectItem>
                  <SelectItem value="hari" className="font-semibold py-2">hari</SelectItem>
                  <SelectItem value="ha" className="font-semibold py-2">ha (Hektar)</SelectItem>
                  <SelectItem value="set" className="font-semibold py-2">set</SelectItem>
                  <SelectItem value="ls" className="font-semibold py-2">ls (Lumpsum)</SelectItem>
                  <SelectItem value="btg" className="font-semibold py-2">btg (Batang)</SelectItem>
                  <SelectItem value="lembar" className="font-semibold py-2">lembar</SelectItem>
                  <SelectItem value="unit" className="font-semibold py-2">unit</SelectItem>
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-xs text-red-500 font-bold mt-1 pl-1">{errors.unit}</p>}
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
                    onChange('category', category.name)
                    // If this category has no sub-classifications, auto-number from the
                    // category code now; otherwise wait for the sub-classification pick.
                    if (getSubcategories(value).length === 0) {
                      onChange('code', nextAhspCode(category.code))
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
                      onChange('category', path.map(p => p.name).join(' > '))
                      // Auto-number the AHSP code from the sub-classification code.
                      onChange('code', nextAhspCode(subcat.code))
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
              onChange={(e) => onChange('name', e.target.value)}
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
              onChange={(e) => onChange('description', e.target.value)}
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
                onChange={(e) => onChange('overheadPercentage', parseFloat(e.target.value) || 0)}
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
                onChange={(e) => onChange('profitPercentage', parseFloat(e.target.value) || 0)}
                className="h-10 pl-4 pr-10 text-xl font-mono font-semibold text-emerald-700 rounded-lg border-border bg-background"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-400">%</span>
            </div>
            <p className="text-xs text-emerald-400 leading-tight font-medium uppercase tracking-wider">Margin keuntungan bersih untuk keseluruhan item AHSP</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AHSPMasterDataForm
