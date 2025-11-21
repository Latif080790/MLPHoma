
/**
 * AHSP.tsx
 * AHSP (Analisis Harga Satuan Pekerjaan) catalog management page
 */

import React, { useEffect } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useAHSPStore } from '../../store/ahspStore'
import { AHSPCatalog } from '../../components/ahsp/AHSPCatalog'
import { ResourceManager } from '../../components/ahsp/ResourceManager'
import { EmptyState } from '../../components/common/EmptyState'
import { TableSkeleton } from '../../components/common/LoadingSkeleton'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { useRetry } from '../../hooks/useRetry'
import { useErrorHandler } from '../../hooks/useErrorHandler'
import { RetryCard } from '../../components/common/RetryButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Calculator, Database } from 'lucide-react'

/**
 * AHSP Page Component
 */
export default function AHSP() {
  // Project context
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectName = activeProject?.name ?? '—'

  // AHSP state
  const { ahspItems, resources, loading, errors, fetchAll } = useAHSPStore()
  const { handleAsync } = useErrorHandler()

  // Fetch all AHSP data with retry mechanism
  const { execute: loadAHSPData, isRetrying, retryCount, error: fetchError } = useRetry(
    async () => {
      await handleAsync(fetchAll)
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
    }
  )

  useEffect(() => {
    // Load data on mount
    loadAHSPData()
  }, [])

  return (
    <AppShell projectName={projectName}>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('AHSP Module Error:', error, errorInfo)
        }}
        onReset={() => {
          // Reload data on reset
          loadAHSPData()
        }}
      >
        <ModuleHeader
          icon={<Calculator size={18} />}
          title="AHSP - Analisis Harga Satuan Pekerjaan"
          description="Work analysis with component breakdown, resource management (DKH), and auto-calculation"
        />

        {loading.ahspItems || loading.resources || isRetrying ? (
          <TableSkeleton rows={8} columns={6} />
        ) : fetchError || errors.ahspItems || errors.resources ? (
          <div className="p-6">
            <RetryCard
              error={fetchError || errors.ahspItems || errors.resources || 'Failed to load AHSP data'}
              onRetry={loadAHSPData}
              retryCount={retryCount}
              isRetrying={isRetrying}
            />
          </div>
        ) : (
          <Tabs defaultValue="ahsp" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="ahsp" className="gap-2">
                <Calculator className="h-4 w-4" />
                AHSP Catalog
              </TabsTrigger>
              <TabsTrigger value="dkh" className="gap-2">
                <Database className="h-4 w-4" />
                DKH (Resources)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ahsp" className="space-y-6">
              {ahspItems.length === 0 && resources.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <EmptyState
                    title="AHSP Catalog Empty"
                    description="Create your first AHSP items and resources to get started with construction cost analysis."
                    imageKeyword="construction materials"
                  />
                </div>
              ) : (
                <AHSPCatalog />
              )}
            </TabsContent>

            <TabsContent value="dkh" className="space-y-6">
              <ResourceManager />
            </TabsContent>
          </Tabs>
        )}
      </ErrorBoundary>
    </AppShell>
  )
}
