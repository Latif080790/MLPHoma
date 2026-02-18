/**
 * BudgetGuardDialog.tsx
 * Pre-flight dialog that shows budget check results before PO creation.
 * Displays per-item budget breakdown with color-coded status indicators.
 *
 * Epic S1.1: Budget Guard on Procurement
 */

import React from 'react'
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
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Loader2 } from 'lucide-react'
import type { BudgetCheckResult, BudgetCheckItem } from '@/services/budgetGuardService'

interface BudgetGuardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Budget check result from checkBudgetAvailability */
    result: BudgetCheckResult | null
    /** Loading state while checking */
    loading?: boolean
    /** Called when user confirms proceed (budget OK) */
    onProceed: () => void
    /** Called when user requests override approval (near threshold) */
    onRequestOverride?: () => void
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

function getItemStatus(item: BudgetCheckItem): 'ok' | 'warning' | 'exceeded' {
    if (item.exceeds) return 'exceeded'
    const wouldRemain = item.remaining - item.requested
    const threshold = item.totalBudget * 0.1
    if (wouldRemain > 0 && wouldRemain < threshold) return 'warning'
    return 'ok'
}

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'exceeded' }) {
    switch (status) {
        case 'ok':
            return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        case 'warning':
            return <AlertTriangle className="h-4 w-4 text-amber-500" />
        case 'exceeded':
            return <XCircle className="h-4 w-4 text-red-500" />
    }
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'exceeded' }) {
    const config = {
        ok: { label: 'Within Budget', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        warning: { label: 'Near Limit', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
        exceeded: { label: 'Exceeded', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    }
    const c = config[status]
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>
}

function BudgetBar({ item }: { item: BudgetCheckItem }) {
    const usedPct = item.totalBudget > 0
        ? Math.min(100, ((item.committed + item.actual) / item.totalBudget) * 100)
        : 0
    const requestedPct = item.totalBudget > 0
        ? Math.min(100 - usedPct, (item.requested / item.totalBudget) * 100)
        : 0
    const status = getItemStatus(item)

    return (
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            {/* Already used portion */}
            <div className="h-full float-left rounded-l-full bg-slate-500/60" style={{ width: `${usedPct}%` }} />
            {/* Requested portion */}
            <div
                className={`h-full float-left ${status === 'exceeded' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                style={{ width: `${requestedPct}%` }}
            />
        </div>
    )
}

export function BudgetGuardDialog({
    open,
    onOpenChange,
    result,
    loading,
    onProceed,
    onRequestOverride,
}: BudgetGuardDialogProps) {
    // Loading state
    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        <p className="text-sm text-muted-foreground">Checking budget availability…</p>
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
                        <ShieldAlert className="h-5 w-5" />
                        Budget Guard — Pre-Flight Check
                    </DialogTitle>
                    <DialogDescription>
                        Verifikasi ketersediaan budget RAP sebelum membuat Purchase Order.
                    </DialogDescription>
                </DialogHeader>

                {/* Overall Status Banner */}
                <div
                    className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${overallStatus === 'exceeded'
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : overallStatus === 'warning'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                >
                    <StatusIcon status={overallStatus} />
                    <span>{result.message}</span>
                </div>

                {/* Items Table */}
                <div className="rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03]">
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Budget</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Used</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Remaining</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Requested</th>
                                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((item, idx) => {
                                const status = getItemStatus(item)
                                return (
                                    <tr
                                        key={item.rapItemId || idx}
                                        className={`border-b border-white/5 last:border-0 ${status === 'exceeded' ? 'bg-red-500/5' : ''
                                            }`}
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="font-medium text-foreground">{item.itemName}</div>
                                            <BudgetBar item={item} />
                                        </td>
                                        <td className="text-right px-3 py-2.5 font-mono text-muted-foreground">
                                            {formatCurrency(item.totalBudget)}
                                        </td>
                                        <td className="text-right px-3 py-2.5 font-mono text-muted-foreground">
                                            {formatCurrency(item.committed + item.actual)}
                                        </td>
                                        <td className="text-right px-3 py-2.5 font-mono text-emerald-400">
                                            {formatCurrency(item.remaining)}
                                        </td>
                                        <td className={`text-right px-3 py-2.5 font-mono font-semibold ${status === 'exceeded' ? 'text-red-400' : status === 'warning' ? 'text-amber-400' : 'text-foreground'
                                            }`}>
                                            {formatCurrency(item.requested)}
                                        </td>
                                        <td className="text-center px-3 py-2.5">
                                            <StatusBadge status={status} />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Overage Detail (if exceeded) */}
                {result.hasExceeded && result.exceededItems.length > 0 && (
                    <div className="text-xs text-red-400/80 space-y-1">
                        {result.exceededItems.map((item) => (
                            <p key={item.rapItemId}>
                                ⚠ <strong>{item.itemName}</strong>: Kelebihan {formatCurrency(item.overageAmount)} —
                                kurangi qty atau ajukan override budget.
                            </p>
                        ))}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>

                    {overallStatus === 'ok' && (
                        <Button onClick={onProceed} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            Lanjutkan Buat PO
                        </Button>
                    )}

                    {overallStatus === 'warning' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={onRequestOverride}
                                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            >
                                <AlertTriangle className="h-4 w-4 mr-1.5" />
                                Request Override Approval
                            </Button>
                            <Button onClick={onProceed} className="bg-amber-600 hover:bg-amber-700">
                                Lanjutkan (Warning)
                            </Button>
                        </>
                    )}

                    {overallStatus === 'exceeded' && (
                        <Button
                            variant="outline"
                            onClick={onRequestOverride}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                            <ShieldAlert className="h-4 w-4 mr-1.5" />
                            Ajukan Override Budget
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
