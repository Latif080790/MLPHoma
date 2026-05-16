/**
 * useDebounce.ts
 *
 * Delays propagating a rapidly-changing value until it stabilises.
 * Prevents expensive re-filters on every keystroke in search inputs.
 *
 * Usage:
 *   const debouncedQuery = useDebounce(searchQuery, 300)
 *   const filtered = useMemo(() => items.filter(i => i.name.includes(debouncedQuery)), [items, debouncedQuery])
 */

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
