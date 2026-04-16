import { useState, useCallback } from 'react';

/**
 * useInspector — Shared hook for inspector drawer state management.
 * 
 * Based on: Frontend Implementation Guide v1 → Section 11.2
 * Capabilities:
 *   - selected item tracking
 *   - open/close state
 *   - active tab preservation
 *   - selection replacement without close
 */

interface UseInspectorOptions<T> {
  /** Initial tab ID */
  defaultTab?: string;
}

interface UseInspectorReturn<T> {
  /** Currently selected item ID */
  selectedId: string | null;
  /** Currently selected item data */
  selectedItem: T | null;
  /** Whether the inspector is open */
  isOpen: boolean;
  /** Current active tab */
  activeTab: string;
  /** Open inspector with an item */
  open: (id: string, item: T) => void;
  /** Close inspector */
  close: () => void;
  /** Set active tab */
  setTab: (tabId: string) => void;
  /** Replace selection without closing */
  replaceSelection: (id: string, item: T) => void;
  /** Toggle inspector for an item */
  toggle: (id: string, item: T) => void;
}

export function useInspector<T = any>(
  options: UseInspectorOptions<T> = {}
): UseInspectorReturn<T> {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(options.defaultTab || 'details');

  const open = useCallback((id: string, item: T) => {
    setSelectedId(id);
    setSelectedItem(item);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Don't clear selection immediately — allows animation
    setTimeout(() => {
      setSelectedId(null);
      setSelectedItem(null);
    }, 200);
  }, []);

  const setTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const replaceSelection = useCallback((id: string, item: T) => {
    setSelectedId(id);
    setSelectedItem(item);
  }, []);

  const toggle = useCallback((id: string, item: T) => {
    if (isOpen && selectedId === id) {
      close();
    } else {
      open(id, item);
    }
  }, [isOpen, selectedId, close, open]);

  return {
    selectedId,
    selectedItem,
    isOpen,
    activeTab,
    open,
    close,
    setTab,
    replaceSelection,
    toggle,
  };
}

export default useInspector;
