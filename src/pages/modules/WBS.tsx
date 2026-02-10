
/**
 * WBS.tsx
 * Work Breakdown Structure management page with hierarchical tree view
 */

import React, { useState, useCallback } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useWBSStore, getWBSTree, validateWBS } from '../../store/wbsStore'
import { WBSTree } from '../../components/wbs/WBSTree'
import { WBSEditor } from '../../components/wbs/WBSEditor'
import { EmptyState } from '../../components/common/EmptyState'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Download, Upload, AlertTriangle, FileText, Plus } from 'lucide-react'
import type { WBSItem } from '../../types/wbs'

/**
 * WBS Page Component
 */
export default function WBS() {
  // Project context
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectName = activeProject?.name ?? '—'
  const projectId = activeProject?.id ?? ''

  // WBS state
  const {
    itemsByProject,
    selectedId,
    expandedIds,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    toggleExpanded,
    selectItem,
    generateCodes,
    importWBS,
    exportWBS,
  } = useWBSStore()

  const items = itemsByProject[projectId] || []
  const tree = getWBSTree(items)
  const validation = validateWBS(items)

  // Editor state
  const [editorItem, setEditorItem] = useState<WBSItem | null>(null)
  const [editorParentId, setEditorParentId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  /**
   * Handle adding new item
   */
  const handleAddItem = useCallback((parentId: string | null) => {
    setEditorItem(null)
    setEditorParentId(parentId)
    setShowEditor(true)
    setImportError(null)
  }, [])

  /**
   * Handle editing existing item
   */
  const handleEditItem = useCallback((item: WBSItem) => {
    setEditorItem(item)
    setEditorParentId(null)
    setShowEditor(true)
    setImportError(null)
  }, [])

  /**
   * Handle deleting item
   */
  const handleDeleteItem = useCallback((item: WBSItem) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}" and all its children?`)) {
      deleteItem(projectId, item.id)
    }
  }, [projectId, deleteItem])

  /**
   * Handle saving editor
   */
  const handleSaveEditor = useCallback(async (data: Omit<WBSItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editorItem) {
        // Update existing item
        updateItem(projectId, editorItem.id, data)
      } else {
        // Add new item
        addItem(projectId, data)
        
        // Auto-expand parent to show new item
        if (data.parentId) {
          toggleExpanded(data.parentId)
        }
      }
      
      // Generate codes to ensure consistency
      generateCodes(projectId)
    } catch (error) {
      console.error('Failed to save WBS item:', error)
      throw error
    }
  }, [editorItem, projectId, addItem, updateItem, generateCodes, toggleExpanded])

  /**
   * Handle moving items
   */
  const handleMoveItem = useCallback((itemId: string, newParentId: string | null, index: number) => {
    moveItem(projectId, itemId, newParentId, index)
    generateCodes(projectId)
  }, [projectId, moveItem, generateCodes])

  /**
   * Handle export
   */
  const handleExport = useCallback(() => {
    try {
      const data = exportWBS(projectId)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wbs-${projectId}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export WBS:', error)
      setImportError('Failed to export WBS data')
    }
  }, [projectId, exportWBS])

  /**
   * Handle import
   */
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as WBSItem[]
        
        // Validate imported data
        if (!Array.isArray(data)) {
          throw new Error('Invalid file format')
        }

        // Map to import format
        const importData = data.map(item => ({
          code: item.code,
          name: item.name,
          description: item.description,
          level: item.level,
          parentId: item.parentId,
          sortOrder: item.sortOrder || 0,
        }))

        importWBS(projectId, importData)
        generateCodes(projectId)
        setImportError(null)
      } catch (error) {
        console.error('Failed to import WBS:', error)
        setImportError('Failed to import WBS data. Please check the file format.')
      }
    }
    reader.readAsText(file)

    // Reset file input
    event.target.value = ''
  }, [projectId, importWBS, generateCodes])

  // No project selected
  if (!projectId) {
    return (
      <AppShell>
        <ModuleHeader
          icon={<FileText size={18} />}
          title="WBS"
          description="Work Breakdown Structure management"
        />
        <EmptyState
          title="No Project Selected"
          description="Please select a project to manage its WBS structure."
          imageKeyword="work breakdown structure"
        />
      </AppShell>
    )
  }

  return (
    <AppShell projectName={projectName}>
      <ModuleHeader
        icon={<FileText size={18} />}
        title="WBS"
        description="Work Breakdown Structure with hierarchical management"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent"
              onClick={handleExport}
              disabled={!items.length}
            >
              <Download size={16} className="mr-2" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent"
              onClick={() => document.getElementById('wbs-import')?.click()}
              asChild
            >
              <label className="cursor-pointer">
                <Upload size={16} className="mr-2" />
                Import
                <input
                  id="wbs-import"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </Button>

            <Button
              size="sm"
              onClick={() => handleAddItem(null)}
            >
              <Plus size={16} className="mr-2" />
              Add Root Item
            </Button>
          </div>
        }
      />

      {/* Error messages */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {importError && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {importError}
          </AlertDescription>
        </Alert>
      )}

      {/* Validation errors */}
      {!validation.isValid && (
        <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {validation.errors.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* WBS Tree */}
      <div className="rounded-xl border bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="p-4 border-b dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">WBS Structure</h3>
            <div className="text-sm text-neutral-500">
              {items.length} items • {tree.length} root items
            </div>
          </div>
        </div>

        <WBSTree
          items={items}
          selectedId={selectedId}
          expandedIds={expandedIds}
          loading={loading}
          onItemClick={(item) => selectItem(item.id)}
          onToggleExpand={toggleExpanded}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
          maxNestingLevel={8}
        />
      </div>

      {/* WBS Editor Modal */}
      <WBSEditor
        item={editorItem}
        parentId={editorParentId}
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSaveEditor}
        existingItems={items}
        projectId={projectId}
      />
    </AppShell>
  )
}
