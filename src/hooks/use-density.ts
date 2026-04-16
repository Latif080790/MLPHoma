import { useState, useCallback, useMemo } from 'react';

/**
 * useDensity — Shared hook for table/grid density preference.
 * 
 * Based on: Design System Rules v1 → Section 5.1
 * Persists preference per user per module via localStorage.
 * 
 * Density modes map to row height tokens:
 *   - compact: 36px (var(--size-row-compact))
 *   - default: 44px (var(--size-row-default))
 *   - comfortable: 52px (var(--size-row-comfortable))
 */

export type DensityMode = 'compact' | 'default' | 'comfortable';

interface UseDensityOptions {
  /** Module key for storage persistence */
  moduleKey?: string;
  /** Default density */
  defaultDensity?: DensityMode;
}

interface UseDensityReturn {
  /** Current density */
  density: DensityMode;
  /** Set density */
  setDensity: (d: DensityMode) => void;
  /** Row height in px */
  rowHeight: number;
  /** CSS class for density */
  densityClass: string;
  /** Font size class */
  fontSizeClass: string;
}

const ROW_HEIGHTS: Record<DensityMode, number> = {
  compact: 36,
  default: 44,
  comfortable: 52,
};

const DENSITY_CLASSES: Record<DensityMode, string> = {
  compact: 'density-compact',
  default: '',
  comfortable: 'density-comfortable',
};

const FONT_SIZE_CLASSES: Record<DensityMode, string> = {
  compact: 'text-[var(--font-size-12)]',
  default: 'text-[var(--font-size-13)]',
  comfortable: 'text-[var(--font-size-14)]',
};

function getStorageKey(moduleKey?: string): string {
  return `mlphoma-density${moduleKey ? `-${moduleKey}` : ''}`;
}

export function useDensity(options: UseDensityOptions = {}): UseDensityReturn {
  const { moduleKey, defaultDensity = 'default' } = options;
  
  const [density, setDensityState] = useState<DensityMode>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(moduleKey));
      if (stored && ['compact', 'default', 'comfortable'].includes(stored)) {
        return stored as DensityMode;
      }
    } catch {
      // ignore
    }
    return defaultDensity;
  });

  const setDensity = useCallback((d: DensityMode) => {
    setDensityState(d);
    try {
      localStorage.setItem(getStorageKey(moduleKey), d);
    } catch {
      // ignore
    }
  }, [moduleKey]);

  return useMemo(() => ({
    density,
    setDensity,
    rowHeight: ROW_HEIGHTS[density],
    densityClass: DENSITY_CLASSES[density],
    fontSizeClass: FONT_SIZE_CLASSES[density],
  }), [density, setDensity]);
}

export default useDensity;
