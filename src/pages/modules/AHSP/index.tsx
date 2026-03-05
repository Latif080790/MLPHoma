import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAHSPStore } from '@/store/ahspStore'
import { AHSPHeader } from '@/components/ahsp/AHSPHeader'
import { AHSPStatsBar } from '@/components/ahsp/AHSPStatsBar'
import { AHSPItemsTab } from '@/components/ahsp/AHSPItemsTab'
import { DKHManager } from '@/components/dkh/DKHManager'
import { BenchmarkingDashboard } from '@/components/ahsp/analytics'
import { AHSPSettings } from '@/components/ahsp/AHSPSettings'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

function AHSPContent() {
    const { fetchAHSPItems, fetchResources, ahspItems, errors } = useAHSPStore()

    // Track whether we've finished our initial load attempt
    // Using local state (not store loading flags) to avoid the brief false-empty flash.
    const [initStatus, setInitStatus] = useState<'loading' | 'done' | 'error'>('loading')

    const loadData = useCallback(async () => {
        setInitStatus('loading')
        try {
            // Run both fetches in parallel; resource errors are non-fatal
            await Promise.allSettled([fetchAHSPItems(), fetchResources()])
            // Check if the critical fetch (AHSP items) succeeded
            const currentState = useAHSPStore.getState()
            if (currentState.errors.ahspItems) {
                console.error('[AHSP] fetch error:', currentState.errors.ahspItems)
                setInitStatus('error')
            } else {
                console.log('[AHSP] fetch done —', currentState.ahspItems.length, 'items,', currentState.resources.length, 'resources')
                setInitStatus('done')
            }
        } catch (err) {
            console.error('[AHSP] loadData exception:', err)
            setInitStatus('error')
        }
    }, [fetchAHSPItems, fetchResources])

    // Fetch once on every mount (component remounts each time the AHSP tab is activated)
    useEffect(() => {
        // If we already have data in store (e.g., switching tabs back), show immediately
        // and refresh silently in background without blocking the UI.
        const snapshot = useAHSPStore.getState()
        if (snapshot.ahspItems.length > 0) {
            setInitStatus('done')
            // Background refresh — don't await, don't block UI
            fetchAHSPItems().catch(console.error)
            fetchResources().catch(console.error)
        } else {
            // Cold start — show loading spinner until data arrives
            loadData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (initStatus === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Memuat data AHSP & DKH dari database…</p>
            </div>
        )
    }

    if (initStatus === 'error') {
        const errMsg = errors.ahspItems || 'Koneksi database gagal'
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <div>
                    <p className="font-semibold text-destructive">Gagal Memuat Data AHSP</p>
                    <p className="mt-1 text-sm text-muted-foreground">{errMsg}</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
                    <RefreshCw size={14} />
                    Coba Lagi
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4 density-compact">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <AHSPStatsBar />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Sinkronisasi ulang data AHSP dari database"
                    onClick={loadData}
                >
                    <RefreshCw size={15} />
                </Button>
            </div>

            <Tabs defaultValue="items" className="space-y-3">
                <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto bg-slate-50/70 p-1 dark:bg-slate-950/40">
                    <TabsTrigger value="items">AHSP Items</TabsTrigger>
                    <TabsTrigger value="resources">DKH Resources</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-3 mt-0">
                    <AHSPItemsTab />
                </TabsContent>

                <TabsContent value="resources" className="space-y-3 mt-0">
                    {errors.resources && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                            <span className="font-semibold">Koneksi Database Gagal (DKH): </span>{errors.resources}
                            <button
                                className="ml-3 underline hover:no-underline"
                                onClick={() => fetchResources().catch(console.error)}
                            >
                                Coba lagi
                            </button>
                        </div>
                    )}
                    <DKHManager />
                </TabsContent>

                <TabsContent value="analytics" className="space-y-3 mt-0">
                    <BenchmarkingDashboard />
                </TabsContent>

                <TabsContent value="settings" className="space-y-3 mt-0">
                    <AHSPSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function AHSPPage() {
    return (
        <div className="space-y-4">
            <ErrorBoundary
                errorMessage="Failed to load AHSP module"
            >
                <AHSPHeader />
                <Suspense fallback={
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                }>
                    <AHSPContent />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
