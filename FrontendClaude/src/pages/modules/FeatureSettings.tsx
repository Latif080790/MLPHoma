/**
 * FeatureSettings.tsx
 *
 * Simple admin UI to preview, export, and reset per-project feature configuration.
 *
 * - Reads active project from useProjectStore.
 * - Loads a generated default config (for now) and allows export/reset.
 * - This is intentionally lightweight: later we'll connect it to persistent store & an editor UI.
 */

import React, { useEffect, useMemo } from 'react'
import { Download, RefreshCw, Zap, ShieldCheck } from 'lucide-react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { Button } from '../../components/ui/button'
import { useProjectStore } from '../../store/projectStore'
import { useFeatureConfigStore } from '../../store/featureConfigStore'
import { FeatureModulesEditor } from '../../components/project/FeatureModulesEditor'
import { Badge } from '../../components/ui/badge'

export default function FeatureSettings(): JSX.Element {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const activeProject = useProjectStore(s => activeProjectId ? s.projects[activeProjectId] : null)
  const projectId = activeProject?.id || ''

  const { configs, loading, fetchConfig, updateConfig, resetToDefaults } = useFeatureConfigStore()
  const config = projectId ? configs[projectId] : null

  useEffect(() => {
    if (projectId && !config) {
      fetchConfig(projectId)
    }
  }, [projectId, config, fetchConfig])

  const handleResetToDefaults = async () => {
    if (!projectId) return
    await resetToDefaults(projectId)
  }

  const handleExport = () => {
    if (config) {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feature-config-${projectId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-6">
        <ModuleHeader title="Feature Settings" description="Project feature configuration (admin)" />
        <div className="rounded-2xl border-2 border-dashed p-12 text-center bg-slate-50/50 dark:bg-neutral-900/30 border-slate-200 dark:border-neutral-800">
          <div className="max-w-xs mx-auto space-y-4">
            <div className="h-12 w-12 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <ShieldCheck size={24} />
            </div>
            <p className="text-slate-600 dark:text-neutral-300 font-medium">Select a project to manage enterprise feature flags and module policies.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <ModuleHeader
        title="Feature Settings"
        description="Enterprise-grade modularity control. Configure guards, automation, and specific module behaviors for this project."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-8 px-3 bg-indigo-50 text-indigo-700 border-indigo-200 gap-1.5 font-bold uppercase tracking-wider">
              <Zap size={12} className="fill-indigo-500 text-indigo-500" /> Managed Mode
            </Badge>

            <Button variant="outline" className="h-9 bg-white border-slate-200" size="sm" onClick={handleResetToDefaults}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>

            <Button variant="outline" className="h-9 bg-white border-slate-200" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Config
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        {loading && !config ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Synchronizing configuration...</p>
            </div>
          </div>
        ) : config ? (
          <FeatureModulesEditor 
            config={config} 
            onUpdate={(updates) => updateConfig(projectId, updates)} 
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400">
            Failed to load configuration.
          </div>
        )}
      </div>
    </div>
  )
}