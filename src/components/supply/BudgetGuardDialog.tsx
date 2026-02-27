/**
 * BudgetGuardDialog.tsx
 *
 * Pre-PO creation budget validation dialog.
 * Shows per-item budget availability check with three states:
 * ✅ PASS — all items within budget, auto-proceed
 * ⚠️ APPROVAL REQUIRED — remaining < 10%, needs PM approval
 * ❌ BLOCKED — exceeds budget, cannot proceed
 */

import React, { useEffect, useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'
import {
    Shield, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { budgetGuardService, type BudgetCheckResult, type CheckableItem } from '../../services/budgetGuardService'
import { formatIDR } from '../../lib/utils'
import { toast } from 'sonner'
import { approvalService } from '../../services/approvalService'
import { useAuthStore } from '../../store/authStore'

// ─── Props ───

interface BudgetGuardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Project ID */
    projectId: string
    /** Items to validate */
    items: CheckableItem[]
    /** Called when budget check passes and user confirms */
    onApproved: () => void
    /** PO reference for display */
    poReference?: string
}

// ─── Status Config ───

function getStatusConfig(result: BudgetCheckResult) {
    if (result.hasExceeded) {
        return {
            icon: <ShieldX size={24} />,
            title: 'Budget Exceeded',
            subtitle: 'PO cannot proceed — items exceed RAP allocation',
            color: 'text-red-600',
            bgColor: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900',
            headerBg: 'bg-red-500',
            badgeClass: 'bg-red-100 text-red-700',
        }
    }
    if (result.requiresApproval) {
        return {
            icon: <ShieldAlert size={24} />,
            title: 'Approval Required',
            subtitle: 'Budget is critically low — PM approval needed to proceed',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
            headerBg: 'bg-amber-500',
            badgeClass: 'bg-amber-100 text-amber-700',
        }
    }
    return {
        icon: <ShieldCheck size={24} />,
        title: 'Budget Available',
        subtitle: 'All items are within RAP allocation',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900',
        headerBg: 'bg-emerald-500',
        badgeClass: 'bg-emerald-100 text-emerald-700',
    }
}

// ─── Main Component ───

export function BudgetGuardDialog({
    open, onOpenChange, projectId, items, onApproved, poReference,
}: BudgetGuardDialogProps) {
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState<BudgetCheckResult | null>(null)
    const [submittingApproval, setSubmittingApproval] = useState(false)

    useEffect(() => {
        if (!open || items.length === 0) {
            setResult(null)
            return
        }

        setChecking(true)
        budgetGuardService.checkBudgetAvailability(projectId, items)
            .then(setResult)
            .catch(err => {
                console.warn('[BudgetGuard] Check failed:', err)
                toast.error('Budget check failed', { description: err.message })
            })
            .finally(() => setChecking(false))
    }, [open, projectId, items])

    const handleProceed = () => {
        onApproved()
        onOpenChange(false)
    }

    const handleRequestApproval = async () => {
        setSubmittingApproval(true)
        try {
            const { user, profile } = useAuthStore.getState()
            const totalAmount = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)

            await approvalService.createApproval({
                projectId,
                entityType: 'PO',
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
        } catch (err: any) {
            toast.error('Failed to submit approval', { description: err.message })
        } finally {
            setSubmittingApproval(false)
        }
    }

    const config = result ? getStatusConfig(result) : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield size={18} /> Budget Guard Check
                    </DialogTitle>
                    <DialogDescription>
                        Validating PO items against RAP budget allocation before creation.
                    </DialogDescription>
                </DialogHeader>

                {checking ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 size={32} className="text-blue-500 animate-spin mb-3" />
                        <p className="text-sm text-slate-500">Checking budget availability...</p>
                    </div>
                ) : result && config ? (
                    <div className="space-y-4">
                        {/* Status Banner */}
                        <div className={`flex items-center gap-3 p-4 rounded-lg border ${config.bgColor}`}>
                            <div className={config.color}>{config.icon}</div>
                            <div>
                                <p className={`font-semibold text-sm ${config.color}`}>{config.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{config.subtitle}</p>
                            </div>
                            <Badge className={`ml-auto text-xs ${config.badgeClass}`}>
                                {result.hasExceeded ? 'BLOCKED' : result.requiresApproval ? 'NEEDS APPROVAL' : 'PASSED'}
                            </Badge>
                        </div>

                        {/* Item Table */}
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="max-h-[300px] overflow-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10">
                                        <TableRow className="hover:bg-transparent text-xs">
                                            <TableHead className="h-8 px-3 font-semibold uppercase">Item</TableHead>
                                            <TableHead className="h-8 px-3 text-right font-semibold uppercase">Budget (RAP)</TableHead>
                                            <TableHead className="h-8 px-3 text-right font-semibold uppercase">Committed</TableHead>
                                            <TableHead className="h-8 px-3 text-right font-semibold uppercase">Remaining</TableHead>
                                            <TableHead className="h-8 px-3 text-right font-semibold uppercase">Requested</TableHead>
                                            <TableHead className="h-8 px-3 text-center font-semibold uppercase">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {result.items.map(item => {
                                            const pctUsed = item.totalBudget > 0 ? ((item.committed + item.actual) / item.totalBudget) * 100 : 0
                                            const pctRemaining = 100 - pctUsed

                                            return (
                                                <TableRow key={item.rapItemId} className="text-xs border-b border-slate-100 dark:border-slate-800">
                                                    <TableCell className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 max-w-[160px] truncate">
                                                        {item.itemName}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-mono text-slate-500">
                                                        {formatIDR(item.totalBudget)}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-mono text-slate-500">
                                                        {formatIDR(item.committed + item.actual)}
                                                    </TableCell>
                                                    <TableCell className={`px-3 py-2 text-right font-mono font-semibold ${pctRemaining < 10 ? 'text-red-600' : pctRemaining < 25 ? 'text-amber-600' : 'text-emerald-600'
                                                        }`}>
                                                        {formatIDR(item.remaining)}
                                                        <span className="text-xs ml-1 opacity-70">({pctRemaining.toFixed(0)}%)</span>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                                        {formatIDR(item.requested)}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-center">
                                                        {item.exceeds ? (
                                                            <div className="flex items-center justify-center gap-1 text-red-600">
                                                                <XCircle size={12} />
                                                                <span className="text-xs font-semibold">OVER by {formatIDR(item.overageAmount)}</span>
                                                            </div>
                                                        ) : pctRemaining < 10 ? (
                                                            <div className="flex items-center justify-center gap-1 text-amber-600">
                                                                <AlertTriangle size={12} />
                                                                <span className="text-xs font-semibold">LOW</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1 text-emerald-600">
                                                                <CheckCircle2 size={12} />
                                                                <span className="text-xs font-semibold">OK</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Budget Bar Summary */}
                        {result.items.length > 0 && (() => {
                            const totalBudget = result.items.reduce((s, i) => s + i.totalBudget, 0)
                            const totalUsed = result.items.reduce((s, i) => s + i.committed + i.actual, 0)
                            const totalReq = result.items.reduce((s, i) => s + i.requested, 0)
                            const pctUsed = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0
                            const pctReq = totalBudget > 0 ? (totalReq / totalBudget) * 100 : 0

                            return (
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                        <span>Budget Utilization</span>
                                        <span>{formatIDR(totalUsed + totalReq)} / {formatIDR(totalBudget)}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                                        <div className={`h-full transition-all ${pctUsed + pctReq > 100 ? 'bg-red-500' : 'bg-amber-400'}`}
                                            style={{ width: `${Math.min(pctReq, 100 - pctUsed)}%` }} />
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Committed</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full" /> This PO</span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                ) : (
                    <div className="py-8 text-center text-sm text-slate-400">No items to check.</div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>

                    {result && !result.hasExceeded && !result.requiresApproval && (
                        <Button onClick={handleProceed} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                            <CheckCircle2 size={14} /> Proceed with PO
                        </Button>
                    )}

                    {result && result.requiresApproval && !result.hasExceeded && (
                        <Button
                            onClick={handleRequestApproval}
                            disabled={submittingApproval}
                            className="bg-amber-600 hover:bg-amber-700 gap-1"
                        >
                            {submittingApproval ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                            Request PM Approval
                        </Button>
                    )}

                    {result && result.hasExceeded && (
                        <Button disabled className="bg-red-600/50 gap-1 cursor-not-allowed">
                            <ShieldX size={14} /> Blocked — Budget Exceeded
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
