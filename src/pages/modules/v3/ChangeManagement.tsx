
import React, { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { GitPullRequest, DollarSign, Clock, Plus, TrendingUp, Check, X, Loader2, AlertTriangle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/store/projectStore"
import { useChangeOrderStore } from "@/store/changeOrderStore"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { ChangeOrderDialog } from "@/components/change-order/ChangeOrderDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { ImpactAnalysisPanel } from "@/components/change/ImpactAnalysisPanel"
import { CCO_STATUS_LABELS, CCO_STATUS_COLORS } from "@/services/ccoStateMachine"
import type { ChangeOrderStatus } from "@/types/change-order"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import ModulePageState from "@/components/common/ModulePageState"
import { Skeleton } from "@/components/common/LoadingSkeleton"

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, ModeSwitch, SummaryStrip, AlertStrip } from '@/components/patterns'

export default function ChangeManagement() {
    const { activeProjectId } = useProjectStore()
    const activeProjectName = useProjectStore(s => activeProjectId ? s.projects[activeProjectId]?.name || 'Project' : 'Project')
    const { handleAsync } = useErrorHandler()
    const { orders, fetchOrders, loading, updateStatus, previewCascade, cascadePreview, previewLoading, clearPreview } = useChangeOrderStore()
    const [activeTab, setActiveTab] = useState("log")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

    // P0.3: Virtualizer for change orders table
    const coScrollRef = useRef<HTMLDivElement>(null)
    const coVirtualizer = useVirtualizer({
        count: orders.length,
        getScrollElement: () => coScrollRef.current,
        estimateSize: () => 56,
        overscan: 8,
    })
    const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)
    const [pendingRejectId, setPendingRejectId] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')

    useEffect(() => {
        if (activeProjectId) {
            fetchOrders(activeProjectId)
        }
    }, [activeProjectId, fetchOrders])

    const handleApproveClick = async (orderId: string) => {
        setPendingApprovalId(orderId)
        const result = await handleAsync(async () => {
            await previewCascade(orderId)
            return true
        }, 'conflict.version', { showToast: false })

        if (result) {
            setConfirmOpen(true)
        }
    }

    const handleConfirmApprove = async () => {
        if (!pendingApprovalId) return
        setSrStatus('Approving change order...')
        setActionLoading(pendingApprovalId)
        const result = await handleAsync(async () => {
            await updateStatus(pendingApprovalId, 'APPROVED')
            return true
        }, 'approval.general')

        if (result) {
            toast.success('Change Order approved')
            setSrStatus('Change order approved.')
        } else {
            setSrStatus('Failed to approve change order.')
        }

        setActionLoading(null)
        setConfirmOpen(false)
        setPendingApprovalId(null)
        clearPreview()
    }

    const handleRejectClick = (orderId: string) => {
        setPendingRejectId(orderId)
        setRejectConfirmOpen(true)
    }

    const handleRejectConfirm = async () => {
        if (!pendingRejectId) return
        setSrStatus('Rejecting change order...')
        setActionLoading(pendingRejectId)
        const result = await handleAsync(async () => {
            await updateStatus(pendingRejectId, 'REJECTED')
            return true
        }, 'approval.general')

        if (result) {
            toast.success('Change Order rejected')
            setSrStatus('Change order rejected.')
        } else {
            setSrStatus('Failed to reject change order.')
        }

        setActionLoading(null)
        setRejectConfirmOpen(false)
        setPendingRejectId(null)
    }

    // Calculate Impact Analysis
    const totalCostImpact = orders.reduce((sum, o) => sum + (o.cost_impact || 0), 0)
    const totalTimeImpact = orders.reduce((sum, o) => sum + (o.schedule_impact_days || 0), 0)
    const approvedCost = orders.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + (o.cost_impact || 0), 0)
    const pendingCost = orders.filter(o => o.status === 'PENDING_APPROVAL').reduce((sum, o) => sum + (o.cost_impact || 0), 0)

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<GitPullRequest size={18} />}
                title="Change Management (CCO)"
                description="Track Contract Change Orders (CCO) and Variation Orders (VO)."
                variant="empty"
                message="Select an active project to manage change orders."
            />
        )
    }

    if (loading && orders.length === 0) {
        return (
            <ModulePageState
                icon={<GitPullRequest size={18} />}
                title="Change Management (CCO)"
                description="Track Contract Change Orders (CCO) and Variation Orders (VO)."
                variant="loading"
                message="Loading change orders..."
            />
        )
    }

    const pendingCount = orders.filter(o => o.status === 'PENDING_APPROVAL' || o.status === 'DRAFT').length

    // ── ModeSwitch tab options ───────────────────────────────────────────────
    const ccoTabOptions = [
        { value: 'log', label: 'Change Log', icon: <GitPullRequest className="h-3.5 w-3.5" /> },
        { value: 'analysis', label: 'Impact', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    ]

    // ── SummaryStrip items ───────────────────────────────────────────────────
    const ccoSummary = [
        { label: 'Cost Impact', value: `Rp ${totalCostImpact.toLocaleString()}`, status: (totalCostImpact > 0 ? 'danger' : 'success') as 'danger' | 'success' },
        { label: 'Schedule Slip', value: `${totalTimeImpact} days`, status: (totalTimeImpact > 0 ? 'danger' : 'success') as 'danger' | 'success' },
        { label: 'Approved', value: `Rp ${approvedCost.toLocaleString()}`, status: 'warning' as const },
        { label: 'Pending', value: `Rp ${pendingCost.toLocaleString()}`, status: (pendingCost > 0 ? 'info' : 'neutral') as 'info' | 'neutral' },
    ]

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'VOs',
                            level: pendingCount > 0 ? 'warning' : 'good',
                            value: `${orders.length}`,
                        },
                    ]}
                />
            }
            navigation={
                <ModeSwitch
                    options={ccoTabOptions}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            }
            header={
                <WorkspaceHeader
                    title="Change Management (CCO)"
                    subtitle="Track Contract Change Orders (CCO) & Variation Orders (VO)"
                    primaryAction={{
                        label: 'New Change Order',
                        icon: <Plus className="h-3.5 w-3.5" />,
                        onClick: () => setDialogOpen(true),
                    }}
                />
            }
            summary={
                <SummaryStrip items={ccoSummary} variant="compact-cards" />
            }
            alert={
                pendingCount > 0 ? (
                    <AlertStrip
                        severity="warning"
                        message={`${pendingCount} change order${pendingCount > 1 ? 's' : ''} pending approval — Rp ${pendingCost.toLocaleString()} potential impact`}
                    />
                ) : undefined
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <ChangeOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={activeProjectId!} />

            {/* Status Pipeline Counters */}
            {orders.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {(['DRAFT', 'SUBMITTED', 'REVIEWED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as ChangeOrderStatus[]).map(status => {
                        const count = orders.filter(o => o.status === status).length
                        if (count === 0) return null
                        return (
                            <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${CCO_STATUS_COLORS[status]}`}>
                                <span className="text-xs opacity-70">{CCO_STATUS_LABELS[status]}</span>
                                <span className="font-mono font-bold">{count}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

                <TabsContent value="log" className="space-y-4">
                    {orders.length === 0 ? (
                        <EmptyState
                            title="No Change Orders"
                            description="Create a Variation Order (VO) to track scope, cost, or time changes."
                            imageKeyword="contract"
                        />
                    ) : (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div ref={coScrollRef} className="max-h-[600px] overflow-auto relative">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">VO Number</TableHead>
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Title</TableHead>
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Status</TableHead>
                                            <TableHead className="p-3 font-semibold text-right text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Cost Impact</TableHead>
                                            <TableHead className="p-3 font-semibold text-right text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Time Impact</TableHead>
                                            <TableHead className="p-3 font-semibold text-right text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Created At</TableHead>
                                            <TableHead className="p-3 font-semibold text-center text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* P0.3 virtual rows */}
                                        {coVirtualizer.getVirtualItems().length > 0 && (
                                            <tr style={{ height: coVirtualizer.getVirtualItems()[0].start }} aria-hidden />
                                        )}
                                        {coVirtualizer.getVirtualItems().map(vRow => {
                                            const order = orders[vRow.index]
                                            return (
                                            <TableRow key={order.id} data-index={vRow.index} ref={coVirtualizer.measureElement} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors">
                                                <TableCell className="p-3 font-mono text-xs font-medium text-blue-600 dark:text-blue-400 border-r border-transparent">{order.vo_number}</TableCell>
                                                <TableCell className="p-3">
                                                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{order.title}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[300px]">{order.description}</div>
                                                </TableCell>
                                                <TableCell className="p-3">
                                                    <Badge className={`text-xs font-semibold px-2 py-0.5 ${CCO_STATUS_COLORS[order.status]}`}>
                                                        {CCO_STATUS_LABELS[order.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`p-3 text-right font-mono text-xs font-semibold ${order.cost_impact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {order.cost_impact > 0 ? '+' : ''}Rp {order.cost_impact.toLocaleString()}
                                                </TableCell>
                                                <TableCell className={`p-3 text-right font-mono text-xs font-semibold ${order.schedule_impact_days > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {order.schedule_impact_days > 0 ? '+' : ''}{order.schedule_impact_days} Days
                                                </TableCell>
                                                <TableCell className="p-3 text-right text-xs text-slate-500 font-mono">{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="p-3 text-center">
                                                    {(order.status === 'DRAFT' || order.status === 'PENDING_APPROVAL') ? (
                                                        <div className="flex items-center justify-center gap-1 opacity-100">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                disabled={actionLoading === order.id}
                                                                onClick={(e) => { e.stopPropagation(); handleApproveClick(order.id) }}
                                                            >
                                                                {actionLoading === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                disabled={actionLoading === order.id}
                                                                onClick={(e) => { e.stopPropagation(); handleRejectClick(order.id) }}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            )
                                        })}
                                        {coVirtualizer.getVirtualItems().length > 0 && (() => {
                                            const last = coVirtualizer.getVirtualItems().at(-1)!
                                            const pad = coVirtualizer.getTotalSize() - last.end
                                            return pad > 0 ? <tr style={{ height: pad }} aria-hidden /> : null
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="analysis" className="space-y-6">
                    {/* Visual Impact Cascade Flow */}
                    {orders.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Cascade Impact Flow</p>
                            <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
                                {[
                                    {
                                        label: 'Change Order',
                                        icon: '📋',
                                        value: `${orders.length} VO`,
                                        sub: `${orders.filter(o => o.status === 'APPROVED').length} approved`,
                                        color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
                                        textColor: 'text-blue-700 dark:text-blue-300',
                                    },
                                    {
                                        label: 'RAB Impact',
                                        icon: '💰',
                                        value: totalCostImpact >= 0 ? `+Rp ${(totalCostImpact / 1e6).toFixed(1)}M` : `-Rp ${(Math.abs(totalCostImpact) / 1e6).toFixed(1)}M`,
                                        sub: 'total budget delta',
                                        color: totalCostImpact > 0 ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : 'border-green-400 bg-green-50 dark:bg-green-950/30',
                                        textColor: totalCostImpact > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300',
                                    },
                                    {
                                        label: 'RAP Effect',
                                        icon: '📊',
                                        value: approvedCost > 0 ? `+Rp ${(approvedCost / 1e6).toFixed(1)}M` : '—',
                                        sub: 'committed cost',
                                        color: approvedCost > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30',
                                        textColor: approvedCost > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400',
                                    },
                                    {
                                        label: 'Schedule Slip',
                                        icon: '📅',
                                        value: totalTimeImpact > 0 ? `+${totalTimeImpact} hari` : '0 hari',
                                        sub: 'extension of time',
                                        color: totalTimeImpact > 0 ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30',
                                        textColor: totalTimeImpact > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-slate-400',
                                    },
                                    {
                                        label: 'Finance Impact',
                                        icon: '🏦',
                                        value: pendingCost > 0 ? `Rp ${(pendingCost / 1e6).toFixed(1)}M pending` : 'Stable',
                                        sub: 'cash flow effect',
                                        color: pendingCost > 0 ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30' : 'border-green-400 bg-green-50 dark:bg-green-950/30',
                                        textColor: pendingCost > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300',
                                    },
                                ].map((node, idx, arr) => (
                                    <React.Fragment key={node.label}>
                                        <div className={`flex-1 min-w-[120px] rounded-lg border-2 p-3 ${node.color}`}>
                                            <div className="text-lg mb-1">{node.icon}</div>
                                            <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${node.textColor}`}>{node.label}</div>
                                            <div className={`text-sm font-semibold ${node.textColor}`}>{node.value}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{node.sub}</div>
                                        </div>
                                        {idx < arr.length - 1 && (
                                            <div className="flex items-center px-1 text-slate-300 dark:text-slate-600 shrink-0">
                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M7 5l6 5-6 5V5z" />
                                                </svg>
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Cost Impact</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">Rp {totalCostImpact.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Across all VOs (inc. Draft)</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Schedule Slip</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalTimeImpact} Days</div>
                                <p className="text-xs text-muted-foreground">Total extension of time</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Approved Cost</CardTitle>
                                <Badge variant="default">Approved</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">Rp {approvedCost.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Committed extra cost</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Cost</CardTitle>
                                <Badge variant="outline">Pending</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">Rp {pendingCost.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Potential extra cost</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Per-Order Impact Analysis Panels */}
                    {orders.length === 0 ? (
                        <EmptyState title="No Change Orders" description="Create a VO to see impact analysis." />
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <ImpactAnalysisPanel
                                    key={order.id}
                                    changeOrder={order}
                                    onTransitioned={() => activeProjectId && fetchOrders(activeProjectId)}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Cascade Preview Confirmation Dialog */}
            <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v) { setConfirmOpen(false); clearPreview(); setPendingApprovalId(null) } }}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Confirm VO Approval
                        </DialogTitle>
                        <DialogDescription>
                            Approving this Change Order will cascade updates to RAB items and timeline tasks.
                        </DialogDescription>
                    </DialogHeader>

                    {previewLoading ? (
                        <div className="space-y-3 py-2" aria-live="polite" aria-busy="true">
                            <div className="text-sm text-muted-foreground">Calculating impact...</div>
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <Card key={`preview-skeleton-${idx}`}>
                                        <CardContent className="p-3 space-y-2">
                                            <Skeleton className="h-8 w-16" />
                                            <Skeleton className="h-3 w-24" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : cascadePreview ? (
                        <div className="space-y-3 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="border-blue-100 bg-blue-50/50">
                                    <CardContent className="p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-700">{cascadePreview.affectedRabItems}</div>
                                        <div className="text-xs text-blue-600">RAB Items Affected</div>
                                    </CardContent>
                                </Card>
                                <Card className="border-purple-100 bg-purple-50/50">
                                    <CardContent className="p-3 text-center">
                                        <div className="text-2xl font-bold text-purple-700">{cascadePreview.affectedTasks}</div>
                                        <div className="text-xs text-purple-600">Timeline Tasks Affected</div>
                                    </CardContent>
                                </Card>
                                <Card className={`border ${cascadePreview.estimatedBudgetDelta > 0 ? 'border-red-100 bg-red-50/50' : 'border-green-100 bg-green-50/50'}`}>
                                    <CardContent className="p-3 text-center">
                                        <div className={`text-lg font-bold ${cascadePreview.estimatedBudgetDelta > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                            {cascadePreview.estimatedBudgetDelta > 0 ? '+' : ''}Rp {cascadePreview.estimatedBudgetDelta.toLocaleString('id-ID')}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Budget Delta</div>
                                    </CardContent>
                                </Card>
                                <Card className={`border ${cascadePreview.estimatedScheduleDelta > 0 ? 'border-orange-100 bg-orange-50/50' : 'border-green-100 bg-green-50/50'}`}>
                                    <CardContent className="p-3 text-center">
                                        <div className={`text-lg font-bold ${cascadePreview.estimatedScheduleDelta > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                                            {cascadePreview.estimatedScheduleDelta > 0 ? '+' : ''}{cascadePreview.estimatedScheduleDelta} days
                                        </div>
                                        <div className="text-xs text-muted-foreground">Schedule Delta</div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); clearPreview(); setPendingApprovalId(null) }}>
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={previewLoading || actionLoading !== null}
                            onClick={handleConfirmApprove}
                        >
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Confirm Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Change Order?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone and will mark the selected change order as rejected.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRejectConfirm}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
