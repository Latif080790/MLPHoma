/**
 * useObjectValues.ts
 * Hook utility to memoize Object.values(obj) so components receive a stable array
 * reference if the source object reference hasn't changed.
 *
 * Usage:
 *  const arr = useObjectValues(myObject)
 *
 * This is intentionally tiny: it relies on the object reference as the dependency.
 */

import React from 'react'

/**
 * useObjectValues
 * Return memoized array of object values.
 *
 * @template T - value type in the object
 * @param obj - Record<string, T> | undefined
 * @returns T[] - memoized array of values
 */
export function useObjectValues<T = any>(obj?: Record<string, T> | null): T[] {
  return React.useMemo(() => {
    if (!obj) return []
    return Object.values(obj)
  }, [obj])
}

export default useObjectValues