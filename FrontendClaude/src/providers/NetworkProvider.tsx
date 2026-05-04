import React, { useEffect } from 'react'
import { useOfflineQueueStore } from '@/store/offlineQueueStore'
import { toast } from 'sonner'
import { Wifi, WifiOff } from 'lucide-react'

export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const syncQueue = useOfflineQueueStore(state => state.syncQueue)

    useEffect(() => {
        const handleOnline = () => {
            toast.success('Connection Restored', {
                description: 'You are back online.',
                icon: <Wifi className="text-green-500 h-4 w-4" />
            })
            // Wait a small moment to ensure network is truly stable before syncing
            setTimeout(() => {
                syncQueue()
            }, 3000)
        }

        const handleOffline = () => {
            toast.warning('Offline Mode Active', {
                description: 'Changes will be saved locally and synced later.',
                icon: <WifiOff className="text-amber-500 h-4 w-4" />
            })
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Attempt sync on initial mount if online
        if (navigator.onLine) {
            // Using requestIdleCallback or setTimeout to not block main thread on load
            setTimeout(() => {
                syncQueue()
            }, 5000)
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [syncQueue])

    return <>{children}</>
}
