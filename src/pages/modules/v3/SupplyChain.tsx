
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Truck, Package, ShoppingCart, Warehouse, Plus, ArrowDown, ArrowUp } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/store/projectStore"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { MaterialRequestDialog } from "@/components/supply-chain/MaterialRequestDialog"
import { PurchaseOrderDialog } from "@/components/supply-chain/PurchaseOrderDialog"
import { InventoryTransactionDialog } from "@/components/supply-chain/InventoryTransactionDialog"

export default function SupplyChain() {
    const { activeProjectId } = useProjectStore()
    const {
        materialRequests,
        purchaseOrders,
        inventoryStock,
        loading,
        fetchMaterialRequests,
        fetchPurchaseOrders,
        fetchInventory
    } = useSupplyChainStore()

    const [activeTab, setActiveTab] = useState("requests")
    const [mrOpen, setMrOpen] = useState(false)
    const [poOpen, setPoOpen] = useState(false)
    const [invOpen, setInvOpen] = useState(false)
    const [invType, setInvType] = useState<"IN" | "OUT">("IN")

    const [projectId, setProjectId] = useState<string>("")

    useEffect(() => {
        if (activeProjectId) {
            setProjectId(activeProjectId)
            if (activeTab === "requests") fetchMaterialRequests(activeProjectId)
            if (activeTab === "orders") fetchPurchaseOrders(activeProjectId)
            if (activeTab === "inventory") fetchInventory(activeProjectId)
        }
    }, [activeProjectId, activeTab])

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Please select a project to manage supply chain." />

    const handleInvClick = (type: "IN" | "OUT") => {
        setInvType(type)
        setInvOpen(true)
    }

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<Truck size={18} />}
                title="Supply Chain (Logistics)"
                description="End-to-end material management: Requests -> Purchase Orders -> Inventory."
                actions={
                    <div className="flex gap-2">
                        <Button size="sm" className="gap-2" variant="outline" onClick={() => setPoOpen(true)}>
                            <ShoppingCart size={16} /> New PO
                        </Button>
                        <Button size="sm" className="gap-2" onClick={() => setMrOpen(true)}>
                            <Plus size={16} /> New Request
                        </Button>
                    </div>
                }
            />

            <MaterialRequestDialog open={mrOpen} onOpenChange={setMrOpen} projectId={activeProjectId} />
            <PurchaseOrderDialog open={poOpen} onOpenChange={setPoOpen} projectId={activeProjectId} />
            <InventoryTransactionDialog open={invOpen} onOpenChange={setInvOpen} projectId={activeProjectId} defaultType={invType} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="requests" className="gap-2">
                        <Package size={14} /> Material Requests
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="gap-2">
                        <ShoppingCart size={14} /> Purchase Orders
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="gap-2">
                        <Warehouse size={14} /> Inventory
                    </TabsTrigger>
                </TabsList>

                {/* --- MATERIAL REQUESTS --- */}
                <TabsContent value="requests" className="space-y-4">
                    {materialRequests.length === 0 ? (
                        <EmptyState
                            title="No Material Requests"
                            description="Site managers can request materials here. Requests link to WBS tasks."
                            imageKeyword="request"
                        />
                    ) : (
                        <div className="grid gap-4">
                            {materialRequests.map(mr => (
                                <Card key={mr.id} className="cursor-pointer hover:border-blue-500 transition-colors">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-lg">{mr.itemName}</span>
                                                <Badge variant={mr.status === 'PENDING' ? 'outline' : 'secondary'}>
                                                    {mr.status}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-neutral-500 flex flex-col sm:flex-row sm:gap-4">
                                                <span>Qty: {mr.quantityRequested} {mr.unit}</span>
                                                <span>For: {mr.wbsCode} - {mr.wbsName || 'Unspecified Task'}</span>
                                                <span>Date Required: {mr.dateRequired || 'ASAP'}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* --- PURCHASE ORDERS --- */}
                <TabsContent value="orders">
                    {purchaseOrders.length === 0 ? (
                        <EmptyState
                            title="No Purchase Orders"
                            description="Procurement team creates POs from approved Material Requests."
                            imageKeyword="purchase order"
                        />
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th className="p-3 font-medium">PO Number</th>
                                        <th className="p-3 font-medium">Vendor</th>
                                        <th className="p-3 font-medium">Total Amount</th>
                                        <th className="p-3 font-medium">Status</th>
                                        <th className="p-3 font-medium">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchaseOrders.map(po => (
                                        <tr key={po.id} className="border-t hover:bg-muted/50 cursor-pointer">
                                            <td className="p-3 font-mono">{po.poNumber}</td>
                                            <td className="p-3">{po.vendorName || '-'}</td>
                                            <td className="p-3 font-medium">Rp {po.totalAmount.toLocaleString()}</td>
                                            <td className="p-3">
                                                <Badge variant="outline">{po.status}</Badge>
                                            </td>
                                            <td className="p-3 text-neutral-500">{format(new Date(po.createdAt), 'dd MMM yyyy')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                {/* --- INVENTORY --- */}
                <TabsContent value="inventory" className="space-y-6">
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleInvClick("IN")}>
                            <ArrowDown size={16} /> Stock In
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleInvClick("OUT")}>
                            <ArrowUp size={16} /> Stock Out
                        </Button>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {inventoryStock.map((item, idx) => (
                            <Card key={idx}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">{item.materialName}</CardTitle>
                                    <CardDescription>Unit: {item.unit}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-sm text-neutral-500">In / Out</div>
                                            <div className="font-mono text-xs">
                                                {item.totalIn} / {item.totalOut}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-blue-600">{item.currentStock}</div>
                                            <div className="text-xs text-neutral-500">Current Stock</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {inventoryStock.length === 0 && (
                            <div className="col-span-full">
                                <EmptyState
                                    title="Inventory Empty"
                                    description="Stock levels will appear here once items are received via PO."
                                    imageKeyword="warehouse"
                                />
                            </div>
                        )}
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    )
}
