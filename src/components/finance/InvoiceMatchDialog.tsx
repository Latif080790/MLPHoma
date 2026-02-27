/**
 * InvoiceMatchDialog.tsx
 *
 * 3-Way Invoice Matching Dialog.
 * Shows side-by-side comparison of PO, GRN, and Invoice data
 * with discrepancies highlighted and action buttons.
 */

import React, { useMemo } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'
import { CheckCircle2, AlertTriangle, XCircle, FileText, Package, Truck, AlertCircle } from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import { useSupplyChainStore } from '../../store/supplyChainStore'
import { useFinanceStore } from '../../store/financeStore'
import {
    matchInvoice,
    getMatchStatusColor,
    getMatchStatusLabel,
    type InvoiceMatchResult,
    type MatchStatus,
} from '../../services/invoiceMatchingService'
import type { Invoice } from '../../types/finance'

// ─── Score Gauge ───

function ScoreGauge({ score }: { score: number }) {
    const color = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'
    const bg = score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/20' : score >= 50 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20'
    return (
        <div className={`flex items-center justify-center w-16 h-16 rounded-full ${bg}`}>
            <span className={`text-xl font-bold ${color}`}>{score}</span>
        </div>
    )
}

// ─── Status Icon ───

function StatusIcon({ status }: { status: MatchStatus }) {
    switch (status) {
        case 'matched': return <CheckCircle2 className="text-emerald-500" size={20} />
        case 'partial': return <AlertCircle className="text-amber-500" size={20} />
        case 'mismatch': return <XCircle className="text-red-500" size={20} />
        case 'no_po': return <FileText className="text-slate-400" size={20} />
    }
}

// ─── Main Dialog ───

interface InvoiceMatchDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoice: Invoice | null
    onApprove?: (invoiceId: string) => void
    onFlag?: (invoiceId: string) => void
    onReject?: (invoiceId: string) => void
}

export function InvoiceMatchDialog({
    open, onOpenChange, invoice, onApprove, onFlag, onReject
}: InvoiceMatchDialogProps) {
    const { purchaseOrders, inventoryTransactions } = useSupplyChainStore()

    const result: InvoiceMatchResult | null = useMemo(() => {
        if (!invoice) return null
        return matchInvoice(invoice, purchaseOrders, inventoryTransactions)
    }, [invoice, purchaseOrders, inventoryTransactions])

    if (!invoice || !result) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <StatusIcon status={result.status} />
                        3-Way Invoice Matching
                    </DialogTitle>
                    <DialogDescription>
                        Invoice <strong>{result.invoiceNumber}</strong> — {result.summary}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    {/* ── Score & Status Overview ── */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-4">
                            <ScoreGauge score={result.overallScore} />
                            <div>
                                <Badge className={getMatchStatusColor(result.status)}>
                                    {getMatchStatusLabel(result.status)}
                                </Badge>
                                <p className="text-xs text-slate-500 mt-1">{result.summary}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── 3-Way Comparison Cards ── */}
                    <div className="grid grid-cols-3 gap-3">

                        {/* PO Card */}
                        <Card className="border-blue-200 dark:border-blue-900">
                            <CardHeader className="pb-2 pt-3 px-3">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                                    <FileText size={13} /> Purchase Order
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-1 text-xs">
                                {result.po ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">PO #</span>
                                            <span className="font-mono font-medium">{result.po.poNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Vendor</span>
                                            <span className="truncate ml-2">{result.po.vendorName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Total</span>
                                            <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                                                {formatIDR(result.po.poTotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Status</span>
                                            <Badge variant="outline" className="text-xs h-4">{result.po.poStatus}</Badge>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-slate-400 py-3">No PO linked</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* GRN Card */}
                        <Card className="border-green-200 dark:border-green-900">
                            <CardHeader className="pb-2 pt-3 px-3">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-400">
                                    <Package size={13} /> Goods Receipt
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-1 text-xs">
                                {result.grn ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Ordered</span>
                                            <span className="font-mono">{result.grn.totalOrdered.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Received</span>
                                            <span className="font-mono">{result.grn.totalReceived.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Receipt %</span>
                                            <span className={`font-mono font-semibold ${result.grn.receiptPercentage >= 100 ? 'text-green-600' :
                                                    result.grn.receiptPercentage >= 80 ? 'text-amber-600' : 'text-red-600'
                                                }`}>
                                                {result.grn.receiptPercentage}%
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-slate-400 py-3">No GRN data</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Invoice Card */}
                        <Card className="border-purple-200 dark:border-purple-900">
                            <CardHeader className="pb-2 pt-3 px-3">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                                    <Truck size={13} /> Invoice
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Invoice #</span>
                                    <span className="font-mono font-medium">{invoice.invoice_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Vendor</span>
                                    <span className="truncate ml-2">{invoice.vendor_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total</span>
                                    <span className="font-mono font-semibold text-purple-700 dark:text-purple-400">
                                        {formatIDR(invoice.total_amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Status</span>
                                    <Badge variant="outline" className="text-xs h-4">{invoice.status}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Discrepancies Table ── */}
                    {result.discrepancies.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                <AlertTriangle size={13} /> Discrepancies ({result.discrepancies.length})
                            </h4>
                            <Table>
                                <TableHeader>
                                    <TableRow className="text-xs">
                                        <TableHead className="h-7">Field</TableHead>
                                        <TableHead className="h-7 text-right">Expected</TableHead>
                                        <TableHead className="h-7 text-right">Actual</TableHead>
                                        <TableHead className="h-7 text-right">Variance</TableHead>
                                        <TableHead className="h-7 text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.discrepancies.map((d, i) => (
                                        <TableRow key={i} className="text-xs">
                                            <TableCell className="py-1.5 font-medium">{d.field}</TableCell>
                                            <TableCell className="py-1.5 text-right font-mono">
                                                {typeof d.expected === 'number' ? d.expected.toLocaleString() : d.expected}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right font-mono">
                                                {typeof d.actual === 'number' ? d.actual.toLocaleString() : d.actual}
                                            </TableCell>
                                            <TableCell className={`py-1.5 text-right font-mono font-semibold ${d.tolerable ? 'text-amber-600' : 'text-red-600'
                                                }`}>
                                                {d.variance.toFixed(1)}%
                                            </TableCell>
                                            <TableCell className="py-1.5 text-center">
                                                {d.tolerable ? (
                                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">Within Tolerance</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">Exceeds Limit</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* ── Actions ── */}
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {onFlag && result.status !== 'matched' && (
                        <Button
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => { onFlag(invoice.id); onOpenChange(false) }}
                        >
                            <AlertTriangle size={14} className="mr-1.5" /> Flag for Review
                        </Button>
                    )}
                    {onReject && result.status === 'mismatch' && (
                        <Button
                            variant="destructive"
                            onClick={() => { onReject(invoice.id); onOpenChange(false) }}
                        >
                            <XCircle size={14} className="mr-1.5" /> Reject
                        </Button>
                    )}
                    {onApprove && (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { onApprove(invoice.id); onOpenChange(false) }}
                            disabled={result.status === 'mismatch'}
                        >
                            <CheckCircle2 size={14} className="mr-1.5" /> Approve Payment
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
