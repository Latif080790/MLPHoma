/**
 * cachedGetter.ts
 * Utility functions to create cached getters that return stable references.
 *
 * This file provides:
 *  - createCachedGetter: caches a derived value based on a single source reference.
 *  - createCachedGetterWithKey: caches derived values per key (useful for per-project stores).
 *
 * The goal is to avoid allocating new arrays/objects on every getter call so React/Zustand
 * subscriptions can rely on stable identity when the underlying source hasn't changed.
 */

/**
 * Create a cached getter that observes a source (by reference) and maps it to a result.
 *
 * @template TSource - type of the source input
 * @template TResult - type of the derived result
 * @param getSource - function that returns the source (by reference)
 * @param map - function that maps source -> result
 * @returns () => TResult - cached getter
 */
export function createCachedGetter<TSource, TResult>(
  getSource: () => TSource,
  map: (src: TSource) => TResult
) {
  let lastSource: TSource | undefined = undefined
  let lastResult: TResult | undefined = undefined

  return function cached() {
    const src = getSource()
    if (src === lastSource && lastResult !== undefined) {
      return lastResult
    }
    lastSource = src
    lastResult = map(src)
    return lastResult
  }
}

/**
 * Create a cached getter keyed by an argument (e.g., projectId).
 * Keeps a tiny cache for the last key+source to return stable result references.
 *
 * @template TSource - type of source returned by getSourceForKey(key)
 * @template TResult - derived result type
 * @param getSourceForKey - (key?) => TSource
 * @param map - (source) => TResult
 * @returns (key?: string) => TResult
 */
export function createCachedGetterWithKey<TSource, TResult>(
  getSourceForKey: (key?: string) => TSource,
  map: (src: TSource) => TResult
) {
  let lastKey: string | undefined = undefined
  let lastSource: TSource | undefined = undefined
  let lastResult: TResult | undefined = undefined

  return function cachedForKey(key?: string) {
    const k = key ?? ''
    const src = getSourceForKey(k)
    // If key and source unchanged return previous
    if (k === lastKey && src === lastSource && lastResult !== undefined) {
      return lastResult
    }
    lastKey = k
    lastSource = src
    lastResult = map(src)
    return lastResult
  }
}

export default {
  createCachedGetter,
  createCachedGetterWithKey,
}