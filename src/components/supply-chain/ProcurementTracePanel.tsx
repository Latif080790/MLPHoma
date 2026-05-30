/**
 * ProcurementTracePanel.tsx
 * Slide-over panel showing the full procurement lifecycle for a PO.
 * Fetches linked GRNs and Invoices to display real trace data.
 *
 * Chain: MR → PO → GRN(s) → Invoice(s)
 */

import React, { useEffect, useState } from 'react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    ShoppingCart,
    PackageCheck,
    Receipt,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowDown,
} from 'lucide-react'
import { supplyChainService } from '@/services/supplyChainService'
import { format } from 'date-fns'
import type { PurchaseOrder } from '@/types/supply-chain'
import type { GoodsReceipt } from '@/types/grn'

interface InvoiceTrace {
    id: string
    invoiceNumber: string
    vendorName: string
    amount: number
    totalAmount: number
    status: string
    dueDate?: string
    createdAt: string
}

interface ProcurementTracePanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    po: PurchaseOrder | null
    projectId: string
}

const statusIcon = (status: string) => {
    switch (status) {
        case 'APPROVED':
        case 'VERIFIED':
        case 'COMPLETED':
        case 'PAID':
            return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        case 'REJECTED':
            return <XCircle className="h-4 w-4 text-red-500" />
        default:
            return <Clock className="h-4 w-4 text-amber-500" />
    }
}

const statusColor = (status: string) => {
    switch (status) {
        case 'APPROVED':
        case 'VERIFIED':
        case 'COMPLETED':
        case 'PAID':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        case 'REJECTED':
            return 'bg-red-100 text-red-700 border-red-200'
        case 'PENDING':
        case 'DRAFT':
            return 'bg-amber-100 text-amber-700 border-amber-200'
        case 'UNPAID':
            return 'bg-orange-100 text-orange-700 border-orange-200'
        default:
            return 'bg-muted/50 text-muted-foreground border-border'
    }
}

export function ProcurementTracePanel({
    open,
    onOpenChange,
    po,
    projectId: _projectId,
}: ProcurementTracePanelProps) {
    const [grns, setGrns] = useState<GoodsReceipt[]>([])
    const [invoices, setInvoices] = useState<InvoiceTrace[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && po) {
            fetchTraceData(po.id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, po])

    async function fetchTraceData(poId: string) {
        setLoading(true)
        try {
            const { grnRows, invRows } = await supplyChainService.getProcurementTraceData(poId)

            setGrns((grnRows || []).map((r: Record<string, unknown>) => ({
                id: r.id as string,
                projectId: r.project_id as string,
                poId: r.po_id as string,
                grnNumber: r.grn_number as string,
                receivedBy: r.received_by as string,
                receiverName: r.receiver_name as string | undefined,
                receivedDate: r.received_date as string,
                items: (r.items as GoodsReceipt['items']) || [],
                photoUrl: r.photo_url as string | undefined,
                deliveryNoteUrl: r.delivery_note_url as string | undefined,
                notes: r.notes as string | undefined,
                status: r.status as GoodsReceipt['status'],
                verifiedBy: r.verified_by as string | undefined,
                verifiedAt: r.verified_at as string | undefined,
                createdAt: r.created_at as string,
                updatedAt: (r.updated_at as string) || '',
            })))

            setInvoices((invRows || []).map((r: Record<string, unknown>) => ({
                id: r.id as string,
                invoiceNumber: r.invoice_number as string,
                vendorName: r.vendor_name as string,
                amount: (r.amount as number) || 0,
                totalAmount: (r.total_amount as number) || 0,
                status: r.status as string,
                dueDate: r.due_date as string | undefined,
                createdAt: r.created_at as string,
            })))
        } catch {
            // failed to load — empty state shown
        } finally {
            setLoading(false)
        }
    }

    if (!po) return null

    const totalReceived = grns.reduce((sum, g) =>
        sum + (g.items || []).reduce((s, i) => s + (i.qtyReceived || 0), 0), 0
    )
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-purple-500" />
                        Procurement Trace
                    </SheetTitle>
                    <SheetDescription>
                        Full lifecycle view: PO → GRN → Invoice
                    </SheetDescription>
                </SheetHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading trace data…
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── PO NODE ── */}
                        <div className="relative pl-8">
                            <div className="absolute left-3 top-1 bottom-0 w-px bg-purple-200 dark:bg-purple-800" />
                            <div className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center ring-2 ring-purple-300 dark:ring-purple-700">
                                <ShoppingCart className="h-3 w-3 text-purple-600" />
                            </div>
                            <div className="rounded-lg border p-4 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono font-bold text-sm text-purple-700 dark:text-purple-400">
                                        {po.poNumber}
                                    </span>
                                    <Badge variant="outline" className={`text-xs ${statusColor(po.status)}`}>
                                        {statusIcon(po.status)}
                                        <span className="ml-1">{po.status}</span>
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <div>Vendor: <span className="text-foreground font-medium">{po.vendorName || '-'}</span></div>
                                    <div>Amount: <span className="text-foreground font-mono font-bold">Rp {po.totalAmount.toLocaleString('id-ID')}</span></div>
                                    <div>Created: {format(new Date(po.createdAt), 'dd MMM yyyy HH:mm')}</div>
                                </div>
                            </div>
                        </div>

                        {/* ── ARROW ── */}
                        <div className="flex justify-center">
                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>

                        {/* ── GRN NODES ── */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <PackageCheck className="h-3.5 w-3.5" />
                                Goods Receipts ({grns.length})
                            </div>
                            {grns.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic pl-4 border-l-2 border-dashed border-border py-2">
                                    No GRN recorded yet — awaiting material delivery
                                </div>
                            ) : (
                                grns.map(grn => (
                                    <div key={grn.id} className="relative pl-8">
                                        <div className="absolute left-3 top-1 bottom-0 w-px bg-emerald-200 dark:bg-emerald-800" />
                                        <div className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center ring-2 ring-emerald-300 dark:ring-emerald-700">
                                            <PackageCheck className="h-3 w-3 text-emerald-600" />
                                        </div>
                                        <div className="rounded-lg border p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                                    {grn.grnNumber}
                                                </span>
                                                <Badge variant="outline" className={`text-xs ${statusColor(grn.status)}`}>
                                                    {statusIcon(grn.status)}
                                                    <span className="ml-1">{grn.status}</span>
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                                <div>Received by: <span className="text-foreground">{grn.receiverName || '-'}</span></div>
                                                <div>Date: {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '-'}</div>
                                                <div>Items: {(grn.items || []).length} ({(grn.items || []).reduce((s, i) => s + (i.qtyReceived || 0), 0)} units received)</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── ARROW ── */}
                        <div className="flex justify-center">
                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>

                        {/* ── INVOICE NODES ── */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Receipt className="h-3.5 w-3.5" />
                                Invoices ({invoices.length})
                            </div>
                            {invoices.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic pl-4 border-l-2 border-dashed border-border py-2">
                                    No invoice generated — GRN verification pending
                                </div>
                            ) : (
                                invoices.map(inv => (
                                    <div key={inv.id} className="relative pl-8">
                                        <div className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center ring-2 ring-orange-300 dark:ring-orange-700">
                                            <Receipt className="h-3 w-3 text-orange-600" />
                                        </div>
                                        <div className="rounded-lg border p-3 bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-mono font-bold text-xs text-orange-700 dark:text-orange-400">
                                                    {inv.invoiceNumber}
                                                </span>
                                                <Badge variant="outline" className={`text-xs ${statusColor(inv.status)}`}>
                                                    {statusIcon(inv.status)}
                                                    <span className="ml-1">{inv.status}</span>
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                                <div>Amount: <span className="text-foreground font-mono font-bold">Rp {inv.totalAmount.toLocaleString('id-ID')}</span></div>
                                                {inv.dueDate && <div>Due: {format(new Date(inv.dueDate), 'dd MMM yyyy')}</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── SUMMARY ── */}
                        <Separator />
                        <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Trace Summary
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-bold text-purple-600">{grns.length}</div>
                                    <div className="text-xs text-muted-foreground">GRNs</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-emerald-600">{totalReceived}</div>
                                    <div className="text-xs text-muted-foreground">Units Received</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-orange-600">{invoices.length}</div>
                                    <div className="text-xs text-muted-foreground">Invoices</div>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs pt-2 border-t border-dashed">
                                <span className="text-muted-foreground">Total Invoiced</span>
                                <span className="font-mono font-bold">Rp {totalInvoiced.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">PO Amount</span>
                                <span className="font-mono font-bold">Rp {po.totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                            {totalInvoiced > po.totalAmount && (
                                <div className="text-xs text-red-600 font-medium flex items-center gap-1 pt-1">
                                    <XCircle className="h-3 w-3" />
                                    Invoiced exceeds PO amount by Rp {(totalInvoiced - po.totalAmount).toLocaleString('id-ID')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
