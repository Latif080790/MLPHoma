/**
 * useAsyncState.ts
 *
 * Generic hook that wraps any promise-returning function and exposes a
 * structured async state object:  { status, data, error, isLoading,
 * isSuccess, isError, execute, reset }
 *
 * Complements AsyncBoundary (UI-03 / UI-04) — pass isLoading/error directly
 * from this hook into the boundary component.
 *
 * @example
 *   const { data, isLoading, error, execute } = useAsyncState(fetchProjects)
 *
 *   useEffect(() => { execute() }, [])
 *
 *   return (
 *     <AsyncBoundary isLoading={isLoading} error={error} isEmpty={!data?.length}>
 *       <ProjectList projects={data ?? []} />
 *     </AsyncBoundary>
 *   )
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T, F extends (...args: any[]) => Promise<T>> {
  /** Full lifecycle status */
  status: AsyncStatus
  /** Resolved data — null until a successful execution */
  data: T | null
  /** Serialised error message — null unless status === 'error' */
  error: string | null
  /** Convenience: status === 'loading' */
  isLoading: boolean
  /** Convenience: status === 'success' */
  isSuccess: boolean
  /** Convenience: status === 'error' */
  isError: boolean
  /**
   * Trigger the async function.  Accepts the same arguments as the wrapped
   * function — TypeScript will enforce the signature.
   */
  execute: (...args: Parameters<F>) => Promise<void>
  /** Reset to initial idle state (clears data and error) */
  reset: () => void
}

// ---------------------------------------------------------------------------
// Initial state factory (avoids object recreation on re-renders)
// ---------------------------------------------------------------------------

function makeInitial<T>(): Pick<AsyncState<T, never>, 'status' | 'data' | 'error' | 'isLoading' | 'isSuccess' | 'isError'> {
  return {
    status: 'idle',
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useAsyncState
 *
 * @param fn  Any function that returns a Promise<T>.  The reference is
 *            captured via useCallback internally — wrap your fn in
 *            useCallback at the call-site if its identity changes often to
 *            avoid stale closures.
 */
export function useAsyncState<T, F extends (...args: any[]) => Promise<T>>(
  fn: F
): AsyncState<T, F> {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: Parameters<F>): Promise<void> => {
      setStatus('loading')
      setError(null)

      try {
        const result = await fn(...(args as Parameters<F>))
        setData(result)
        setStatus('success')
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : 'Terjadi kesalahan yang tidak diketahui'
        setError(message)
        setStatus('error')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setData(null)
    setError(null)
  }, [])

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    execute,
    reset,
  }
}

export default useAsyncState
