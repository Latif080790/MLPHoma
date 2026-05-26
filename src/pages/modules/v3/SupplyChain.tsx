
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Truck, Package, ShoppingCart, Warehouse, Plus, FileText, ArrowDown, ArrowUp, PackageCheck, ArrowRightLeft, ClipboardList, ShieldCheck, XCircle } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useProjectStore } from "@/store/projectStore"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { useAuthStore } from "@/store/authStore"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { BulkActionBar } from "@/components/common/BulkActionBar"
import { ExcelImportPreviewDialog } from "@/components/common/ExcelImportPreviewDialog"
import { MaterialRequestDialog } from "@/components/supply-chain/MaterialRequestDialog"
import { PurchaseOrderDialog } from "@/components/supply-chain/PurchaseOrderDialog"
import { InventoryTransactionDialog } from "@/components/supply-chain/InventoryTransactionDialog"
import { GRNDialog } from "@/components/supply-chain/GRNDialog"
import { MaterialTransferDialog } from "@/components/supply-chain/MaterialTransferDialog"
import { MaterialTransferPanel } from "@/components/supply-chain/MaterialTransferPanel"
import { TraceChain, TraceCountBadge } from "@/components/common/TraceChip"
import { ProcurementTracePanel } from "@/components/supply-chain/ProcurementTracePanel"
import { MTRPanel } from "@/components/supply-chain/MTRPanel"
import { MRPAlertPanel } from '@/components/supply-chain/MRPAlertPanel'
import { SubcontractorPanel } from "@/components/supply-chain/SubcontractorPanel"
import { MaterialTransferRequestDialog } from "@/components/supply-chain/MaterialTransferRequestDialog"
import { MaterialTransferApprovalPanel } from "@/components/supply-chain/MaterialTransferApprovalPanel"
import type { PurchaseOrder } from "@/types/supply-chain"
import type { TraceableDocType } from "@/types/traceability"
import { useVirtualizer } from "@tanstack/react-virtual"
import ModulePageState from "@/components/common/ModulePageState"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"
import { toast } from "sonner"

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader, SummaryStrip } from '@/components/patterns'

const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'ORDERED', label: 'Ordered' },
    { value: 'RECEIVED', label: 'Received' },
]

const REQUEST_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Item A-Z' },
    { value: 'name-desc', label: 'Item Z-A' },
    { value: 'qty-high', label: 'Qty High-Low' },
    { value: 'qty-low', label: 'Qty Low-High' },
]

const ORDER_SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'amount-high', label: 'Amount High-Low' },
    { value: 'amount-low', label: 'Amount Low-High' },
]

export default function SupplyChain() {
    const { activeProjectId } = useProjectStore()
    const activeProjectName = useProjectStore(s => activeProjectId ? s.projects[activeProjectId]?.name || 'Project' : 'Project')
    const { handleAsync } = useErrorHandler()
    const {
        materialRequests,
        purchaseOrders,
        inventoryStock,
        loading,
        error,
        fetchMaterialRequests,
        fetchPurchaseOrders,
        fetchInventory,
        fetchTransfers,
        updatePoStatus,
        updateMrStatus,
        createPurchaseOrder,
    } = useSupplyChainStore()

    const [activeTab, setActiveTab] = useState("requests")
    const [mrOpen, setMrOpen] = useState(false)
    const [poOpen, setPoOpen] = useState(false)
    const [invOpen, setInvOpen] = useState(false)
    const [invType, setInvType] = useState<"IN" | "OUT">("IN")
    const [searchTerm, setSearchTerm] = useState(() => {
        try { return localStorage.getItem('supply.toolbar.query') || '' } catch { return '' }
    })
    const [statusFilter, setStatusFilter] = useState(() => {
        try { return localStorage.getItem('supply.toolbar.status') || 'all' } catch { return 'all' }
    })
    const [sortBy, setSortBy] = useState(() => {
        try { return localStorage.getItem('supply.toolbar.sort') || 'name-asc' } catch { return 'name-asc' }
    })
    const [requesterFilter, setRequesterFilter] = useState(() => {
        try { return localStorage.getItem('supply.requests.requester') || 'all' } catch { return 'all' }
    })
    const [requestDateFrom, setRequestDateFrom] = useState(() => {
        try { return localStorage.getItem('supply.requests.dateFrom') || '' } catch { return '' }
    })
    const [requestDateTo, setRequestDateTo] = useState(() => {
        try { return localStorage.getItem('supply.requests.dateTo') || '' } catch { return '' }
    })
    const [poVendorFilter, setPoVendorFilter] = useState(() => {
        try { return localStorage.getItem('supply.orders.vendor') || 'all' } catch { return 'all' }
    })
    const [poDateFrom, setPoDateFrom] = useState(() => {
        try { return localStorage.getItem('supply.orders.dateFrom') || '' } catch { return '' }
    })
    const [poDateTo, setPoDateTo] = useState(() => {
        try { return localStorage.getItem('supply.orders.dateTo') || '' } catch { return '' }
    })
    const [grnOpen, setGrnOpen] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)
    const [tracePo, setTracePo] = useState<PurchaseOrder | null>(null)
    const [mtrRequestOpen, setMtrRequestOpen] = useState(false)
    const [poImportOpen, setPoImportOpen] = useState(false)
    const [logisticsTab, setLogisticsTab] = useState<'transfers' | 'mtr'>('transfers')
    const [srStatus, setSrStatus] = useState('')

    const handlePoImport = useCallback(async (rows: Record<string, unknown>[]) => {
        if (!activeProjectId) return
        const poRows = rows
            .map((row) => ({
                poNumber: String(row.poNumber ?? row.po_number ?? '').trim(),
                vendorName: String(row.vendorName ?? row.vendor_name ?? '').trim(),
                itemName: String(row.itemName ?? row.item_name ?? '').trim(),
                quantity: Number(row.quantity ?? row.qty ?? 0),
                unitPrice: Number(row.unitPrice ?? row.unit_price ?? 0),
            }))
            .filter((row) => row.poNumber && row.vendorName && row.itemName && row.quantity > 0)

        if (!poRows.length) {
            toast.error('Tidak ada baris PO yang valid')
            return
        }

        for (const row of poRows) {
            await createPurchaseOrder(
                {
                    projectId: activeProjectId,
                    poNumber: row.poNumber,
                    vendorName: row.vendorName,
                    status: 'DRAFT',
                    totalAmount: row.quantity * row.unitPrice,
                },
                [{ itemName: row.itemName, quantity: row.quantity, unitPrice: row.unitPrice }],
            )
        }

        toast.success(`Imported ${poRows.length} purchase orders`)
        setPoImportOpen(false)
        await fetchPurchaseOrders(activeProjectId)
    }, [activeProjectId, createPurchaseOrder, fetchPurchaseOrders])

    // v4 Sprint 2: Bulk selection states
    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set())
    const [selectedMrIds, setSelectedMrIds] = useState<Set<string>>(new Set())

    const filteredMaterialRequests = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        return [...materialRequests]
            .filter((mr) => {
                const matchesQuery = !q ||
                    mr.itemName.toLowerCase().includes(q) ||
                    (mr.wbsName || '').toLowerCase().includes(q) ||
                    mr.status.toLowerCase().includes(q)
                const matchesStatus = statusFilter === 'all' || mr.status === statusFilter
                const requester = (mr.requestedBy || '').toLowerCase()
                const matchesRequester = requesterFilter === 'all' || requester === requesterFilter.toLowerCase()

                const requestDate = new Date(mr.dateRequired || mr.createdAt || 0)
                const fromBoundary = requestDateFrom ? new Date(`${requestDateFrom}T00:00:00`) : null
                const toBoundary = requestDateTo ? new Date(`${requestDateTo}T23:59:59`) : null
                const matchesDateFrom = !fromBoundary || requestDate >= fromBoundary
                const matchesDateTo = !toBoundary || requestDate <= toBoundary

                return matchesQuery && matchesStatus && matchesRequester && matchesDateFrom && matchesDateTo
            })
            .sort((a, b) => {
                if (sortBy === 'name-desc') return b.itemName.localeCompare(a.itemName)
                if (sortBy === 'qty-high') return b.quantityRequested - a.quantityRequested
                if (sortBy === 'qty-low') return a.quantityRequested - b.quantityRequested
                return a.itemName.localeCompare(b.itemName)
            })
    }, [materialRequests, searchTerm, statusFilter, sortBy, requesterFilter, requestDateFrom, requestDateTo])

    const filteredPurchaseOrders = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        return [...purchaseOrders]
            .filter((po) => {
                const matchesQuery = !q ||
                    po.poNumber.toLowerCase().includes(q) ||
                    (po.vendorName || '').toLowerCase().includes(q) ||
                    po.status.toLowerCase().includes(q)
                const matchesStatus = statusFilter === 'all' || po.status === statusFilter
                const vendor = (po.vendorName || '').toLowerCase()
                const matchesVendor = poVendorFilter === 'all' || vendor === poVendorFilter.toLowerCase()

                const createdDate = new Date(po.createdAt || 0)
                const fromBoundary = poDateFrom ? new Date(`${poDateFrom}T00:00:00`) : null
                const toBoundary = poDateTo ? new Date(`${poDateTo}T23:59:59`) : null
                const matchesDateFrom = !fromBoundary || createdDate >= fromBoundary
                const matchesDateTo = !toBoundary || createdDate <= toBoundary

                return matchesQuery && matchesStatus && matchesVendor && matchesDateFrom && matchesDateTo
            })
            .sort((a, b) => {
                if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                if (sortBy === 'amount-high') return b.totalAmount - a.totalAmount
                if (sortBy === 'amount-low') return a.totalAmount - b.totalAmount
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
    }, [purchaseOrders, searchTerm, statusFilter, sortBy, poVendorFilter, poDateFrom, poDateTo])

    const requesterOptions = useMemo(() => {
        const map = new Map<string, string>()
        materialRequests.forEach((mr) => {
            const name = (mr.requestedBy || '').trim()
            if (!name) return
            const key = name.toLowerCase()
            if (!map.has(key)) map.set(key, name)
        })
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
    }, [materialRequests])

    const poVendorOptions = useMemo(() => {
        const map = new Map<string, string>()
        purchaseOrders.forEach((po) => {
            const name = (po.vendorName || '').trim()
            if (!name) return
            const key = name.toLowerCase()
            if (!map.has(key)) map.set(key, name)
        })
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
    }, [purchaseOrders])

    const toolbarResultCount = activeTab === 'requests'
        ? filteredMaterialRequests.length
        : activeTab === 'orders'
            ? filteredPurchaseOrders.length
            : undefined

    const toolbarEnabled = activeTab === 'requests' || activeTab === 'orders'

    // v4 Sprint 2: PO bulk action helpers
    const togglePoSelection = (id: string) => {
        setSelectedPoIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }  return n })
    }
    const selectablePos = filteredPurchaseOrders.filter(po => po.status === 'DRAFT' || po.status === 'PENDING')
    const isAllPoSelected = selectablePos.length > 0 && selectablePos.every(po => selectedPoIds.has(po.id))
    const toggleAllPos = () => {
        if (isAllPoSelected) setSelectedPoIds(new Set())
        else setSelectedPoIds(new Set(selectablePos.map(po => po.id)))
    }
    const handleBulkPoApprove = async () => {
        const { user } = useAuthStore.getState()
        const targets = filteredPurchaseOrders.filter(po => selectedPoIds.has(po.id))
        for (const po of targets) await updatePoStatus(po.id, 'APPROVED', user?.id)
        setSelectedPoIds(new Set())
    }
    const handleBulkPoReject = async () => {
        const targets = filteredPurchaseOrders.filter(po => selectedPoIds.has(po.id))
        for (const po of targets) await updatePoStatus(po.id, 'REJECTED')
        setSelectedPoIds(new Set())
    }

    // v4 Sprint 2: MR bulk action helpers
    const toggleMrSelection = (id: string) => {
        setSelectedMrIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })
    }

    const handleBulkMrApprove = async () => {
        const targets = filteredMaterialRequests.filter(mr => selectedMrIds.has(mr.id))
        for (const mr of targets) await updateMrStatus(mr.id, 'APPROVED')
        setSelectedMrIds(new Set())
    }

    // P0.3: Virtualizer for PO table
    const poScrollRef = useRef<HTMLDivElement>(null)
    const poVirtualizer = useVirtualizer({
        count: filteredPurchaseOrders.length,
        getScrollElement: () => poScrollRef.current,
        estimateSize: () => 52,
        overscan: 8,
    })

    useEffect(() => {
        if (activeProjectId) {
            const tabLabel =
                activeTab === 'requests' ? 'material requests' :
                    activeTab === 'orders' ? 'purchase orders' :
                        activeTab === 'inventory' ? 'inventory' :
                            activeTab === 'logistics' ? 'logistics' :
                                activeTab === 'spk' ? 'SPK opname' : 'data'
            setSrStatus(`Loading ${tabLabel} data...`)
            if (activeTab === "requests") fetchMaterialRequests(activeProjectId)
            if (activeTab === "orders") fetchPurchaseOrders(activeProjectId)
            if (activeTab === "inventory") fetchInventory(activeProjectId)
            if (activeTab === "logistics") fetchTransfers(activeProjectId)
        }
    }, [activeProjectId, activeTab, fetchInventory, fetchMaterialRequests, fetchPurchaseOrders, fetchTransfers])

    useEffect(() => {
        if (!activeProjectId) return

        const tabLabel =
            activeTab === 'requests' ? 'material requests' :
                activeTab === 'orders' ? 'purchase orders' :
                    activeTab === 'inventory' ? 'inventory' :
                        activeTab === 'logistics' ? 'logistics' :
                            activeTab === 'spk' ? 'SPK opname' : 'data'

        const isLoading =
            (activeTab === 'requests' && loading.mr) ||
            (activeTab === 'orders' && loading.po) ||
            (activeTab === 'inventory' && loading.inventory) ||
            (activeTab === 'logistics' && loading.transfer)

        if (error) {
            setSrStatus(`Failed to load ${tabLabel}.`)
        } else if (isLoading) {
            setSrStatus(`Loading ${tabLabel} data...`)
        } else {
            setSrStatus(`${tabLabel.charAt(0).toUpperCase() + tabLabel.slice(1)} data ready.`)
        }
    }, [
        activeProjectId,
        activeTab,
        loading.mr,
        loading.po,
        loading.inventory,
        loading.transfer,
        error,
    ])

    useEffect(() => {
        if (activeTab === 'orders' && !ORDER_SORT_OPTIONS.some((option) => option.value === sortBy)) {
            setSortBy('newest')
        }
        if (activeTab === 'requests' && !REQUEST_SORT_OPTIONS.some((option) => option.value === sortBy)) {
            setSortBy('name-asc')
        }
    }, [activeTab, sortBy])

    useEffect(() => {
        try {
            localStorage.setItem('supply.toolbar.query', searchTerm)
            localStorage.setItem('supply.toolbar.status', statusFilter)
            localStorage.setItem('supply.toolbar.sort', sortBy)
            localStorage.setItem('supply.requests.requester', requesterFilter)
            localStorage.setItem('supply.requests.dateFrom', requestDateFrom)
            localStorage.setItem('supply.requests.dateTo', requestDateTo)
            localStorage.setItem('supply.orders.vendor', poVendorFilter)
            localStorage.setItem('supply.orders.dateFrom', poDateFrom)
            localStorage.setItem('supply.orders.dateTo', poDateTo)
        } catch {
            // ignore storage errors
        }
    }, [searchTerm, statusFilter, sortBy, requesterFilter, requestDateFrom, requestDateTo, poVendorFilter, poDateFrom, poDateTo])

    const resetRequestAdvancedFilters = () => {
        setRequesterFilter('all')
        setRequestDateFrom('')
        setRequestDateTo('')
        setSrStatus('Request advanced filters reset.')
    }

    const resetOrderAdvancedFilters = () => {
        setPoVendorFilter('all')
        setPoDateFrom('')
        setPoDateTo('')
        setSrStatus('PO advanced filters reset.')
    }

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<Truck size={18} />}
                title="Supply Chain (Logistics)"
                description="End-to-end material management: Requests -> Purchase Orders -> Inventory."
                variant="empty"
                message="Please select a project to manage supply chain workflows."
            />
        )
    }

    const currentTabLoading =
        (activeTab === 'requests' && loading.mr) ||
        (activeTab === 'orders' && loading.po) ||
        (activeTab === 'inventory' && loading.inventory) ||
        (activeTab === 'logistics' && loading.transfer)

    const currentTabHasData =
        (activeTab === 'requests' && materialRequests.length > 0) ||
        (activeTab === 'orders' && purchaseOrders.length > 0) ||
        (activeTab === 'inventory' && inventoryStock.length > 0) ||
        activeTab === 'logistics' ||
        activeTab === 'spk' ||
        activeTab === 'mtr'

    const reloadActiveTab = async () => {
        if (activeTab === 'requests') return fetchMaterialRequests(activeProjectId)
        if (activeTab === 'orders') return fetchPurchaseOrders(activeProjectId)
        if (activeTab === 'inventory') return fetchInventory(activeProjectId)
        if (activeTab === 'transfers') return fetchTransfers(activeProjectId)
    }

    if (currentTabLoading && !currentTabHasData) {
        return (
            <ModulePageState
                icon={<Truck size={18} />}
                title="Supply Chain (Logistics)"
                description="End-to-end material management: Requests -> Purchase Orders -> Inventory."
                variant="loading"
                message="Loading supply chain telemetry..."
            />
        )
    }

    if (error && !currentTabHasData) {
        return (
            <ModulePageState
                icon={<Truck size={18} />}
                title="Supply Chain (Logistics)"
                description="End-to-end material management: Requests -> Purchase Orders -> Inventory."
                variant="error"
                message={error}
                onRetry={() => {
                    void reloadActiveTab()
                }}
            />
        )
    }

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

    // ── ModeSwitch tab options ───────────────────────────────────────────────
    const supplyTabOptions = [
        { value: 'requests', label: 'MR', icon: <Package className="h-3.5 w-3.5" /> },
        { value: 'orders', label: 'PO', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
        { value: 'inventory', label: 'Inventory', icon: <Warehouse className="h-3.5 w-3.5" /> },
        { value: 'logistics', label: 'Logistics', icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
        { value: 'spk', label: 'SPK', icon: <ClipboardList className="h-3.5 w-3.5" /> },
    ]

    // ── SummaryStrip items ───────────────────────────────────────────────────
    const pendingMR = materialRequests.filter(m => m.status === 'PENDING').length
    const supplySummaryItems = [
        { label: 'Material Req', value: materialRequests.length, status: 'neutral' as const },
        { label: 'Pending', value: pendingMR, status: (pendingMR > 0 ? 'warning' : 'success') as 'warning' | 'success' },
        { label: 'Purchase Orders', value: purchaseOrders.length, status: 'neutral' as const },
        { label: 'Stock Items', value: inventoryStock.length, status: 'neutral' as const },
    ]

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'Pending',
                            level: pendingMR > 5 ? 'warning' : 'good',
                            value: `${pendingMR}`,
                        },
                    ]}
                />
            }
            navigation={
                <ModeSwitch
                    options={supplyTabOptions}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            }
            header={
                <WorkspaceHeader
                    title="Supply Chain"
                    subtitle="End-to-end material management: MR → PO → GRN → Inventory"
                    primaryAction={{
                        label: 'New Request',
                        icon: <Plus className="h-3.5 w-3.5" />,
                        onClick: () => setMrOpen(true),
                    }}
                    secondaryActions={[
                        {
                            label: 'New PO',
                            icon: <ShoppingCart className="h-3.5 w-3.5" />,
                            onClick: () => setPoOpen(true),
                        },
                        {
                            label: 'Import Excel',
                            icon: <FileText className="h-3.5 w-3.5" />,
                            onClick: () => setPoImportOpen(true),
                        },
                        {
                            label: 'GRN',
                            icon: <PackageCheck className="h-3.5 w-3.5" />,
                            onClick: () => setGrnOpen(true),
                        },
                    ]}
                    overflowActions={[
                        {
                            label: 'Transfer',
                            icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
                            onClick: () => setTransferOpen(true),
                        },
                    ]}
                />
            }
            summary={
                <SummaryStrip items={supplySummaryItems} variant="chips" />
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <MaterialRequestDialog open={mrOpen} onOpenChange={setMrOpen} projectId={activeProjectId} />
            <PurchaseOrderDialog open={poOpen} onOpenChange={setPoOpen} projectId={activeProjectId} />
            <InventoryTransactionDialog open={invOpen} onOpenChange={setInvOpen} projectId={activeProjectId} defaultType={invType} />
            <GRNDialog open={grnOpen} onOpenChange={setGrnOpen} projectId={activeProjectId} />
            <MaterialTransferDialog open={transferOpen} onOpenChange={setTransferOpen} projectId={activeProjectId} />
            <MaterialTransferRequestDialog open={mtrRequestOpen} onOpenChange={setMtrRequestOpen} projectId={activeProjectId} />
            <ProcurementTracePanel open={!!tracePo} onOpenChange={(o) => { if (!o) setTracePo(null) }} po={tracePo} projectId={activeProjectId} />
            <ExcelImportPreviewDialog
                open={poImportOpen}
                onOpenChange={setPoImportOpen}
                title="Import Purchase Order Excel"
                description="Map spreadsheet columns to PO fields, preview the rows, then create purchase orders in bulk."
                targetFields={[
                    { key: 'poNumber', label: 'PO Number', required: true },
                    { key: 'vendorName', label: 'Vendor Name', required: true },
                    { key: 'itemName', label: 'Item Name', required: true },
                    { key: 'quantity', label: 'Quantity', required: true, transform: (raw) => Number(String(raw).replace(/[^0-9.-]/g, '')) },
                    { key: 'unitPrice', label: 'Unit Price', required: true, transform: (raw) => Number(String(raw).replace(/[^0-9.-]/g, '')) },
                ]}
                onImport={handlePoImport}
            />

            {/* MRP Alert Panel — surface material shortage alerts at top of Supply Chain */}
            <div className="mb-4">
                <MRPAlertPanel compact />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {toolbarEnabled && (
                    <div className="w-full max-w-[640px] mb-[var(--space-4)]">
                        <ModuleListToolbar
                            query={searchTerm}
                            onQueryChange={setSearchTerm}
                            queryPlaceholder={activeTab === 'orders' ? 'Search PO number, vendor, status...' : 'Search item, WBS, status...'}
                            filterValue={statusFilter}
                            onFilterChange={setStatusFilter}
                            filterOptions={STATUS_FILTER_OPTIONS}
                            sortValue={sortBy}
                            onSortChange={setSortBy}
                            sortOptions={activeTab === 'orders' ? ORDER_SORT_OPTIONS : REQUEST_SORT_OPTIONS}
                            resultCount={toolbarResultCount}
                            resultLabel={activeTab === 'orders' ? 'orders' : 'requests'}
                        />
                    </div>
                )}

                {/* --- MATERIAL REQUESTS --- */}
                <TabsContent value="requests" className="space-y-4">
                    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                        <div className="grid gap-1 md:w-[220px]">
                            <Label className="text-xs text-muted-foreground">Requester</Label>
                            <Select value={requesterFilter} onValueChange={setRequesterFilter}>
                                <SelectTrigger className="h-9" aria-label="Filter requests by requester">
                                    <SelectValue placeholder="All Requesters" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Requesters</SelectItem>
                                    {requesterOptions.map((name) => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Required from</Label>
                            <Input
                                type="date"
                                value={requestDateFrom}
                                onChange={(event) => setRequestDateFrom(event.target.value)}
                                aria-label="Filter request required date from"
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Required to</Label>
                            <Input
                                type="date"
                                value={requestDateTo}
                                onChange={(event) => setRequestDateTo(event.target.value)}
                                aria-label="Filter request required date to"
                                className="h-9"
                            />
                        </div>
                        <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={resetRequestAdvancedFilters}>
                            Reset Filters
                        </Button>
                    </div>
                    {filteredMaterialRequests.length === 0 ? (
                        <EmptyState
                            title="No Material Requests"
                            description="No matching requests for current search/filter."
                            imageKeyword="request"
                        />
                    ) : (
                        <>
                        {/* v4 Sprint 2: MR Bulk Action Bar */}
                        <BulkActionBar
                            selectedCount={selectedMrIds.size}
                            label="requests selected"
                            onClear={() => setSelectedMrIds(new Set())}
                            actions={[
                                { label: 'Approve All', icon: <ShieldCheck size={12} />, onClick: handleBulkMrApprove, variant: 'outline' },
                            ]}
                            className="mb-2"
                        />
                        <div className="grid gap-3">
                            {filteredMaterialRequests.map((mr) => {
                                const traceChain = mr.status === 'PO_CREATED'
                                    ? [
                                        { type: 'MR' as const, ref: `MR-${mr.id.slice(0, 6).toUpperCase()}` },
                                        { type: 'PO' as const, ref: 'PO-LINKED' }
                                    ]
                                    : []

                                return (
                                    <div key={mr.id} className={`group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-800 ${selectedMrIds.has(mr.id) ? 'border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-900/10' : ''}`}>
                                        {/* v4 Sprint 2: checkbox for PENDING MRs */}
                                        {mr.status === 'PENDING' && (
                                            <div className="mr-3 shrink-0" onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedMrIds.has(mr.id)}
                                                    onCheckedChange={() => toggleMrSelection(mr.id)}
                                                    aria-label={`Select MR ${mr.itemName}`}
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{mr.itemName}</h3>
                                                    <Badge variant="outline" className={`text-xs px-1.5 py-0 border ${getStatusColor(mr.status)}`}>
                                                        {mr.status}
                                                    </Badge>
                                                    {traceChain.length > 0 && (
                                                        <TraceChain chain={traceChain} size="sm" />
                                                    )}
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
                                )
                            })}
                        </div>
                        </>
                    )}
                </TabsContent>

                {/* --- PURCHASE ORDERS --- */}
                <TabsContent value="orders">
                    <div className="mb-4 flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                        <div className="grid gap-1 md:w-[220px]">
                            <Label className="text-xs text-muted-foreground">Vendor</Label>
                            <Select value={poVendorFilter} onValueChange={setPoVendorFilter}>
                                <SelectTrigger className="h-9" aria-label="Filter purchase orders by vendor">
                                    <SelectValue placeholder="All Vendors" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vendors</SelectItem>
                                    {poVendorOptions.map((name) => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Created from</Label>
                            <Input
                                type="date"
                                value={poDateFrom}
                                onChange={(event) => setPoDateFrom(event.target.value)}
                                aria-label="Filter purchase order created date from"
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Created to</Label>
                            <Input
                                type="date"
                                value={poDateTo}
                                onChange={(event) => setPoDateTo(event.target.value)}
                                aria-label="Filter purchase order created date to"
                                className="h-9"
                            />
                        </div>
                        <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={resetOrderAdvancedFilters}>
                            Reset Filters
                        </Button>
                    </div>
                    {filteredPurchaseOrders.length === 0 ? (
                        <EmptyState
                            title="No Purchase Orders"
                            description="No matching purchase orders for current search/filter."
                            imageKeyword="purchase order"
                        />
                    ) : (
                        <>
                        {/* v4 Sprint 2: PO Bulk Action Bar */}
                        <BulkActionBar
                            selectedCount={selectedPoIds.size}
                            label="POs selected"
                            onClear={() => setSelectedPoIds(new Set())}
                            actions={[
                                { label: 'Approve', icon: <ShieldCheck size={12} />, onClick: handleBulkPoApprove, variant: 'outline' },
                                { label: 'Reject', icon: <XCircle size={12} />, onClick: handleBulkPoReject, variant: 'destructive' },
                            ]}
                            className="mb-2"
                        />
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div ref={poScrollRef} className="max-h-[600px] overflow-auto relative">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                            <TableHead className="w-10 p-3">
                                                <Checkbox
                                                    checked={isAllPoSelected}
                                                    onCheckedChange={toggleAllPos}
                                                    aria-label="Select all draft/pending purchase orders"
                                                    disabled={selectablePos.length === 0}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[120px] font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">PO Number</TableHead>
                                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Vendor</TableHead>
                                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Trace</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Amount</TableHead>
                                            <TableHead className="w-[120px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Status</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* P0.3 virtual rows */}
                                        {poVirtualizer.getVirtualItems().length > 0 && (
                                            <tr style={{ height: poVirtualizer.getVirtualItems()[0].start }} aria-hidden />
                                        )}
                                        {poVirtualizer.getVirtualItems().map(vRow => {
                                            const po = filteredPurchaseOrders[vRow.index]
                                            const traceChain: { type: TraceableDocType; ref: string }[] = [
                                                { type: 'PO', ref: po.poNumber }
                                            ]
                                            if (po.status === 'PARTIALLY_RECEIVED' || po.status === 'COMPLETED') {
                                                traceChain.push({ type: 'GRN' as const, ref: `GRN-${po.poNumber.slice(-4)}` })
                                            }
                                            if (po.status === 'COMPLETED') {
                                                traceChain.push({ type: 'INVOICE' as const, ref: `INV-${po.poNumber.slice(-4)}` })
                                            }
                                            const downstreamCount = Math.max(0, traceChain.length - 1)
                                            return (
                                                <TableRow key={po.id} data-index={vRow.index} ref={poVirtualizer.measureElement} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors ${selectedPoIds.has(po.id) ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''}`} onClick={() => setTracePo(po)}>
                                                    {/* v4 Sprint 2: checkbox — only selectable for DRAFT/PENDING */}
                                                    <TableCell className="w-10 py-2 px-3" onClick={e => e.stopPropagation()}>
                                                        {(po.status === 'DRAFT' || po.status === 'PENDING') && (
                                                            <Checkbox
                                                                checked={selectedPoIds.has(po.id)}
                                                                onCheckedChange={() => togglePoSelection(po.id)}
                                                                aria-label={`Select PO ${po.poNumber}`}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400 py-2 border-r border-transparent">
                                                        {po.poNumber}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-sm text-slate-700 dark:text-slate-300">
                                                        {po.vendorName || '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        {traceChain.length > 0 ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <TraceChain chain={traceChain} size="sm" />
                                                                {downstreamCount > 0 && (
                                                                    <TraceCountBadge count={downstreamCount} direction="downstream" />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs font-semibold py-2">
                                                        Rp {po.totalAmount.toLocaleString('id-ID')}
                                                    </TableCell>
                                                    <TableCell className="text-center py-2">
                                                        <Badge variant="outline" className={`text-xs font-normal px-2 py-0.5 border ${getStatusColor(po.status)}`}>
                                                            {po.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-500 font-mono py-2">
                                                        {format(new Date(po.createdAt), 'dd MMM yyyy')}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {poVirtualizer.getVirtualItems().length > 0 && (() => {
                                            const last = poVirtualizer.getVirtualItems().at(-1)!
                                            const pad = poVirtualizer.getTotalSize() - last.end
                                            return pad > 0 ? <tr style={{ height: pad }} aria-hidden /> : null
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        </>
                    )}
                </TabsContent>
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
                                            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Movement</div>
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
                                            <div className="text-xs font-medium text-slate-400 uppercase tracking-widest">Available</div>
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

                {/* --- LOGISTICS (Transfers + MTR) --- */}
                <TabsContent value="logistics" className="space-y-4">
                    <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <button
                            onClick={() => setLogisticsTab('transfers')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${logisticsTab === 'transfers' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            Material Transfers
                        </button>
                        <button
                            onClick={() => setLogisticsTab('mtr')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${logisticsTab === 'mtr' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            Transfer Requests
                        </button>
                    </div>
                    {logisticsTab === 'transfers' && <MaterialTransferPanel />}
                    {logisticsTab === 'mtr' && (
                        <>
                            <div className="flex justify-end">
                                <Button size="sm" onClick={() => setMtrRequestOpen(true)} className="gap-2">
                                    <Plus size={14} /> New Transfer Request
                                </Button>
                            </div>
                            <MaterialTransferApprovalPanel projectId={activeProjectId} />
                            <MTRPanel />
                        </>
                    )}
                </TabsContent>

                {/* --- SPK / OPNAME --- */}
                <TabsContent value="spk" className="space-y-4">
                    <SubcontractorPanel />
                </TabsContent>

            </Tabs>
        </PageShell>
    )
}

function generateSku(name: string) {
    const hash = name.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) + '-' + String(Math.abs(hash) % 999).padStart(3, '0')
}
