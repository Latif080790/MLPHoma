import { useState, useCallback, useMemo } from 'react';

/**
 * useSelection — Multi-select hook for table/list selection state.
 * 
 * Based on: Frontend Implementation Guide v1 → Section 10
 * Supports:
 *   - Toggle individual items
 *   - Select all / deselect all
 *   - Selection count
 *   - Check if item is selected
 */

interface UseSelectionReturn<T extends string = string> {
  /** Set of selected IDs */
  selectedIds: Set<T>;
  /** Number of selected items */
  selectedCount: number;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Check if a specific item is selected */
  isSelected: (id: T) => boolean;
  /** Toggle selection for an item */
  toggle: (id: T) => void;
  /** Select specific items */
  select: (ids: T[]) => void;
  /** Deselect specific items */
  deselect: (ids: T[]) => void;
  /** Select all from a list */
  selectAll: (allIds: T[]) => void;
  /** Clear all selections */
  clearAll: () => void;
  /** Get selected as array */
  selectedArray: T[];
}

export function useSelection<T extends string = string>(): UseSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((ids: T[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselect = useCallback((ids: T[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const selectAll = useCallback((allIds: T[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: T) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    clearAll,
    selectedArray,
  };
}

export default useSelection;
