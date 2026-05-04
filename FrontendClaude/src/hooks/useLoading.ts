/**
 * Loading State Management Hook
 * 
 * Manages loading states for async operations with support for:
 * - Multiple concurrent operations
 * - Minimum display time
 * - Error tracking
 * - Progress tracking
 * 
 * @module useLoading
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface LoadingState {
  isLoading: boolean
  error: Error | null
  progress?: number
}

export interface UseLoadingOptions {
  minDisplayTime?: number // Minimum time to show loading state (ms)
  onError?: (error: Error) => void
  onSuccess?: () => void
}

/**
 * Hook for managing loading states
 */
export function useLoading(initialState = false, options: UseLoadingOptions = {}) {
  const [isLoading, setIsLoading] = useState(initialState)
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const startTimeRef = useRef<number | null>(null)
  const minDisplayTime = options.minDisplayTime || 0

  /**
   * Start loading
   */
  const startLoading = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setProgress(0)
    startTimeRef.current = Date.now()
  }, [])

  /**
   * Stop loading with minimum display time
   */
  const stopLoading = useCallback(async () => {
    if (minDisplayTime > 0 && startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = minDisplayTime - elapsed

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }
    }

    setIsLoading(false)
    startTimeRef.current = null
  }, [minDisplayTime])

  /**
   * Set error and stop loading
   */
  const setLoadingError = useCallback(
    (err: Error) => {
      setError(err)
      stopLoading()
      options.onError?.(err)
    },
    [stopLoading, options]
  )

  /**
   * Wrap async function with loading state
   */
  const withLoading = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T | null> => {
      try {
        startLoading()
        const result = await asyncFn()
        await stopLoading()
        options.onSuccess?.()
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setLoadingError(error)
        return null
      }
    },
    [startLoading, stopLoading, setLoadingError, options]
  )

  /**
   * Update progress (0-100)
   */
  const updateProgress = useCallback((value: number) => {
    setProgress(Math.min(100, Math.max(0, value)))
  }, [])

  /**
   * Reset loading state
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setProgress(0)
    startTimeRef.current = null
  }, [])

  return {
    isLoading,
    error,
    progress,
    startLoading,
    stopLoading,
    setError: setLoadingError,
    withLoading,
    updateProgress,
    reset,
  }
}

/**
 * Hook for managing multiple loading states
 */
export function useMultipleLoading() {
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({})

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], isLoading: loading },
    }))
  }, [])

  const setError = useCallback((key: string, error: Error | null) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], error, isLoading: false },
    }))
  }, [])

  const setProgress = useCallback((key: string, progress: number) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], progress },
    }))
  }, [])

  const withLoading = useCallback(
    async <T,>(key: string, asyncFn: () => Promise<T>): Promise<T | null> => {
      try {
        setLoading(key, true)
        const result = await asyncFn()
        setLoading(key, false)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(key, error)
        return null
      }
    },
    [setLoading, setError]
  )

  const reset = useCallback((key?: string) => {
    if (key) {
      setLoadingStates((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      setLoadingStates({})
    }
  }, [])

  const isAnyLoading = Object.values(loadingStates).some((state) => state.isLoading)

  return {
    loadingStates,
    isAnyLoading,
    setLoading,
    setError,
    setProgress,
    withLoading,
    reset,
    getState: (key: string) => loadingStates[key] || { isLoading: false, error: null },
  }
}

/**
 * Hook for async operation with loading state
 */
export function useAsyncLoading<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseLoadingOptions = {}
) {
  const { isLoading, error, withLoading } = useLoading(false, options)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(async () => {
    const result = await withLoading(asyncFn)
    if (result !== null) {
      setData(result)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (deps.length > 0) {
      execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    data,
    isLoading,
    error,
    execute,
    refetch: execute,
  }
}
