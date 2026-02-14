/**
 * ApprovalDialog.tsx
 * Reusable dialog for reviewing and acting on approval requests.
 * Shows Impact Analysis Card + APPROVE/REJECT actions.
 */

import React, { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Check, X, AlertTriangle, DollarSign, ArrowRightLeft, Info, ShieldCheck } from 'lucide-react'
import { useApprovalStore } from '@/store/approvalStore'
import { useAuthStore } from '@/store/authStore'
import { APPROVAL_ENTITY_LABELS } from '@/types/approval'
import type { ApprovalRequest } from '@/types/approval'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Props {
    approval: ApprovalRequest
    open: boolean
    onClose: () => void
    onApproved?: (approval: ApprovalRequest) => void
    onRejected?: (approval: ApprovalRequest) => void
}

export function ApprovalDialog({ approval, open, onClose, onApproved, onRejected }: Props) {
    const { user, profile } = useAuthStore()
    const { approve, reject } = useApprovalStore()

    const [notes, setNotes] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [mode, setMode] = useState<'review' | 'reject'>('review')
    const [processing, setProcessing] = useState(false)

    const canApprove = profile?.role === 'admin' || profile?.role === 'manager'
    const impact = approval.impactSummary || {}

    const handleApprove = async () => {
        if (!user?.id || !canApprove) return
        setProcessing(true)
        try {
            await approve(approval.id, user.id, profile?.full_name || 'Manager', notes || undefined)
            toast.success('Request approved successfully')
            onApproved?.(approval)
            onClose()
        } catch (err: any) {
            toast.error('Failed to approve: ' + (err.message || 'Unknown error'))
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
        } catch (err: any) {
            toast.error('Failed to reject: ' + (err.message || 'Unknown error'))
        } finally {
            setProcessing(false)
        }
    }

    const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`

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
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
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
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                            <span>By: <strong>{approval.requesterName || 'Unknown'}</strong></span>
                            <span>{format(new Date(approval.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                    </div>

                    {/* Impact Analysis Card */}
                    {Object.keys(impact).length > 0 && (
                        <Card className="border-amber-200 dark:border-amber-800">
                            <CardContent className="pt-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                                    <AlertTriangle size={14} />
                                    Impact Analysis
                                </div>

                                {impact.budgetImpact !== undefined && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <DollarSign size={12} className="text-green-600" />
                                        <span>Budget Impact:</span>
                                        <strong className={impact.budgetImpact < 0 ? 'text-red-600' : 'text-green-600'}>
                                            {formatCurrency(Math.abs(impact.budgetImpact))}
                                            {impact.budgetImpact < 0 ? ' (decrease)' : ' (increase)'}
                                        </strong>
                                    </div>
                                )}

                                {impact.sourceWbs && impact.targetWbs && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <ArrowRightLeft size={12} className="text-indigo-500" />
                                        <span>{impact.sourceWbs}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <span>{impact.targetWbs}</span>
                                    </div>
                                )}

                                {impact.remainingBudget !== undefined && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <Info size={12} className="text-blue-500" />
                                        <span>Remaining Budget:</span>
                                        <strong>{formatCurrency(impact.remainingBudget)}</strong>
                                    </div>
                                )}

                                {impact.warning && (
                                    <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                                        <AlertTriangle size={12} />
                                        <span>{impact.warning}</span>
                                    </div>
                                )}
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
