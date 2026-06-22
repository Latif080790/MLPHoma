import React, { useEffect, useState, useMemo } from 'react'
import { ShieldCheck, AlertTriangle, ClipboardCheck, BarChart2, FileKey } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { qhseService } from '@/services/qhseService'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePageState from '@/components/common/ModulePageState'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import type {
    SafetyIncident,
    HSEInspection,
    IBPREntry,
    QHSESummary,
    WorkPermit,
} from '@/types/qhse'
import { ReportIncidentDialog } from '@/components/qhse/ReportIncidentDialog'
import { ScheduleInspectionDialog } from '@/components/qhse/ScheduleInspectionDialog'
import { AddHazardDialog } from '@/components/qhse/AddHazardDialog'
import { QHSEDashboardTab } from '@/components/qhse/QHSEDashboardTab'
import { QHSEIncidentsTab } from '@/components/qhse/QHSEIncidentsTab'
import { QHSEInspectionsTab } from '@/components/qhse/QHSEInspectionsTab'
import { QHSEIBPRTab } from '@/components/qhse/QHSEIBPRTab'
import { QHSEPermitsTab } from '@/components/qhse/QHSEPermitsTab'

// ── Main QHSE Page ───────────────────────────────────────────────────────────

export default function QHSE() {
    const { activeProjectId } = useProjectStore()
    const { handleAsync: _handleAsync } = useErrorHandler()

    const [loading, setLoading] = useState(true)
    const [incidents, setIncidents] = useState<SafetyIncident[]>([])
    const [inspections, setInspections] = useState<HSEInspection[]>([])
    const [ibpr, setIbpr] = useState<IBPREntry[]>([])
    const [permits, setPermits] = useState<WorkPermit[]>([])
    const [summary, setSummary] = useState<QHSESummary | null>(null)
    const [activeTab, setActiveTab] = useState('dashboard')
    const [srStatus, setSrStatus] = useState('')

    // Dialog visibility
    const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)
    const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
    const [hazardDialogOpen, setHazardDialogOpen] = useState(false)

    const loadData = async (projectId: string) => {
        setLoading(true)
        try {
            const [inc, ins, ib, sum] = await Promise.all([
                qhseService.getIncidents(projectId),
                qhseService.getInspections(projectId),
                qhseService.getIBPR(projectId),
                qhseService.getSummary(projectId),
            ])
            setIncidents(inc); setInspections(ins); setIbpr(ib); setSummary(sum)
            setSrStatus(`QHSE data loaded: ${inc.length} incidents, ${ins.length} inspections.`)
        } catch {
            toast.error('Failed to load QHSE data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!activeProjectId) { setLoading(false); return }
            setLoading(true)
            try {
                const [inc, ins, ib, sum] = await Promise.all([
                    qhseService.getIncidents(activeProjectId),
                    qhseService.getInspections(activeProjectId),
                    qhseService.getIBPR(activeProjectId),
                    qhseService.getSummary(activeProjectId),
                ])
                if (cancelled) return
                setIncidents(inc); setInspections(ins); setIbpr(ib); setSummary(sum)
                setPermits([]) // Work permits: no backend table yet; populated via future service method
                setSrStatus(`QHSE data loaded: ${inc.length} incidents, ${ins.length} inspections.`)
            } catch {
                if (cancelled) return
                toast.error('Failed to load QHSE data')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [activeProjectId])

    const summaryItems = useMemo(() => summary ? [
        { label: 'Incidents', value: summary.totalIncidents, status: summary.totalIncidents > 0 ? 'warning' as const : 'success' as const },
        { label: 'LTI', value: summary.ltiCount, status: summary.ltiCount > 0 ? 'danger' as const : 'success' as const },
        { label: 'Near Miss', value: summary.nearMissCount, status: 'neutral' as const },
        { label: 'Open Inspections', value: summary.openInspections, status: summary.overdueInspections > 0 ? 'danger' as const : 'neutral' as const },
        { label: 'Critical Hazards', value: summary.criticalHazards, status: summary.criticalHazards > 0 ? 'danger' as const : 'success' as const },
        { label: 'TRIR', value: summary.trir.toFixed(2), status: summary.trir > 1 ? 'danger' as const : 'success' as const },
    ] : [], [summary])

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<ShieldCheck size={18} />}
                title="QHSE / K3"
                description="Safety incidents, HSE inspections, and hazard risk assessment."
                variant="empty"
                message="Select an active project to manage QHSE."
            />
        )
    }

    if (loading) {
        return (
            <ModulePageState
                icon={<ShieldCheck size={18} />}
                title="QHSE / K3"
                description="Safety incidents, HSE inspections, and hazard risk assessment."
                variant="loading"
                message="Loading QHSE data..."
            />
        )
    }

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectId}
                    versionLabel="v1.0"
                    syncStatus="synced"
                    healthItems={summary ? [
                        { label: 'LTI', level: summary.ltiCount > 0 ? 'critical' : 'good', value: String(summary.ltiCount) },
                        { label: 'Hazards', level: summary.criticalHazards > 0 ? 'critical' : 'good', value: String(summary.criticalHazards) },
                        { label: 'TRIR', level: summary.trir > 1 ? 'warning' : 'good', value: summary.trir.toFixed(2) },
                    ] : []}
                />
            }
            header={
                <WorkspaceHeader
                    title="QHSE / K3"
                    subtitle="Safety management, HSE inspections, and hazard identification (IBPR)"
                />
            }
            summary={<SummaryStrip items={summaryItems} variant="chips" />}
        >
            <div className="sr-only" role="status" aria-live="polite">{srStatus}</div>

            {/* Dialogs */}
            {activeProjectId && (
                <>
                    <ReportIncidentDialog
                        open={incidentDialogOpen}
                        onOpenChange={setIncidentDialogOpen}
                        projectId={activeProjectId}
                        onSaved={() => void loadData(activeProjectId)}
                    />
                    <ScheduleInspectionDialog
                        open={inspectionDialogOpen}
                        onOpenChange={setInspectionDialogOpen}
                        projectId={activeProjectId}
                        onSaved={() => void loadData(activeProjectId)}
                    />
                    <AddHazardDialog
                        open={hazardDialogOpen}
                        onOpenChange={setHazardDialogOpen}
                        projectId={activeProjectId}
                        onSaved={() => void loadData(activeProjectId)}
                    />
                </>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="dashboard"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Dashboard</TabsTrigger>
                    <TabsTrigger value="incidents"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Incidents</TabsTrigger>
                    <TabsTrigger value="inspections"><ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />Inspections</TabsTrigger>
                    <TabsTrigger value="ibpr"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />IBPR</TabsTrigger>
                    <TabsTrigger value="permits"><FileKey className="h-3.5 w-3.5 mr-1.5" />Izin Kerja</TabsTrigger>
                </TabsList>

                <QHSEDashboardTab summary={summary} incidents={incidents} ibpr={ibpr} />
                <QHSEIncidentsTab incidents={incidents} onOpenReportDialog={() => setIncidentDialogOpen(true)} />
                <QHSEInspectionsTab inspections={inspections} onOpenScheduleDialog={() => setInspectionDialogOpen(true)} />
                <QHSEIBPRTab ibpr={ibpr} onOpenHazardDialog={() => setHazardDialogOpen(true)} />
                <QHSEPermitsTab permits={permits} />
            </Tabs>
        </PageShell>
    )
}
