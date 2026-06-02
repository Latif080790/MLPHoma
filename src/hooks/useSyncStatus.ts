import { useEffect, useState } from 'react'
import { syncQueue } from '../lib/supabaseSyncService'

export interface SyncStatus {
  failedCount: number
  queueLength: number
  processing: boolean
}

/**
 * Reactive hook that tracks sync queue status.
 * Re-renders whenever failedCount or queue state changes.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => syncQueue.getStatus())

  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(() => {
      setStatus(syncQueue.getStatus())
    })
    // Sync initial state in case it changed between render and effect
    setStatus(syncQueue.getStatus())
    return unsubscribe
  }, [])

  return status
}
