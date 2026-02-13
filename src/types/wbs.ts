
/**
 * wbs.ts
 * Type definitions for Work Breakdown Structure
 */

/** WBS Item with hierarchical structure */
export interface WBSItem {
  /** Unique identifier */
  id: string
  /** WBS code (e.g., "1", "1.1", "1.1.1") */
  code: string
  /** WBS name/description */
  name: string
  /** Hierarchy level (1 = root level) */
  level: number
  /** Parent ID for hierarchy */
  parentId: string | null
  /** Sort order within siblings */
  sortOrder: number
  /** Associated project ID */
  projectId: string
  /** Optional description */
  description?: string
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
  /** Children items (computed) */
  children?: WBSItem[]
  /** Whether item is expanded in UI */
  isExpanded?: boolean
  /** Whether item is being dragged */
  isDragging?: boolean
  /** Whether item is drop target */
  isDropTarget?: boolean
  /** Quality Control Status */
  qc_status?: 'PENDING' | 'PASSED' | 'FAILED' | 'NOT_REQUIRED'
  /** Progress percentage (0-100) */
  progress?: number
}

/** WBS Tree State */
export interface WBSTreeState {
  /** All WBS items indexed by project */
  itemsByProject: Record<string, WBSItem[]>
  /** Selected item ID */
  selectedId: string | null
  /** Expanded item IDs */
  expandedIds: Set<string>
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
}

/** WBS Actions */
export interface WBSActions {
  /** Add new WBS item */
  addItem: (projectId: string, item: Omit<WBSItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** Update WBS item */
  updateItem: (projectId: string, id: string, updates: Partial<WBSItem>) => void
  /** Delete WBS item (and children) */
  deleteItem: (projectId: string, id: string) => void
  /** Move item (drag & drop) */
  moveItem: (projectId: string, itemId: string, newParentId: string | null, newIndex: number) => void
  /** Toggle item expansion */
  toggleExpanded: (id: string) => void
  /** Select item */
  selectItem: (id: string | null) => void
  /** Reorder items within parent */
  reorderItems: (projectId: string, parentId: string | null, itemIds: string[]) => void
  /** Generate WBS codes */
  generateCodes: (projectId: string) => void
  /** Import WBS structure */
  importWBS: (projectId: string, items: Omit<WBSItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]) => void
  /** Export WBS structure */
  exportWBS: (projectId: string) => WBSItem[]
  /** Find all descendants of an item (recursive) */
  findDescendants: (projectId: string, itemId: string) => WBSItem[]
  /** Clear project WBS */
  clearProject: (projectId: string) => void
}

/** WBS Store Interface */
export interface WBSStore extends WBSTreeState, WBSActions { }

/** WBS Validation Result */
export interface WBSValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/** WBS Import Template */
export interface WBSImportTemplate {
  code: string
  name: string
  description?: string
  level?: number
  parentCode?: string
}
