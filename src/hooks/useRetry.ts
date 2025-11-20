/**
 * Retry Hook
 * 
 * React hook for managing retry logic with UI state.
 * Provides manual and automatic retry with loading states.
 * 
 * @module useRetry
 */

import { useState, useCallback, useRef } from 'react'
import { retryAsync, type RetryOptions } from '@/lib/retryUtils'

export interface UseRetryOptions extends RetryOptions {
  showRetryButton?: boolean
  retryMessage?: string
}

/**
 * Hook for retry functionality
 */
export function useRetry<T>(
  asyncFn: () => Promise<T>,
  options: UseRetryOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<T | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const attemptRef = useRef(0)

  const {
    maxRetries = 3,
    initialDelay = 1000,
    showRetryButton = true,
    retryMessage = 'Mencoba ulang...',
    ...retryOptions
  } = options

  /**
   * Execute with automatic retry
   */
  const execute = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    attemptRef.current = 0

    try {
      const result = await retryAsync(asyncFn, {
        ...retryOptions,
        maxRetries,
        initialDelay,
        onRetry: (err, attempt, delay) => {
          setIsRetrying(true)
          attemptRef.current = attempt
          setRetryCount(attempt)
          retryOptions.onRetry?.(err, attempt, delay)
        },
      })

      setData(result)
      setIsRetrying(false)
      setRetryCount(0)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setIsRetrying(false)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [asyncFn, maxRetries, initialDelay, retryOptions])

  /**
   * Manual retry
   */
  const retry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setError(new Error('Maksimum percobaan tercapai'))
      return null
    }

    return execute()
  }, [execute, retryCount, maxRetries])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setIsRetrying(false)
    setError(null)
    setData(null)
    setRetryCount(0)
    attemptRef.current = 0
  }, [])

  const canRetry = retryCount < maxRetries && !isLoading

  return {
    data,
    error,
    isLoading,
    isRetrying,
    retryCount,
    canRetry,
    execute,
    retry,
    reset,
    maxRetries,
  }
}

/**
 * Hook for multiple retry operations
 */
export function useMultipleRetry() {
  const [operations, setOperations] = useState<
    Record<
      string,
      {
        isLoading: boolean
        isRetrying: boolean
        error: Error | null
        retryCount: number
      }
    >
  >({})

  const execute = useCallback(
    async <T,>(
      key: string,
      asyncFn: () => Promise<T>,
      options: RetryOptions = {}
    ): Promise<T | null> => {
      setOperations((prev) => ({
        ...prev,
        [key]: { isLoading: true, isRetrying: false, error: null, retryCount: 0 },
      }))

      try {
        const result = await retryAsync(asyncFn, {
          ...options,
          onRetry: (err, attempt, delay) => {
            setOperations((prev) => ({
              ...prev,
              [key]: { ...prev[key], isRetrying: true, retryCount: attempt },
            }))
            options.onRetry?.(err, attempt, delay)
          },
        })

        setOperations((prev) => ({
          ...prev,
          [key]: { isLoading: false, isRetrying: false, error: null, retryCount: 0 },
        }))

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))

        setOperations((prev) => ({
          ...prev,
          [key]: { ...prev[key], isLoading: false, isRetrying: false, error },
        }))

        return null
      }
    },
    []
  )

  const reset = useCallback((key?: string) => {
    if (key) {
      setOperations((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      setOperations({})
    }
  }, [])

  return {
    operations,
    execute,
    reset,
    getOperation: (key: string) =>
      operations[key] || { isLoading: false, isRetrying: false, error: null, retryCount: 0 },
  }
}

/**
 * Hook for API retry with cache
 */
export function useApiRetry<T>(
  url: string | null,
  options: UseRetryOptions & { cacheTime?: number } = {}
) {
  const cacheRef = useRef<{ data: T; timestamp: number } | null>(null)
  const { cacheTime = 60000, ...retryOptions } = options

  const fetchData = useCallback(async () => {
    if (!url) throw new Error('URL is required')

    // Check cache
    if (cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp
      if (age < cacheTime) {
        return cacheRef.current.data
      }
    }

    const response = await fetch(url)
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}`)
      error.status = response.status
      throw error
    }

    const data = await response.json()

    // Update cache
    cacheRef.current = { data, timestamp: Date.now() }

    return data
  }, [url, cacheTime])

  const retryState = useRetry(fetchData, retryOptions)

  const clearCache = useCallback(() => {
    cacheRef.current = null
  }, [])

  return {
    ...retryState,
    clearCache,
  }
}
