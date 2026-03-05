import React, { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Receipt, FileText, Clock, AlertTriangle, TrendingUp, DollarSign, ArrowRightLeft, PieChart, Send, ShieldCheck, CheckCircle, Plus, Zap, Wallet } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { auditTrail } from "@/lib/auditTrail"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import ModulePageState from "@/components/common/ModulePageState"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"

const AP_STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ISSUED', label: 'Issued' },
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

const AR_STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'PAID', label: 'Paid' },
]

const AR_SORT_OPTIONS = [
    { value: 'period-latest', label: 'Latest Period' },
    { value: 'period-oldest', label: 'Oldest Period' },
    { value: 'amount-high', label: 'Amount High-Low' },
    { value: 'amount-low', label: 'Amount Low-High' },
]

export default function Finance() {
    const { activeProjectId } = useProjectStore()
    const { handleAsync } = useErrorHandler()
    const [activeTab, setActiveTab] = useState("overview")
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [claimDialogOpen, setClaimDialogOpen] = useState(false)
    const [billingDialogOpen, setBillingDialogOpen] = useState(false)
    const [billingProgressInput, setBillingProgressInput] = useState(() => {
        try { return localStorage.getItem('finance.billing.progress') || '0' } catch { return '0' }
    })
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
    const [arQuery, setArQuery] = useState(() => {
        try { return localStorage.getItem('finance.ar.query') || '' } catch { return '' }
    })
    const [arStatusFilter, setArStatusFilter] = useState(() => {
        try { return localStorage.getItem('finance.ar.status') || 'all' } catch { return 'all' }
    })
    const [arSortBy, setArSortBy] = useState(() => {
        try { return localStorage.getItem('finance.ar.sort') || 'period-latest' } catch { return 'period-latest' }
    })
    const [arPeriodFrom, setArPeriodFrom] = useState(() => {
        try { return localStorage.getItem('finance.ar.periodFrom') || '' } catch { return '' }
    })
    const [arPeriodTo, setArPeriodTo] = useState(() => {
        try { return localStorage.getItem('finance.ar.periodTo') || '' } catch { return '' }
    })
    const [pendingInvoicePayment, setPendingInvoicePayment] = useState<{ id: string; project_id: string; total_amount: number; invoice_number: string; vendor_name?: string } | null>(null)
    const [matchDialogInvoice, setMatchDialogInvoice] = useState<Invoice | null>(null)
    const [srStatus, setSrStatus] = useState('')
    const { purchaseOrders, inventoryTransactions } = useSupplyChainStore()

    const {
        invoices, claims, transactions, loading,
        summary, aging,
        fetchAll, markOverdue, payInvoice, updateClaimStatus
    } = useFinanceStore()

    // P0.3.3: Invoice table virtualizer
    const invScrollRef = useRef<HTMLDivElement>(null)

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

    const filteredClaims = useMemo(() => {
        const q = arQuery.trim().toLowerCase()
        return [...claims]
            .filter((claim) => {
                const matchesQuery = !q ||
                    claim.claim_number.toLowerCase().includes(q) ||
                    (claim.notes || '').toLowerCase().includes(q)
                const matchesStatus = arStatusFilter === 'all' || claim.status === arStatusFilter
                const periodDate = new Date(claim.period_end || claim.period_start || claim.created_at || 0)
                const fromBoundary = arPeriodFrom ? new Date(`${arPeriodFrom}T00:00:00`) : null
                const toBoundary = arPeriodTo ? new Date(`${arPeriodTo}T23:59:59`) : null
                const matchesPeriodFrom = !fromBoundary || periodDate >= fromBoundary
                const matchesPeriodTo = !toBoundary || periodDate <= toBoundary

                return matchesQuery && matchesStatus && matchesPeriodFrom && matchesPeriodTo
            })
            .sort((a, b) => {
                const aPeriod = new Date(a.period_end || a.period_start || 0).getTime()
                const bPeriod = new Date(b.period_end || b.period_start || 0).getTime()
                if (arSortBy === 'period-oldest') return aPeriod - bPeriod
                if (arSortBy === 'amount-high') return b.amount - a.amount
                if (arSortBy === 'amount-low') return a.amount - b.amount
                return bPeriod - aPeriod
            })
    }, [claims, arQuery, arStatusFilter, arSortBy, arPeriodFrom, arPeriodTo])

    const apVendorOptions = useMemo(() => {
        return Array.from(new Set(
            invoices
                .map((inv) => (inv.vendor_name || '').trim())
                .filter((name) => name.length > 0)
                .map((name) => name.toLowerCase())
        )).sort((a, b) => a.localeCompare(b))
    }, [invoices])

    const virtualInvoiceRows = useVirtualizer({
        count: filteredInvoices.length,
        getScrollElement: () => invScrollRef.current,
        estimateSize: () => 56,
        overscan: 8,
    })

    useEffect(() => {
        if (activeProjectId) {
            setSrStatus('Loading financial data...')
            fetchAll(activeProjectId)
            // Auto-detect overdue invoices
            markOverdue(activeProjectId)
        }
    }, [activeProjectId, fetchAll, markOverdue])

    useEffect(() => {
        if (!activeProjectId) {
            setSrStatus('No active project selected for finance module.')
            return
        }

        if (loading) {
            setSrStatus(`Loading ${activeTab} financial data...`)
            return
        }

        setSrStatus(`Finance ${activeTab} data ready.`)
    }, [activeProjectId, loading, activeTab])

    useEffect(() => {
        try {
            localStorage.setItem('finance.billing.progress', billingProgressInput)
            localStorage.setItem('finance.ap.query', apQuery)
            localStorage.setItem('finance.ap.status', apStatusFilter)
            localStorage.setItem('finance.ap.sort', apSortBy)
            localStorage.setItem('finance.ap.vendor', apVendorFilter)
            localStorage.setItem('finance.ap.dueFrom', apDueFrom)
            localStorage.setItem('finance.ap.dueTo', apDueTo)
            localStorage.setItem('finance.ar.query', arQuery)
            localStorage.setItem('finance.ar.status', arStatusFilter)
            localStorage.setItem('finance.ar.sort', arSortBy)
            localStorage.setItem('finance.ar.periodFrom', arPeriodFrom)
            localStorage.setItem('finance.ar.periodTo', arPeriodTo)
        } catch {
            // ignore storage errors
        }
    }, [billingProgressInput, apQuery, apStatusFilter, apSortBy, apVendorFilter, apDueFrom, apDueTo, arQuery, arStatusFilter, arSortBy, arPeriodFrom, arPeriodTo])

    const resetApAdvancedFilters = () => {
        setApVendorFilter('all')
        setApDueFrom('')
        setApDueTo('')
        setSrStatus('AP advanced filters reset.')
    }

    const resetArAdvancedFilters = () => {
        setArPeriodFrom('')
        setArPeriodTo('')
        setSrStatus('AR advanced filters reset.')
    }

    const handlePayClick = (inv: { id: string; project_id: string; total_amount: number; invoice_number: string; vendor_name?: string }) => {
        setPendingInvoicePayment(inv)
    }

    const handlePayConfirm = async () => {
        if (!pendingInvoicePayment) return
        setSrStatus('Submitting payment approval request...')

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

            // Mark invoice as pending locally
            useFinanceStore.getState().updateInvoiceStatus(pendingInvoicePayment.id, 'PENDING_PAYMENT', pendingInvoicePayment.project_id)
            return true
        }, 'approval.general')

        if (approved) {
            toast.success("Payment approval requested", { description: "Sent to PM's Command Center" })
            setSrStatus('Payment approval request submitted.')
            setPendingInvoicePayment(null)
        } else {
            setSrStatus('Failed to submit payment approval request.')
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
                onClick={async () => {
                    if (!activeProjectId) return
                    setSrStatus(`Updating claim ${claim.claim_number} status to ${action.next}...`)
                    try {
                        await updateClaimStatus(claim.id, action.next, activeProjectId)
                        setSrStatus(`Claim ${claim.claim_number} updated to ${action.next}.`)
                    } catch {
                        setSrStatus(`Failed to update claim ${claim.claim_number}.`)
                    }
                }}
            >
                {action.icon} {action.label}
            </Button>
        )
    }

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<TrendingUp size={18} />}
                title="Finance"
                description="Manage AP (Invoices), AR (Claims), Aging, and 3-Way Matching."
                variant="empty"
                message="Select an active project to view financial data."
            />
        )
    }

    if (loading && invoices.length === 0 && claims.length === 0 && transactions.length === 0) {
        return (
            <ModulePageState
                icon={<TrendingUp size={18} />}
                title="Finance"
                description="Manage AP (Invoices), AR (Claims), Aging, and 3-Way Matching."
                variant="loading"
                message="Loading financial data..."
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <ModuleHeader
                icon={<TrendingUp size={18} />}
                title="Finance"
                description="Manage AP (Invoices), AR (Claims), Aging, and 3-Way Matching."
                accent="teal"
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
                                                    <span className="font-mono tabular-nums">Rp {inv.total_amount.toLocaleString()}</span>
                                                    <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'OVERDUE' ? 'destructive' : 'secondary'} className="text-xs">{inv.status}</Badge>
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
                                                    <span className="font-mono tabular-nums text-green-600">Rp {claim.amount.toLocaleString()}</span>
                                                    <Badge variant="outline" className="text-xs">{claim.status}</Badge>
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
                        invoices={invoices}
                        claims={claims}
                        transactions={transactions}
                        currentBalance={Math.max(0, summary.totalIncome - summary.totalExpense)}
                    />
                </TabsContent>

                {/* --- AP (INVOICES) --- */}
                <TabsContent value="ap" className="space-y-4">
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
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setInvoiceDialogOpen(true)}>
                            <Plus size={14} /> Record Invoice
                        </Button>
                    </div>
                    {filteredInvoices.length === 0 ? (
                        <EmptyState title="No Invoices Found" description="No invoice matches current search/filter." imageKeyword="invoice" />
                    ) : (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            <div ref={invScrollRef} className="max-h-[600px] overflow-auto relative">
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
                                                <TableRow key={inv.id} data-index={vRow.index} ref={virtualInvoiceRows.measureElement} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors ${inv.status === 'OVERDUE' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                                                    <TableCell className="p-3 font-medium text-slate-700 dark:text-slate-300">{inv.vendor_name}</TableCell>
                                                    <TableCell className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.invoice_number}</TableCell>
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
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="p-3 text-xs text-slate-500">{format(new Date(inv.due_date || new Date()), 'dd MMM yyyy')}</TableCell>
                                                    <TableCell className="p-3 text-right font-mono tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-300">Rp {inv.total_amount.toLocaleString()}</TableCell>
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
                                                        <Badge variant={
                                                            inv.status === 'PAID' ? 'default' :
                                                                inv.status === 'OVERDUE' ? 'destructive' :
                                                                    'secondary'
                                                        } className="text-xs font-normal px-2 py-0.5">{inv.status}</Badge>
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
                </TabsContent>

                {/* --- AR (CLAIMS) --- */}
                <TabsContent value="ar">
                    <div className="flex flex-col gap-3 mb-4">
                        <ModuleListToolbar
                            query={arQuery}
                            onQueryChange={setArQuery}
                            queryPlaceholder="Search claim number or notes..."
                            filterValue={arStatusFilter}
                            onFilterChange={setArStatusFilter}
                            filterOptions={AR_STATUS_OPTIONS}
                            sortValue={arSortBy}
                            onSortChange={setArSortBy}
                            sortOptions={AR_SORT_OPTIONS}
                            resultCount={filteredClaims.length}
                            resultLabel="claims"
                        />
                        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                            <div className="grid gap-1 md:w-[170px]">
                                <Label className="text-xs text-muted-foreground">Period from</Label>
                                <Input
                                    type="date"
                                    value={arPeriodFrom}
                                    onChange={(event) => setArPeriodFrom(event.target.value)}
                                    aria-label="Filter AR period from"
                                    className="h-9"
                                />
                            </div>
                            <div className="grid gap-1 md:w-[170px]">
                                <Label className="text-xs text-muted-foreground">Period to</Label>
                                <Input
                                    type="date"
                                    value={arPeriodTo}
                                    onChange={(event) => setArPeriodTo(event.target.value)}
                                    aria-label="Filter AR period to"
                                    className="h-9"
                                />
                            </div>
                            <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={resetArAdvancedFilters}>
                                Reset Filters
                            </Button>
                        </div>
                        <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setBillingDialogOpen(true)}>
                            <Zap size={14} /> Auto-Generate Billing
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setClaimDialogOpen(true)}>
                            <Plus size={14} /> Create Claim
                        </Button>
                        </div>
                    </div>
                    {filteredClaims.length === 0 ? (
                        <EmptyState title="No Claims Found" description="No claim matches current search/filter." imageKeyword="contract" />
                    ) : (
                        <div className="grid gap-4">
                            {filteredClaims.map(claim => (
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
                    <CashflowForecastWidget
                        projectId={activeProjectId}
                        forecastWeeks={8}
                        invoices={invoices}
                        claims={claims}
                        transactions={transactions}
                        currentBalance={Math.max(0, summary.totalIncome - summary.totalExpense)}
                    />

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
                                                        <TableCell className="p-3"><Badge variant="outline" className="text-xs font-normal text-slate-500">{t.category}</Badge></TableCell>
                                                        <TableCell className={`p-3 text-right font-bold font-mono tabular-nums text-xs ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

            <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Auto-Generate Billing</DialogTitle>
                        <DialogDescription>
                            Generate monthly client billing from current overall progress percentage.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-muted-foreground">Overall Progress (%)</label>
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={billingProgressInput}
                            onChange={(e) => setBillingProgressInput(e.target.value)}
                            placeholder="e.g. 35.5"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBillingDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                const pct = parseFloat(billingProgressInput)
                                if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
                                    toast.error('Progress must be between 0 and 100')
                                    setSrStatus('Progress must be between 0 and 100.')
                                    return
                                }

                                setSrStatus('Generating monthly billing from progress data...')

                                const generated = await handleAsync(async () => {
                                    await progressBillingService.generateMonthlyBilling(activeProjectId!, pct)
                                    return true
                                }, 'finance.general')

                                if (generated) {
                                    toast.success("Monthly billing generated", { description: "Claims created from progress data." })
                                    setSrStatus('Monthly billing generated successfully.')
                                    setBillingDialogOpen(false)
                                    fetchAll(activeProjectId!)
                                } else {
                                    setSrStatus('Failed to generate monthly billing.')
                                }
                            }}
                        >Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
