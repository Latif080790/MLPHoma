
/**
 * WBSEditor.tsx
 * Modal editor for creating and editing WBS items
 */

import React, { useState, useEffect } from 'react'
import { Save, RotateCcw, GitBranch, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import type { WBSItem } from '../../types/wbs'

/** Props for WBSEditor component */
export interface WBSEditorProps {
  /** Current item being edited (null for new item) */
  item?: WBSItem | null
  /** Parent ID for new items */
  parentId?: string | null
  /** Whether dialog is open */
  open: boolean
  /** Dialog close handler */
  onClose: () => void
  /** Save handler */
  onSave: (item: Omit<WBSItem, 'id' | 'createdAt' | 'updatedAt'>, keepOpen?: boolean) => void
  /** All existing items for validation */
  existingItems?: WBSItem[]
  /** Project ID */
  projectId?: string
}

/**
 * WBSEditor Component
 */
export function WBSEditor({
  item,
  parentId = null,
  open,
  onClose,
  onSave,
  existingItems = [],
  projectId = '',
}: WBSEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    level: 1,
    parentId: parentId,
    sortOrder: 0,
    projectId: projectId,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addAnother, setAddAnother] = useState(false)

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        code: item.code || '',
        level: item.level || 1,
        parentId: item.parentId || null,
        sortOrder: item.sortOrder || 0,
        projectId: item.projectId || projectId,
      })
    } else {
      // New item
      setFormData({
        name: '',
        description: '',
        code: '',
        level: 1,
        parentId: parentId,
        sortOrder: existingItems.length,
        projectId: projectId,
      })
    }
    setErrors({})
  }, [item, parentId, existingItems.length, projectId])

  // Calculate level based on parent
  useEffect(() => {
    if (parentId && !item) {
      const parent = existingItems.find(i => i.id === parentId)
      const newLevel = parent ? parent.level + 1 : 1
      setFormData(prev => ({ ...prev, level: newLevel }))
    }
  }, [parentId, existingItems, item])

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name must be less than 200 characters'
    }

    // Description validation
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters'
    }

    // Code validation (if manually entered)
    if (formData.code && !/^[0-9.]+$/.test(formData.code)) {
      newErrors.code = 'Code must contain only numbers and dots'
    }

    // Check for duplicate names at same level
    const sameLevelItems = existingItems.filter(
      i => i.parentId === formData.parentId && i.id !== item?.id
    )
    if (sameLevelItems.some(i => i.name.toLowerCase() === formData.name.toLowerCase())) {
      newErrors.name = 'An item with this name already exists at this level'
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
      const keepOpen = addAnother && !item
      await onSave(formData, keepOpen)
      if (!keepOpen) {
        onClose()
      } else {
        // Reset form for next entry
        toast.success('Item WBS ditambahkan', { description: formData.name })
        setFormData(prev => ({
          ...prev,
          name: '',
          description: '',
          code: '',
        }))
      }
    } catch (error) {
      toast.error('Failed to save WBS item', { description: (error as Error).message })
      setErrors({ submit: 'Failed to save item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle input changes
   */
  const handleChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const parentItem = formData.parentId ? existingItems.find(i => i.id === formData.parentId) : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch size={16} className="text-blue-500" />
            {item ? 'Edit WBS Item' : 'Tambah WBS Item'}
          </DialogTitle>
          <DialogDescription>
            {parentItem
              ? `Child dari: ${parentItem.code ? `[${parentItem.code}] ` : ''}${parentItem.name}`
              : 'Item baru di level root'}
          </DialogDescription>
        </DialogHeader>

        {/* Hierarchy context strip */}
        <div className="flex items-center gap-2 -mt-1 px-1">
          {item?.code && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono text-xs font-bold text-blue-700 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-400">
              {item.code}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/50 border border-border text-xs font-medium text-muted-foreground">
            <Layers size={10} />
            Level {formData.level}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nama Item <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Contoh: Pekerjaan Pondasi"
              className={errors.name ? 'border-red-500 focus-visible:ring-red-400' : ''}
              disabled={isSubmitting}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deskripsi
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Opsional — deskripsi singkat item ini"
              rows={2}
              className={errors.description ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Error message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Add another toggle (only for new items) */}
          {!item && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="addAnother"
                checked={addAnother}
                onCheckedChange={(checked) => setAddAnother(!!checked)}
              />
              <label htmlFor="addAnother" className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                <RotateCcw size={12} className="text-muted-foreground" />
                Tambah lagi setelah simpan
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save size={14} />
                  {item ? 'Update' : addAnother ? 'Tambah & Lanjut' : 'Tambah'}
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WBSEditor
