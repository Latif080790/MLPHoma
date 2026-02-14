
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Truck, Package, ShoppingCart, Warehouse, Plus, ArrowDown, ArrowUp, Search, Filter, PackageCheck, ArrowRightLeft, ClipboardList } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useProjectStore } from "@/store/projectStore"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { MaterialRequestDialog } from "@/components/supply-chain/MaterialRequestDialog"
import { PurchaseOrderDialog } from "@/components/supply-chain/PurchaseOrderDialog"
import { InventoryTransactionDialog } from "@/components/supply-chain/InventoryTransactionDialog"
import { GRNDialog } from "@/components/supply-chain/GRNDialog"
import { MaterialTransferDialog } from "@/components/supply-chain/MaterialTransferDialog"
import { WorkOrderPanel } from "@/components/modules/WorkOrderPanel"

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
    const [searchTerm, setSearchTerm] = useState("")
    const [grnOpen, setGrnOpen] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)

    useEffect(() => {
        if (activeProjectId) {
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            case 'REJECTED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
            case 'ORDERED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
            case 'RECEIVED': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800'
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }
    }

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<Truck size={18} />}
                title="Supply Chain (Logistics)"
                description="End-to-end material management: Requests -> Purchase Orders -> Inventory."
                actions={
                    <div className="flex gap-2">
                        <Button size="sm" className="gap-2" variant="outline" onClick={() => setGrnOpen(true)}>
                            <PackageCheck size={16} /> GRN
                        </Button>
                        <Button size="sm" className="gap-2" variant="outline" onClick={() => setTransferOpen(true)}>
                            <ArrowRightLeft size={16} /> Transfer
                        </Button>
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
            <GRNDialog open={grnOpen} onOpenChange={setGrnOpen} projectId={activeProjectId} />
            <MaterialTransferDialog open={transferOpen} onOpenChange={setTransferOpen} projectId={activeProjectId} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="requests" className="gap-2">
                            <Package size={14} /> Material Requests
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="gap-2">
                            <ShoppingCart size={14} /> Purchase Orders
                        </TabsTrigger>
                        <TabsTrigger value="inventory" className="gap-2">
                            <Warehouse size={14} /> Inventory
                        </TabsTrigger>
                        <TabsTrigger value="spk" className="gap-2">
                            <ClipboardList size={14} /> SPK / Opname
                        </TabsTrigger>
                    </TabsList>

                    <div className="relative w-64 hidden md:block">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search items..."
                            className="pl-8 h-9 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* --- MATERIAL REQUESTS --- */}
                <TabsContent value="requests" className="space-y-4">
                    {materialRequests.length === 0 ? (
                        <EmptyState
                            title="No Material Requests"
                            description="Site managers can request materials here. Requests link to WBS tasks."
                            imageKeyword="request"
                        />
                    ) : (
                        <div className="grid gap-3">
                            {materialRequests.map(mr => (
                                <div key={mr.id} className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-800">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{mr.itemName}</h3>
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${getStatusColor(mr.status)}`}>
                                                    {mr.status}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-slate-500 flex items-center gap-3 mt-0.5">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">Qty: {mr.quantityRequested} {mr.unit}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{mr.wbsName || 'General Request'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-slate-400">
                                        <div className="font-medium text-slate-600 dark:text-slate-400">Required: {mr.dateRequired || 'ASAP'}</div>
                                        <div>ID: {mr.id.slice(0, 8)}</div>
                                    </div>
                                </div>
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
                        <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                                    <TableRow>
                                        <TableHead className="w-[120px]">PO Number</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="w-[120px]">Status</TableHead>
                                        <TableHead className="text-right">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {purchaseOrders.map(po => (
                                        <TableRow key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                                            <TableCell className="font-mono font-medium text-blue-600">{po.poNumber}</TableCell>
                                            <TableCell className="font-medium">{po.vendorName || '-'}</TableCell>
                                            <TableCell className="text-right font-semibold">Rp {po.totalAmount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] px-2 border ${getStatusColor(po.status)}`}>
                                                    {po.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-slate-500">{format(new Date(po.createdAt), 'dd MMM yyyy')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* --- INVENTORY --- */}
                <TabsContent value="inventory" className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-dashed">
                        <div className="text-sm text-slate-500 ml-2">Digital Warehouse <span className="text-slate-300">|</span> Real-time Levels</div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleInvClick("IN")}>
                                <ArrowDown size={14} /> Stock In
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleInvClick("OUT")}>
                                <ArrowUp size={14} /> Stock Out
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {inventoryStock.map((item, idx) => (
                            <Card key={idx} className="overflow-hidden hover:shadow-md transition-all border-l-4 border-l-slate-300 hover:border-l-blue-500">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{item.materialName}</h3>
                                            <p className="text-xs text-slate-500">Unit: {item.unit} • SKU: {generateSku(item.materialName)}</p>
                                        </div>
                                        <div className={`p-2 rounded-lg ${(item.currentStock ?? 0) > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
                                            <Warehouse size={18} />
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="space-y-1">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Movement</div>
                                            <div className="flex gap-3 text-xs font-mono">
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <ArrowDown size={10} /> {item.totalIn}
                                                </span>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-red-500 flex items-center gap-1">
                                                    <ArrowUp size={10} /> {item.totalOut}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                                {item.currentStock}
                                            </div>
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Available</div>
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

                {/* --- SPK / OPNAME --- */}
                <TabsContent value="spk" className="space-y-4">
                    <WorkOrderPanel projectId={activeProjectId} />
                </TabsContent>

            </Tabs>
        </div>
    )
}

function generateSku(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) + '-' + Math.floor(Math.random() * 999)
}
