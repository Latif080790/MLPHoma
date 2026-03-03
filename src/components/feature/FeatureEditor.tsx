/**
 * FeatureEditor.tsx
 *
 * Page-level editor that composes per-module editors.
 * Provides load/save/export/reset/sync capabilities and delegates module edits to child editors.
 */

import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Download, RefreshCw, Save } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import useFeatureStore from '../../store/featureStore'
import { getFeatureConfig, saveFeatureConfig } from '../../lib/api/featureApi'
import type { FeatureConfig, FeatureModuleKey } from '../../config/features'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import ProjectManagementEditor from './modules/ProjectManagementEditor'
import WbsEditor from './modules/WBSEditor'
import AHSPEditor from './modules/AHSPEditor'
import RABEditor from './modules/RABEditor'
import TimelineEditor from './modules/TimelineEditor'
import RAPEditor from './modules/RAPEditor'
import CurvaSEditor from './modules/CurvaSEditor'
import ResourcePlanningEditor from './modules/ResourcePlanningEditor'
import CashFlowEditor from './modules/CashFlowEditor'
import ProgressEditor from './modules/ProgressEditor'
import ReportingEditor from './modules/ReportingEditor'

/**
 * FeatureEditor
 *
 * Top-level editor UI that shows per-module editors in tabs.
 * Loads config from useFeatureStore, allows local edits, persists to localStorage and optionally syncs to backend.
 */
export default function FeatureEditor(): JSX.Element {
  const activeProject = useProjectStore((s) => (typeof s.getActiveProject === 'function' ? s.getActiveProject() : null))
  const projectId = activeProject?.id ?? ''
  const projectName = activeProject?.name ?? ''
  void projectName // suppress unused warning

  const loadConfig = useFeatureStore((s) => s.loadConfig)
  const setConfig = useFeatureStore((s) => s.setConfig)
  const exportConfig = useFeatureStore((s) => s.exportConfig)
  const resetToDefault = useFeatureStore((s) => s.resetToDefault)

  const [config, setLocalConfig] = useState<FeatureConfig | null>(null)
  const [_loadingRemote, setLoadingRemote] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<string>('projectManagement')

  useEffect(() => {
    if (!projectId) {
      setLocalConfig(null)
      return
    }
    const cfg = loadConfig(projectId)
    setLocalConfig(cfg)
  }, [projectId, loadConfig])

  /**
   * handleSyncFromBackend
   *
   * Try to fetch from backend and overwrite local store if available.
   */
  async function handleSyncFromBackend() {
    if (!projectId) return
    setLoadingRemote(true)
    try {
      const remote = await getFeatureConfig(projectId)
      if (remote) {
        setConfig(projectId, remote)
        setLocalConfig(remote)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('FeatureEditor sync failed', e)
    } finally {
      setLoadingRemote(false)
    }
  }

  /**
   * handleSaveClick
   *
   * Save local config to backend (async) while ensuring local store updated.
   */
  async function handleSaveClick() {
    if (!projectId || !config) return
    setSaveState('saving')
    try {
      const ok = await saveFeatureConfig(projectId, config)
      if (ok) setSaveState('done')
      else setSaveState('error')
      setConfig(projectId, config)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('save failed', e)
      setSaveState('error')
    } finally {
      setTimeout(() => setSaveState('idle'), 1200)
    }
  }

  function handleReset() {
    if (!projectId) return
    const def = resetToDefault(projectId)
    setLocalConfig(def)
  }

  function handleExport() {
    if (!projectId) return
    const out = exportConfig(projectId)
    if (!out) return
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feature-config-${projectId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleModuleUpdate(moduleKey: FeatureModuleKey, patch: unknown) {
    if (!projectId || !config) return
    const key = moduleKey as FeatureModuleKey
    const existing = config[key] as unknown as Record<string, unknown>
    const update = patch as unknown as Record<string, unknown>
    const next = { ...config, [key]: { ...existing, ...update } } as unknown as FeatureConfig
    setLocalConfig(next)
  }

  if (!projectId) {
    return (
      <>
        <ModuleHeader title="Feature Settings" description="Project feature configuration (admin preview)" />
        <div className="rounded-xl border p-6 text-center dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-300">Select a project to view or manage feature configuration.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <ModuleHeader
        title="Feature Settings"
        description="Preview and edit per-project feature configuration. Save to local and optionally sync to backend."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-transparent" size="sm" onClick={handleReset}>
              <RefreshCw className="mr-2" />
              Reset to Defaults
            </Button>

            <Button variant="outline" className="bg-transparent" size="sm" onClick={handleSyncFromBackend}>
              <Download className="mr-2" />
              Sync from Backend
            </Button>

            <Button size="sm" onClick={handleSaveClick}>
              <Save className="mr-2" />
              {saveState === 'saving' ? 'Saving...' : saveState === 'done' ? 'Saved' : 'Save'}
            </Button>

            <Button variant="outline" className="bg-transparent" size="sm" onClick={handleExport}>
              <Download className="mr-2" />
              Export JSON
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <nav className="col-span-1 space-y-2">
          {[
            { key: 'projectManagement', label: 'Project Mgmt' },
            { key: 'wbs', label: 'WBS' },
            { key: 'ahsp', label: 'AHSP' },
            { key: 'rab', label: 'RAB' },
            { key: 'timeline', label: 'Timeline' },
            { key: 'rap', label: 'RAP' },
            { key: 'curvas', label: 'Curva-S' },
            { key: 'resources', label: 'Resources' },
            { key: 'cashflow', label: 'Cash Flow' },
            { key: 'progress', label: 'Progress' },
            { key: 'reporting', label: 'Reporting' },
          ].map((t) => (
            <button
              key={t.key}
              className={`w-full text-left rounded-md px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${activeTab === t.key ? 'bg-neutral-100 dark:bg-neutral-900 font-medium' : 'bg-transparent'}`}
              onClick={() => setActiveTab(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="col-span-3 space-y-4">
          {/* Render the selected module editor */}
          {config ? (
            <>
              {activeTab === 'projectManagement' && (
                <ProjectManagementEditor initialValue={config.projectManagement as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('projectManagement', p)} />
              )}
              {activeTab === 'wbs' && <WbsEditor initialValue={config.wbs as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('wbs', p)} />}
              {activeTab === 'ahsp' && <AHSPEditor initialValue={config.ahsp as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('ahsp', p)} />}
              {activeTab === 'rab' && <RABEditor initialValue={config.rab as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('rab', p)} />}
              {activeTab === 'timeline' && <TimelineEditor initialValue={config.timeline as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('timeline', p)} />}
              {activeTab === 'rap' && <RAPEditor initialValue={config.rap as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('rap', p)} />}
              {activeTab === 'curvas' && <CurvaSEditor initialValue={config.curvas as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('curvas', p)} />}
              {activeTab === 'resources' && <ResourcePlanningEditor initialValue={config.resources as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('resources', p)} />}
              {activeTab === 'cashflow' && <CashFlowEditor initialValue={config.cashflow as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('cashflow', p)} />}
              {activeTab === 'progress' && <ProgressEditor initialValue={config.progress as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('progress', p)} />}
              {activeTab === 'reporting' && <ReportingEditor initialValue={config.reporting as unknown as Record<string, unknown>} onSave={(p) => handleModuleUpdate('reporting', p)} />}
            </>
          ) : (
            <div className="rounded-xl border p-6 text-center dark:border-neutral-800">
              <p className="text-neutral-600 dark:text-neutral-300">Loading configuration...</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}