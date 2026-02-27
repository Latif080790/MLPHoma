import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { approvalService } from '@/services/approvalService'
import { useAuthStore } from '@/store/authStore'
import type { ApprovalRequest } from '@/types/approval'

interface MaterialTransferApprovalPanelProps {
  projectId: string
}

export function MaterialTransferApprovalPanel({ projectId }: MaterialTransferApprovalPanelProps) {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({})

  const loadPending = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await approvalService.getApprovals(projectId)
      setItems(data)
    } catch {
      toast.error('Failed to load transfer approvals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPending()
  }, [projectId])

  const pendingTransfers = useMemo(() => {
    return items.filter(
      (item) =>
        item.status === 'PENDING' &&
        (item.entityType === 'MATERIAL_TRANSFER' || item.entityType === 'EMERGENCY_TRANSFER')
    )
  }, [items])

  const handleApprove = async (approvalId: string) => {
    try {
      await approvalService.approve(
        approvalId,
        user?.id || 'unknown',
        profile?.full_name || user?.email || 'Unknown User'
      )
      toast.success('Transfer request approved')
      await loadPending()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve transfer')
    }
  }

  const handleReject = async (approvalId: string) => {
    const reason = rejectionNotes[approvalId]?.trim() || 'Rejected by approver'
    try {
      await approvalService.reject(
        approvalId,
        user?.id || 'unknown',
        profile?.full_name || user?.email || 'Unknown User',
        reason
      )
      toast.success('Transfer request rejected')
      await loadPending()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reject transfer')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Material Transfer Approvals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading approvals…</div>
        ) : pendingTransfers.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending material transfer approvals.</div>
        ) : (
          pendingTransfers.map((approval) => (
            <div key={approval.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{approval.title}</div>
                  <div className="text-xs text-muted-foreground">{approval.description}</div>
                </div>
                <Badge variant={approval.entityType === 'EMERGENCY_TRANSFER' ? 'destructive' : 'secondary'}>
                  {approval.entityType === 'EMERGENCY_TRANSFER' ? 'Emergency' : 'Transfer'}
                </Badge>
              </div>

              <Input
                placeholder="Rejection reason (optional)"
                value={rejectionNotes[approval.id] || ''}
                onChange={(e) =>
                  setRejectionNotes((prev) => ({ ...prev, [approval.id]: e.target.value }))
                }
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleReject(approval.id)}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => void handleApprove(approval.id)}>
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
