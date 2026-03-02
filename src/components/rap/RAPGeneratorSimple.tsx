/**
 * src/components/rap/RAPGeneratorSimple.tsx
 *
 * Simple RAP generator UI:
 * - Reads RAB items from rabStore
 * - Accepts timeline tasks (start/end)
 * - Distributes volume/value across tasks using rapUtils.distributeVolumeByTasks
 *
 * This is a prototype to create time-phased budget (RAP) from RAB + simple schedule.
 */

import React, { useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import useRabStore from '../../store/rabStore'
import { distributeVolumeByTasks, distributionToSeries, ScheduleTask } from '../../lib/rapUtils'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import notify from '../../lib/toast'

/**
 * Minimal Task editor row
 */
function TaskRow({ task, onChange, onRemove }: { task: ScheduleTask; onChange: (t: ScheduleTask) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-2 items-center">
      <Input type="text" value={task.title} onChange={(e) => onChange({ ...task, title: e.target.value })} placeholder="Task title" />
      <Input type="date" value={task.startDate} onChange={(e) => onChange({ ...task, startDate: e.target.value })} />
      <Input type="date" value={task.endDate} onChange={(e) => onChange({ ...task, endDate: e.target.value })} />
      <Button variant="outline" className="bg-transparent" size="sm" onClick={onRemove}>Remove</Button>
    </div>
  )
}

/**
 * RAPGeneratorSimple component
 */
export default function RAPGeneratorSimple({ projectId = 'default' }: { projectId?: string }) {
  const getItems = useRabStore((s) => s.getItems)
  const items = getItems(projectId)

  // tasks state - use lazy initializer for date calculations
  const [tasks, setTasks] = useState<ScheduleTask[]>(() => {
    const now = new Date()
    const weekLater = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    return [
      { 
        id: 't-1', 
        title: 'Phase 1', 
        startDate: now.toISOString().slice(0, 10), 
        endDate: weekLater.toISOString().slice(0, 10) 
      }
    ]
  })

  const [distribution, setDistribution] = useState<Record<string, number[]> | null>(null)

  const addTask = () => {
    const id = `t-${Math.random().toString(36).slice(2, 6)}`
    setTasks((s) => [...s, { id, title: `Task ${s.length + 1}`, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10) }])
  }

  const updateTask = (idx: number, t: ScheduleTask) => {
    const next = tasks.slice()
    next[idx] = t
    setTasks(next)
  }

  const removeTask = (idx: number) => {
    const next = tasks.slice()
    next.splice(idx, 1)
    setTasks(next)
  }

  const compute = () => {
    if (!tasks || tasks.length === 0) {
      notify.error('Add at least one task')
      return
    }
    const dist = distributeVolumeByTasks(items, tasks)
    setDistribution(dist)
    notify.success('RAP generated (prototype)')
  }

  const chartData = useMemo(() => {
    if (!distribution) return []
    return distributionToSeries(distribution)
  }, [distribution])

  return (
    <div className="rounded-md border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">RAP Generator (prototype)</h4>
        <div className="text-xs text-neutral-500">Distribute RAB by task durations (business days)</div>
      </div>

      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={t.id}><TaskRow task={t} onChange={(nt) => updateTask(i, nt)} onRemove={() => removeTask(i)} /></div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" onClick={addTask}>Add Task</Button>
          <Button size="sm" onClick={compute}>Generate RAP</Button>
        </div>
      </div>

      <div className="mt-4">
        {distribution ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: number | string) => (typeof v === 'number' ? v.toLocaleString() : v)} />
                <Bar dataKey="value" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-neutral-500">No RAP generated yet.</div>
        )}
      </div>

      {distribution && (
        <div className="mt-3 text-sm">
          <div className="font-medium">Details</div>
          <div className="space-y-2 mt-2">
            {Object.values(distribution).map((d: { task: { id: string; title: string; startDate: string; endDate: string }; totalValue: number }) => (
              <div key={d.task.id} className="flex justify-between">
                <div>{d.task.title} ({d.task.startDate} → {d.task.endDate})</div>
                <div className="font-mono">{Math.round(d.totalValue).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}