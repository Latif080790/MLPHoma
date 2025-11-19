
/**
 * AHSP.tsx
 * AHSP (Analisis Harga Satuan Pekerjaan) catalog management page
 */

import React from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useAHSPStore } from '../../store/ahspStore'
import { AHSPCatalog } from '../../components/ahsp/AHSPCatalog'
import { EmptyState } from '../../components/common/EmptyState'
import { Calculator } from 'lucide-react'

/**
 * AHSP Page Component
 */
export default function AHSP() {
  // Project context
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectName = activeProject?.name ?? '—'

  // AHSP state
  const { ahspItems, resources, loading } = useAHSPStore()

  return (
    <AppShell projectName={projectName}>
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="AHSP Catalog"
        description="Analisis Harga Satuan Pekerjaan with component breakdown and auto calculation"
      />

      {loading.ahspItems || loading.resources ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : ahspItems.length === 0 && resources.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <EmptyState
            title="AHSP Catalog Empty"
            description="Create your first AHSP items and resources to get started with construction cost analysis."
            imageKeyword="construction materials"
          />
        </div>
      ) : (
        <AHSPCatalog />
      )}
    </AppShell>
  )
}
