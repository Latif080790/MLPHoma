import React, { useEffect, useMemo, useState } from "react"
import { Send, ShieldCheck, CheckCircle, Zap, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { TabsContent } from "@/components/ui/tabs"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { ClientClaim } from "@/types/finance"
import { progressBillingService } from "@/services/progressBillingService"
import { toast } from "sonner"

// ── Constants ────────────────────────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────────────────

interface FinanceARTabProps {
    projectId: string
    claims: ClientClaim[]
    updateClaimStatus: (claimId: string, next: ClientClaim['status'], projectId: string) => Promise<void>
    fetchAll: (projectId: string) => Promise<void>
    onOpenClaimDialog: () => void
    handleAsync: <T>(fn: () => Promise<T>, key?: string) => Promise<T | null>
    loading?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FinanceARTab({
    projectId,
    claims,
    updateClaimStatus,
    fetchAll,
    onOpenClaimDialog,
    handleAsync,
}: FinanceARTabProps) {

    // ── Local State ───────────────────────────────────────────────────────────

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

    // ── Persistence ──────────────────────────────────────────────────────────

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

    // ── Computed Values ──────────────────────────────────────────────────────

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

    // ── Handlers ──────────────────────────────────────────────────────────────

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
                    setSrStatus(`Updating claim ${claim.claim_number} status to ${action.next}...`)
                    try {
                        await updateClaimStatus(claim.id, action.next, projectId)
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

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

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
                        <Button size="sm" variant="outline" className="gap-2" onClick={onOpenClaimDialog}>
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

            {/* Billing Dialog */}
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
                                    await progressBillingService.generateMonthlyBilling(projectId, pct)
                                    return true
                                }, 'finance.general')

                                if (generated) {
                                    toast.success("Monthly billing generated", { description: "Claims created from progress data." })
                                    setSrStatus('Monthly billing generated successfully.')
                                    setBillingDialogOpen(false)
                                    fetchAll(projectId)
                                } else {
                                    setSrStatus('Failed to generate monthly billing.')
                                }
                            }}
                        >Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
