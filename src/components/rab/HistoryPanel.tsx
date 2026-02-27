/**
 * src/components/rab/HistoryPanel.tsx
 *
 * Small UI panel to show audit log and history/redo controls for RAB per project.
 */

import React from 'react'
import { Button } from '../ui/button'
import useRabStore from '../../store/rabStore'
import { toast } from 'sonner'

/**
 * HistoryPanelProps
 */
interface HistoryPanelProps {
  projectId?: string
}

/**
 * HistoryPanel component
 */
export default function HistoryPanel({ projectId = 'default' }: HistoryPanelProps) {
  const undo = useRabStore((s) => s.undo)
  const redo = useRabStore((s) => s.redo)
  const clearHistory = useRabStore((s) => s.clearHistory)
  const { past, future } = useRabStore((s) => s.getHistory(projectId))
  const audit = useRabStore((s) => s.audit.filter((a) => a.projectId === projectId).slice(-20))

  return (
    <div className="rounded-md border p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">History & Undo/Redo</div>
        <div className="text-xs text-neutral-500">past: {past} · future: {future}</div>
      </div>

      <div className="flex gap-2 mb-3">
        <Button size="sm" onClick={() => { const ok = undo(projectId); if (!ok) toast.info('Nothing to undo') }}>Undo</Button>
        <Button size="sm" variant="outline" className="bg-transparent" onClick={() => { const ok = redo(projectId); if (!ok) toast.info('Nothing to redo') }}>Redo</Button>
        <Button size="sm" variant="ghost" className="bg-transparent" onClick={() => clearHistory(projectId)}>Clear History</Button>
      </div>

      <div className="text-xs text-neutral-500 mb-2">Recent audit</div>
      <div className="max-h-40 overflow-auto text-xs">
        {audit.length === 0 ? (
          <div className="text-neutral-500">No actions yet</div>
        ) : (
          audit.slice().reverse().map((a) => (
            <div key={a.id} className="border-b py-1">
              <div className="font-mono text-xs text-neutral-600">{new Date(a.timestamp).toLocaleString()}</div>
              <div className="text-sm">{a.action}</div>
              <div className="text-xs text-neutral-500">{JSON.stringify(a.payload)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}