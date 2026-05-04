/**
 * ApprovalQueueWidget.tsx
 * Dashboard widget showing pending approvals for managers/admins.
 * Part of Command Center Bento Grid.
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileCheck, Check, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { useApprovalStore } from '@/store/approvalStore'
import { useAuthStore } from '@/store/authStore'
import { useProjectStore } from '@/store/projectStore'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { APPROVAL_ENTITY_LABELS } from '@/types/approval'
import type { ApprovalRequest } from '@/types/approval'
import { ApprovalDialog } from './ApprovalDialog'

export function ApprovalQueueWidget() {
    const { profile } = useAuthStore()
    const { activeProjectId } = useProjectStore()
    const { pendingApprovals, pendingCount, fetchPendingApprovals } = useApprovalStore()
    const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)

    const canApprove = profile?.role === 'admin' || profile?.role === 'manager'

    useEffect(() => {
        fetchPendingApprovals(activeProjectId || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId])

    if (!canApprove && pendingCount === 0) return null

    return (
        <>
            <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileCheck size={16} className="text-purple-500" />
                            Approval Queue
                        </CardTitle>
                        {pendingCount > 0 && (
                            <Badge variant="destructive" className="animate-pulse">
                                {pendingCount} pending
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {pendingApprovals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                            <Check size={24} className="mb-1 text-green-500 opacity-50" />
                            <span className="text-xs">All approvals cleared</span>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {pendingApprovals.slice(0, 5).map(approval => (
                                <div
                                    key={approval.id}
                                    className="flex items-start gap-3 rounded-lg border bg-white/60 dark:bg-slate-900/60 p-3 cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                                    onClick={() => setSelectedApproval(approval)}
                                >
                                    <div className="mt-0.5">
                                        {approval.entityType === 'EMERGENCY_TRANSFER' || approval.entityType === 'BUDGET_OVERRIDE'
                                            ? <AlertTriangle size={14} className="text-red-500" />
                                            : <Clock size={14} className="text-yellow-500" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{approval.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {APPROVAL_ENTITY_LABELS[approval.entityType] || approval.entityType}
                                            {' · '}
                                            {approval.requesterName || 'Unknown'}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                                            {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true, locale: idLocale })}
                                        </p>
                                    </div>
                                    <ChevronRight size={14} className="text-muted-foreground mt-1 shrink-0" />
                                </div>
                            ))}

                            {pendingApprovals.length > 5 && (
                                <p className="text-center text-xs text-muted-foreground pt-1">
                                    +{pendingApprovals.length - 5} more pending
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Approval Dialog */}
            {selectedApproval && (
                <ApprovalDialog
                    approval={selectedApproval}
                    open={!!selectedApproval}
                    onClose={() => setSelectedApproval(null)}
                />
            )}
        </>
    )
}

export default ApprovalQueueWidget
