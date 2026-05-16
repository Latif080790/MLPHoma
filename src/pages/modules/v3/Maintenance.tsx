import React, { useEffect, useState, useMemo } from 'react'
import { Wrench, Package, ClipboardList, Calendar, Plus, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { maintenanceService } from '@/services/maintenanceService'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ModulePageState from '@/components/common/ModulePageState'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import type { Asset, WorkOrder, PPMSchedule, MaintenanceSummary } from '@/types/maintenance'
import { format } from 'date-fns'

const CONDITION_COLORS: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    GOOD: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FAIR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    POOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    SCRAPPED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const WO_PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const WO_STATUS_ICON: Record<string, React.ReactNode> = {
    OPEN: <Clock className="h-3.5 w-3.5 text-slate-500" />,
    IN_PROGRESS: <Wrench className="h-3.5 w-3.5 text-blue-500" />,
    PENDING_PARTS: <Package className="h-3.5 w-3.5 text-yellow-500" />,
    COMPLETED: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    CANCELLED: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
}

export default function Maintenance() {
    const { activeProjectId } = useProjectStore()
    const { handleAsync } = useErrorHandler()

    const [loading, setLoading] = useState(true)
    const [assets, setAssets] = useState<Asset[]>([])
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([])
    const [summary, setSummary] = useState<MaintenanceSummary | null>(null)
    const [activeTab, setActiveTab] = useState('assets')
    const [srStatus, setSrStatus] = useState('')

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

    const handleCompleteWO = async (woId: string) => {
        await handleAsync(async () => {
            await maintenanceService.updateWorkOrderStatus(woId, 'COMPLETED', new Date().toISOString())
            toast.success('Work order closed')
            await load()
        }, 'default')
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
                            <Button size="sm" variant="outline" disabled>
                                <Plus className="h-3.5 w-3.5 mr-1" />Add Asset
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
                            <Button size="sm" variant="outline" disabled>
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
                                                            onClick={() => void handleCompleteWO(wo.id)}
                                                        >
                                                            Close
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
                        <CardHeader>
                            <CardTitle className="text-sm">Preventive Maintenance Schedule ({ppmSchedules.length})</CardTitle>
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
        </PageShell>
    )
}
