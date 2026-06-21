import React, { useEffect, useMemo, useState } from "react"
import { Receipt, FileText, Clock, AlertTriangle, TrendingUp, DollarSign, ArrowRightLeft, PieChart, Send, ShieldCheck, CheckCircle, Plus, Zap, Wallet } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { CashflowForecastWidget } from "@/components/finance/CashflowForecastWidget"
import { FinanceAPTab } from "@/components/finance/FinanceAPTab"
import { AnomalyWidget } from "@/components/common/AnomalyWidget"
import { useShallow } from "zustand/react/shallow"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import type { Invoice } from "@/types/finance"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import ModulePageState from "@/components/common/ModulePageState"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"
import { ExportMenu, type ExportColumn } from "@/components/shared/ExportMenu"

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip, ModeSwitch, AlertStrip } from '@/components/patterns'

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
    const activeProjectName = useProjectStore(s => activeProjectId ? s.projects[activeProjectId]?.name || 'Project' : 'Project')
    const { handleAsync } = useErrorHandler()
    const [activeTab, setActiveTab] = useState("overview")
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [claimDialogOpen, setClaimDialogOpen] = useState(false)
    const [billingDialogOpen, setBillingDialogOpen] = useState(false)
    const [billingProgressInput, setBillingProgressInput] = useState(() => {
        try { return localStorage.getItem('finance.billing.progress') || '0' } catch { return '0' }
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
    const [srStatus, setSrStatus] = useState('')
    const { purchaseOrders, inventoryTransactions } = useSupplyChainStore(
        useShallow(s => ({ purchaseOrders: s.purchaseOrders, inventoryTransactions: s.inventoryTransactions }))
    )

    const {
        invoices, claims, transactions, loading,
        summary, aging,
        fetchAll, markOverdue, updateClaimStatus, updateInvoiceStatus
    } = useFinanceStore(useShallow(s => ({
        invoices: s.invoices, claims: s.claims, transactions: s.transactions, loading: s.loading,
        summary: s.summary, aging: s.aging,
        fetchAll: s.fetchAll, markOverdue: s.markOverdue,
        updateClaimStatus: s.updateClaimStatus, updateInvoiceStatus: s.updateInvoiceStatus,
    })))

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
            localStorage.setItem('finance.ar.query', arQuery)
            localStorage.setItem('finance.ar.status', arStatusFilter)
            localStorage.setItem('finance.ar.sort', arSortBy)
            localStorage.setItem('finance.ar.periodFrom', arPeriodFrom)
            localStorage.setItem('finance.ar.periodTo', arPeriodTo)
        } catch {
            // ignore storage errors
        }
    }, [billingProgressInput, arQuery, arStatusFilter, arSortBy, arPeriodFrom, arPeriodTo])

    const resetArAdvancedFilters = () => {
        setArPeriodFrom('')
        setArPeriodTo('')
        setSrStatus('AR advanced filters reset.')
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

    // ── ModeSwitch tab options ───────────────────────────────────────────────
    const financeTabOptions = [
        { value: 'overview', label: 'Overview', icon: <DollarSign className="h-3.5 w-3.5" /> },
        { value: 'ap', label: 'AP', icon: <Receipt className="h-3.5 w-3.5" /> },
        { value: 'ar', label: 'AR', icon: <FileText className="h-3.5 w-3.5" /> },
        { value: 'aging', label: 'Aging', icon: <Clock className="h-3.5 w-3.5" /> },
        { value: 'matching', label: '3-Way', icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
        { value: 'cashflow', label: 'Cash Flow', icon: <TrendingUp className="h-3.5 w-3.5" /> },
        { value: 'overhead', label: 'Overhead', icon: <PieChart className="h-3.5 w-3.5" /> },
        { value: 'opname', label: 'Opname', icon: <Wallet className="h-3.5 w-3.5" /> },
    ]

    // ── SummaryStrip items ───────────────────────────────────────────────────
    const finSummaryItems = [
        { label: 'AP Outstanding', value: `Rp ${summary.totalAPOutstanding.toLocaleString()}`, status: 'danger' as const },
        { label: 'AR Receivable', value: `Rp ${summary.totalAROutstanding.toLocaleString()}`, status: 'success' as const },
        { label: 'Net Cashflow', value: `Rp ${summary.netCashflow.toLocaleString()}`, status: (summary.netCashflow >= 0 ? 'success' : 'danger') as 'success' | 'danger' },
        { label: 'Overdue', value: summary.overdueCount, status: (summary.overdueCount > 0 ? 'danger' : 'success') as 'danger' | 'success' },
    ]

    // ── Export column definitions ─────────────────────────────────────────────
    const invoiceExportCols: ExportColumn<Invoice>[] = [
        { header: 'Invoice #', accessor: r => r.invoice_number ?? '' },
        { header: 'Vendor', accessor: r => r.vendor_name ?? '' },
        { header: 'Amount', accessor: r => r.total_amount ?? 0 },
        { header: 'Status', accessor: r => r.status ?? '' },
        { header: 'Due Date', accessor: r => r.due_date ?? '' },
    ]

    const claimExportCols: ExportColumn<typeof filteredClaims[number]>[] = [
        { header: 'Claim #', accessor: r => (r as any).claim_number ?? (r as any).id ?? '' },
        { header: 'Period', accessor: r => (r as any).period ?? '' },
        { header: 'Amount', accessor: r => (r as any).amount ?? 0 },
        { header: 'Status', accessor: r => (r as any).status ?? '' },
        { header: 'Submitted', accessor: r => (r as any).submitted_at ?? '' },
    ]

    const exportFilename = `Finance_${activeProjectId}_${new Date().toISOString().slice(0, 10)}`

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'Overdue',
                            level: summary.overdueCount > 0 ? 'critical' : 'good',
                            value: `${summary.overdueCount}`,
                        },
                    ]}
                />
            }
            navigation={
                <ModeSwitch
                    options={financeTabOptions}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            }
            header={
                <WorkspaceHeader
                    title="Finance"
                    subtitle="Manage AP, AR, Aging, 3-Way Matching & Cash Flow"
                    primaryAction={{
                        label: 'Record Invoice',
                        icon: <Plus className="h-3.5 w-3.5" />,
                        onClick: () => setInvoiceDialogOpen(true),
                    }}
                    secondaryActions={[
                        {
                            label: 'Create Claim',
                            icon: <FileText className="h-3.5 w-3.5" />,
                            onClick: () => setClaimDialogOpen(true),
                        },
                    ]}
                    extraContent={
                        <ExportMenu
                            data={activeTab === 'ar' ? filteredClaims as any[] : invoices}
                            columns={activeTab === 'ar' ? claimExportCols as any : invoiceExportCols}
                            filename={exportFilename}
                            size="sm"
                        />
                    }
                />
            }
            summary={
                <SummaryStrip items={finSummaryItems} variant="compact-cards" />
            }
            alert={
                summary.overdueCount > 0 ? (
                    <AlertStrip
                        severity="warning"
                        message={`${summary.overdueCount} invoice${summary.overdueCount > 1 ? 's' : ''} overdue — Rp ${summary.overdueAmount.toLocaleString()} past due`}
                        action={{ label: 'View Aging', onClick: () => setActiveTab('aging') }}
                    />
                ) : undefined
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

                {/* --- OVERVIEW --- */}
                <TabsContent value="overview" className="space-y-6">
                    <AnomalyWidget projectId={activeProjectId} />
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
                    <FinanceAPTab
                        projectId={activeProjectId!}
                        invoices={invoices}
                        purchaseOrders={purchaseOrders}
                        inventoryTransactions={inventoryTransactions}
                        onUpdateInvoiceStatus={updateInvoiceStatus}
                        onOpenInvoiceDialog={() => setInvoiceDialogOpen(true)}
                        handleAsync={handleAsync}
                    />
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
                        <div className="flex flex-wrap justify-end gap-2">
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
                                <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                                    <div className="max-h-[400px] overflow-auto relative">
                                        <Table>
                                            <TableHeader className="bg-muted/30 backdrop-blur-sm sticky top-0 z-20">
                                                <TableRow className="hover:bg-transparent border-border">
                                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Date</TableHead>
                                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Description</TableHead>
                                                    <TableHead className="p-3 font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Category</TableHead>
                                                    <TableHead className="p-3 text-right font-semibold text-muted-foreground h-9 text-xs uppercase tracking-wider">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.map(t => (
                                                    <TableRow key={t.id} className="border-b border-border hover:bg-accent/40 transition-colors">
                                                        <TableCell className="p-3 text-xs text-muted-foreground font-mono">{format(new Date(t.transaction_date), 'dd MMM yyyy')}</TableCell>
                                                        <TableCell className="p-3 text-sm text-muted-foreground">{t.description}</TableCell>
                                                        <TableCell className="p-3"><Badge variant="outline" className="text-xs font-normal text-muted-foreground">{t.category}</Badge></TableCell>
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
        </PageShell>
    )
}
