import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useProjectStore } from '@/store/projectStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import AHSP from '../AHSP'
import WBS from '../WBS'
import RAB from '../RAB'
import RAP from '../RAP'

type CostingTab = 'ahsp' | 'wbs' | 'rab' | 'rap'

export default function ProjectCosting() {
  const { activeProjectId, projects } = useProjectStore()
  const [activeTab, setActiveTab] = useState<CostingTab>('ahsp')

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  if (!activeProjectId || !activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view costing data." />
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'ahsp':
        return (
          <ErrorBoundary errorMessage="AHSP module failed to render">
            <AHSP />
          </ErrorBoundary>
        )
      case 'wbs':
        return (
          <ErrorBoundary errorMessage="WBS module failed to render">
            <WBS />
          </ErrorBoundary>
        )
      case 'rab':
        return (
          <ErrorBoundary errorMessage="RAB module failed to render">
            <RAB />
          </ErrorBoundary>
        )
      case 'rap':
        return (
          <ErrorBoundary errorMessage="RAP module failed to render">
            <RAP />
          </ErrorBoundary>
        )
    }
  }

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="Project Costing"
        description={`Integrated costing workspace for ${activeProject.name}`}
        showBackButton={false}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CostingTab)}>
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-slate-50/70 p-1 dark:bg-slate-950/40">
            <TabsTrigger value="ahsp">AHSP</TabsTrigger>
            <TabsTrigger value="wbs">WBS</TabsTrigger>
            <TabsTrigger value="rab">RAB</TabsTrigger>
            <TabsTrigger value="rap">RAP</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-[420px]">{renderContent()}</div>
    </div>
  )
}
