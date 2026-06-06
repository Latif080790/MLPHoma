import { useEffect, useState } from 'react'
import { syncQueue } from '@/lib/supabaseSyncService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

interface SyncStatus {
  queueLength: number
  processing: boolean
  failedCount: number
}

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>({ queueLength: 0, processing: false, failedCount: 0 })

  useEffect(() => {
    const update = () => setStatus(syncQueue.getStatus())
    update()
    const unsubscribe = syncQueue.subscribe(update)
    return unsubscribe
  }, [])

  const handleRetry = () => {
    syncQueue.retryFailedTasks()
  }

  if (status.failedCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={handleRetry} className="gap-1.5 text-destructive h-7 px-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs">{status.failedCount} gagal sync</span>
            <Badge variant="destructive" className="text-xs px-1 h-4">{status.failedCount}</Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.failedCount} operasi gagal disinkronkan ke server.</p>
          <p className="text-xs mt-1">Klik untuk retry.</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (status.processing || status.queueLength > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs px-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Menyinkronkan...</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.queueLength} perubahan sedang disinkronkan ke server.</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-muted-foreground text-xs px-2">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="hidden sm:inline">Tersinkron</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Semua data tersinkron dengan server.</p>
      </TooltipContent>
    </Tooltip>
  )
}
