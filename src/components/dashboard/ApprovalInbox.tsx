/**
 * ApprovalInbox.tsx
 * Unified Approval Queue for Command Center.
 * Shows all pending approvals across entity types with approve/reject actions.
 *
 * Epic S1.3: Unified Approval Queue
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Inbox,
    CheckCircle2,
    XCircle,
    ShoppingCart,
    ArrowRightLeft,
    ShieldAlert,
    Wallet,
    FileEdit,
    AlertTriangle,
    Clock,
    Loader2,
    Filter,
} from 'lucide-react'
import { useApprovalStore } from '@/store/approvalStore'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import type { ApprovalEntityType, ApprovalRequest } from '@/types/approval'

const ENTITY_ICONS: Record<ApprovalEntityType, React.ReactNode> = {
    PURCHASE_ORDER: <ShoppingCart className="h-4 w-4 text-blue-400" />,
    MATERIAL_TRANSFER: <ArrowRightLeft className="h-4 w-4 text-purple-400" />,
    BUDGET_OVERRIDE: <ShieldAlert className="h-4 w-4 text-red-400" />,
    BUDGET_TRANSFER: <ShieldAlert className="h-4 w-4 text-amber-400" />,
    PAYMENT: <Wallet className="h-4 w-4 text-emerald-400" />,
    CHANGE_ORDER: <FileEdit className="h-4 w-4 text-cyan-400" />,
    EMERGENCY_TRANSFER: <AlertTriangle className="h-4 w-4 text-red-500" />,
}

const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
    PURCHASE_ORDER: 'Purchase Order',
    MATERIAL_TRANSFER: 'Material Transfer',
    BUDGET_OVERRIDE: 'Budget Override',
    BUDGET_TRANSFER: 'Budget Transfer',
    PAYMENT: 'Payment',
    CHANGE_ORDER: 'Change Order',
    EMERGENCY_TRANSFER: 'Emergency Transfer',
}

const FILTER_OPTIONS: { label: string; value: ApprovalEntityType | 'ALL' }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'PO', value: 'PURCHASE_ORDER' },
    { label: 'Transfer', value: 'MATERIAL_TRANSFER' },
    { label: 'Budget', value: 'BUDGET_OVERRIDE' },
    { label: 'Payment', value: 'PAYMENT' },
    { label: 'CCO', value: 'CHANGE_ORDER' },
]

function ImpactPreview({ impact }: { impact: Record<string, any> }) {
    if (!impact || Object.keys(impact).length === 0) return null

    const formatValue = (key: string, val: any) => {
        if (typeof val === 'number') {
            if (key.toLowerCase().includes('budget') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('amount')) {
                return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
            }
            return val.toLocaleString('id-ID')
        }
        return String(val)
    }

    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1.5">
            <div className="font-medium text-muted-foreground mb-1.5">Impact Analysis</div>
            {Object.entries(impact).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={`font-mono ${typeof val === 'number' && val < 0 ? 'text-red-400' : 'text-foreground'}`}>
                        {formatValue(key, val)}
                    </span>
                </div>
            ))}
        </div>
    )
}

function TimeAgo({ date }: { date: string }) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return <span>baru saja</span>
    if (mins < 60) return <span>{mins}m ago</span>
    const hours = Math.floor(mins / 60)
    if (hours < 24) return <span>{hours}h ago</span>
    const days = Math.floor(hours / 24)
    return <span>{days}d ago</span>
}

export function ApprovalInbox() {
    const activeProjectId = useProjectStore((s) => s.activeProjectId)
    const user = useAuthStore((s) => s.user)

    const {
        pendingApprovals,
        loading,
        fetchPendingApprovals,
        approve,
        reject,
    } = useApprovalStore()

    const [filter, setFilter] = useState<ApprovalEntityType | 'ALL'>('ALL')
    const [approveTarget, setApproveTarget] = useState<ApprovalRequest | null>(null)
    const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [approveNotes, setApproveNotes] = useState('')

    useEffect(() => {
        fetchPendingApprovals(activeProjectId || undefined)
    }, [activeProjectId, fetchPendingApprovals])

    const filtered = filter === 'ALL'
        ? pendingApprovals
        : pendingApprovals.filter(a => a.entityType === filter)

    const handleApprove = async () => {
        if (!approveTarget || !user) return
        try {
            await approve(
                approveTarget.id,
                user.id,
                user.user_metadata?.full_name || user.email || 'PM',
                approveNotes || undefined
            )
            setApproveTarget(null)
            setApproveNotes('')
        } catch {
            // handled by store
        }
    }

    const handleReject = async () => {
        if (!rejectTarget || !user || !rejectReason) return
        try {
            await reject(
                rejectTarget.id,
                user.id,
                user.user_metadata?.full_name || user.email || 'PM',
                rejectReason
            )
            setRejectTarget(null)
            setRejectReason('')
        } catch {
            // handled by store
        }
    }

    return (
        <Card className="border-white/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-blue-400" />
                        Approval Queue
                        {pendingApprovals.length > 0 && (
                            <Badge className="bg-red-500 text-white border-0 text-xs h-5 min-w-5 px-1.5">
                                {pendingApprovals.length}
                            </Badge>
                        )}
                    </CardTitle>
                </div>

                {/* Filter chips */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                    {FILTER_OPTIONS.map(opt => (
                        <Button
                            key={opt.value}
                            size="sm"
                            variant={filter === opt.value ? 'default' : 'ghost'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setFilter(opt.value)}
                        >
                            {opt.value !== 'ALL' && ENTITY_ICONS[opt.value as ApprovalEntityType]}
                            <span className="ml-1">{opt.label}</span>
                        </Button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Memuat approvals…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {filter === 'ALL' ? 'Tidak ada pending approval.' : 'Tidak ada approval untuk kategori ini.'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(approval => (
                            <div
                                key={approval.id}
                                className={`rounded-lg border px-4 py-3 transition-colors hover:bg-white/[0.02] ${approval.entityType === 'EMERGENCY_TRANSFER' || approval.entityType === 'BUDGET_OVERRIDE'
                                        ? 'border-red-500/20 bg-red-500/[0.03]'
                                        : 'border-white/10'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="mt-0.5">{ENTITY_ICONS[approval.entityType]}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate">{approval.title}</div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <Badge variant="outline" className="text-[10px] h-5">
                                                    {ENTITY_LABELS[approval.entityType]}
                                                </Badge>
                                                <span>by {approval.requesterName || 'Unknown'}</span>
                                                <span>·</span>
                                                <Clock className="h-3 w-3" />
                                                <TimeAgo date={approval.createdAt} />
                                            </div>
                                            {approval.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{approval.description}</p>
                                            )}
                                            {/* Impact preview inline */}
                                            {approval.impactSummary && Object.keys(approval.impactSummary).length > 0 && (
                                                <div className="mt-2">
                                                    <ImpactPreview impact={approval.impactSummary} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-1.5 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs text-emerald-400 hover:bg-emerald-500/10"
                                            onClick={() => setApproveTarget(approval)}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs text-red-400 hover:bg-red-500/10"
                                            onClick={() => setRejectTarget(approval)}
                                        >
                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Approve Confirmation */}
            <AlertDialog open={!!approveTarget} onOpenChange={o => !o && setApproveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            Approve Request?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {approveTarget?.title}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {approveTarget?.impactSummary && Object.keys(approveTarget.impactSummary).length > 0 && (
                        <ImpactPreview impact={approveTarget.impactSummary} />
                    )}
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                        <Input
                            placeholder="Catatan persetujuan…"
                            value={approveNotes}
                            onChange={e => setApproveNotes(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            Reject Request
                        </DialogTitle>
                        <DialogDescription>
                            {rejectTarget?.title}
                        </DialogDescription>
                    </DialogHeader>
                    {rejectTarget?.impactSummary && Object.keys(rejectTarget.impactSummary).length > 0 && (
                        <ImpactPreview impact={rejectTarget.impactSummary} />
                    )}
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Rejection Reason (required)</label>
                        <Input
                            placeholder="Alasan penolakan…"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectTarget(null)}>Batal</Button>
                        <Button
                            onClick={handleReject}
                            disabled={!rejectReason}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
