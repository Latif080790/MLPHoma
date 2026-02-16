import React, { useEffect, Suspense } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAHSPStore } from '@/store/ahspStore'
import { AHSPHeader } from '@/components/ahsp/AHSPHeader'
import { AHSPStatsBar } from '@/components/ahsp/AHSPStatsBar'
import { AHSPItemsTab } from '@/components/ahsp/AHSPItemsTab'
import { DKHManager } from '@/components/dkh/DKHManager'
import { BenchmarkingDashboard } from '@/components/ahsp/analytics'
import { AHSPSettings } from '@/components/ahsp/AHSPSettings'
import { Loader2 } from 'lucide-react'

function AHSPContent() {
    const { fetchAHSPItems, fetchResources, ahspItems, resources, loading, errors } = useAHSPStore()

    useEffect(() => {
        // Initial fetch if data is missing
        if (ahspItems.length === 0) {
            fetchAHSPItems().catch(console.error)
        }
        if (resources.length === 0) {
            fetchResources().catch(console.error)
        }
    }, [fetchAHSPItems, fetchResources, ahspItems.length, resources.length])

    const error = errors.ahspItems || errors.resources
    if (error) {
        return (
            <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                <h3 className="font-semibold">Error Loading AHSP Data</h3>
                <p>{error}</p>
            </div>
        )
    }

    // Show loading state only on initial load when data is empty
    const isLoading = loading.ahspItems || loading.resources
    if (isLoading && ahspItems.length === 0 && resources.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading AHSP data...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4 density-compact">
            <AHSPStatsBar />

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
