
/**
 * WBSEditor.tsx
 * Modal editor for creating and editing WBS items
 */

import React, { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
        setFormData(prev => ({
          ...prev,
          name: '',
          description: '',
          code: '',
        }))
      }
    } catch (error) {
      console.error('Failed to save WBS item:', error)
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit WBS Item' : 'Add New WBS Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter WBS item name"
              className={errors.name ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Code field */}
          <div className="space-y-2">
            <Label htmlFor="code">WBS Code</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              placeholder="Auto-generated if empty"
              className={errors.code ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.code && (
              <p className="text-sm text-red-500">{errors.code}</p>
            )}
            <p className="text-xs text-neutral-500">
              Leave empty to auto-generate based on hierarchy
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter optional description"
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Parent info */}
          {formData.parentId && (
            <div className="space-y-2">
              <Label>Parent Item</Label>
              <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-sm">
                {(() => {
                  const parent = existingItems.find(i => i.id === formData.parentId)
                  return parent ? `${parent.code} - ${parent.name}` : 'Unknown'
                })()}
              </div>
            </div>
          )}

          {/* Level info */}
          <div className="space-y-2">
            <Label>Level</Label>
            <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-sm">
              Level {formData.level}
            </div>
          </div>

          {/* Error message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Add another checkbox (only for new items) */}
          {!item && (
            <label className="flex items-center gap-2 pt-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addAnother}
                onChange={e => setAddAnother(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <RotateCcw size={13} className="text-neutral-400" />
              Tambah lagi setelah simpan
            </label>
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
              disabled={isSubmitting}
              className="min-w-[80px]"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  {item ? 'Update' : addAnother ? 'Add & Continue' : 'Add'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WBSEditor
