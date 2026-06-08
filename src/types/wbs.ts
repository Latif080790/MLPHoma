
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
  /**
   * Origin of the current progress value.
   * 'timeline' = automatically propagated from linked Timeline task averages (A3).
   * 'manual'   = explicitly set by user via WBS editor or daily progress board.
   * Default: undefined (legacy nodes with no source tracking).
   */
  progressSource?: 'timeline' | 'manual'
  /**
   * When true, the A3 Timeline→WBS progress propagation is suppressed for this node.
   * Physical progress must be validated and entered manually (e.g., after QC inspection).
   * Does not prevent manual progress updates.
   */
  physicalProgressLocked?: boolean
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
  /**
   * Pending delete confirmation — set when user tries to delete a WBS node
   * that has linked Timeline tasks. UI should show AlertDialog before confirming.
   */
  pendingDeleteConfirmation: {
    projectId: string
    wbsId: string
    wbsCode: string
    affectedTaskNames: string[]
  } | null
  lastAction: WBSSnapshot | null
  activeFilter: KPIFilter
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
  /** Import WBS structure (async — clears existing DB rows first) */
  importWBS: (projectId: string, items: Omit<WBSItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]) => Promise<void>
  /** Export WBS structure */
  exportWBS: (projectId: string) => WBSItem[]
  /** Find all descendants of an item (recursive) */
  findDescendants: (projectId: string, itemId: string) => WBSItem[]
  /** Load WBS items from Supabase (replaces local state) */
  fetchItems: (projectId: string) => Promise<void>
  /** Clear project WBS */
  clearProject: (projectId: string) => void
  /** Confirm pending delete — executes the guarded deletion */
  confirmDelete: () => void
  /** Cancel pending delete — dismisses the confirmation dialog */
  cancelDelete: () => void
  undoLastAction: (projectId: string) => void
  setActiveFilter: (filter: KPIFilter) => void
}

/** WBS Store Interface */
export interface WBSStore extends WBSTreeState, WBSActions { }

/** Filter mode for KPI strip. null = show all. */
export type KPIFilter =
  | 'rab-unlinked'
  | 'timeline-linked'
  | 'qc-passed'
  | 'low-progress'
  | null

/** One visible row in the virtualized flat-list tree */
export interface WBSFlatRow {
  item: WBSItem
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  recursiveBudget: number
  weightedProgress: number
}

/** Undo snapshot — taken before a move or delete mutation */
export interface WBSSnapshot {
  items: WBSItem[]
  action: 'move' | 'delete'
  timestamp: number
}

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
