import React, { useEffect, useState, useMemo } from 'react'
import { ShieldCheck, AlertTriangle, ClipboardCheck, BarChart2, Plus, FileKey } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { qhseService } from '@/services/qhseService'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePageState from '@/components/common/ModulePageState'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip, AlertStrip } from '@/components/patterns'
import type {
    SafetyIncident,
    HSEInspection,
    IBPREntry,
    QHSESummary,
    WorkPermit,
} from '@/types/qhse'
import { format, differenceInDays, parseISO } from 'date-fns'
import { SEVERITY_BADGE_CONFIG, INCIDENT_TYPE_LABEL, RISK_LEVEL_COLORS } from '@/components/qhse/qhseConstants'
import { ReportIncidentDialog } from '@/components/qhse/ReportIncidentDialog'
import { ScheduleInspectionDialog } from '@/components/qhse/ScheduleInspectionDialog'
import { AddHazardDialog } from '@/components/qhse/AddHazardDialog'

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

    // Compute expiring permits (within 3 days, not already expired)
    const expiringPermits = useMemo(() => permits.filter(p => {
        if (!p.expiry_date || p.status === 'EXPIRED') return false
        const daysLeft = differenceInDays(parseISO(p.expiry_date), new Date())
        return daysLeft >= 0 && daysLeft <= 3
    }), [permits])

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

            {/* KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Lost Time Injuries</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.ltiCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary.ltiCount}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">LTI this project</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Total Incidents</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className="text-3xl font-bold">{summary.totalIncidents}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{summary.nearMissCount} near misses</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">HSE Score</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.avgInspectionScore >= 85 ? 'text-green-600' : summary.avgInspectionScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {summary.avgInspectionScore.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">avg inspection score</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">TRIR</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.trir > 1 ? 'text-red-600' : 'text-green-600'}`}>{summary.trir.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">per 200,000 man-hours</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="dashboard"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Dashboard</TabsTrigger>
                    <TabsTrigger value="incidents"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Incidents</TabsTrigger>
                    <TabsTrigger value="inspections"><ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />Inspections</TabsTrigger>
                    <TabsTrigger value="ibpr"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />IBPR</TabsTrigger>
                    <TabsTrigger value="permits"><FileKey className="h-3.5 w-3.5 mr-1.5" />Izin Kerja</TabsTrigger>
                </TabsList>

                {/* Dashboard */}
                <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Recent Incidents</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {incidents.slice(0, 5).map(inc => (
                                    <div key={inc.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
                                        {(() => {
                                            const cfg = SEVERITY_BADGE_CONFIG[inc.severity] ?? SEVERITY_BADGE_CONFIG.LOW
                                            return (
                                                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold shrink-0 ${cfg.cls}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                                    {inc.severity}
                                                </span>
                                            )
                                        })()}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{inc.title}</p>
                                            <p className="text-xs text-muted-foreground">{INCIDENT_TYPE_LABEL[inc.type]} · {format(new Date(inc.incident_date), 'dd/MM/yyyy')}</p>
                                        </div>
                                        <Badge variant={inc.status === 'CLOSED' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                            {inc.status}
                                        </Badge>
                                    </div>
                                ))}
                                {incidents.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        <ShieldCheck className="mx-auto h-8 w-8 mb-2 text-green-500" />
                                        Zero incidents reported.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Critical Hazards (IBPR)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {ibpr.filter(i => i.risk_level === 'CRITICAL' || i.risk_level === 'HIGH').slice(0, 5).map(entry => (
                                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
                                        <span className={`text-xs font-bold tabular-nums ${RISK_LEVEL_COLORS[entry.risk_level]}`}>
                                            RS:{entry.risk_score}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{entry.hazard}</p>
                                            <p className="text-xs text-muted-foreground truncate">{entry.activity}</p>
                                        </div>
                                        <Badge variant={entry.status === 'MITIGATED' ? 'default' : 'destructive'} className="text-xs shrink-0">
                                            {entry.status}
                                        </Badge>
                                    </div>
                                ))}
                                {ibpr.filter(i => i.risk_level === 'CRITICAL' || i.risk_level === 'HIGH').length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        <ShieldCheck className="mx-auto h-8 w-8 mb-2 text-green-500" />
                                        No critical or high hazards.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Incidents */}
                <TabsContent value="incidents">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Safety Incidents ({incidents.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setIncidentDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />Report Incident
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {incidents.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ShieldCheck className="mx-auto h-10 w-10 mb-3 text-green-400" />
                                    <p className="text-sm font-medium text-green-600">Zero incidents recorded.</p>
                                    <p className="text-xs mt-1 text-muted-foreground">Maintain this record by following safety protocols.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Incident No.</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Severity</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {incidents.map(inc => (
                                            <TableRow key={inc.id} style={inc.type === 'FATALITY' ? { backgroundColor: 'rgba(239,68,68,.15)' } : undefined}>
                                                <TableCell className="font-mono text-xs">{inc.incident_number}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{inc.title}</div>
                                                    {inc.location && <div className="text-xs text-muted-foreground">{inc.location}</div>}
                                                </TableCell>
                                                <TableCell className="text-xs">{INCIDENT_TYPE_LABEL[inc.type]}</TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const cfg = SEVERITY_BADGE_CONFIG[inc.severity] ?? SEVERITY_BADGE_CONFIG.LOW
                                                        return (
                                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
                                                                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                                                {inc.severity}
                                                            </span>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell className="text-xs">{format(new Date(inc.incident_date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={inc.status === 'CLOSED' ? 'default' : 'secondary'} className="text-xs">
                                                        {inc.status.replace('_', ' ')}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Inspections */}
                <TabsContent value="inspections">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">HSE Inspections ({inspections.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setInspectionDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />Schedule Inspection
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {inspections.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ClipboardCheck className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">No inspections scheduled.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Inspection No.</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Scheduled</TableHead>
                                            <TableHead>Checklist</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inspections.map(ins => {
                                            const totalItems = ins.checklist?.length ?? 0
                                            const completedItems = ins.checklist?.filter(i => i.status === 'OK').length ?? 0
                                            const checkPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
                                            return (
                                            <TableRow key={ins.id} style={ins.score != null && ((ins.score / (ins.max_score || 100)) * 100) < 80 ? { backgroundColor: 'rgba(245,158,11,.08)' } : undefined}>
                                                <TableCell className="font-mono text-xs">{ins.inspection_number}</TableCell>
                                                <TableCell className="font-medium text-sm">{ins.title}</TableCell>
                                                <TableCell className="text-xs">{ins.type}</TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={new Date(ins.scheduled_date) < new Date() && ins.status !== 'COMPLETED' ? 'text-red-600 font-medium' : ''}>
                                                        {format(new Date(ins.scheduled_date), 'dd/MM/yyyy')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs min-w-[120px]">
                                                    {totalItems > 0 ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                                                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${checkPct}%` }} />
                                                            </div>
                                                            <span className="font-mono text-slate-500 shrink-0">{completedItems}/{totalItems}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {ins.score != null
                                                        ? `${((ins.score / (ins.max_score || 100)) * 100).toFixed(0)}%`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={ins.status === 'COMPLETED' ? 'default' : ins.status === 'FAILED' ? 'destructive' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {ins.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* IBPR */}
                <TabsContent value="ibpr">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">IBPR — Identifikasi Bahaya & Penilaian Risiko ({ibpr.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setHazardDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />Add Hazard
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {ibpr.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ShieldCheck className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">No hazard entries found.</p>
                                    <p className="text-xs mt-1">Document project hazards for risk management compliance.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Activity</TableHead>
                                            <TableHead>Hazard</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-center">L</TableHead>
                                            <TableHead className="text-center">S</TableHead>
                                            <TableHead className="text-center">Risk Score</TableHead>
                                            <TableHead>Level</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ibpr.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="text-xs max-w-[140px] truncate">{entry.activity}</TableCell>
                                                <TableCell className="text-sm font-medium max-w-[160px] truncate">{entry.hazard}</TableCell>
                                                <TableCell className="text-xs">{entry.hazard_type}</TableCell>
                                                <TableCell className="text-center text-xs font-mono">{entry.likelihood}</TableCell>
                                                <TableCell className="text-center text-xs font-mono">{entry.severity}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={`text-sm font-bold ${RISK_LEVEL_COLORS[entry.risk_level]}`}>{entry.risk_score}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-xs font-semibold ${RISK_LEVEL_COLORS[entry.risk_level]}`}>{entry.risk_level}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={entry.status === 'MITIGATED' || entry.status === 'ELIMINATED' ? 'default' : 'secondary'} className="text-xs">
                                                        {entry.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* Work Permits */}
                <TabsContent value="permits">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Izin Kerja / Work Permits ({permits.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Expiry warning banner */}
                            {expiringPermits.length > 0 && (
                                <AlertStrip
                                    severity="warning"
                                    message={`${expiringPermits.length} izin kerja berakhir dalam 3 hari — segera perbarui`}
                                    className="mb-3"
                                />
                            )}
                            {permits.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <FileKey className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">Belum ada izin kerja terdaftar.</p>
                                    <p className="text-xs mt-1">Izin kerja (Hot Work, Confined Space, dll.) akan ditampilkan di sini.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Izin</TableHead>
                                            <TableHead>Judul</TableHead>
                                            <TableHead>Tipe</TableHead>
                                            <TableHead>Ditugaskan</TableHead>
                                            <TableHead>Berlaku</TableHead>
                                            <TableHead>Berakhir</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {permits.map(p => {
                                            const daysLeft = p.expiry_date && p.status !== 'EXPIRED'
                                                ? differenceInDays(parseISO(p.expiry_date), new Date())
                                                : null
                                            const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
                                            return (
                                                <TableRow key={p.id} className={isNearExpiry ? 'bg-amber-50/60' : undefined}>
                                                    <TableCell className="font-mono text-xs">{p.permit_number}</TableCell>
                                                    <TableCell className="font-medium text-sm">{p.title}</TableCell>
                                                    <TableCell className="text-xs">{p.type.replace(/_/g, ' ')}</TableCell>
                                                    <TableCell className="text-xs">{p.issued_to}</TableCell>
                                                    <TableCell className="text-xs">{format(new Date(p.issue_date), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <span className={isNearExpiry ? 'text-amber-600 font-semibold' : ''}>
                                                            {format(new Date(p.expiry_date), 'dd/MM/yyyy')}
                                                            {isNearExpiry && daysLeft !== null && (
                                                                <span className="ml-1 text-amber-500">({daysLeft}h lagi)</span>
                                                            )}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={p.status === 'ACTIVE' ? 'default' : p.status === 'EXPIRED' ? 'destructive' : 'secondary'}
                                                            className="text-xs"
                                                        >
                                                            {p.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </PageShell>
    )
}
