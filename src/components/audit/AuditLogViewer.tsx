/**
 * AuditLogViewer.tsx
 *
 * Timeline-style audit event viewer with filtering.
 * Displays a chronological list of audit events with icons,
 * colors, and expandable detail rows showing old/new value diffs.
 *
 * Used in: CommandCenter (compact), dedicated Audit page, scoped views
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
    Shield, FileText, DollarSign, Package, Truck, User, Clock, ChevronDown, ChevronRight,
    Filter, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Edit, Trash2, Plus, Send,
    Lock, Unlock, Archive, ArrowRightLeft, Eye
} from 'lucide-react'
import { auditService } from '../../services/auditService'
import type { AuditLogEntry, AuditAction } from '../../types/audit'
import { formatDistanceToNow } from 'date-fns'

// ─── Action Config (icon, color, label) ───

interface ActionConfig {
    icon: React.ReactNode
    color: string
    bgColor: string
    label: string
}

function getActionConfig(action: AuditAction): ActionConfig {
    const configs: Partial<Record<AuditAction, ActionConfig>> = {
        CREATE: { icon: <Plus size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Created' },
        UPDATE: { icon: <Edit size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Updated' },
        DELETE: { icon: <Trash2 size={12} />, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Deleted' },
        APPROVE: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Approved' },
        REJECT: { icon: <XCircle size={12} />, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Rejected' },
        STATUS_CHANGE: { icon: <ArrowRightLeft size={12} />, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Status Changed' },
        BUDGET_CHANGE: { icon: <DollarSign size={12} />, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Budget Changed' },
        TRANSFER: { icon: <Truck size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Transferred' },
        PAYMENT: { icon: <DollarSign size={12} />, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Payment' },
        LOGIN: { icon: <User size={12} />, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800', label: 'Login' },
        EXPORT: { icon: <FileText size={12} />, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800', label: 'Exported' },
        SNAPSHOT: { icon: <Archive size={12} />, color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'Snapshot' },
        PRICE_OVERRIDE: { icon: <AlertTriangle size={12} />, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Price Override' },
        INVOICE_CREATED: { icon: <FileText size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Invoice Created' },
        INVOICE_PAID: { icon: <CheckCircle2 size={12} />, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Invoice Paid' },
        CLAIM_SUBMITTED: { icon: <Send size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Claim Submitted' },
        CLAIM_APPROVED: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Claim Approved' },
        PO_CREATED: { icon: <Package size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'PO Created' },
        PO_APPROVED: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'PO Approved' },
        GRN_VERIFIED: { icon: <Package size={12} />, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'GRN Verified' },
        DOCUMENT_UPLOADED: { icon: <FileText size={12} />, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Doc Uploaded' },
        DOCUMENT_LOCKED: { icon: <Lock size={12} />, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Doc Locked' },
        DOCUMENT_UNLOCKED: { icon: <Unlock size={12} />, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Doc Unlocked' },
        CO_CREATED: { icon: <FileText size={12} />, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Change Order Created' },
        CO_APPROVED: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'CO Approved' },
        CO_REJECTED: { icon: <XCircle size={12} />, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'CO Rejected' },
        APPROVAL_GRANTED: { icon: <Shield size={12} />, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Approval Granted' },
        APPROVAL_REJECTED: { icon: <XCircle size={12} />, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Approval Rejected' },
    }

    return configs[action] || {
        icon: <Eye size={12} />,
        color: 'text-slate-600',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        label: action.replace(/_/g, ' '),
    }
}

// ─── Detail Diff Row ───

function DetailDiff({ details }: { details: Record<string, unknown> }) {
    if (!details || Object.keys(details).length === 0) {
        return <p className="text-xs text-slate-400 italic">No additional details</p>
    }

    const { oldValue, newValue, reason, ...rest } = details

    return (
        <div className="space-y-2 text-xs">
            {!!reason && (
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Reason:</span>
                    <span className="text-slate-700 dark:text-slate-300">{String(reason)}</span>
                </div>
            )}
            {!!oldValue && !!newValue && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                        <span className="text-xs text-red-500 uppercase font-semibold">Before</span>
                        <pre className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono text-xs max-h-24 overflow-auto">
                            {typeof oldValue === 'object' ? JSON.stringify(oldValue, null, 2) : String(oldValue)}
                        </pre>
                    </div>
                    <div className="p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                        <span className="text-xs text-green-500 uppercase font-semibold">After</span>
                        <pre className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono text-xs max-h-24 overflow-auto">
                            {typeof newValue === 'object' ? JSON.stringify(newValue, null, 2) : String(newValue)}
                        </pre>
                    </div>
                </div>
            )}
            {Object.keys(rest).length > 0 && (
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {Object.entries(rest).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                            <span className="text-slate-500 font-medium min-w-[80px]">{key}:</span>
                            <span className="text-slate-700 dark:text-slate-300 font-mono">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Single Event Row ───

function AuditEventRow({ entry }: { entry: AuditLogEntry }) {
    const [expanded, setExpanded] = useState(false)
    const config = getActionConfig(entry.action)
    const hasDetails = entry.details && Object.keys(entry.details).length > 0

    return (
        <div className="group">
            <button
                className="w-full flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                onClick={() => hasDetails && setExpanded(!expanded)}
            >
                {/* Timeline dot */}
                <div className={`shrink-0 mt-0.5 p-1.5 rounded-md ${config.bgColor}`}>
                    <span className={config.color}>{config.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 h-4 ${config.color} border-current/20`}>
                            {config.label}
                        </Badge>
                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {entry.entity}
                        </span>
                        {entry.entityType && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-slate-500">
                                {entry.entityType}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {entry.userName && (
                            <span className="flex items-center gap-1">
                                <User size={10} /> {entry.userName}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                </div>

                {/* Expand indicator */}
                {hasDetails && (
                    <div className="shrink-0 text-slate-400 mt-1">
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                )}
            </button>

            {/* Expanded details */}
            {expanded && hasDetails && (
                <div className="ml-10 mr-3 mb-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <DetailDiff details={entry.details} />
                </div>
            )}
        </div>
    )
}

// ─── Entity Type Filter ───
const ENTITY_TYPES = [
    { value: '', label: 'All' },
    { value: 'PO', label: 'Purchase Orders' },
    { value: 'MR', label: 'Material Requests' },
    { value: 'INVOICE', label: 'Invoices' },
    { value: 'CLAIM', label: 'Claims' },
    { value: 'RAB', label: 'RAB Items' },
    { value: 'RAP', label: 'RAP Budget' },
    { value: 'PROJECT', label: 'Project' },
    { value: 'DOCUMENT', label: 'Documents' },
    { value: 'CO', label: 'Change Orders' },
]

// ─── Main Component ───

interface AuditLogViewerProps {
    /** Show only events for this entity type */
    entityType?: string
    /** Show only events for this entity ID */
    entityId?: string
    /** Compact mode (widget) — show fewer items, no filters */
    compact?: boolean
    /** Maximum items to show */
    maxItems?: number
    /** Title override */
    title?: string
}

export function AuditLogViewer({
    entityType,
    entityId,
    compact = false,
    maxItems = 50,
    title = 'Audit Trail',
}: AuditLogViewerProps) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [filterType, setFilterType] = useState(entityType || '')

    const loadLogs = async () => {
        setLoading(true)
        try {
            const result = await auditService.getLogs({
                entityType: filterType || undefined,
                entityId,
                limit: compact ? 5 : maxItems,
            })
            setLogs(result)
        } catch (err) {
            console.warn('[AuditLogViewer] Failed to load logs:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterType, entityId])

    const displayLogs = compact ? logs.slice(0, 5) : logs

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <Shield size={16} />
                        </div>
                        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                        {logs.length > 0 && (
                            <Badge variant="outline" className="text-xs h-5">{logs.length} events</Badge>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadLogs} disabled={loading}>
                        <RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>

                {/* Filters (full mode only) */}
                {!compact && !entityType && (
                    <div className="flex items-center gap-2 mt-3">
                        <Filter size={12} className="text-slate-400" />
                        <div className="flex gap-1 flex-wrap">
                            {ENTITY_TYPES.map(et => (
                                <button
                                    key={et.value}
                                    onClick={() => setFilterType(et.value)}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${filterType === et.value
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {et.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="px-4 pb-4">
                {loading && logs.length === 0 ? (
                    <div className="text-center py-8">
                        <RefreshCw size={20} className="mx-auto mb-2 text-slate-300 animate-spin" />
                        <p className="text-xs text-slate-400">Loading audit trail...</p>
                    </div>
                ) : displayLogs.length === 0 ? (
                    <div className="text-center py-8">
                        <Shield size={28} className="mx-auto mb-2 text-slate-300 opacity-40" />
                        <p className="text-sm text-slate-400">No audit events found.</p>
                        <p className="text-xs text-slate-400 mt-1">Actions will appear here as changes are made.</p>
                    </div>
                ) : (
                    <div className="space-y-0.5 mt-1">
                        {/* Timeline line */}
                        <div className="relative">
                            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-800" />
                            <div className="relative z-10 space-y-0.5">
                                {displayLogs.map(entry => (
                                    <AuditEventRow key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </div>
                        {compact && logs.length > 5 && (
                            <p className="text-center text-xs text-slate-400 mt-2">
                                +{logs.length - 5} more events
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
