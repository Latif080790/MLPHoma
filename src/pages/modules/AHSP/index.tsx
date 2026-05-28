import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { TableSkeleton } from '@/components/common/LoadingSkeleton'
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
import { toast } from 'sonner'

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
                toast.error('AHSP fetch failed', { description: String(currentState.errors.ahspItems) })
                setInitStatus('error')
            } else {
                setInitStatus('done')
            }
        } catch (err) {
            toast.error('Failed to load AHSP data', { description: (err as Error).message })
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
            fetchAHSPItems().catch(() => { /* background refresh — errors shown on next critical fetch */ })
            fetchResources().catch(() => { /* background refresh — errors shown on next critical fetch */ })
        } else {
            // Cold start — show loading spinner until data arrives
            loadData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (initStatus === 'loading') {
        return (
            <div style={{ minHeight: 420 }}>
                <TableSkeleton rows={8} columns={5} />
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
        <div className="flex flex-col gap-3 density-compact">
            {/* KPI Strip */}
            <AHSPStatsBar onRefresh={loadData} />

            {/* Tab bar — flat underline style */}
            <Tabs defaultValue="items" className="flex flex-col gap-0">
                <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-b border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950">
                    <TabsTrigger
                        value="items"
                        className="relative h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-700 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    >
                        AHSP Items
                        <span className="ml-1.5 font-mono text-xs opacity-60">{ahspItems.length}</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="resources"
                        className="relative h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-700 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    >
                        DKH Resources
                    </TabsTrigger>
                    <TabsTrigger
                        value="analytics"
                        className="relative h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-700 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    >
                        Analytics
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="relative h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-700 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    >
                        Settings
                    </TabsTrigger>
                    {/* Refresh sits flush to the right end of the tab bar */}
                    <div className="ml-auto flex items-center pr-2">
                        <button
                            onClick={loadData}
                            title="Sinkronisasi ulang data AHSP"
                            aria-label="Sinkronisasi ulang data AHSP"
                            className="flex items-center justify-center h-6 w-6 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <RefreshCw size={11} />
                        </button>
                    </div>
                </TabsList>

                <TabsContent value="items" className="mt-0">
                    <AHSPItemsTab />
                </TabsContent>

                <TabsContent value="resources" className="mt-3">
                    {errors.resources && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                            <span className="font-semibold">Koneksi Database Gagal (DKH): </span>{errors.resources}
                            <button
                                className="ml-3 underline hover:no-underline"
                                onClick={() => fetchResources().catch(() => {})}
                            >
                                Coba lagi
                            </button>
                        </div>
                    )}
                    <DKHManager />
                </TabsContent>

                <TabsContent value="analytics" className="mt-3">
                    <BenchmarkingDashboard />
                </TabsContent>

                <TabsContent value="settings" className="mt-3">
                    <AHSPSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function AHSPPage({ embedded = false }: { embedded?: boolean }) {
    return (
        <div className="space-y-4">
            <ErrorBoundary
                errorMessage="Failed to load AHSP module"
            >
                {!embedded && <AHSPHeader />}
                <Suspense fallback={
                    <div style={{ minHeight: 420 }}>
                        <TableSkeleton rows={8} columns={5} />
                    </div>
                }>
                    <AHSPContent />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
