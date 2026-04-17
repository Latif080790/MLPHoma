/**
 * BudgetGuardDialog.tsx
 * 
 * Enterprise-grade budget validation before PO creation.
 * Combines high-fidelity UI with robust approval request logic.
 */

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { approvalService } from '@/services/approvalService'
import { checkBudgetAvailability, type BudgetCheckResult, type BudgetCheckItem, type CheckableItem } from '@/services/budgetGuardService'
import { CurrencyCell } from '../shared/CurrencyCell'

interface BudgetGuardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    items: CheckableItem[]
    poReference?: string
    onProceed: () => void
}

export function BudgetGuardDialog({
    open,
    onOpenChange,
    projectId,
    items,
    poReference,
    onProceed,
}: BudgetGuardDialogProps) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<BudgetCheckResult | null>(null)
    const [submittingApproval, setSubmittingApproval] = useState(false)

    useEffect(() => {
        if (!open || items.length === 0) {
            setResult(null)
            return
        }

        setLoading(true)
        checkBudgetAvailability(projectId, items)
            .then(setResult)
            .catch(err => {
                console.warn('[BudgetGuard] Check failed:', err)
                toast.error('Budget check failed', { description: err.message })
            })
            .finally(() => setLoading(true)) // Ensure we don't flash, wait for it
            setTimeout(() => setLoading(false), 500)
    }, [open, projectId, items])

    const handleRequestApproval = async () => {
        setSubmittingApproval(true)
        try {
            const { user, profile } = useAuthStore.getState()
            const totalAmount = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)

            await approvalService.createApproval({
                projectId,
                entityType: 'PURCHASE_ORDER',
                entityId: poReference || 'pending-po',
                title: `Budget Guard: PO ${poReference || 'New'}`,
                description: `PO requires approval — budget critically low. Total: Rp ${totalAmount.toLocaleString()}`,
                requesterId: user?.id || 'unknown',
                requesterName: profile?.full_name || user?.email || 'Procurement',
                approverRole: 'manager',
                impactSummary: {
                    totalAmount,
                    itemCount: items.length,
                    reason: 'Budget threshold exceeded (<10% remaining)',
                },
            })

            toast.success('Approval request sent', { description: 'Sent to PM\'s Command Center for review.' })
            onOpenChange(false)
        } catch (err: unknown) {
            toast.error('Failed to submit approval', { description: (err as Error).message })
        } finally {
            setSubmittingApproval(false)
        }
    }

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        <p className="text-sm text-muted-foreground font-medium">Checking budget against RAP...</p>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (!result) return null

    const overallStatus = result.hasExceeded ? 'exceeded' : result.requiresApproval ? 'warning' : 'ok'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-blue-500" />
                        Budget Guard — Pre-Flight Check
                    </DialogTitle>
                    <DialogDescription>
                        Validating Procurement items against RAP budget allocation.
                    </DialogDescription>
                </DialogHeader>

                {/* Overall Status Banner */}
                <div
                    className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                        overallStatus === 'exceeded'
                            ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                            : overallStatus === 'warning'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                >
                    {overallStatus === 'ok' && <CheckCircle2 className="h-4 w-4" />}
                    {overallStatus === 'warning' && <AlertTriangle className="h-4 w-4" />}
                    {overallStatus === 'exceeded' && <XCircle className="h-4 w-4" />}
                    <span className="font-medium">{result.message}</span>
                </div>

                {/* Items Table */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase">Item</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase">Budget</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase">Used</th>
                                <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase">Requested</th>
                                <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((item, idx) => {
                                const status = item.exceeds ? 'exceeded' : (item.remaining - item.requested < item.totalBudget * 0.1) ? 'warning' : 'ok'
                                return (
                                    <tr key={item.rapItemId || idx} className="border-b border-slate-50 dark:border-slate-900 last:border-0">
                                        <td className="px-3 py-2 font-medium">{item.itemName}</td>
                                        <td className="px-3 py-2">
                                            <CurrencyCell value={item.totalBudget} className="text-[11px]" />
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            <CurrencyCell value={item.committed + item.actual} className="text-[11px] text-slate-500" />
                                        </td>
                                        <td className="px-3 py-2">
                                            <CurrencyCell 
                                                value={item.requested} 
                                                variant={status === 'exceeded' ? 'negative' : status === 'warning' ? 'neutral' : 'default'}
                                                className="text-[11px]" 
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <Badge variant="outline" className={
                                                status === 'exceeded' ? 'bg-red-50 text-red-600 border-red-200' :
                                                status === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-emerald-50 text-emerald-600 border-emerald-200'
                                            }>
                                                {status.toUpperCase()}
                                            </Badge>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 bg-slate-50/50 dark:bg-slate-900/50 p-4 -mx-6 -mb-6 mt-2 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>

                    {overallStatus === 'ok' && (
                        <Button onClick={onProceed} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Lanjutkan Buat PO
                        </Button>
                    )}

                    {overallStatus === 'warning' && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleRequestApproval}
                                disabled={submittingApproval}
                                className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                            >
                                {submittingApproval ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
                                Request Approval
                            </Button>
                            <Button onClick={onProceed} className="bg-amber-600 hover:bg-amber-700">
                                Lanjutkan (Override)
                            </Button>
                        </div>
                    )}

                    {overallStatus === 'exceeded' && (
                        <Button
                            variant="destructive"
                            onClick={handleRequestApproval}
                            disabled={submittingApproval}
                        >
                            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                            Ajukan Override Budget (Exceeded)
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
