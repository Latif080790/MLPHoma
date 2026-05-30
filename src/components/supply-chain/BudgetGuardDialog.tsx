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
    result: BudgetCheckResult | null
    loading: boolean
    onProceed: () => void
    onRequestOverride: () => void
}

export function BudgetGuardDialog({
    open,
    onOpenChange,
    result,
    loading,
    onProceed,
    onRequestOverride,
}: BudgetGuardDialogProps) {
    const [submittingApproval, setSubmittingApproval] = useState(false)

    const handleRequestApproval = async () => {
        setSubmittingApproval(true)
        try {
            await onRequestOverride()
        } finally {
            setSubmittingApproval(false)
        }
    }

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="sm:max-w-[420px]"
                    style={{ borderLeft: '4px solid #F59E0B' }}
                >
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                        <p className="text-sm text-muted-foreground font-medium">Memvalidasi anggaran RAP...</p>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (!result) return null

    const overallStatus = result.hasExceeded ? 'exceeded' : result.requiresApproval ? 'warning' : 'ok'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[420px]"
                style={{ borderLeft: '4px solid #F59E0B' }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Anggaran Melebihi Batas
                    </DialogTitle>
                    <DialogDescription>
                        Validasi item Pengadaan terhadap alokasi anggaran RAP.
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
                <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border bg-muted/30/50">
                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase">Item</th>
                                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase">Budget</th>
                                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase">Used</th>
                                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase">Requested</th>
                                <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((item, idx) => {
                                const status = item.exceeds ? 'exceeded' : (item.remaining - item.requested < item.totalBudget * 0.1) ? 'warning' : 'ok'
                                return (
                                    <tr key={item.rapItemId || idx} className="border-b border-border/20 last:border-0">
                                        <td className="px-3 py-2 font-medium">{item.itemName}</td>
                                        <td className="px-3 py-2">
                                            <CurrencyCell value={item.totalBudget} className="text-xs" />
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            <CurrencyCell value={item.committed + item.actual} className="text-xs text-muted-foreground" />
                                        </td>
                                        <td className="px-3 py-2">
                                            <CurrencyCell 
                                                value={item.requested} 
                                                variant={status === 'exceeded' ? 'negative' : status === 'warning' ? 'neutral' : 'default'}
                                                className="text-xs" 
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

                <DialogFooter className="gap-2 sm:gap-0 bg-muted/30/50 p-4 -mx-6 -mb-6 mt-2 border-t">
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
