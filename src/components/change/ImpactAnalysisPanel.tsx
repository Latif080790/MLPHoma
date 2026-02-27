/**
 * ImpactAnalysisPanel.tsx
 *
 * Visual preview of CCO/VO cascade effects before approval.
 * Shows: affected RAB items, affected timeline tasks,
 * budget delta, schedule delta — with color-coded gauges.
 * Includes transition action buttons (Review, Approve, Reject).
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import {
    FileText, DollarSign, CalendarClock, Layers, CheckCircle2, XCircle,
    AlertTriangle, Loader2, ArrowRight, Send, Eye, ShieldCheck,
} from 'lucide-react'
import {
    ccoStateMachine,
    CCO_STATUS_LABELS,
    CCO_STATUS_COLORS,
} from '../../services/ccoStateMachine'
import type { ChangeOrder, ChangeOrderStatus } from '../../types/change-order'
import { formatIDR } from '../../lib/utils'

// ─── Impact Preview Data ───

interface ImpactPreview {
    affectedRabItems: number
    affectedTasks: number
    estimatedBudgetDelta: number
    estimatedScheduleDelta: number
}

// ─── Status Pipeline ───

const LIFECYCLE_ORDER: ChangeOrderStatus[] = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'PENDING_APPROVAL', 'APPROVED']

function StatusPipeline({ currentStatus }: { currentStatus: ChangeOrderStatus }) {
    const currentIdx = LIFECYCLE_ORDER.indexOf(currentStatus)
    const isRejected = currentStatus === 'REJECTED'

    return (
        <div className="flex items-center gap-1">
            {LIFECYCLE_ORDER.map((status, idx) => {
                const isActive = status === currentStatus
                const isPassed = idx < currentIdx && !isRejected
                const colorClass = isActive ? CCO_STATUS_COLORS[status] :
                    isPassed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'

                return (
                    <React.Fragment key={status}>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass} transition-all`}>
                            {isPassed ? '✓' : ''} {CCO_STATUS_LABELS[status]}
                        </div>
                        {idx < LIFECYCLE_ORDER.length - 1 && (
                            <ArrowRight size={10} className={`shrink-0 ${isPassed ? 'text-emerald-400' : 'text-slate-300'}`} />
                        )}
                    </React.Fragment>
                )
            })}
            {isRejected && (
                <>
                    <ArrowRight size={10} className="text-red-400 shrink-0" />
                    <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CCO_STATUS_COLORS.REJECTED}`}>
                        {CCO_STATUS_LABELS.REJECTED}
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Impact Gauge ───

function ImpactGauge({ label, value, icon, suffix, isNegative }: {
    label: string; value: number; icon: React.ReactNode; suffix?: string; isNegative?: boolean
}) {
    const color = isNegative
        ? (value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-slate-500')
        : (value > 0 ? 'text-emerald-600' : 'text-slate-500')

    return (
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-slate-400 mb-1">{icon}</div>
            <p className="text-xs text-slate-500 uppercase font-semibold">{label}</p>
            <p className={`text-lg font-mono font-bold mt-1 ${color}`}>
                {value > 0 ? '+' : ''}{typeof value === 'number' && suffix === 'Rp'
                    ? formatIDR(value)
                    : `${value}${suffix || ''}`}
            </p>
        </div>
    )
}

// ─── Main Component ───

interface ImpactAnalysisPanelProps {
    changeOrder: ChangeOrder
    onTransitioned?: () => void
}

export function ImpactAnalysisPanel({ changeOrder, onTransitioned }: ImpactAnalysisPanelProps) {
    const [preview, setPreview] = useState<ImpactPreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [comment, setComment] = useState('')
    const [transitioning, setTransitioning] = useState(false)

    const nextStatuses = ccoStateMachine.getNextStatuses(changeOrder.status)

    // Load impact preview when in REVIEWED or PENDING_APPROVAL
    useEffect(() => {
        if (['REVIEWED', 'PENDING_APPROVAL'].includes(changeOrder.status)) {
            setLoading(true)
            ccoStateMachine.previewImpact(changeOrder.id)
                .then(setPreview)
                .catch(err => console.warn('[ImpactAnalysis] Preview failed:', err))
                .finally(() => setLoading(false))
        }
    }, [changeOrder.id, changeOrder.status])

    const handleTransition = async (targetStatus: ChangeOrderStatus) => {
        setTransitioning(true)
        const result = await ccoStateMachine.transition(changeOrder, targetStatus, comment)
        setTransitioning(false)
        if (result.success) {
            setComment('')
            onTransitioned?.()
        }
    }

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            <FileText size={16} />
                        </div>
                        <CardTitle className="text-sm font-semibold">
                            {changeOrder.vo_number}: {changeOrder.title}
                        </CardTitle>
                        <Badge className={`text-xs ${CCO_STATUS_COLORS[changeOrder.status]}`}>
                            {CCO_STATUS_LABELS[changeOrder.status]}
                        </Badge>
                    </div>
                </div>
                {/* Status Pipeline */}
                <div className="mt-3">
                    <StatusPipeline currentStatus={changeOrder.status} />
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-4">
                {/* Quick Summary */}
                <div className="grid grid-cols-4 gap-3">
                    <ImpactGauge
                        label="Cost Impact"
                        value={changeOrder.cost_impact}
                        icon={<DollarSign size={16} className="mx-auto" />}
                        suffix="Rp"
                        isNegative
                    />
                    <ImpactGauge
                        label="Schedule Impact"
                        value={changeOrder.schedule_impact_days}
                        icon={<CalendarClock size={16} className="mx-auto" />}
                        suffix=" days"
                        isNegative
                    />
                    {preview ? (
                        <>
                            <ImpactGauge
                                label="RAB Items Affected"
                                value={preview.affectedRabItems}
                                icon={<Layers size={16} className="mx-auto" />}
                            />
                            <ImpactGauge
                                label="Tasks Affected"
                                value={preview.affectedTasks}
                                icon={<CalendarClock size={16} className="mx-auto" />}
                            />
                        </>
                    ) : (
                        <>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                <p className="text-xs text-slate-400 uppercase font-semibold">Items</p>
                                <p className="text-lg font-mono font-bold text-slate-600 mt-1">{changeOrder.items?.length || 0}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                {loading ? (
                                    <Loader2 size={16} className="mx-auto animate-spin text-slate-400 mt-2" />
                                ) : (
                                    <>
                                        <p className="text-xs text-slate-400 uppercase font-semibold">Preview</p>
                                        <p className="text-xs text-slate-400 mt-2">Available after review</p>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Change Items List */}
                {changeOrder.items && changeOrder.items.length > 0 && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                            Change Items ({changeOrder.items.length})
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {changeOrder.items.map(item => (
                                <div key={item.id} className="flex items-center justify-between px-3 py-2 text-xs">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate block">{item.item_description}</span>
                                        {item.wbs_name && <span className="text-xs text-slate-400">WBS: {item.wbs_name}</span>}
                                    </div>
                                    <div className="text-right font-mono shrink-0 ml-3">
                                        <span className="text-slate-500">Δ Vol: {item.volume_delta > 0 ? '+' : ''}{item.volume_delta}</span>
                                        <span className={`block font-semibold ${item.total_delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.total_delta > 0 ? '+' : ''}{formatIDR(item.total_delta)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Section */}
                {nextStatuses.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {/* Comment required for Review/Approve/Reject */}
                        {nextStatuses.some(s => ['REVIEWED', 'APPROVED', 'REJECTED'].includes(s)) && (
                            <Textarea
                                placeholder="Komentar / catatan review..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="h-16 text-xs resize-none"
                            />
                        )}

                        <div className="flex items-center gap-2 justify-end flex-wrap">
                            {nextStatuses.map(targetStatus => {
                                const isReject = targetStatus === 'REJECTED'
                                const isApprove = targetStatus === 'APPROVED'
                                const isSubmit = targetStatus === 'SUBMITTED'
                                const isDraft = targetStatus === 'DRAFT'

                                return (
                                    <Button
                                        key={targetStatus}
                                        size="sm"
                                        variant={isReject ? 'destructive' : isApprove ? 'default' : 'outline'}
                                        disabled={transitioning}
                                        onClick={() => handleTransition(targetStatus)}
                                        className={`gap-1 text-xs ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                    >
                                        {transitioning ? <Loader2 size={12} className="animate-spin" /> :
                                            isSubmit ? <Send size={12} /> :
                                                isApprove ? <ShieldCheck size={12} /> :
                                                    isReject ? <XCircle size={12} /> :
                                                        isDraft ? <FileText size={12} /> :
                                                            <Eye size={12} />}
                                        {CCO_STATUS_LABELS[targetStatus]}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Terminal state messages */}
                {changeOrder.status === 'APPROVED' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Approved & Cascaded</p>
                            <p className="text-xs text-emerald-600/70 mt-0.5">
                                RAB and Timeline have been updated with this change order.
                            </p>
                        </div>
                    </div>
                )}

                {changeOrder.status === 'REJECTED' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                        <XCircle size={16} className="text-red-600 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Rejected</p>
                            <p className="text-xs text-red-600/70 mt-0.5">
                                Revise to Draft to make changes and resubmit.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
