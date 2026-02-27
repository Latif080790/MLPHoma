import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Receipt, FileText, Clock, AlertTriangle, TrendingUp, DollarSign, Download, ArrowRightLeft, PieChart, Send, ShieldCheck, CheckCircle, Plus, Zap, Wallet } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useProjectStore } from "@/store/projectStore"
import { useFinanceStore } from "@/store/financeStore"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { ClientClaim } from "@/types/finance"
import { toast } from "sonner"
import { progressBillingService } from "@/services/progressBillingService"
import { InvoiceDialog } from "@/components/finance/InvoiceDialog"
import { ClaimDialog } from "@/components/finance/ClaimDialog"
import { AgingReport } from "@/components/finance/AgingReport"
import { OverheadCostPanel } from "@/components/finance/OverheadCostPanel"
import { ThreeWayMatch } from "@/components/finance/ThreeWayMatch"
import { OpnameBoard } from "@/components/finance/OpnameBoard"
import { TraceChain, TraceCountBadge } from "@/components/common/TraceChip"
import { CashflowForecastWidget } from "@/components/finance/CashflowForecastWidget"
import { approvalService } from "@/services/approvalService"
import { useAuthStore } from "@/store/authStore"
import { InvoiceMatchDialog } from "@/components/finance/InvoiceMatchDialog"
import { matchInvoice, getMatchStatusColor, getMatchStatusLabel } from "@/services/invoiceMatchingService"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import type { Invoice } from "@/types/finance"

export default function Finance() {
    const { activeProjectId } = useProjectStore()
    const [activeTab, setActiveTab] = useState("overview")
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [claimDialogOpen, setClaimDialogOpen] = useState(false)
    const [pendingInvoicePayment, setPendingInvoicePayment] = useState<{ id: string; project_id: string; total_amount: number; invoice_number: string; vendor_name?: string } | null>(null)
    const [matchDialogInvoice, setMatchDialogInvoice] = useState<Invoice | null>(null)
    const { purchaseOrders, inventoryTransactions } = useSupplyChainStore()

    const {
        invoices, claims, transactions, loading,
        summary, aging,
        fetchAll, markOverdue, payInvoice, updateClaimStatus
    } = useFinanceStore()

    useEffect(() => {
        if (activeProjectId) {
            fetchAll(activeProjectId)
            // Auto-detect overdue invoices
            markOverdue(activeProjectId)
        }
    }, [activeProjectId])

    const handlePayClick = (inv: { id: string; project_id: string; total_amount: number; invoice_number: string; vendor_name?: string }) => {
        setPendingInvoicePayment(inv)
    }

    const handlePayConfirm = async () => {
        if (!pendingInvoicePayment) return

        try {
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

            // Mark invoice as pending locally
            useFinanceStore.getState().updateInvoiceStatus(pendingInvoicePayment.id, 'PENDING_PAYMENT', pendingInvoicePayment.project_id)

            toast.success("Payment approval requested", { description: "Sent to PM's Command Center" })
            setPendingInvoicePayment(null)
        } catch (err: any) {
            toast.error("Failed to request approval", { description: err.message })
        }
    }

    const claimActions = (claim: ClientClaim) => {
        const transitions: Record<string, { label: string; next: ClientClaim['status']; icon: React.ReactNode }> = {
            DRAFT: { label: 'Submit', next: 'SUBMITTED', icon: <Send size={12} /> },
            SUBMITTED: { label: 'Approve', next: 'APPROVED', icon: <ShieldCheck size={12} /> },
            APPROVED: { label: 'Mark Paid', next: 'PAID', icon: <CheckCircle size={12} /> }
        }
        const action = transitions[claim.status]
        if (!action) return null
        return (
            <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => activeProjectId && updateClaimStatus(claim.id, action.next, activeProjectId)}
            >
                {action.icon} {action.label}
            </Button>
        )
    }

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view financials." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<TrendingUp size={18} />}
                title="Finance"
                description="Manage AP (Invoices), AR (Claims), Aging, and 3-Way Matching."
            />

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">AP Outstanding</p>
                                <p className="text-2xl font-bold text-red-600">Rp {summary.totalAPOutstanding.toLocaleString()}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-red-50 text-red-600"><Receipt size={20} /></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => i.status !== 'PAID').length} unpaid invoices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">AR Receivable</p>
                                <p className="text-2xl font-bold text-green-600">Rp {summary.totalAROutstanding.toLocaleString()}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-50 text-green-600"><FileText size={20} /></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{claims.filter(c => c.status !== 'PAID').length} pending claims</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Cash Flow</p>
                                <p className={`text-2xl font-bold ${summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Rp {summary.netCashflow.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><DollarSign size={20} /></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">In: Rp {summary.totalIncome.toLocaleString()} | Out: Rp {summary.totalExpense.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className={summary.overdueCount > 0 ? 'border-red-300 bg-red-50/50' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p>
                                <p className="text-2xl font-bold text-orange-600">{summary.overdueCount}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><AlertTriangle size={20} /></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Rp {summary.overdueAmount.toLocaleString()} past due</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview" className="gap-2">
                        <DollarSign size={14} /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="ap" className="gap-2">
                        <Receipt size={14} /> AP (Invoices)
                    </TabsTrigger>
                    <TabsTrigger value="ar" className="gap-2">
                        <FileText size={14} /> AR (Claims)
                    </TabsTrigger>
                    <TabsTrigger value="aging" className="gap-2">
                        <Clock size={14} /> Aging
                    </TabsTrigger>
                    <TabsTrigger value="matching" className="gap-2">
                        <ArrowRightLeft size={14} /> 3-Way Match
                    </TabsTrigger>
                    <TabsTrigger value="cashflow" className="gap-2">
                        <TrendingUp size={14} /> Cash Flow
                    </TabsTrigger>
                    <TabsTrigger value="overhead" className="gap-2">
                        <PieChart size={14} /> Overhead
                    </TabsTrigger>
                    <TabsTrigger value="opname" className="gap-2">
                        <Wallet size={14} /> Hutang Subcon (Opname)
                    </TabsTrigger>
                </TabsList>

                {/* --- OVERVIEW --- */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Recent Invoices */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    Latest Invoices
                                    <Button size="sm" variant="ghost" onClick={() => setActiveTab('ap')}>View All</Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {invoices.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No invoices yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {invoices.slice(0, 5).map(inv => (
                                            <div key={inv.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                                                <div>
                                                    <span className="font-medium">{inv.vendor_name}</span>
                                                    <span className="text-muted-foreground ml-2 text-xs">{inv.invoice_number}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">Rp {inv.total_amount.toLocaleString()}</span>
                                                    <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'OVERDUE' ? 'destructive' : 'secondary'} className="text-[10px]">{inv.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Claims */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    Latest Claims
                                    <Button size="sm" variant="ghost" onClick={() => setActiveTab('ar')}>View All</Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {claims.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No claims yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {claims.slice(0, 5).map(claim => (
                                            <div key={claim.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                                                <div>
                                                    <span className="font-medium">{claim.claim_number}</span>
                                                    <span className="text-muted-foreground ml-2 text-xs">{claim.progress_percentage}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-green-600">Rp {claim.amount.toLocaleString()}</span>
                                                    <Badge variant="outline" className="text-[10px]">{claim.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick aging preview */}
                    {(aging.total30 > 0 || aging.total60 > 0 || aging.total90plus > 0) && (
                        <Card className="border-orange-200">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={16} className="text-orange-500" />
                                    <span className="font-semibold text-sm">Overdue Alert</span>
                                </div>
                                <div className="flex gap-4 text-sm">
                                    {aging.total30 > 0 && <span className="text-yellow-600">1-30d: Rp {aging.total30.toLocaleString()}</span>}
                                    {aging.total60 > 0 && <span className="text-orange-600">31-60d: Rp {aging.total60.toLocaleString()}</span>}
                                    {aging.total90plus > 0 && <span className="text-red-600">90d+: Rp {aging.total90plus.toLocaleString()}</span>}
                                </div>
                                <Button size="sm" variant="link" className="p-0 mt-1" onClick={() => setActiveTab('aging')}>View Aging Report →</Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Cashflow Forecast Widget */}
                    <CashflowForecastWidget
                        projectId={activeProjectId}
                        forecastWeeks={4}
                    />
                </TabsContent>

                {/* --- AP (INVOICES) --- */}
                <TabsContent value="ap" className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setInvoiceDialogOpen(true)}>
                            <Plus size={14} /> Record Invoice
                        </Button>
                    </div>
                    {invoices.length === 0 ? (
                        <EmptyState title="No Invoices" description="Record vendor invoices here." imageKeyword="invoice" />
                    ) : (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div className="max-h-[600px] overflow-auto relative">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Vendor</TableHead>
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Inv Number</TableHead>
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Trace</TableHead>
                                            <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Due Date</TableHead>
                                            <TableHead className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Amount</TableHead>
                                            <TableHead className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Match</TableHead>
                                            <TableHead className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Status</TableHead>
                                            <TableHead className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.map((inv, idx) => {
                                            // Mock trace data - show invoice lineage back to GRN → PO
                                            const hasTrace = inv.po_id || idx % 2 === 0
                                            const mockTrace = hasTrace ? [
                                                { type: 'PO' as const, ref: inv.po_id?.slice(0, 12) || `PO-${String(idx + 1).padStart(4, '0')}` },
                                                { type: 'GRN' as const, ref: `GRN-${String(idx).padStart(3, '0')}` },
                                            ] : []

                                            return (
                                                <TableRow key={inv.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors ${inv.status === 'OVERDUE' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                                                    <TableCell className="p-3 font-medium text-slate-700 dark:text-slate-300">{inv.vendor_name}</TableCell>
                                                    <TableCell className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.invoice_number}</TableCell>
                                                    <TableCell className="p-3">
                                                        {mockTrace.length > 0 ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <TraceCountBadge count={mockTrace.length} direction="upstream" />
                                                                <TraceChain
                                                                    chain={mockTrace}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="p-3 text-xs text-slate-500">{format(new Date(inv.due_date || new Date()), 'dd MMM yyyy')}</TableCell>
                                                    <TableCell className="p-3 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">Rp {inv.total_amount.toLocaleString()}</TableCell>
                                                    <TableCell className="p-3 text-center">
                                                        {(() => {
                                                            const matchResult = matchInvoice(inv, purchaseOrders, inventoryTransactions)
                                                            return (
                                                                <button
                                                                    onClick={() => setMatchDialogInvoice(inv)}
                                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                                >
                                                                    <Badge className={`text-[10px] px-2 py-0.5 ${getMatchStatusColor(matchResult.status)}`}>
                                                                        {getMatchStatusLabel(matchResult.status)}
                                                                    </Badge>
                                                                </button>
                                                            )
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="p-3 text-center">
                                                        <Badge variant={
                                                            inv.status === 'PAID' ? 'default' :
                                                                inv.status === 'OVERDUE' ? 'destructive' :
                                                                    'secondary'
                                                        } className="text-[10px] font-normal px-2 py-0.5">{inv.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="p-3 text-right">
                                                        {inv.status !== 'PAID' && inv.status !== 'PENDING_PAYMENT' && (
                                                            <Button size="sm" onClick={() => handlePayClick(inv)} className="h-7 text-xs">Pay</Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* --- AR (CLAIMS) --- */}
                <TabsContent value="ar">
                    <div className="flex justify-end mb-4 gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                            try {
                                const pct = parseFloat(prompt("Enter current overall progress % (e.g. 35.5):", "0") || "0")
                                if (pct <= 0) { toast.info("Cancelled"); return }
                                await progressBillingService.generateMonthlyBilling(activeProjectId!, pct)
                                toast.success("Monthly billing generated", { description: "Claims created from progress data." })
                                fetchAll(activeProjectId!)
                            } catch (err: any) {
                                toast.error("Billing generation failed", { description: err.message })
                            }
                        }}>
                            <Zap size={14} /> Auto-Generate Billing
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setClaimDialogOpen(true)}>
                            <Plus size={14} /> Create Claim
                        </Button>
                    </div>
                    {claims.length === 0 ? (
                        <EmptyState title="No Claims" description="Create progress billings (claims) to the client." imageKeyword="contract" />
                    ) : (
                        <div className="grid gap-4">
                            {claims.map(claim => (
                                <Card key={claim.id}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold">{claim.claim_number}</div>
                                            <div className="text-sm text-neutral-500">
                                                Period: {claim.period_start || '—'} → {claim.period_end || '—'}
                                                <span className="ml-2">Progress: {claim.progress_percentage}%</span>
                                            </div>
                                            {claim.notes && <div className="text-xs text-muted-foreground mt-1">{claim.notes}</div>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-green-600">Rp {claim.amount.toLocaleString()}</div>
                                                <Badge variant={
                                                    claim.status === 'PAID' ? 'default' :
                                                        claim.status === 'APPROVED' ? 'secondary' :
                                                            'outline'
                                                }>{claim.status}</Badge>
                                            </div>
                                            {claimActions(claim)}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* --- AGING REPORT --- */}
                <TabsContent value="aging">
                    <AgingReport aging={aging} />
                </TabsContent>

                {/* --- 3-WAY MATCHING --- */}
                <TabsContent value="matching">
                    <ThreeWayMatch projectId={activeProjectId!} invoices={invoices} />
                </TabsContent>

                {/* --- CASHFLOW SUMMARY --- */}
                <TabsContent value="cashflow">
                    <div className="grid gap-4 md:grid-cols-2 mb-6">
                        <Card className="bg-green-50">
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Total Income</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-green-700">Rp {summary.totalIncome.toLocaleString()}</div></CardContent>
                        </Card>
                        <Card className="bg-red-50">
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Total Expense</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-red-700">Rp {summary.totalExpense.toLocaleString()}</div></CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Transaction Ledger</CardTitle></CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? <p className="text-neutral-500 text-sm">No transactions recorded.</p> : (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <div className="max-h-[400px] overflow-auto relative">
                                        <Table>
                                            <TableHeader className="bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20">
                                                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                                    <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Date</TableHead>
                                                    <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Description</TableHead>
                                                    <TableHead className="p-3 font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Category</TableHead>
                                                    <TableHead className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.map(t => (
                                                    <TableRow key={t.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <TableCell className="p-3 text-xs text-slate-500 font-mono">{format(new Date(t.transaction_date), 'dd MMM yyyy')}</TableCell>
                                                        <TableCell className="p-3 text-sm text-slate-700 dark:text-slate-300">{t.description}</TableCell>
                                                        <TableCell className="p-3"><Badge variant="outline" className="text-[10px] font-normal text-slate-500">{t.category}</Badge></TableCell>
                                                        <TableCell className={`p-3 text-right font-bold font-mono text-xs ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            Rp {t.amount.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- OPNAME BOARD --- */}
                <TabsContent value="opname" className="space-y-6">
                    <OpnameBoard />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <InvoiceDialog
                open={invoiceDialogOpen}
                onOpenChange={setInvoiceDialogOpen}
                projectId={activeProjectId!}
            />
            <ClaimDialog
                open={claimDialogOpen}
                onOpenChange={setClaimDialogOpen}
                projectId={activeProjectId!}
            />
            <InvoiceMatchDialog
                open={!!matchDialogInvoice}
                onOpenChange={(open) => { if (!open) setMatchDialogInvoice(null) }}
                invoice={matchDialogInvoice}
                onApprove={(id) => {
                    if (activeProjectId) payInvoice(id, activeProjectId, matchDialogInvoice?.total_amount || 0)
                }}
            />

            <AlertDialog open={!!pendingInvoicePayment} onOpenChange={(open) => { if (!open) setPendingInvoicePayment(null) }}>
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
        </div>
    )
}
