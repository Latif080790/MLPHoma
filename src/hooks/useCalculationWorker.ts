/**
 * useCalculationWorker.ts
 *
 * React hook that manages the lifecycle of the Calculation Web Worker.
 * Provides a promise-based API for dispatching calculations off the main thread.
 *
 * Usage:
 *   const { postCalculation, isReady } = useCalculationWorker()
 *   const result = await postCalculation('calculateAHSPPrice', { components, overheadPercent, profitPercent })
 */

import { useRef, useEffect, useCallback, useState } from 'react'

type CalcType = 'calculateAHSPPrice' | 'calculatePareto' | 'recalculateAll' | 'calculateRABTotals'

interface PendingRequest {
    resolve: (value: any) => void
    reject: (reason: any) => void
}

let _sharedWorker: Worker | null = null
let _refCount = 0
const _pendingRequests = new Map<string, PendingRequest>()
let _requestId = 0

function getSharedWorker(): Worker {
    if (!_sharedWorker) {
        _sharedWorker = new Worker(
            new URL('../workers/calculationWorker.ts', import.meta.url),
            { type: 'module' }
        )
        _sharedWorker.onmessage = (ev: MessageEvent) => {
            const { id, result, error } = ev.data
            const pending = _pendingRequests.get(id)
            if (pending) {
                _pendingRequests.delete(id)
                if (error) {
                    pending.reject(new Error(error))
                } else {
                    pending.resolve(result)
                }
            }
        }
        _sharedWorker.onerror = (err) => {
            console.error('[CalculationWorker] Error:', err)
        }
    }
    _refCount++
    return _sharedWorker
}

function releaseSharedWorker() {
    _refCount--
    if (_refCount <= 0 && _sharedWorker) {
        _sharedWorker.terminate()
        _sharedWorker = null
        _refCount = 0
        // Reject any remaining pending requests
        _pendingRequests.forEach((pending) => {
            pending.reject(new Error('Worker terminated'))
        })
        _pendingRequests.clear()
    }
}

export function useCalculationWorker() {
    const workerRef = useRef<Worker | null>(null)
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        workerRef.current = getSharedWorker()
        setIsReady(true)

        return () => {
            releaseSharedWorker()
            workerRef.current = null
            setIsReady(false)
        }
    }, [])

    const postCalculation = useCallback(
        <T = any>(type: CalcType, payload: any): Promise<T> => {
            return new Promise<T>((resolve, reject) => {
                if (!workerRef.current) {
                    reject(new Error('Worker not ready'))
                    return
                }

                const id = `calc-${++_requestId}`
                _pendingRequests.set(id, { resolve, reject })
                workerRef.current.postMessage({ id, type, payload })
            })
        },
        []
    )

    return { postCalculation, isReady }
}

/**
 * Standalone function for non-hook contexts (e.g., inside Zustand stores).
 * Creates a temporary worker, runs the calculation, and terminates.
 */
export async function runCalculation<T = any>(type: CalcType, payload: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const worker = new Worker(
            new URL('../workers/calculationWorker.ts', import.meta.url),
            { type: 'module' }
        )

        const id = `standalone-${++_requestId}`
        const timeout = setTimeout(() => {
            worker.terminate()
            reject(new Error('Calculation timed out'))
        }, 30000)

        worker.onmessage = (ev: MessageEvent) => {
            clearTimeout(timeout)
            worker.terminate()
            const { result, error } = ev.data
            if (error) {
                reject(new Error(error))
            } else {
                resolve(result)
            }
        }

        worker.onerror = (err) => {
            clearTimeout(timeout)
            worker.terminate()
            reject(err)
        }

        worker.postMessage({ id, type, payload })
    })
}
