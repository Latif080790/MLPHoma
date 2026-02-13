
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "../../../components/modules/ModuleHeader"
import { GitPullRequest, DollarSign, Clock, AlertOctagon, Plus, TrendingUp } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import { useProjectStore } from "../../../store/projectStore"
import { useChangeOrderStore } from "../../../store/changeOrderStore"
import { format } from "date-fns"
import { EmptyState } from "../../../components/common/EmptyState"
import { ChangeOrderDialog } from "../../../components/change-order/ChangeOrderDialog"

export default function ChangeManagement() {
    const { activeProjectId } = useProjectStore()
    const { orders, fetchOrders, loading } = useChangeOrderStore()
    const [activeTab, setActiveTab] = useState("log")
    const [dialogOpen, setDialogOpen] = useState(false)

    useEffect(() => {
        if (activeProjectId) {
            fetchOrders(activeProjectId)
        }
    }, [activeProjectId])

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Please select a project to manage changes." />

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

            <ChangeOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={activeProjectId} />

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
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th className="p-3 font-medium">VO Number</th>
                                        <th className="p-3 font-medium">Title</th>
                                        <th className="p-3 font-medium">Status</th>
                                        <th className="p-3 font-medium text-right">Cost Impact</th>
                                        <th className="p-3 font-medium text-right">Time Impact</th>
                                        <th className="p-3 font-medium text-right">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id} className="border-t hover:bg-muted/50 cursor-pointer">
                                            <td className="p-3 font-mono">{order.vo_number}</td>
                                            <td className="p-3">
                                                <div className="font-medium">{order.title}</div>
                                                <div className="text-xs text-neutral-500 truncate max-w-[300px]">{order.description}</div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={
                                                    order.status === 'APPROVED' ? 'default' :
                                                        order.status === 'REJECTED' ? 'destructive' : 'outline'
                                                }>
                                                    {order.status}
                                                </Badge>
                                            </td>
                                            <td className={`p-3 text-right font-medium ${order.cost_impact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {order.cost_impact > 0 ? '+' : ''}Rp {order.cost_impact.toLocaleString()}
                                            </td>
                                            <td className={`p-3 text-right font-medium ${order.schedule_impact_days > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {order.schedule_impact_days > 0 ? '+' : ''}{order.schedule_impact_days} Days
                                            </td>
                                            <td className="p-3 text-right text-neutral-500">{format(new Date(order.created_at), 'dd MMM yyyy')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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

                    <Card className="bg-blue-50 border-blue-100">
                        <CardContent className="p-4 flex gap-4">
                            <AlertOctagon className="text-blue-500 mt-1" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Impact Summary</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    The project is currently facing a total potential cost overrun of <strong>Rp {totalCostImpact.toLocaleString()}</strong> and a schedule delay of <strong>{totalTimeImpact} days</strong>.
                                    Approval of pending items will formalize these changes into the project baseline.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
