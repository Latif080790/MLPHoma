/**
 * ApprovalInbox.tsx
 * Unified Approval Queue for Command Center.
 * Shows pending/escalated approvals with SLA indicators, multi-select, and bulk actions.
 */

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
    Timer,
    ReceiptText,
    TrendingUp,
} from 'lucide-react'
import { useApprovalStore } from '@/store/approvalStore'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import { approvalService } from '@/services/approvalService'
import type { ApprovalEntityType, ApprovalRequest } from '@/types/approval'
import { RoleGuard } from '@/components/common/RoleGuard'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { toast } from 'sonner'

const ENTITY_ICONS: Record<ApprovalEntityType, React.ReactNode> = {
    PURCHASE_ORDER:    <ShoppingCart className="h-4 w-4 text-blue-400" />,
    MATERIAL_TRANSFER: <ArrowRightLeft className="h-4 w-4 text-purple-400" />,
    BUDGET_OVERRIDE:   <ShieldAlert className="h-4 w-4 text-red-400" />,
    BUDGET_TRANSFER:   <ShieldAlert className="h-4 w-4 text-amber-400" />,
    PAYMENT:           <Wallet className="h-4 w-4 text-emerald-400" />,
    CHANGE_ORDER:      <FileEdit className="h-4 w-4 text-cyan-400" />,
    EMERGENCY_TRANSFER:<AlertTriangle className="h-4 w-4 text-red-500" />,
    PROGRESS_CLAIM:    <ReceiptText className="h-4 w-4 text-teal-400" />,
    BUDGET_REVISION:   <TrendingUp className="h-4 w-4 text-orange-400" />,
}

const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
    PURCHASE_ORDER:    'Purchase Order',
    MATERIAL_TRANSFER: 'Material Transfer',
    BUDGET_OVERRIDE:   'Budget Override',
    BUDGET_TRANSFER:   'Budget Transfer',
    PAYMENT:           'Payment',
    CHANGE_ORDER:      'Change Order',
    EMERGENCY_TRANSFER:'Emergency Transfer',
    PROGRESS_CLAIM:    'Progress Claim',
    BUDGET_REVISION:   'Budget Revision',
}

const FILTER_OPTIONS: { label: string; value: ApprovalEntityType | 'ALL' }[] = [
    { label: 'All',      value: 'ALL' },
    { label: 'PO',       value: 'PURCHASE_ORDER' },
    { label: 'Transfer', value: 'MATERIAL_TRANSFER' },
    { label: 'Budget',   value: 'BUDGET_OVERRIDE' },
    { label: 'Payment',  value: 'PAYMENT' },
    { label: 'CCO',      value: 'CHANGE_ORDER' },
    { label: 'Claim',    value: 'PROGRESS_CLAIM' },
]

// ─────────────────────────────────────────────
// SLA helpers
// ─────────────────────────────────────────────

function getSLAState(slaDeadline?: string): 'overdue' | 'urgent' | 'ok' | 'none' {
    if (!slaDeadline) return 'none'
    const msLeft = new Date(slaDeadline).getTime() - Date.now()
    if (msLeft < 0) return 'overdue'
    if (msLeft < 4 * 3600 * 1000) return 'urgent'   // < 4 hours
    return 'ok'
}

function SLABadge({ slaDeadline, status }: { slaDeadline?: string; status: string }) {
    const state = getSLAState(slaDeadline)
    if (state === 'none' || status === 'ESCALATED') {
        if (status === 'ESCALATED') {
            return (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs h-4 px-1.5">
                    ESCALATED
                </Badge>
            )
        }
        return null
    }

    const msLeft = new Date(slaDeadline!).getTime() - Date.now()

    if (state === 'overdue') {
        const hoursOver = Math.abs(Math.floor(msLeft / 3600000))
        return (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs h-4 px-1.5 gap-1">
                <Timer className="h-2.5 w-2.5" />
                {hoursOver}h overdue
            </Badge>
        )
    }

    if (state === 'urgent') {
        const hoursLeft = Math.floor(msLeft / 3600000)
        const minsLeft = Math.floor((msLeft % 3600000) / 60000)
        return (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs h-4 px-1.5 gap-1">
                <Timer className="h-2.5 w-2.5" />
                {hoursLeft}h {minsLeft}m left
            </Badge>
        )
    }

    return null
}

// ─────────────────────────────────────────────
// Impact Preview
// ─────────────────────────────────────────────

function ImpactPreview({ impact }: { impact: Record<string, unknown> }) {
    if (!impact || Object.keys(impact).length === 0) return null
    const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

    const formatValue = (key: string, val: unknown) => {
        if (typeof val === 'number') {
            if (/budget|cost|amount/i.test(key)) return fmt.format(val)
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

// ─────────────────────────────────────────────
// TimeAgo
// ─────────────────────────────────────────────

function TimeAgo({ date }: { date: string }) {
    const timeAgo = useMemo(() => {
        const diff = Date.now() - new Date(date).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'baru saja'
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }, [date])
    return <span>{timeAgo}</span>
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function ApprovalInbox() {
    const activeProjectId = useProjectStore((s) => s.activeProjectId)
    const user = useAuthStore((s) => s.user)

    const { pendingApprovals, loading, fetchPendingApprovals, approve, reject } = useApprovalStore()

    const [filter, setFilter]               = useState<ApprovalEntityType | 'ALL'>('ALL')
    const [selected, setSelected]           = useState<Set<string>>(new Set())
    const [approveTarget, setApproveTarget] = useState<ApprovalRequest | null>(null)
    const [rejectTarget, setRejectTarget]   = useState<ApprovalRequest | null>(null)
    const [rejectReason, setRejectReason]   = useState('')
    const [approveNotes, setApproveNotes]   = useState('')
    const [bulkLoading, setBulkLoading]     = useState(false)

    useEffect(() => {
        fetchPendingApprovals(activeProjectId || undefined)
    }, [activeProjectId, fetchPendingApprovals])

    // Reset selection when list changes
    useEffect(() => {
        setSelected(new Set())
    }, [pendingApprovals.length])

    const filtered = useMemo(() =>
        filter === 'ALL'
            ? pendingApprovals
            : pendingApprovals.filter(a => a.entityType === filter),
        [filter, pendingApprovals]
    )

    // Sort: overdue first → urgent → ok → by createdAt desc
    const sorted = useMemo(() => [...filtered].sort((a, b) => {
        const pri = (x: ApprovalRequest) => {
            const s = getSLAState(x.slaDeadline)
            if (x.status === 'ESCALATED') return 0
            if (s === 'overdue') return 1
            if (s === 'urgent') return 2
            return 3
        }
        const diff = pri(a) - pri(b)
        if (diff !== 0) return diff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }), [filtered])

    const allSelected = sorted.length > 0 && sorted.every(a => selected.has(a.id))

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) { next.delete(id) } else { next.add(id) }
            return next
        })
    }

    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set())
        } else {
            setSelected(new Set(sorted.map(a => a.id)))
        }
    }

    const handleApprove = async () => {
        if (!approveTarget || !user) return
        try {
            await approve(approveTarget.id, user.id,
                user.user_metadata?.full_name || user.email || 'PM',
                approveNotes || undefined)
            setApproveTarget(null)
            setApproveNotes('')
        } catch { /* handled by store */ }
    }

    const handleReject = async () => {
        if (!rejectTarget || !user || !rejectReason) return
        try {
            await reject(rejectTarget.id, user.id,
                user.user_metadata?.full_name || user.email || 'PM',
                rejectReason)
            setRejectTarget(null)
            setRejectReason('')
        } catch { /* handled by store */ }
    }

    const handleBulkApprove = async () => {
        if (!user || selected.size === 0) return
        setBulkLoading(true)
        try {
            const result = await approvalService.bulkApprove(
                Array.from(selected),
                user.id,
                user.user_metadata?.full_name || user.email || 'PM'
            )
            toast.success(`Approved ${result.succeeded.length}/${selected.size} requests`)
            if (result.failed.length > 0) {
                toast.warning(`${result.failed.length} failed — check details`)
            }
            setSelected(new Set())
            fetchPendingApprovals(activeProjectId || undefined)
        } catch {
            toast.error('Bulk approve gagal')
        } finally {
            setBulkLoading(false)
        }
    }

    const handleBulkReject = async () => {
        if (!user || selected.size === 0) return
        setBulkLoading(true)
        try {
            const result = await approvalService.bulkReject(
                Array.from(selected),
                user.id,
                user.user_metadata?.full_name || user.email || 'PM',
                'Rejected via bulk action'
            )
            toast.success(`Rejected ${result.succeeded.length}/${selected.size} requests`)
            setSelected(new Set())
            fetchPendingApprovals(activeProjectId || undefined)
        } catch {
            toast.error('Bulk reject gagal')
        } finally {
            setBulkLoading(false)
        }
    }

    return (
        <>
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
                    ) : sorted.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            {filter === 'ALL' ? 'Tidak ada pending approval.' : 'Tidak ada approval untuk kategori ini.'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Select-all header */}
                            {sorted.length > 1 && (
                                <div className="flex items-center gap-2 px-1 pb-1 border-b border-border/60">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={toggleAll}
                                        className="h-3.5 w-3.5"
                                        aria-label="Select all"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        {selected.size > 0 ? `${selected.size} dipilih` : 'Pilih semua'}
                                    </span>
                                </div>
                            )}

                            {sorted.map(approval => {
                                const slaState = getSLAState(approval.slaDeadline)
                                const isUrgent = slaState === 'overdue' || slaState === 'urgent' || approval.status === 'ESCALATED'
                                const isChecked = selected.has(approval.id)

                                return (
                                    <div
                                        key={approval.id}
                                        className={`rounded-lg border px-4 py-3 transition-colors hover:bg-muted/20 ${
                                            approval.entityType === 'EMERGENCY_TRANSFER' || approval.entityType === 'BUDGET_OVERRIDE' || isUrgent
                                                ? slaState === 'overdue' || approval.status === 'ESCALATED'
                                                    ? 'border-red-500/30 bg-red-500/[0.04]'
                                                    : slaState === 'urgent'
                                                        ? 'border-yellow-500/20 bg-yellow-500/[0.03]'
                                                        : 'border-red-500/20 bg-red-500/[0.03]'
                                                : isChecked
                                                    ? 'border-blue-500/30 bg-blue-500/[0.04]'
                                                    : 'border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox */}
                                            <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={() => toggleSelect(approval.id)}
                                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                            />

                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="mt-0.5">{ENTITY_ICONS[approval.entityType]}</div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">{approval.title}</div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                                        <Badge variant="outline" className="text-xs h-5">
                                                            {ENTITY_LABELS[approval.entityType]}
                                                        </Badge>
                                                        <span>by {approval.requesterName || 'Unknown'}</span>
                                                        <span>·</span>
                                                        <Clock className="h-3 w-3" />
                                                        <TimeAgo date={approval.createdAt} />
                                                        {/* SLA indicator */}
                                                        <SLABadge slaDeadline={approval.slaDeadline} status={approval.status} />
                                                    </div>
                                                    {approval.description && (
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{approval.description}</p>
                                                    )}
                                                    {approval.impactSummary && Object.keys(approval.impactSummary).length > 0 && (
                                                        <div className="mt-2">
                                                            <ImpactPreview impact={approval.impactSummary} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Per-item action buttons */}
                                            <div className="flex gap-1.5 shrink-0">
                                                <RoleGuard allowedRoles={['PROJECT_MANAGER', 'FINANCE', 'ADMIN']} fallback={<span className="text-xs text-muted-foreground italic mt-2">No Auth</span>}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-emerald-400 hover:bg-emerald-500/10"
                                                        onClick={() => setApproveTarget(approval)}
                                                        disabled={bulkLoading}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-red-400 hover:bg-red-500/10"
                                                        onClick={() => setRejectTarget(approval)}
                                                        disabled={bulkLoading}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                                        Reject
                                                    </Button>
                                                </RoleGuard>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk action bar — floats above bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <BulkActionBar
                    selectedCount={selected.size}
                    label="approvals dipilih"
                    onClear={() => setSelected(new Set())}
                    actions={[
                        {
                            label: bulkLoading ? 'Processing…' : `Approve ${selected.size}`,
                            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                            onClick: handleBulkApprove,
                            disabled: bulkLoading,
                            variant: 'default',
                        },
                        {
                            label: `Reject ${selected.size}`,
                            icon: <XCircle className="h-3.5 w-3.5" />,
                            onClick: handleBulkReject,
                            disabled: bulkLoading,
                            variant: 'destructive',
                        },
                    ]}
                />
            </div>

            {/* Approve Confirmation */}
            <AlertDialog open={!!approveTarget} onOpenChange={o => !o && setApproveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            Approve Request?
                        </AlertDialogTitle>
                        <AlertDialogDescription>{approveTarget?.title}</AlertDialogDescription>
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
                        <DialogDescription>{rejectTarget?.title}</DialogDescription>
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
                        <Button onClick={handleReject} disabled={!rejectReason} className="bg-red-600 hover:bg-red-700">
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
