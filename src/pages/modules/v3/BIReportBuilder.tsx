import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import ModulePageState from '@/components/common/ModulePageState'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useProjectStore } from '@/store/projectStore'
import type { ReportPreviewResult, ReportTemplate } from '@/types/report'
import { reportBuilderService } from '@/services/reportBuilderService'
import { ReportPreviewTable, ReportTemplateEditor, ReportTemplateList } from '@/components/reports'

export default function BIReportBuilder() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const projects = useProjectStore((state) => state.projects)
  const { handleAsync } = useErrorHandler()

  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [preview, setPreview] = useState<ReportPreviewResult | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) || null,
    [templates, selectedId]
  )

  const loadTemplates = async () => {
    if (!activeProjectId) return

    setLoadingTemplates(true)
    try {
      const rows = await reportBuilderService.listTemplates(activeProjectId)
      setTemplates(rows)
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load report templates')
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
    // Intentionally keyed only by active project context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  const handleCreate = () => {
    if (!activeProjectId) return

    const draft: ReportTemplate = {
      id: `draft-${Date.now()}`,
      project_id: activeProjectId,
      name: 'New Report Template',
      description: null,
      scope: 'PROJECT',
      dataset: 'DASHBOARD_KPI',
      chart_type: 'TABLE',
      config: { limit: 50 },
      is_shared: false,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setTemplates((prev) => [draft, ...prev])
    setSelectedId(draft.id)
    setPreview(null)
  }

  const handlePatchSelected = (patch: Partial<ReportTemplate>) => {
    setTemplates((prev) => prev.map((template) => {
      if (template.id !== selectedId) return template
      return { ...template, ...patch }
    }))
  }

  const handleSave = async () => {
    if (!selectedTemplate || !activeProjectId) return

    setSaving(true)
    await handleAsync(async () => {
      if (selectedTemplate.id.startsWith('draft-')) {
        const created = await reportBuilderService.createTemplate({
          project_id: activeProjectId,
          name: selectedTemplate.name,
          description: selectedTemplate.description || '',
          scope: selectedTemplate.scope,
          dataset: selectedTemplate.dataset,
          chart_type: selectedTemplate.chart_type,
          config: selectedTemplate.config || {},
          is_shared: selectedTemplate.is_shared,
        })

        setTemplates((prev) => [created, ...prev.filter((row) => row.id !== selectedTemplate.id)])
        setSelectedId(created.id)
      } else {
        const updated = await reportBuilderService.updateTemplate(selectedTemplate.id, {
          name: selectedTemplate.name,
          description: selectedTemplate.description || '',
          scope: selectedTemplate.scope,
          dataset: selectedTemplate.dataset,
          chart_type: selectedTemplate.chart_type,
          config: selectedTemplate.config || {},
          is_shared: selectedTemplate.is_shared,
        })

        setTemplates((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      }

      toast.success('Template saved')
    }, 'default')
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedTemplate) return

    if (selectedTemplate.id.startsWith('draft-')) {
      setTemplates((prev) => prev.filter((row) => row.id !== selectedTemplate.id))
      setSelectedId(undefined)
      setPreview(null)
      return
    }

    await handleAsync(async () => {
      await reportBuilderService.deleteTemplate(selectedTemplate.id)
      setTemplates((prev) => prev.filter((row) => row.id !== selectedTemplate.id))
      setSelectedId(undefined)
      setPreview(null)
      toast.success('Template deleted')
    }, 'default')
  }

  const handleRun = async () => {
    if (!selectedTemplate || !activeProjectId) return

    setRunning(true)
    await handleAsync(async () => {
      const result = await reportBuilderService.runTemplate(activeProjectId, selectedTemplate)
      setPreview(result)
      toast.success('Preview generated')
    }, 'default')
    setRunning(false)
  }

  if (!activeProjectId || !activeProject) {
    return (
      <ModulePageState
        icon={<BarChart3 size={18} />}
        title="BI Report Builder"
        description="Build reusable portfolio and project report templates."
        variant="empty"
        message="Select an active project to start building reports."
      />
    )
  }

  const summaryItems = [
    { label: 'Templates', value: templates.length, status: 'neutral' as const },
    { label: 'Selected', value: selectedTemplate?.name || '-', status: 'neutral' as const },
    { label: 'Rows', value: preview?.rows.length || 0, status: 'neutral' as const },
  ]

  return (
    <PageShell
      contextBar={
        <GlobalContextBar
          projectName={activeProject.name}
          packageName={activeProject.code || undefined}
          versionLabel="BI v1"
          syncStatus="synced"
        />
      }
      header={
        <WorkspaceHeader
          title="BI Report Builder"
          subtitle="Template-driven reporting for KPI, risk, and supply chain insights"
        />
      }
      summary={<SummaryStrip items={summaryItems} />}
    >
      <div className="grid grid-cols-1 gap-4 p-padding-md lg:grid-cols-12">
        <div className="lg:col-span-3">
          <ReportTemplateList
            templates={templates}
            activeId={selectedId}
            loading={loadingTemplates}
            onSelect={setSelectedId}
            onCreate={handleCreate}
          />
        </div>

        <div className="lg:col-span-4">
          <ReportTemplateEditor
            template={selectedTemplate}
            saving={saving}
            onChange={handlePatchSelected}
            onSave={handleSave}
            onDelete={handleDelete}
            onRun={handleRun}
          />
        </div>

        <div className="lg:col-span-5">
          <ReportPreviewTable
            result={preview}
            loading={running}
            chartType={selectedTemplate?.chart_type}
          />
        </div>
      </div>
    </PageShell>
  )
}
