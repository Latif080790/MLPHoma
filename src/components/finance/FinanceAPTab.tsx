import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useShallow } from "zustand/react/shallow"
import { Plus, Send, FileText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/EmptyState"
import { BulkActionBar } from "@/components/common/BulkActionBar"
import { ExcelImportPreviewDialog } from "@/components/common/ExcelImportPreviewDialog"
import { InvoiceMatchDialog } from "@/components/finance/InvoiceMatchDialog"
import { TraceChain, TraceCountBadge } from "@/components/common/TraceChip"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"
import { matchInvoice, getMatchStatusColor, getMatchStatusLabel } from "@/services/invoiceMatchingService"
import { approvalService } from "@/services/approvalService"
import { auditTrail } from "@/lib/auditTrail"
import { useFinanceStore } from "@/store/financeStore"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { Invoice, InvoiceStatus } from "@/types/finance"
import type { PurchaseOrder, InventoryTransaction } from "@/types/supply-chain"

// ── Constants ────────────────────────────────────────────────────────────────

const AP_STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'PAID', label: 'Paid' },
]

const AP_SORT_OPTIONS = [
    { value: 'due-soonest', label: 'Due Soonest' },
    { value: 'due-latest', label: 'Due Latest' },
    { value: 'amount-high', label: 'Amount High-Low' },
    { value: 'amount-low', label: 'Amount Low-High' },
]

const isOverdue = (item: { due_date?: string | null; status?: string }) =>
    !!(item.due_date && new Date(item.due_date) < new Date() && item.status !== 'PAID')

// ── Props ────────────────────────────────────────────────────────────────────

interface FinanceAPTabProps {
    projectId: string
    invoices: Invoice[]
    purchaseOrders: PurchaseOrder[]
    inventoryTransactions: InventoryTransaction[]
    onUpdateInvoiceStatus: (id: string, status: InvoiceStatus, projectId: string) => void
    onOpenInvoiceDialog: () => void
    handleAsync: <T>(fn: () => Promise<T>, errorKey?: string) => Promise<T | null>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FinanceAPTab({
    projectId,
    invoices,
    purchaseOrders,
    inventoryTransactions,
    onUpdateInvoiceStatus,
    onOpenInvoiceDialog,
    handleAsync,
}: FinanceAPTabProps) {

    // ── Local State ───────────────────────────────────────────────────────────

    const [apQuery, setApQuery] = useState(() => {
        try { return localStorage.getItem('finance.ap.query') || '' } catch { return '' }
    })
    const [apStatusFilter, setApStatusFilter] = useState(() => {
        try { return localStorage.getItem('finance.ap.status') || 'all' } catch { return 'all' }
    })
    const [apSortBy, setApSortBy] = useState(() => {
        try { return localStorage.getItem('finance.ap.sort') || 'due-soonest' } catch { return 'due-soonest' }
    })
    const [apVendorFilter, setApVendorFilter] = useState(() => {
        try { return localStorage.getItem('finance.ap.vendor') || 'all' } catch { return 'all' }
    })
    const [apDueFrom, setApDueFrom] = useState(() => {
        try { return localStorage.getItem('finance.ap.dueFrom') || '' } catch { return '' }
    })
    const [apDueTo, setApDueTo] = useState(() => {
        try { return localStorage.getItem('finance.ap.dueTo') || '' } catch { return '' }
    })
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
    const [pendingInvoicePayment, setPendingInvoicePayment] = useState<{
        id: string
        project_id: string
        total_amount: number
        invoice_number: string
        vendor_name?: string
    } | null>(null)
    const [matchDialogInvoice, setMatchDialogInvoice] = useState<Invoice | null>(null)
    const [invoiceImportOpen, setInvoiceImportOpen] = useState(false)

    // ── Store actions ────────────────────────────────────────────────────────

    const { payInvoice, createInvoice, fetchAll } = useFinanceStore(useShallow(s => ({
        payInvoice: s.payInvoice,
        createInvoice: s.createInvoice,
        fetchAll: s.fetchAll,
    })))

    // ── Persistence ──────────────────────────────────────────────────────────

    useEffect(() => {
        try {
            localStorage.setItem('finance.ap.query', apQuery)
            localStorage.setItem('finance.ap.status', apStatusFilter)
            localStorage.setItem('finance.ap.sort', apSortBy)
            localStorage.setItem('finance.ap.vendor', apVendorFilter)
            localStorage.setItem('finance.ap.dueFrom', apDueFrom)
            localStorage.setItem('finance.ap.dueTo', apDueTo)
        } catch {
            // ignore storage errors
        }
    }, [apQuery, apStatusFilter, apSortBy, apVendorFilter, apDueFrom, apDueTo])

    // ── Computed Values ──────────────────────────────────────────────────────

    const filteredInvoices = useMemo(() => {
        const q = apQuery.trim().toLowerCase()
        return [...invoices]
            .filter((inv) => {
                const matchesQuery = !q ||
                    (inv.vendor_name || '').toLowerCase().includes(q) ||
                    inv.invoice_number.toLowerCase().includes(q)
                const matchesStatus = apStatusFilter === 'all' || inv.status === apStatusFilter
                const matchesVendor = apVendorFilter === 'all' || (inv.vendor_name || '').toLowerCase() === apVendorFilter

                const dueDate = new Date(inv.due_date || 0)
                const fromBoundary = apDueFrom ? new Date(`${apDueFrom}T00:00:00`) : null
                const toBoundary = apDueTo ? new Date(`${apDueTo}T23:59:59`) : null
                const matchesDueFrom = !fromBoundary || dueDate >= fromBoundary
                const matchesDueTo = !toBoundary || dueDate <= toBoundary

                return matchesQuery && matchesStatus && matchesVendor && matchesDueFrom && matchesDueTo
            })
            .sort((a, b) => {
                const aDue = new Date(a.due_date || 0).getTime()
                const bDue = new Date(b.due_date || 0).getTime()
                if (apSortBy === 'due-latest') return bDue - aDue
                if (apSortBy === 'amount-high') return b.total_amount - a.total_amount
                if (apSortBy === 'amount-low') return a.total_amount - b.total_amount
                return aDue - bDue
            })
    }, [invoices, apQuery, apStatusFilter, apSortBy, apVendorFilter, apDueFrom, apDueTo])

    const apVendorOptions = useMemo(() => {
        return Array.from(new Set(
            invoices
                .map((inv) => (inv.vendor_name || '').trim())
                .filter((name) => name.length > 0)
                .map((name) => name.toLowerCase())
        )).sort((a, b) => a.localeCompare(b))
    }, [invoices])

    // ── Virtualizer ───────────────────────────────────────────────────────────

    const invScrollRef = useRef<HTMLDivElement>(null)

    const virtualInvoiceRows = useVirtualizer({
        count: filteredInvoices.length,
        getScrollElement: () => invScrollRef.current,
        estimateSize: () => 56,
        overscan: 8,
    })

    // ── Selection Helpers ─────────────────────────────────────────────────────

    const toggleInvoiceSelection = (id: string) => {
        setSelectedInvoiceIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) { next.delete(id) } else { next.add(id) }
            return next
        })
    }

    const isAllInvoicesSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedInvoiceIds.has(inv.id))

    const toggleAllInvoices = () => {
        if (isAllInvoicesSelected) {
            setSelectedInvoiceIds(new Set())
        } else {
            setSelectedInvoiceIds(new Set(filteredInvoices.map(inv => inv.id)))
        }
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    const resetApAdvancedFilters = () => {
        setApVendorFilter('all')
        setApDueFrom('')
        setApDueTo('')
    }

    const handlePayClick = (inv: {
        id: string
        project_id: string
        total_amount: number
        invoice_number: string
        vendor_name?: string
    }) => {
        setPendingInvoicePayment(inv)
    }

    const handlePayConfirm = async () => {
        if (!pendingInvoicePayment) return

        const approved = await handleAsync(async () => {
            const { user, profile } = useAuthStore.getState()
            await approvalService.createApproval({
                projectId: pendingInvoicePayment.project_id,
                entityType: 'PAYMENT',
                entityId: pendingInvoicePayment.id,
                title: `Payment: ${pendingInvoicePayment.vendor_name || 'Vendor'} Inv#${pendingInvoicePayment.invoice_number}`,
                description: `Requesting approval to release payment for Rp ${pendingInvoicePayment.total_amount.toLocaleString()}`,
                requesterId: user?.id || 'unknown',
                requesterName: profile?.full_name || user?.email || 'Finance',
                approverRole: 'manager',
                impactSummary: { amount: pendingInvoicePayment.total_amount, vendor: pendingInvoicePayment.vendor_name }
            })

            if (user?.id) {
                await auditTrail.logPaymentApprovalRequested(
                    pendingInvoicePayment.id,
                    pendingInvoicePayment.invoice_number,
                    pendingInvoicePayment.total_amount,
                    user.id,
                    profile?.full_name || user.email || 'Finance'
                )
            }

            useFinanceStore.getState().updateInvoiceStatus(pendingInvoicePayment.id, 'PENDING_PAYMENT', pendingInvoicePayment.project_id)
            return true
        }, 'approval.general')

        if (approved) {
            toast.success("Payment approval requested", { description: "Sent to PM's Command Center" })
            setPendingInvoicePayment(null)
        }
    }

    const handleBulkPayRequest = async () => {
        if (selectedInvoiceIds.size === 0) return
        const targets = filteredInvoices.filter(
            inv => selectedInvoiceIds.has(inv.id) && inv.status !== 'PAID' && inv.status !== 'PENDING_PAYMENT'
        )
        for (const inv of targets) {
            await handleAsync(async () => {
                const { user, profile } = useAuthStore.getState()
                await approvalService.createApproval({
                    projectId: inv.project_id,
                    entityType: 'PAYMENT',
                    entityId: inv.id,
                    title: `Payment: ${inv.vendor_name || 'Vendor'} Inv#${inv.invoice_number}`,
                    description: `Bulk payment approval for Rp ${inv.total_amount.toLocaleString()}`,
                    requesterId: user?.id || 'unknown',
                    requesterName: profile?.full_name || user?.email || 'Finance',
                    approverRole: 'manager',
                    impactSummary: { amount: inv.total_amount, vendor: inv.vendor_name }
                })
                useFinanceStore.getState().updateInvoiceStatus(inv.id, 'PENDING_PAYMENT', inv.project_id)
                return true
            }, 'approval.general')
        }
        toast.success(`${targets.length} payment requests submitted`)
        setSelectedInvoiceIds(new Set())
    }

    const handleInvoiceImport = useCallback(async (rows: Record<string, unknown>[]) => {
        const invoiceRows = rows
            .map((row) => ({
                vendor_name: String(row.vendor_name ?? '').trim(),
                invoice_number: String(row.invoice_number ?? '').trim(),
                description: String(row.description ?? '').trim(),
                amount: Number(row.amount ?? 0),
                tax_amount: Number(row.tax_amount ?? 0),
                due_date: String(row.due_date ?? '').trim(),
            }))
            .filter((row) => row.vendor_name && row.invoice_number && row.due_date)

        if (!invoiceRows.length) {
            toast.error('Tidak ada baris invoice yang valid')
            return
        }

        for (const row of invoiceRows) {
            await createInvoice({
                project_id: projectId,
                vendor_name: row.vendor_name,
                invoice_number: row.invoice_number,
                description: row.description || undefined,
                amount: row.amount,
                tax_amount: row.tax_amount,
                total_amount: row.amount + row.tax_amount,
                due_date: row.due_date,
                status: 'UNPAID',
            })
        }

        toast.success(`Imported ${invoiceRows.length} invoices`)
        setInvoiceImportOpen(false)
        await fetchAll(projectId)
    }, [projectId, createInvoice, fetchAll])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="w-full md:max-w-3xl space-y-2">
                    <ModuleListToolbar
                        query={apQuery}
                        onQueryChange={setApQuery}
                        queryPlaceholder="Search vendor or invoice number..."
                        filterValue={apStatusFilter}
                        onFilterChange={setApStatusFilter}
                        filterOptions={AP_STATUS_OPTIONS}
                        sortValue={apSortBy}
                        onSortChange={setApSortBy}
                        sortOptions={AP_SORT_OPTIONS}
                        resultCount={filteredInvoices.length}
                        resultLabel="invoices"
                    />
                    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                        <div className="grid gap-1 md:w-[200px]">
                            <Label className="text-xs text-muted-foreground">Vendor</Label>
                            <Select value={apVendorFilter} onValueChange={setApVendorFilter}>
                                <SelectTrigger className="h-9" aria-label="Filter AP by vendor">
                                    <SelectValue placeholder="All Vendors" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vendors</SelectItem>
                                    {apVendorOptions.map((vendor) => (
                                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Due from</Label>
                            <Input
                                type="date"
                                value={apDueFrom}
                                onChange={(event) => setApDueFrom(event.target.value)}
                                aria-label="Filter AP due date from"
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-1 md:w-[170px]">
                            <Label className="text-xs text-muted-foreground">Due to</Label>
                            <Input
                                type="date"
                                value={apDueTo}
                                onChange={(event) => setApDueTo(event.target.value)}
                                aria-label="Filter AP due date to"
                                className="h-9"
                            />
                        </div>
                        <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={resetApAdvancedFilters}>
                            Reset Filters
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setInvoiceImportOpen(true)}>
                        <FileText size={14} /> Import Excel
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={onOpenInvoiceDialog}>
                        <Plus size={14} /> Record Invoice
                    </Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedInvoiceIds.size}
                label="invoices selected"
                onClear={() => setSelectedInvoiceIds(new Set())}
                actions={[
                    {
                        label: 'Request Payment',
                        icon: <Send size={12} />,
                        onClick: handleBulkPayRequest,
                        disabled: filteredInvoices.filter(inv => selectedInvoiceIds.has(inv.id) && inv.status !== 'PAID' && inv.status !== 'PENDING_PAYMENT').length === 0,
                    },
                ]}
            />

            {/* Invoice Table */}
            {filteredInvoices.length === 0 ? (
                <EmptyState title="No Invoices Found" description="No invoice matches current search/filter." imageKeyword="invoice" />
            ) : (
                <div className="rounded-lg border border-border overflow-hidden shadow-sm bg-card">
                    <div ref={invScrollRef} className="max-h-[600px] overflow-auto relative">
                        <Table>
                            <TableHeader className="bg-muted/30 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="w-10 p-3">
                                        <Checkbox
                                            checked={isAllInvoicesSelected}
                                            onCheckedChange={toggleAllInvoices}
                                            aria-label="Select all invoices"
                                        />
                                    </TableHead>
                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Vendor</TableHead>
                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Inv Number</TableHead>
                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Trace</TableHead>
                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Due Date</TableHead>
                                    <TableHead className="p-3 text-right font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Amount</TableHead>
                                    <TableHead className="p-3 text-center font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Match</TableHead>
                                    <TableHead className="p-3 text-center font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="p-3 text-right font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {virtualInvoiceRows.getVirtualItems().length > 0 && (
                                    <tr style={{ height: virtualInvoiceRows.getVirtualItems()[0].start }} aria-hidden />
                                )}
                                {virtualInvoiceRows.getVirtualItems().map((vRow) => {
                                    const inv = filteredInvoices[vRow.index]
                                    const traceChain = inv.po_id
                                        ? [
                                            { type: 'PO' as const, ref: inv.po_id.slice(0, 12) },
                                            { type: 'INVOICE' as const, ref: inv.invoice_number },
                                        ]
                                        : [
                                            { type: 'INVOICE' as const, ref: inv.invoice_number },
                                        ]
                                    const upstreamCount = inv.po_id ? 1 : 0

                                    return (
                                        <TableRow
                                            key={inv.id}
                                            data-index={vRow.index}
                                            ref={virtualInvoiceRows.measureElement}
                                            className={cn(
                                                'group hover:bg-accent/40 border-b border-border transition-colors',
                                                isOverdue(inv) && 'bg-rose-50 dark:bg-rose-950/20',
                                                selectedInvoiceIds.has(inv.id) && 'bg-orange-50/60 dark:bg-orange-900/10'
                                            )}
                                        >
                                            <TableCell className="p-3 w-10" onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedInvoiceIds.has(inv.id)}
                                                    onCheckedChange={() => toggleInvoiceSelection(inv.id)}
                                                    aria-label={`Select invoice ${inv.invoice_number}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-3 font-medium text-muted-foreground">{inv.vendor_name}</TableCell>
                                            <TableCell className="p-3 font-mono text-xs text-muted-foreground">{inv.invoice_number}</TableCell>
                                            <TableCell className="p-3">
                                                {traceChain.length > 0 ? (
                                                    <div className="flex items-center gap-1.5">
                                                        {upstreamCount > 0 && <TraceCountBadge count={upstreamCount} direction="upstream" />}
                                                        <TraceChain
                                                            chain={traceChain}
                                                            size="sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-3 text-xs text-muted-foreground">
                                                {format(new Date(inv.due_date || new Date()), 'dd MMM yyyy')}
                                            </TableCell>
                                            <TableCell className="p-3 text-right font-mono tabular-nums text-xs font-semibold text-muted-foreground">
                                                Rp {inv.total_amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="p-3 text-center">
                                                {(() => {
                                                    const matchResult = matchInvoice(inv, purchaseOrders, inventoryTransactions)
                                                    return (
                                                        <button
                                                            onClick={() => setMatchDialogInvoice(inv)}
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                        >
                                                            <Badge className={`text-xs px-2 py-0.5 ${getMatchStatusColor(matchResult.status)}`}>
                                                                {getMatchStatusLabel(matchResult.status)}
                                                            </Badge>
                                                        </button>
                                                    )
                                                })()}
                                            </TableCell>
                                            <TableCell className="p-3 text-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                            aria-label={`Change invoice status (currently ${inv.status})`}
                                                        >
                                                            <Badge
                                                                variant={
                                                                    inv.status === 'PAID' ? 'default' :
                                                                        inv.status === 'OVERDUE' ? 'destructive' :
                                                                            'secondary'
                                                                }
                                                                className="text-xs font-normal px-2 py-0.5"
                                                            >
                                                                {inv.status}
                                                            </Badge>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-44 p-1" align="center">
                                                        <p className="text-xs font-semibold text-zinc-500 px-2 py-1">Change Status</p>
                                                        {(['UNPAID', 'PARTIAL', 'PENDING_PAYMENT', 'PAID'] as const).map(s => (
                                                            <button
                                                                key={s}
                                                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                                onClick={() => {
                                                                    onUpdateInvoiceStatus(inv.id, s, projectId)
                                                                    toast.success(`Invoice ${inv.invoice_number} → ${s}`)
                                                                }}
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="p-3 text-right">
                                                {inv.status !== 'PAID' && inv.status !== 'PENDING_PAYMENT' && (
                                                    <Button size="sm" onClick={() => handlePayClick(inv)} className="h-7 text-xs">Pay</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {virtualInvoiceRows.getVirtualItems().length > 0 && (() => {
                                    const last = virtualInvoiceRows.getVirtualItems().at(-1)!
                                    const pad = virtualInvoiceRows.getTotalSize() - last.end
                                    return pad > 0 ? <tr style={{ height: pad }} aria-hidden /> : null
                                })()}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Dialogs */}
            <ExcelImportPreviewDialog
                open={invoiceImportOpen}
                onOpenChange={setInvoiceImportOpen}
                title="Import Invoice Excel"
                description="Map Excel columns to AP invoice fields, preview rows, then create invoices in bulk."
                targetFields={[
                    { key: 'vendor_name', label: 'Vendor Name', required: true },
                    { key: 'invoice_number', label: 'Invoice Number', required: true },
                    { key: 'description', label: 'Description' },
                    { key: 'amount', label: 'Amount', required: true, transform: (raw) => Number(String(raw).replace(/[^0-9.-]/g, '')) },
                    { key: 'tax_amount', label: 'Tax Amount', transform: (raw) => Number(String(raw).replace(/[^0-9.-]/g, '')) },
                    { key: 'due_date', label: 'Due Date', required: true },
                ]}
                onImport={handleInvoiceImport}
            />

            <InvoiceMatchDialog
                open={!!matchDialogInvoice}
                onOpenChange={(open) => { if (!open) setMatchDialogInvoice(null) }}
                invoice={matchDialogInvoice}
                onApprove={(id) => {
                    payInvoice(id, projectId, matchDialogInvoice?.total_amount || 0)
                }}
            />

            <AlertDialog
                open={!!pendingInvoicePayment}
                onOpenChange={(open) => { if (!open) setPendingInvoicePayment(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm invoice payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingInvoicePayment
                                ? `Mark invoice ${pendingInvoicePayment.invoice_number} as PAID and record Rp ${pendingInvoicePayment.total_amount.toLocaleString()} payment.`
                                : 'This action updates AP status and creates payment trail.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePayConfirm}>Confirm Payment</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
