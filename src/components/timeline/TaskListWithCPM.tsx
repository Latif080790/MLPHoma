/**
 * TaskListWithCPM.tsx
 *
 * Panel component that lists timeline tasks and highlights critical path tasks.
 * - Provides filter (all / critical only)
 * - Shows counts and allows quick navigation (on click -> onTaskClick callback)
 *
 * Uses computeCPM to determine critical tasks from timelineStore data.
 */

import React, { useMemo, useState } from 'react'
import { useTimelineStore } from '../../store/timelineStore'
import { computeCPM } from '../../lib/cpm'

/**
 * Props for TaskListWithCPM
 */
interface Props {
  projectId: string
  onTaskClick?: (taskId: string) => void
}

/**
 * TaskListWithCPM component
 */
export default function TaskListWithCPM({ projectId, onTaskClick }: Props) {
  const { getTasks } = useTimelineStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getTasks(projectId) || [], [projectId])

  const [showOnlyCritical, setShowOnlyCritical] = useState(false)

  // compute CPM metrics
  const cpm = useMemo(() => {
    const input = tasks.map((t) => ({
      id: t.id,
      duration: Math.max(1, t.duration || Math.max(1, Math.ceil((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / (1000 * 60 * 60 * 24)))),
      dependencies: (t.dependencies || []).map((d) => ({ predecessorId: d.predecessorId, type: d.type, lag: d.lag })),
    }))
    return computeCPM(input)
  }, [tasks])

  const criticalSet = cpm.criticalIds || new Set<string>()

  const visibleTasks = showOnlyCritical ? tasks.filter((t) => criticalSet.has(t.id)) : tasks

  return (
    <div className="rounded-md border p-3 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Tasks</div>
        <div className="text-xs text-neutral-500">
          {tasks.length} tasks · <span className="text-red-600 font-medium">{criticalSet.size}</span> critical
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          className={`text-sm px-2 py-1 rounded ${!showOnlyCritical ? 'bg-blue-50' : 'bg-transparent'} border`}
          onClick={() => setShowOnlyCritical(false)}
        >
          All
        </button>
        <button
          className={`text-sm px-2 py-1 rounded ${showOnlyCritical ? 'bg-red-50 text-red-700' : 'bg-transparent'} border`}
          onClick={() => setShowOnlyCritical((v) => !v)}
        >
          Critical only
        </button>
      </div>

      <div className="max-h-64 overflow-auto">
        {visibleTasks.length === 0 ? (
          <div className="text-sm text-neutral-500">No tasks</div>
        ) : (
          <ul className="space-y-2">
            {visibleTasks.map((t) => {
              const isCritical = criticalSet.has(t.id)
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between p-2 rounded ${isCritical ? 'bg-red-50 border-l-4 border-red-400' : 'hover:bg-neutral-50'}`}
                  role="button"
                  onClick={() => onTaskClick?.(t.id)}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.name}</div>
                    <div className="text-xs text-neutral-500">
                      {t.startDate} → {t.endDate}
                    </div>
                  </div>
                  <div className="text-xs">
                    {isCritical ? <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">CRITICAL</span> : <span className="text-neutral-500">{t.duration}d</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
