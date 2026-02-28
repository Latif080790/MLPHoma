/**
 * FeatureSettings.tsx
 *
 * Simple admin UI to preview, export, and reset per-project feature configuration.
 *
 * - Reads active project from useProjectStore.
 * - Loads a generated default config (for now) and allows export/reset.
 * - This is intentionally lightweight: later we'll connect it to persistent store & an editor UI.
 */

import React, { useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { Button } from '../../components/ui/button'
import { useProjectStore } from '../../store/projectStore'
import { generateDefaultFeatureConfig } from '../../lib/featureDefaults'
import type { FeatureConfig } from '../../config/features'

/**
 * downloadJSON
 *
 * Utility to download an object as a JSON file.
 *
 * @param data - object to be serialized
 * @param filename - filename for the download
 */
function downloadJSON(data: any, filename = 'feature-config.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * FeatureSettings
 *
 * Page component that displays current (generated) feature config for the active project.
 *
 * Note: Currently this component uses in-memory defaults. Next step: persist to store/backend.
 */
export default function FeatureSettings(): JSX.Element {
  // Defensive read of active project
  const activeProject = useProjectStore((s) => (typeof s.getActiveProject === 'function' ? s.getActiveProject() : null))
  const projectId = activeProject?.id ?? ''

  // Generate a default config for preview if project exists
  const defaultConfig = useMemo<FeatureConfig | null>(() => {
    if (!projectId) return null
    return generateDefaultFeatureConfig(projectId)
  }, [projectId])

  // Local editable snapshot (readonly JSON viewer for now)
  const [configSnapshot, setConfigSnapshot] = useState<FeatureConfig | null>(defaultConfig)

  // Reset to defaults handler
  const handleResetToDefaults = () => {
    if (!projectId) return
    const def = generateDefaultFeatureConfig(projectId)
    setConfigSnapshot(def)
  }

  // Export JSON handler
  const handleExport = () => {
    if (configSnapshot) downloadJSON(configSnapshot, `feature-config-${projectId}.json`)
  }

  if (!projectId) {
    return (
      <div className="space-y-6">
        <ModuleHeader title="Feature Settings" description="Project feature configuration (admin preview)" />
        <div className="rounded-xl border p-6 text-center dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-300">Select a project to view or manage feature configuration.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Feature Settings"
        description="Preview and export per-project feature configuration. Use this as the single source of feature flags and module policies."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-transparent" size="sm" onClick={handleResetToDefaults}>
              <RefreshCw className="mr-2" />
              Reset to Defaults
            </Button>

            <Button variant="outline" className="bg-transparent" size="sm" onClick={handleExport}>
              <Download className="mr-2" />
              Export JSON
            </Button>
          </div>
        }
      />

      <div className="mt-4">
        <div className="rounded-lg border p-4 bg-white dark:bg-black dark:border-neutral-800">
          <h3 className="mb-2 text-sm font-medium">Configuration JSON (read-only preview)</h3>
          <pre className="max-h-[60vh] overflow-auto text-xs leading-snug">
            {configSnapshot ? JSON.stringify(configSnapshot, null, 2) : 'No configuration available.'}
          </pre>
        </div>
      </div>
    </div>
  )
}