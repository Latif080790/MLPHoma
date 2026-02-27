import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, Loader2, ShoppingCart, ArrowRightLeft, Wallet } from 'lucide-react'
import { approvalService } from '@/services/approvalService'
import type { ApprovalQueueItem } from '@/types/approvalQueue'
import { toApprovalQueueItems } from '@/types/approvalQueue'

interface ApprovalQueueWidgetProps {
  projectId: string
  maxItems?: number
  onOpenInbox?: () => void
}

const SCOPE_CONFIG = {
  PURCHASE_ORDER: { label: 'PO', icon: ShoppingCart, className: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  MATERIAL_TRANSFER: { label: 'MTR', icon: ArrowRightLeft, className: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  PAYMENT: { label: 'PAY', icon: Wallet, className: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
} as const

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ApprovalQueueWidget({ projectId, maxItems = 5, onOpenInbox }: ApprovalQueueWidgetProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ApprovalQueueItem[]>([])

  useEffect(() => {
    if (!projectId) {
      setItems([])
      return
    }

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const approvals = await approvalService.getApprovals(projectId)
        if (mounted) {
          setItems(toApprovalQueueItems(approvals))
        }
      } catch {
        if (mounted) {
          setItems([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [projectId])

  const visibleItems = useMemo(() => items.slice(0, maxItems), [items, maxItems])

  return (
    <Card className="border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Unified Approval Queue
          </CardTitle>
          {items.length > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs h-5 min-w-5 px-1.5">{items.length}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading queue...
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-30" />
            No pending PO/MTR/Payment approvals.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const config = SCOPE_CONFIG[item.scope]
              const Icon = config.icon
              return (
                <div key={item.id} className="rounded-md border border-white/10 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        by {item.requesterName || 'Unknown'} · {timeAgo(item.createdAt)}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 ${config.className}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
              )
            })}

            {onOpenInbox && (
              <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={onOpenInbox}>
                Open Full Approval Inbox
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
