
import React, { useEffect, useState, useMemo } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { GitPullRequest, DollarSign, Clock, AlertOctagon, Plus, TrendingUp, Check, X, Loader2, AlertTriangle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export default function ChangeManagement() {
    const { activeProjectId } = useProjectStore()
    const { handleAsync } = useErrorHandler()
    const { orders, fetchOrders, loading, updateStatus, previewCascade, cascadePreview, previewLoading, clearPreview } = useChangeOrderStore()
    const [activeTab, setActiveTab] = useState("log")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)
    const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)
    const [pendingRejectId, setPendingRejectId] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        if (activeProjectId) {
            fetchOrders(activeProjectId)
        }
    }, [activeProjectId])

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
        setActionLoading(pendingApprovalId)
        const result = await handleAsync(async () => {
            await updateStatus(pendingApprovalId, 'APPROVED')
            return true
        }, 'approval.general')

        if (result) {
            toast.success('Change Order approved')
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
        setActionLoading(pendingRejectId)
        const result = await handleAsync(async () => {
            await updateStatus(pendingRejectId, 'REJECTED')
            return true
        }, 'approval.general')

        if (result) {
            toast.success('Change Order rejected')
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

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<GitPullRequest size={18} />}
                title="Change Management (CCO)"
                description="Track Contract Change Orders (CCO) and Variation Orders (VO)."
                actions={
                    <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
                        <Plus size={16} /> New Change Order
                    </Button>
                }
            />

            <ChangeOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={activeProjectId!} />

            {/* Status Pipeline Counters */}
            {orders.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {(['DRAFT', 'SUBMITTED', 'REVIEWED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as ChangeOrderStatus[]).map(status => {
                        const count = orders.filter(o => o.status === status).length
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
                <TabsList className="mb-4">
                    <TabsTrigger value="log" className="gap-2">
                        <GitPullRequest size={14} /> Change Log
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="gap-2">
                        <TrendingUp size={14} /> Impact Analysis
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="log" className="space-y-4">
                    {orders.length === 0 ? (
                        <EmptyState
                            title="No Change Orders"
                            description="Create a Variation Order (VO) to track scope, cost, or time changes."
                            imageKeyword="contract"
                        />
                    ) : (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div className="max-h-[600px] overflow-auto relative">
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
                                        {orders.map(order => (
                                            <TableRow key={order.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors">
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
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="analysis" className="space-y-6">
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
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Calculating impact...</span>
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
        </div>
    )
}
