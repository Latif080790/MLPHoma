import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncProgressLog } from '@/lib/supabaseSyncService'
import { toast } from 'sonner'

export interface QueuedProgressLog {
    id: string
    projectId: string
    date: string
    actualProgress: number
    actualCost: number
    notes?: string
    photoUrl?: string
    gpsCoords?: { latitude: number; longitude: number } | null
    wbsId?: string
    timestamp: number
}

interface OfflineQueueState {
    queue: QueuedProgressLog[]
    isSyncing: boolean
    addLog: (log: Omit<QueuedProgressLog, 'id' | 'timestamp'>) => void
    removeLog: (id: string) => void
    syncQueue: () => Promise<void>
    clearQueue: () => void
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
    persist(
        (set, get) => ({
            queue: [],
            isSyncing: false,

            addLog: (logData) => {
                const newLog = {
                    ...logData,
                    id: Math.random().toString(36).substring(7),
                    timestamp: Date.now()
                }
                set((state) => ({ queue: [...state.queue, newLog] }))
                toast.warning('Offline Mode: Progress log queued locally.', {
                    description: 'It will sync automatically when connection is restored.'
                })
            },

            removeLog: (id) => {
                set((state) => ({ queue: state.queue.filter(q => q.id !== id) }))
            },

            syncQueue: async () => {
                const state = get()
                if (state.queue.length === 0 || state.isSyncing || !navigator.onLine) return

                set({ isSyncing: true })
                toast.info(`Syncing ${state.queue.length} offline progress logs...`)

                let successCount = 0
                const failedItems: QueuedProgressLog[] = []

                for (const item of state.queue) {
                    try {
                        // Re-attempt push to Supabase via our standard sync service
                        await syncProgressLog({
                            projectId: item.projectId,
                            date: item.date,
                            actualProgress: item.actualProgress,
                            actualCost: item.actualCost,
                            notes: item.notes,
                            photoUrl: item.photoUrl,
                            gpsCoords: item.gpsCoords,
                            wbsId: item.wbsId
                        })
                        successCount++
                    } catch (error) {
                        failedItems.push(item) // keep it in queue if it still fails
                    }
                }

                set({ queue: failedItems, isSyncing: false })

                if (successCount > 0) {
                    toast.success(`Successfully synced ${successCount} progress logs.`)
                }
                if (failedItems.length > 0) {
                    toast.error(`${failedItems.length} logs failed to sync.`)
                }
            },

            clearQueue: () => set({ queue: [] })
        }),
        {
            name: 'mlphoma-offline-queue', // unique name for localStorage
        }
    )
)
