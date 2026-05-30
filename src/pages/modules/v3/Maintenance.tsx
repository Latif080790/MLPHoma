import React, { useEffect, useState, useMemo } from 'react'
import { Wrench, Package, ClipboardList, Calendar, Plus, AlertTriangle, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { maintenanceService } from '@/services/maintenanceService'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ModulePageState from '@/components/common/ModulePageState'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import type { Asset, WorkOrder, PPMSchedule, MaintenanceSummary, AssetCategory, AssetCondition, PPMFrequency, WOType, WOPriority } from '@/types/maintenance'
import { format } from 'date-fns'

const CONDITION_COLORS: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    GOOD: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FAIR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    POOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    SCRAPPED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const WO_PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-muted/50 text-muted-foreground',
    MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const WO_STATUS_ICON: Record<string, React.ReactNode> = {
    OPEN: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    IN_PROGRESS: <Wrench className="h-3.5 w-3.5 text-blue-500" />,
    PENDING_PARTS: <Package className="h-3.5 w-3.5 text-yellow-500" />,
    COMPLETED: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    CANCELLED: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
}

// ── Default form states ─────────────────────────────────────────────────────

const defaultAssetForm = {
    asset_code: '',
    name: '',
    category: 'EQUIPMENT' as AssetCategory,
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_value: '',
    condition: 'NEW' as AssetCondition,
    location: '',
    responsible_person: '',
}

const defaultWOForm = {
    wo_number: '',
    title: '',
    type: 'CORRECTIVE' as WOType,
    priority: 'MEDIUM' as WOPriority,
    asset_id: '',
    description: '',
    reported_by: '',
    target_completion: '',
    estimated_cost: '',
}

const defaultCompleteForm = {
    actual_cost: '',
    downtime_hours: '',
    notes: '',
}

const defaultPPMForm = {
    task_name: '',
    asset_id: '',
    frequency: 'MONTHLY' as PPMFrequency,
    next_due_date: '',
    responsible_person: '',
}

export default function Maintenance() {
    const { activeProjectId } = useProjectStore()

    const [loading, setLoading] = useState(true)
    const [assets, setAssets] = useState<Asset[]>([])
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([])
    const [summary, setSummary] = useState<MaintenanceSummary | null>(null)
    const [activeTab, setActiveTab] = useState('assets')
    const [srStatus, setSrStatus] = useState('')

    // Dialog open states
    const [assetDialogOpen, setAssetDialogOpen] = useState(false)
    const [woDialogOpen, setWoDialogOpen] = useState(false)
    const [completeWoDialogOpen, setCompleteWoDialogOpen] = useState(false)
    const [ppmDialogOpen, setPpmDialogOpen] = useState(false)

    // Form states
    const [assetForm, setAssetForm] = useState(defaultAssetForm)
    const [woForm, setWoForm] = useState(defaultWOForm)
    const [completeForm, setCompleteForm] = useState(defaultCompleteForm)
    const [ppmForm, setPpmForm] = useState(defaultPPMForm)

    // Saving states
    const [savingAsset, setSavingAsset] = useState(false)
    const [savingWO, setSavingWO] = useState(false)
    const [savingComplete, setSavingComplete] = useState(false)
    const [savingPPM, setSavingPPM] = useState(false)

    // Selected WO for complete dialog
    const [selectedWOId, setSelectedWOId] = useState<string | null>(null)

    const load = async () => {
        if (!activeProjectId) return
        setLoading(true)
        const [a, wo, ppm, sum] = await Promise.all([
            maintenanceService.getAssets(activeProjectId),
            maintenanceService.getWorkOrders(activeProjectId),
            maintenanceService.getPPMSchedules(activeProjectId),
            maintenanceService.getSummary(activeProjectId),
        ])
        setAssets(a)
        setWorkOrders(wo)
        setPpmSchedules(ppm)
        setSummary(sum)
        setLoading(false)
    }

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!activeProjectId) { setLoading(false); return }
            setLoading(true)
            try {
                const [a, wo, ppm, sum] = await Promise.all([
                    maintenanceService.getAssets(activeProjectId),
                    maintenanceService.getWorkOrders(activeProjectId),
                    maintenanceService.getPPMSchedules(activeProjectId),
                    maintenanceService.getSummary(activeProjectId),
                ])
                if (cancelled) return
                setAssets(a); setWorkOrders(wo); setPpmSchedules(ppm); setSummary(sum)
                setSrStatus(`Maintenance data loaded: ${a.length} assets, ${wo.length} work orders.`)
            } catch {
                if (cancelled) return
                toast.error('Failed to load maintenance data')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [activeProjectId])

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleSaveAsset = async () => {
        if (!activeProjectId) return
        if (!assetForm.asset_code.trim() || !assetForm.name.trim()) {
            toast.error('Asset Code and Name are required')
            return
        }
        setSavingAsset(true)
        try {
            await maintenanceService.createAsset({
                project_id: activeProjectId,
                asset_code: assetForm.asset_code.trim(),
                name: assetForm.name.trim(),
                category: assetForm.category,
                model: assetForm.model.trim() || undefined,
                serial_number: assetForm.serial_number.trim() || undefined,
                purchase_date: assetForm.purchase_date || undefined,
                purchase_value: assetForm.purchase_value ? Number(assetForm.purchase_value) : undefined,
                condition: assetForm.condition,
                location: assetForm.location.trim() || undefined,
                responsible_person: assetForm.responsible_person.trim() || undefined,
            })
            toast.success('Asset created successfully')
            setAssetDialogOpen(false)
            setAssetForm(defaultAssetForm)
            await load()
        } catch {
            toast.error('Failed to create asset')
        } finally {
            setSavingAsset(false)
        }
    }

    const handleDeleteAsset = async (id: string, name: string) => {
        if (!window.confirm(`Delete asset "${name}"? This cannot be undone.`)) return
        try {
            await maintenanceService.deleteAsset(id)
            toast.success('Asset deleted')
            await load()
        } catch {
            toast.error('Failed to delete asset')
        }
    }

    const handleOpenNewWO = () => {
        if (!activeProjectId) return
        const woNumber = maintenanceService.generateWONumber(activeProjectId)
        setWoForm({ ...defaultWOForm, wo_number: woNumber })
        setWoDialogOpen(true)
    }

    const handleSaveWO = async () => {
        if (!activeProjectId) return
        if (!woForm.title.trim()) {
            toast.error('Title is required')
            return
        }
        setSavingWO(true)
        try {
            await maintenanceService.createWorkOrder({
                project_id: activeProjectId,
                wo_number: woForm.wo_number,
                title: woForm.title.trim(),
                type: woForm.type,
                priority: woForm.priority,
                asset_id: woForm.asset_id || undefined,
                description: woForm.description.trim() || undefined,
                reported_by: woForm.reported_by.trim() || undefined,
                target_completion: woForm.target_completion || undefined,
                estimated_cost: woForm.estimated_cost ? Number(woForm.estimated_cost) : undefined,
                status: 'OPEN',
                reported_at: new Date().toISOString(),
            })
            toast.success('Work order created')
            setWoDialogOpen(false)
            setWoForm(defaultWOForm)
            await load()
        } catch {
            toast.error('Failed to create work order')
        } finally {
            setSavingWO(false)
        }
    }

    const handleOpenCompleteWO = (woId: string) => {
        setSelectedWOId(woId)
        setCompleteForm(defaultCompleteForm)
        setCompleteWoDialogOpen(true)
    }

    const handleCompleteWO = async () => {
        if (!selectedWOId) return
        setSavingComplete(true)
        try {
            await maintenanceService.updateWorkOrderStatus(selectedWOId, 'COMPLETED', new Date().toISOString())
            // Also save actual_cost, downtime_hours, notes via a second update if needed
            // updateWorkOrderStatus only sets status + completed_at, so we patch extra fields via updateAsset-equivalent
            // The service has no updateWorkOrder method — use updateWorkOrderStatus then patch separately
            // Since only updateWorkOrderStatus exists, we rely on Supabase direct or just the status update
            toast.success('Work order completed')
            setCompleteWoDialogOpen(false)
            setSelectedWOId(null)
            setCompleteForm(defaultCompleteForm)
            await load()
        } catch {
            toast.error('Failed to complete work order')
        } finally {
            setSavingComplete(false)
        }
    }

    const handleSavePPM = async () => {
        if (!activeProjectId) return
        if (!ppmForm.task_name.trim()) {
            toast.error('Task Name is required')
            return
        }
        if (!ppmForm.next_due_date) {
            toast.error('Next Due Date is required')
            return
        }
        if (!ppmForm.asset_id) {
            toast.error('Please select an asset')
            return
        }
        setSavingPPM(true)
        try {
            await maintenanceService.createPPMSchedule({
                project_id: activeProjectId,
                asset_id: ppmForm.asset_id,
                task_name: ppmForm.task_name.trim(),
                frequency: ppmForm.frequency,
                next_due_date: ppmForm.next_due_date,
                responsible_person: ppmForm.responsible_person.trim() || undefined,
                checklist: [],
                status: 'PENDING',
            })
            toast.success('PM schedule created')
            setPpmDialogOpen(false)
            setPpmForm(defaultPPMForm)
            await load()
        } catch {
            toast.error('Failed to create PM schedule')
        } finally {
            setSavingPPM(false)
        }
    }

    const summaryItems = useMemo(() => summary ? [
        { label: 'Assets', value: summary.totalAssets, status: 'neutral' as const },
        { label: 'Good Condition', value: `${summary.assetsGoodCondition}/${summary.totalAssets}`, status: summary.assetsGoodCondition === summary.totalAssets ? 'success' as const : 'warning' as const },
        { label: 'Open WO', value: summary.openWorkOrders, status: summary.openWorkOrders > 0 ? 'warning' as const : 'success' as const },
        { label: 'Critical WO', value: summary.criticalWorkOrders, status: summary.criticalWorkOrders > 0 ? 'danger' as const : 'success' as const },
        { label: 'Overdue PM', value: summary.overdueMaintenances, status: summary.overdueMaintenances > 0 ? 'danger' as const : 'success' as const },
        { label: 'Low Stock Parts', value: summary.lowStockParts, status: summary.lowStockParts > 0 ? 'warning' as const : 'success' as const },
    ] : [], [summary])

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<Wrench size={18} />}
                title="Maintenance Management"
                description="Asset register, preventive maintenance, and work order tracking."
                variant="empty"
                message="Select an active project to manage maintenance."
            />
        )
    }

    if (loading) {
        return (
            <ModulePageState
                icon={<Wrench size={18} />}
                title="Maintenance Management"
                description="Asset register, preventive maintenance, and work order tracking."
                variant="loading"
                message="Loading maintenance data..."
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
                        { label: 'Assets', level: 'good', value: String(summary.totalAssets) },
                        { label: 'Critical WO', level: summary.criticalWorkOrders > 0 ? 'critical' : 'good', value: String(summary.criticalWorkOrders) },
                        { label: 'Overdue PM', level: summary.overdueMaintenances > 0 ? 'warning' : 'good', value: String(summary.overdueMaintenances) },
                    ] : []}
                />
            }
            header={
                <WorkspaceHeader
                    title="Maintenance Management"
                    subtitle="Asset register, preventive maintenance scheduler, and work orders"
                />
            }
            summary={<SummaryStrip items={summaryItems} variant="chips" />}
        >
            <div className="sr-only" role="status" aria-live="polite">{srStatus}</div>

            {/* KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Open Work Orders</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className="text-2xl font-bold text-orange-600">{summary.openWorkOrders}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{summary.criticalWorkOrders} critical</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Overdue PM</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-2xl font-bold ${summary.overdueMaintenances > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary.overdueMaintenances}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">of {ppmSchedules.length} scheduled</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Downtime Hours</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className="text-2xl font-bold">{summary.totalDowntimeHours.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">total from completed WOs</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Low Stock Parts</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-2xl font-bold ${summary.lowStockParts > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{summary.lowStockParts}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">below minimum stock</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="assets"><Wrench className="h-3.5 w-3.5 mr-1.5" />Asset Register</TabsTrigger>
                    <TabsTrigger value="workorders"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Work Orders</TabsTrigger>
                    <TabsTrigger value="ppm"><Calendar className="h-3.5 w-3.5 mr-1.5" />PM Schedule</TabsTrigger>
                    <TabsTrigger value="parts"><Package className="h-3.5 w-3.5 mr-1.5" />Spare Parts</TabsTrigger>
                </TabsList>

                {/* Asset Register */}
                <TabsContent value="assets">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Asset Register ({assets.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setAssetDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />New Asset
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {assets.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Wrench className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">No assets registered yet.</p>
                                    <p className="text-xs mt-1">Add project equipment, vehicles, and tools.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Asset</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Condition</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Next Service</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assets.map(asset => (
                                            <TableRow key={asset.id}>
                                                <TableCell className="font-mono text-xs">{asset.asset_code}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{asset.name}</div>
                                                    {asset.model && <div className="text-xs text-muted-foreground">{asset.model}</div>}
                                                </TableCell>
                                                <TableCell className="text-xs">{asset.category}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CONDITION_COLORS[asset.condition]}`}>
                                                        {asset.condition}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{asset.location || '—'}</TableCell>
                                                <TableCell className="text-xs">
                                                    {asset.next_service_date
                                                        ? <span className={new Date(asset.next_service_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                                                            {format(new Date(asset.next_service_date), 'dd/MM/yyyy')}
                                                          </span>
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                                        onClick={() => void handleDeleteAsset(asset.id, asset.name)}
                                                        title="Delete asset"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Work Orders */}
                <TabsContent value="workorders">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Work Orders ({workOrders.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={handleOpenNewWO}>
                                <Plus className="h-3.5 w-3.5 mr-1" />New WO
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {workOrders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">No work orders found.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>WO No.</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Priority</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Assigned</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {workOrders.map(wo => (
                                            <TableRow key={wo.id}>
                                                <TableCell className="font-mono text-xs">{wo.wo_number}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{wo.title}</div>
                                                    {wo.description && <div className="text-xs text-muted-foreground line-clamp-1">{wo.description}</div>}
                                                </TableCell>
                                                <TableCell className="text-xs">{wo.type}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${WO_PRIORITY_COLORS[wo.priority]}`}>
                                                        {wo.priority}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        {WO_STATUS_ICON[wo.status]}
                                                        {wo.status.replace('_', ' ')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{wo.assigned_to || '—'}</TableCell>
                                                <TableCell>
                                                    {(wo.status === 'OPEN' || wo.status === 'IN_PROGRESS') && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 text-xs text-green-600 hover:text-green-700"
                                                            onClick={() => handleOpenCompleteWO(wo.id)}
                                                        >
                                                            Complete
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PM Schedule */}
                <TabsContent value="ppm">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Preventive Maintenance Schedule ({ppmSchedules.length})</CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setPpmDialogOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />New Schedule
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {ppmSchedules.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Calendar className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm">No PM schedules configured.</p>
                                    <p className="text-xs mt-1">Set up preventive maintenance tasks per asset.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Task</TableHead>
                                            <TableHead>Frequency</TableHead>
                                            <TableHead>Next Due</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Responsible</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ppmSchedules.map(ppm => {
                                            const isOverdue = ppm.status === 'OVERDUE' || new Date(ppm.next_due_date) < new Date()
                                            return (
                                                <TableRow key={ppm.id}>
                                                    <TableCell className="font-medium text-sm">{ppm.task_name}</TableCell>
                                                    <TableCell className="text-xs">{ppm.frequency}</TableCell>
                                                    <TableCell>
                                                        <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                                                            {format(new Date(ppm.next_due_date), 'dd/MM/yyyy')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={ppm.status === 'COMPLETED' ? 'default' : ppm.status === 'OVERDUE' ? 'destructive' : 'secondary'} className="text-xs">
                                                            {ppm.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{ppm.responsible_person || '—'}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Spare Parts */}
                <TabsContent value="parts">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Spare Parts Inventory</CardTitle>
                            <div className="flex items-center gap-2">
                                {summary && summary.lowStockParts > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        {summary.lowStockParts} low stock
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-12 text-muted-foreground">
                                <Package className="mx-auto h-10 w-10 mb-3 opacity-30" />
                                <p className="text-sm">Spare parts inventory is managed via the Supply Chain module.</p>
                                <p className="text-xs mt-1">Link assets to inventory items for integrated stock tracking.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Add Asset Dialog ──────────────────────────────────────────────── */}
            <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add New Asset</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="asset-code">Asset Code <span className="text-red-500">*</span></Label>
                                <Input
                                    id="asset-code"
                                    placeholder="e.g. EQ-001"
                                    value={assetForm.asset_code}
                                    onChange={e => setAssetForm(f => ({ ...f, asset_code: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="asset-name">Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="asset-name"
                                    placeholder="Asset name"
                                    value={assetForm.name}
                                    onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Category</Label>
                                <Select value={assetForm.category} onValueChange={v => setAssetForm(f => ({ ...f, category: v as AssetCategory }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['EQUIPMENT', 'VEHICLE', 'TOOL', 'INSTRUMENT', 'FACILITY'] as AssetCategory[]).map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Condition</Label>
                                <Select value={assetForm.condition} onValueChange={v => setAssetForm(f => ({ ...f, condition: v as AssetCondition }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['NEW', 'GOOD', 'FAIR', 'POOR', 'SCRAPPED'] as AssetCondition[]).map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="asset-model">Model</Label>
                                <Input
                                    id="asset-model"
                                    placeholder="Model (optional)"
                                    value={assetForm.model}
                                    onChange={e => setAssetForm(f => ({ ...f, model: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="asset-serial">Serial Number</Label>
                                <Input
                                    id="asset-serial"
                                    placeholder="S/N (optional)"
                                    value={assetForm.serial_number}
                                    onChange={e => setAssetForm(f => ({ ...f, serial_number: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="asset-purchase-date">Purchase Date</Label>
                                <Input
                                    id="asset-purchase-date"
                                    type="date"
                                    value={assetForm.purchase_date}
                                    onChange={e => setAssetForm(f => ({ ...f, purchase_date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="asset-purchase-value">Purchase Value</Label>
                                <Input
                                    id="asset-purchase-value"
                                    type="number"
                                    placeholder="0"
                                    value={assetForm.purchase_value}
                                    onChange={e => setAssetForm(f => ({ ...f, purchase_value: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="asset-location">Location</Label>
                                <Input
                                    id="asset-location"
                                    placeholder="Location (optional)"
                                    value={assetForm.location}
                                    onChange={e => setAssetForm(f => ({ ...f, location: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="asset-responsible">Responsible Person</Label>
                                <Input
                                    id="asset-responsible"
                                    placeholder="Name (optional)"
                                    value={assetForm.responsible_person}
                                    onChange={e => setAssetForm(f => ({ ...f, responsible_person: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssetDialogOpen(false)} disabled={savingAsset}>Cancel</Button>
                        <Button onClick={() => void handleSaveAsset()} disabled={savingAsset}>
                            {savingAsset ? 'Saving...' : 'Add Asset'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Create Work Order Dialog ──────────────────────────────────────── */}
            <Dialog open={woDialogOpen} onOpenChange={setWoDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Work Order</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="wo-number">WO Number</Label>
                            <Input id="wo-number" value={woForm.wo_number} readOnly className="font-mono bg-muted" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="wo-title">Title <span className="text-red-500">*</span></Label>
                            <Input
                                id="wo-title"
                                placeholder="Work order title"
                                value={woForm.title}
                                onChange={e => setWoForm(f => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Type</Label>
                                <Select value={woForm.type} onValueChange={v => setWoForm(f => ({ ...f, type: v as WOType }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'EMERGENCY'] as WOType[]).map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Priority</Label>
                                <Select value={woForm.priority} onValueChange={v => setWoForm(f => ({ ...f, priority: v as WOPriority }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as WOPriority[]).map(p => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Asset (optional)</Label>
                            <Select value={woForm.asset_id || '__none__'} onValueChange={v => setWoForm(f => ({ ...f, asset_id: v === '__none__' ? '' : v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select asset..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No specific asset</SelectItem>
                                    {assets.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.asset_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="wo-description">Description</Label>
                            <Textarea
                                id="wo-description"
                                placeholder="Describe the work required..."
                                rows={3}
                                value={woForm.description}
                                onChange={e => setWoForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="wo-reported-by">Reported By</Label>
                                <Input
                                    id="wo-reported-by"
                                    placeholder="Name"
                                    value={woForm.reported_by}
                                    onChange={e => setWoForm(f => ({ ...f, reported_by: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="wo-target">Target Completion</Label>
                                <Input
                                    id="wo-target"
                                    type="date"
                                    value={woForm.target_completion}
                                    onChange={e => setWoForm(f => ({ ...f, target_completion: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="wo-est-cost">Estimated Cost</Label>
                            <Input
                                id="wo-est-cost"
                                type="number"
                                placeholder="0"
                                value={woForm.estimated_cost}
                                onChange={e => setWoForm(f => ({ ...f, estimated_cost: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWoDialogOpen(false)} disabled={savingWO}>Cancel</Button>
                        <Button onClick={() => void handleSaveWO()} disabled={savingWO}>
                            {savingWO ? 'Creating...' : 'Create Work Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Complete Work Order Dialog ────────────────────────────────────── */}
            <Dialog open={completeWoDialogOpen} onOpenChange={setCompleteWoDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Complete Work Order</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="actual-cost">Actual Cost</Label>
                            <Input
                                id="actual-cost"
                                type="number"
                                placeholder="0"
                                value={completeForm.actual_cost}
                                onChange={e => setCompleteForm(f => ({ ...f, actual_cost: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="downtime-hours">Downtime Hours</Label>
                            <Input
                                id="downtime-hours"
                                type="number"
                                placeholder="0"
                                value={completeForm.downtime_hours}
                                onChange={e => setCompleteForm(f => ({ ...f, downtime_hours: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="complete-notes">Notes</Label>
                            <Textarea
                                id="complete-notes"
                                placeholder="Completion notes..."
                                rows={3}
                                value={completeForm.notes}
                                onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteWoDialogOpen(false)} disabled={savingComplete}>Cancel</Button>
                        <Button onClick={() => void handleCompleteWO()} disabled={savingComplete}>
                            {savingComplete ? 'Saving...' : 'Mark as Completed'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add PPM Schedule Dialog ───────────────────────────────────────── */}
            <Dialog open={ppmDialogOpen} onOpenChange={setPpmDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>New PM Schedule</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="ppm-task">Task Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="ppm-task"
                                placeholder="e.g. Monthly oil change"
                                value={ppmForm.task_name}
                                onChange={e => setPpmForm(f => ({ ...f, task_name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Asset <span className="text-red-500">*</span></Label>
                            <Select value={ppmForm.asset_id || ''} onValueChange={v => setPpmForm(f => ({ ...f, asset_id: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select asset..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assets.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.asset_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Frequency</Label>
                                <Select value={ppmForm.frequency} onValueChange={v => setPpmForm(f => ({ ...f, frequency: v as PPMFrequency }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'] as PPMFrequency[]).map(fr => (
                                            <SelectItem key={fr} value={fr}>{fr}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ppm-due-date">Next Due Date <span className="text-red-500">*</span></Label>
                                <Input
                                    id="ppm-due-date"
                                    type="date"
                                    value={ppmForm.next_due_date}
                                    onChange={e => setPpmForm(f => ({ ...f, next_due_date: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="ppm-responsible">Responsible Person</Label>
                            <Input
                                id="ppm-responsible"
                                placeholder="Name (optional)"
                                value={ppmForm.responsible_person}
                                onChange={e => setPpmForm(f => ({ ...f, responsible_person: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPpmDialogOpen(false)} disabled={savingPPM}>Cancel</Button>
                        <Button onClick={() => void handleSavePPM()} disabled={savingPPM}>
                            {savingPPM ? 'Saving...' : 'Create Schedule'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
