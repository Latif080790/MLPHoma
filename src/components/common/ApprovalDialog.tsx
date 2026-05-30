/**
 * ApprovalDialog.tsx
 * Reusable dialog for reviewing and acting on approval requests.
 * Shows entity-type-aware Impact Analysis Panel + APPROVE/REJECT actions.
 */

import React, { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
    Check, X, AlertTriangle, DollarSign, ArrowRightLeft, Info, ShieldCheck,
    TrendingUp, TrendingDown, Package, Receipt, RefreshCw
} from 'lucide-react'
import { useApprovalStore } from '@/store/approvalStore'
import { useAuthStore } from '@/store/authStore'
import { APPROVAL_ENTITY_LABELS } from '@/types/approval'
import type { ApprovalEntityType, ApprovalRequest } from '@/types/approval'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Props {
    approval: ApprovalRequest
    open: boolean
    onClose: () => void
    onApproved?: (approval: ApprovalRequest) => void
    onRejected?: (approval: ApprovalRequest) => void
}

// ---------------------------------------------------------------------------
// IDR formatter
// ---------------------------------------------------------------------------
const idrFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
})
function formatIDR(val: number): string {
    return idrFormatter.format(val)
}

// ---------------------------------------------------------------------------
// Impact-panel helpers
// ---------------------------------------------------------------------------

function ImpactRow({ icon, label, value, valueClass }: {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
    valueClass?: string
}) {
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="shrink-0">{icon}</span>
            <span className="text-muted-foreground">{label}:</span>
            <strong className={valueClass}>{value}</strong>
        </div>
    )
}

function WarningRow({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
            <AlertTriangle size={12} className="shrink-0" />
            <span>{text}</span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Per-entity impact panels
// ---------------------------------------------------------------------------

function PurchaseOrderPanel({ s }: { s: Record<string, unknown> }) {
    const totalAmount = typeof s.totalAmount === 'number' ? s.totalAmount : null
    const remainingBudget = typeof s.remainingBudget === 'number' ? s.remainingBudget : null
    const requiresApproval = Boolean(s.requiresApproval)

    return (
        <>
            {totalAmount !== null && (
                <ImpactRow
                    icon={<Receipt size={12} className="text-blue-500" />}
                    label="PO Total Amount"
                    value={formatIDR(totalAmount)}
                />
            )}
            {remainingBudget !== null && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Remaining Budget (after commit)"
                    value={formatIDR(remainingBudget)}
                    valueClass={remainingBudget < 0 ? 'text-red-600' : undefined}
                />
            )}
            {requiresApproval && (
                <WarningRow text="Amount is close to budget limit — elevated approval required." />
            )}
        </>
    )
}

function BudgetTransferOverridePanel({ s }: { s: Record<string, unknown> }) {
    const budgetImpact = typeof s.budgetImpact === 'number' ? s.budgetImpact : null
    const sourceWbs = typeof s.sourceWbs === 'string' ? s.sourceWbs : null
    const targetWbs = typeof s.targetWbs === 'string' ? s.targetWbs : null
    const remainingBudget = typeof s.remainingBudget === 'number' ? s.remainingBudget : null
    const warning = typeof s.warning === 'string' ? s.warning : null

    return (
        <>
            {budgetImpact !== null && (
                <ImpactRow
                    icon={budgetImpact < 0
                        ? <TrendingDown size={12} className="text-red-500" />
                        : <TrendingUp size={12} className="text-green-500" />}
                    label="Budget Impact"
                    value={`${budgetImpact < 0 ? '-' : '+'}${formatIDR(Math.abs(budgetImpact))}`}
                    valueClass={budgetImpact < 0 ? 'text-red-600' : 'text-green-600'}
                />
            )}
            {sourceWbs && targetWbs && (
                <div className="flex items-center gap-2 text-xs">
                    <ArrowRightLeft size={12} className="shrink-0 text-indigo-500" />
                    <span className="font-medium">{sourceWbs}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{targetWbs}</span>
                </div>
            )}
            {remainingBudget !== null && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Remaining Budget"
                    value={formatIDR(remainingBudget)}
                    valueClass={remainingBudget < 0 ? 'text-red-600' : undefined}
                />
            )}
            {warning && <WarningRow text={warning} />}
        </>
    )
}

function ChangeOrderPanel({ s }: { s: Record<string, unknown> }) {
    // Variation Order branch
    const isVO = s.valueChange !== undefined || s.currentContractValue !== undefined

    if (isVO) {
        const valueChange = typeof s.valueChange === 'number' ? s.valueChange : null
        const scheduleChangeDays = typeof s.scheduleChangeDays === 'number' ? s.scheduleChangeDays : null
        const currentContractValue = typeof s.currentContractValue === 'number' ? s.currentContractValue : null
        const newContractValue = typeof s.newContractValue === 'number' ? s.newContractValue : null
        const isAddition = Boolean(s.isAddition)

        return (
            <>
                {valueChange !== null && (
                    <ImpactRow
                        icon={isAddition
                            ? <TrendingUp size={12} className="text-green-500" />
                            : <TrendingDown size={12} className="text-red-500" />}
                        label="Contract Value Change (VO)"
                        value={`${isAddition ? '+' : '-'}${formatIDR(Math.abs(valueChange))}`}
                        valueClass={isAddition ? 'text-green-600' : 'text-red-600'}
                    />
                )}
                {currentContractValue !== null && newContractValue !== null && (
                    <div className="flex items-center gap-2 text-xs">
                        <RefreshCw size={12} className="shrink-0 text-purple-500" />
                        <span className="text-muted-foreground">Contract:</span>
                        <span className="font-medium">{formatIDR(currentContractValue)}</span>
                        <span className="text-muted-foreground">→</span>
                        <strong className={isAddition ? 'text-green-600' : 'text-red-600'}>
                            {formatIDR(newContractValue)}
                        </strong>
                    </div>
                )}
                {scheduleChangeDays !== null && (
                    <ImpactRow
                        icon={<AlertTriangle size={12} className={scheduleChangeDays > 0 ? 'text-amber-500' : 'text-green-500'} />}
                        label="Schedule Change"
                        value={`${scheduleChangeDays > 0 ? '+' : ''}${scheduleChangeDays} days`}
                        valueClass={scheduleChangeDays > 0 ? 'text-amber-600' : 'text-green-600'}
                    />
                )}
            </>
        )
    }

    // Standard Change Order (CCO)
    const costImpact = typeof s.costImpact === 'number' ? s.costImpact : null
    const scheduleImpactDays = typeof s.scheduleImpactDays === 'number' ? s.scheduleImpactDays : null
    const warning = typeof s.warning === 'string' ? s.warning : null

    return (
        <>
            {costImpact !== null && (
                <ImpactRow
                    icon={<DollarSign size={12} className={costImpact < 0 ? 'text-red-500' : 'text-green-500'} />}
                    label="Cost Impact"
                    value={`${costImpact < 0 ? '-' : '+'}${formatIDR(Math.abs(costImpact))}`}
                    valueClass={costImpact < 0 ? 'text-red-600' : 'text-green-600'}
                />
            )}
            {scheduleImpactDays !== null && (
                <ImpactRow
                    icon={<AlertTriangle size={12} className={scheduleImpactDays > 0 ? 'text-amber-500' : 'text-green-500'} />}
                    label="Schedule Impact"
                    value={`${scheduleImpactDays > 0 ? '+' : ''}${scheduleImpactDays} days`}
                    valueClass={scheduleImpactDays > 0 ? 'text-amber-600' : 'text-green-600'}
                />
            )}
            {warning && <WarningRow text={warning} />}
        </>
    )
}

function ProgressClaimPanel({ s }: { s: Record<string, unknown> }) {
    const grossAmount = typeof s.grossAmount === 'number' ? s.grossAmount : null
    const retentionAmount = typeof s.retentionAmount === 'number' ? s.retentionAmount : null
    const netAmount = typeof s.netAmount === 'number' ? s.netAmount : null
    const progress = typeof s.progress === 'number' ? s.progress : null
    const period = typeof s.period === 'string' ? s.period : null

    return (
        <>
            {period && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Claim Period"
                    value={period}
                />
            )}
            {progress !== null && (
                <ImpactRow
                    icon={<TrendingUp size={12} className="text-green-500" />}
                    label="Progress"
                    value={`${progress.toFixed(1)}%`}
                />
            )}
            {grossAmount !== null && (
                <ImpactRow
                    icon={<Receipt size={12} className="text-blue-500" />}
                    label="Gross Amount"
                    value={formatIDR(grossAmount)}
                />
            )}
            {retentionAmount !== null && (
                <ImpactRow
                    icon={<TrendingDown size={12} className="text-amber-500" />}
                    label="Retention (5%)"
                    value={`– ${formatIDR(retentionAmount)}`}
                    valueClass="text-amber-600"
                />
            )}
            {netAmount !== null && (
                <ImpactRow
                    icon={<DollarSign size={12} className="text-green-600" />}
                    label="Net Claim Amount"
                    value={formatIDR(netAmount)}
                    valueClass="text-green-700 dark:text-green-400"
                />
            )}
        </>
    )
}

function BudgetRevisionPanel({ s }: { s: Record<string, unknown> }) {
    const totalCurrentBudget = typeof s.totalCurrentBudget === 'number' ? s.totalCurrentBudget : null
    const totalDelta = typeof s.totalDelta === 'number' ? s.totalDelta : null
    const deltaPercent = typeof s.deltaPercent === 'number' ? s.deltaPercent : null
    const itemCount = typeof s.itemCount === 'number' ? s.itemCount : null
    const needsDirector = deltaPercent !== null && Math.abs(deltaPercent) > 10

    return (
        <>
            {itemCount !== null && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Items Affected"
                    value={`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                />
            )}
            {totalCurrentBudget !== null && (
                <ImpactRow
                    icon={<DollarSign size={12} className="text-blue-500" />}
                    label="Current Budget"
                    value={formatIDR(totalCurrentBudget)}
                />
            )}
            {totalDelta !== null && (
                <ImpactRow
                    icon={totalDelta < 0
                        ? <TrendingDown size={12} className="text-red-500" />
                        : <TrendingUp size={12} className="text-green-500" />}
                    label="Total Delta (Δ)"
                    value={`${totalDelta < 0 ? '-' : '+'}${formatIDR(Math.abs(totalDelta))}`}
                    valueClass={totalDelta < 0 ? 'text-red-600' : 'text-green-600'}
                />
            )}
            {deltaPercent !== null && (
                <div className="flex items-center gap-2 text-xs">
                    <RefreshCw size={12} className="shrink-0 text-purple-500" />
                    <span className="text-muted-foreground">Δ Percent:</span>
                    <Badge
                        variant={needsDirector ? 'destructive' : 'outline'}
                        className="text-xs px-1.5 py-0"
                    >
                        {deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
                    </Badge>
                    {needsDirector && (
                        <span className="text-red-600 font-semibold">&gt;10% — Director approval required</span>
                    )}
                </div>
            )}
        </>
    )
}

function MaterialTransferPanel({ s }: { s: Record<string, unknown> }) {
    const sourceLocation = typeof s.sourceLocation === 'string' ? s.sourceLocation : null
    const destinationLocation = typeof s.destinationLocation === 'string' ? s.destinationLocation : null
    const materialName = typeof s.materialName === 'string' ? s.materialName : null
    const quantity = typeof s.quantity === 'number' ? s.quantity : null
    const unit = typeof s.unit === 'string' ? s.unit : null

    return (
        <>
            {materialName && (
                <ImpactRow
                    icon={<Package size={12} className="text-blue-500" />}
                    label="Material"
                    value={materialName}
                />
            )}
            {quantity !== null && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Quantity"
                    value={unit ? `${quantity.toLocaleString('id-ID')} ${unit}` : quantity.toLocaleString('id-ID')}
                />
            )}
            {sourceLocation && destinationLocation && (
                <div className="flex items-center gap-2 text-xs">
                    <ArrowRightLeft size={12} className="shrink-0 text-indigo-500" />
                    <span className="font-medium">{sourceLocation}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{destinationLocation}</span>
                </div>
            )}
        </>
    )
}

function PaymentPanel({ s }: { s: Record<string, unknown> }) {
    const amount = typeof s.amount === 'number' ? s.amount : null
    const invoiceRef = typeof s.invoiceRef === 'string' ? s.invoiceRef : null
    const vendorName = typeof s.vendorName === 'string' ? s.vendorName : null

    return (
        <>
            {vendorName && (
                <ImpactRow
                    icon={<Info size={12} className="text-blue-500" />}
                    label="Vendor"
                    value={vendorName}
                />
            )}
            {invoiceRef && (
                <ImpactRow
                    icon={<Receipt size={12} className="text-blue-500" />}
                    label="Invoice Ref"
                    value={invoiceRef}
                />
            )}
            {amount !== null && (
                <ImpactRow
                    icon={<DollarSign size={12} className="text-green-600" />}
                    label="Payment Amount"
                    value={formatIDR(amount)}
                    valueClass="text-green-700 dark:text-green-400"
                />
            )}
        </>
    )
}

// ---------------------------------------------------------------------------
// Main render dispatcher
// ---------------------------------------------------------------------------

function renderImpactPanel(entityType: ApprovalEntityType, s: Record<string, unknown>): React.ReactNode | null {
    if (Object.keys(s).length === 0) return null

    switch (entityType) {
        case 'PURCHASE_ORDER':
            return <PurchaseOrderPanel s={s} />

        case 'BUDGET_TRANSFER':
        case 'BUDGET_OVERRIDE':
            return <BudgetTransferOverridePanel s={s} />

        case 'CHANGE_ORDER':
            return <ChangeOrderPanel s={s} />

        case 'PROGRESS_CLAIM':
            return <ProgressClaimPanel s={s} />

        case 'BUDGET_REVISION':
            return <BudgetRevisionPanel s={s} />

        case 'MATERIAL_TRANSFER':
        case 'EMERGENCY_TRANSFER':
            return <MaterialTransferPanel s={s} />

        case 'PAYMENT':
            return <PaymentPanel s={s} />

        default:
            return null
    }
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

export function ApprovalDialog({ approval, open, onClose, onApproved, onRejected }: Props) {
    const { user, profile } = useAuthStore()
    const { approve, reject } = useApprovalStore()

    const [notes, setNotes] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [mode, setMode] = useState<'review' | 'reject'>('review')
    const [processing, setProcessing] = useState(false)

    const canApprove = profile?.role === 'admin' || profile?.role === 'manager'
    const impactSummary = (approval.impactSummary ?? {}) as Record<string, unknown>
    const impactPanel = renderImpactPanel(approval.entityType, impactSummary)

    const handleApprove = async () => {
        if (!user?.id || !canApprove) return
        setProcessing(true)
        try {
            await approve(approval.id, user.id, profile?.full_name || 'Manager', notes || undefined)
            toast.success('Request approved successfully')
            onApproved?.(approval)
            onClose()
        } catch (err: unknown) {
            toast.error('Failed to approve: ' + ((err as Error).message || 'Unknown error'))
        } finally {
            setProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!user?.id || !canApprove) return
        if (!rejectionReason.trim()) {
            toast.warning('Please provide a rejection reason')
            return
        }
        setProcessing(true)
        try {
            await reject(approval.id, user.id, profile?.full_name || 'Manager', rejectionReason)
            toast.success('Request rejected')
            onRejected?.(approval)
            onClose()
        } catch (err: unknown) {
            toast.error('Failed to reject: ' + ((err as Error).message || 'Unknown error'))
        } finally {
            setProcessing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={20} className="text-purple-500" />
                        <DialogTitle className="text-base">Approval Review</DialogTitle>
                    </div>
                    <DialogDescription>
                        {APPROVAL_ENTITY_LABELS[approval.entityType]} — Review and take action
                    </DialogDescription>
                </DialogHeader>

                {/* Request Info */}
                <div className="space-y-4">
                    <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Request</span>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700">
                                {approval.status}
                            </Badge>
                        </div>
                        <h4 className="font-semibold text-sm">{approval.title}</h4>
                        {approval.description && (
                            <p className="text-xs text-muted-foreground">{approval.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                            <span>By: <strong>{approval.requesterName || 'Unknown'}</strong></span>
                            <span>{format(new Date(approval.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                    </div>

                    {/* Impact Analysis Card */}
                    {impactPanel !== null && (
                        <Card className="border-amber-200 dark:border-amber-800">
                            <CardContent className="pt-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                                    <AlertTriangle size={14} />
                                    Impact Analysis
                                </div>
                                {impactPanel}
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Area */}
                    {mode === 'review' && canApprove && approval.status === 'PENDING' && (
                        <div className="space-y-3">
                            <Textarea
                                placeholder="Notes (optional)..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="text-sm"
                            />
                        </div>
                    )}

                    {mode === 'reject' && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-red-600">Rejection Reason (required)</label>
                            <Textarea
                                placeholder="Explain why this request is rejected..."
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                rows={3}
                                className="text-sm border-red-200 focus:ring-red-500"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {mode === 'review' && canApprove && approval.status === 'PENDING' && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMode('reject')}
                                disabled={processing}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                                <X size={14} className="mr-1" />
                                Reject
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleApprove}
                                disabled={processing}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Check size={14} className="mr-1" />
                                {processing ? 'Processing...' : 'Approve'}
                            </Button>
                        </>
                    )}

                    {mode === 'reject' && (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setMode('review')} disabled={processing}>
                                Back
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleReject}
                                disabled={processing || !rejectionReason.trim()}
                            >
                                {processing ? 'Processing...' : 'Confirm Reject'}
                            </Button>
                        </>
                    )}

                    {(!canApprove || approval.status !== 'PENDING') && (
                        <Button variant="outline" size="sm" onClick={onClose}>
                            Close
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ApprovalDialog
