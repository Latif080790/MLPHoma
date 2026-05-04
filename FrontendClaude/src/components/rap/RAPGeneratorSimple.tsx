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
import { useProjectStore } from '../../store/projectStore'
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

  // Read project markup config (set in ProjectCosting > CostingConfigPanel)
  const projectMeta = useProjectStore(s => s.projects[projectId]?.meta)
  const costingConfig = projectMeta?.costingConfig as {
    overheadPercent?: number
    profitPercent?: number
    taxPercent?: number
    profitBasis?: 'base_plus_overhead' | 'base'
  } | undefined
  const markupConfig = costingConfig && ((costingConfig.overheadPercent || 0) > 0 || (costingConfig.profitPercent || 0) > 0)
    ? {
        overheadPercent: costingConfig.overheadPercent || 0,
        profitPercent: costingConfig.profitPercent || 0,
        taxPercent: costingConfig.taxPercent || 0,
        profitBasis: costingConfig.profitBasis ?? 'base_plus_overhead',
      }
    : undefined

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

  type DistributionMap = Record<string, { task: ScheduleTask; totalVolume: number; totalValue: number; items: { id: string; volume: number; value: number }[] }>
  const [distribution, setDistribution] = useState<DistributionMap | null>(null)

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
    const dist = distributeVolumeByTasks(items, tasks, markupConfig)
    setDistribution(dist)
    // Note: this is a cashflow preview chart only; actual RAP savings to Supabase
    // use rapService.initFromRab() which pulls AHSP base_price (biaya produksi).
    notify.success(`Preview cashflow RAP${markupConfig ? ` — markup OH ${markupConfig.overheadPercent}% Profit ${markupConfig.profitPercent}% diterapkan ke nilai RAB` : ' — nilai RAB tanpa markup (biaya produksi)'}`)  
  }

  const chartData = useMemo(() => {
    if (!distribution) return []
    return distributionToSeries(distribution)
  }, [distribution])

  return (
    <div className="rounded-md border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">RAP Generator (prototype)</h4>
        <div className="text-xs text-neutral-500">Preview cashflow dari distribusi RAB (biaya produksi = AHSP base price)</div>
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
                <Bar dataKey="value" fill="#0072B2" />
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
            {Object.values(distribution).map((d) => (
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