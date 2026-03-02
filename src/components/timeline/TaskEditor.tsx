/**
 * TaskEditor.tsx
 * Modal component for creating and editing timeline tasks with
 * dependency management and optional WBS/RAB integration.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { X, Calendar, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import type { TimelineTask, TaskDependency, TaskStatus, DependencyType } from '../../types/timeline'
import { useTimelineStore } from '../../store/timelineStore'
import { useWBSStore } from '../../store/wbsStore'
import { useRabStore } from '../../store/rabStore'
import {
  isTimelineProgressEvidenceComplete,
  type TimelineProgressEvidence,
} from '../../types/progressEvidence'

/**
 * Props for TaskEditor component
 */
export interface TaskEditorProps {
  /** Project identifier */
  projectId: string
  /** Task to edit (null for new task) */
  task?: TimelineTask | null
  /** Whether modal is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Save callback (called after store update) */
  onSave?: (task: TimelineTask) => void
}

/**
 * calculateEndDate
 * Derive end date given a start date (YYYY-MM-DD) and duration days
 */
function calculateEndDate(startDate: string, duration: number): string {
  const end = new Date(startDate)
  end.setDate(end.getDate() + Math.max(1, duration) - 1)
  return end.toISOString().split('T')[0]
}

function toDateTimeLocal(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/**
 * TaskEditor
 * Simple modal overlay to add/edit a timeline task.
 */
export default function TaskEditor({ projectId, task, isOpen, onClose, onSave }: TaskEditorProps) {
  const { addTask, updateTask, getTasks } = useTimelineStore()
  const { itemsByProject } = useWBSStore()
  const { getItems: getRabItems } = useRabStore()

  const wbsItems = itemsByProject[projectId] || []
  const rabItems = getRabItems(projectId)
  const availableTasks = useMemo(() => (getTasks(projectId) || []).filter(t => t.id !== task?.id), [projectId, task, getTasks])

  const [form, setForm] = useState({
    name: '',
    description: '',
    duration: 1,
    startDate: new Date().toISOString().split('T')[0],
    progress: 0,
    status: 'not_started' as TaskStatus,
    priority: 'medium' as 'low' | 'medium' | 'high',
    evidencePhotoUrl: '',
    evidenceCapturedAt: '',
    evidenceLatitude: '',
    evidenceLongitude: '',
    wbsId: '',
    rabId: '',
    assignedResources: [] as string[],
  })

  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resourceInput, setResourceInput] = useState('')

  // Initialize when opening or when task changes
  useEffect(() => {
    if (!isOpen) return
    if (task) {
      setForm({
        name: task.name,
        description: task.description || '',
        duration: task.duration,
        startDate: task.startDate,
        progress: task.progress,
        status: task.status,
        priority: task.priority,
        evidencePhotoUrl: task.progressEvidence?.photoUrl || '',
        evidenceCapturedAt: toDateTimeLocal(task.progressEvidence?.capturedAt),
        evidenceLatitude: task.progressEvidence?.latitude != null ? String(task.progressEvidence.latitude) : '',
        evidenceLongitude: task.progressEvidence?.longitude != null ? String(task.progressEvidence.longitude) : '',
        wbsId: task.wbsId || '',
        rabId: task.rabId || '',
        assignedResources: task.assignedResources || [],
      })
      setDependencies(task.dependencies || [])
    } else {
      setForm({
        name: '',
        description: '',
        duration: 1,
        startDate: new Date().toISOString().split('T')[0],
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        evidencePhotoUrl: '',
        evidenceCapturedAt: '',
        evidenceLatitude: '',
        evidenceLongitude: '',
        wbsId: '',
        rabId: '',
        assignedResources: [],
      })
      setDependencies([])
    }
    setErrors({})
  }, [isOpen, task])

  /**
   * Validate form
   */
  const validate = (): boolean => {
    const e: Record<string, string> = {}
    const previousProgress = task?.progress ?? 0
    const progressIncreased = form.progress > previousProgress
    const draftEvidence = {
      photoUrl: form.evidencePhotoUrl.trim(),
      capturedAt: form.evidenceCapturedAt ? new Date(form.evidenceCapturedAt).toISOString() : '',
      latitude: form.evidenceLatitude === '' ? undefined : Number(form.evidenceLatitude),
      longitude: form.evidenceLongitude === '' ? undefined : Number(form.evidenceLongitude),
      hasPhoto: form.evidencePhotoUrl.trim().length > 0,
      hasTimestamp: form.evidenceCapturedAt.trim().length > 0,
      hasLocation: form.evidenceLatitude.trim().length > 0 && form.evidenceLongitude.trim().length > 0,
    }

    if (!form.name.trim()) e.name = 'Task name is required'
    if (!form.startDate) e.startDate = 'Start date is required'
    if (form.duration < 1) e.duration = 'Duration must be at least 1 day'
    if (form.progress < 0 || form.progress > 100) e.progress = 'Progress must be 0–100'
    if (progressIncreased && !isTimelineProgressEvidenceComplete(draftEvidence)) {
      e.progressEvidence = 'Progress increase requires complete evidence: photo URL, timestamp, and GPS location.'
    }

    // Validate dependencies
    if (dependencies.some(d => !d.predecessorId)) {
      e.dependencies = 'All dependency rows must have a predecessor selected.'
    }
    // Prevent self-dependency validation (simple check)
    if (task?.id && dependencies.some(d => d.predecessorId === task.id)) {
      e.dependencies = 'A task cannot depend on itself.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /**
   * Submit handler
   */
  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return

    const evidenceInput = {
      photoUrl: form.evidencePhotoUrl.trim(),
      capturedAt: form.evidenceCapturedAt ? new Date(form.evidenceCapturedAt).toISOString() : '',
      latitude: form.evidenceLatitude === '' ? Number.NaN : Number(form.evidenceLatitude),
      longitude: form.evidenceLongitude === '' ? Number.NaN : Number(form.evidenceLongitude),
      hasPhoto: form.evidencePhotoUrl.trim().length > 0,
      hasTimestamp: form.evidenceCapturedAt.trim().length > 0,
      hasLocation: form.evidenceLatitude.trim().length > 0 && form.evidenceLongitude.trim().length > 0,
    }
    const progressEvidence: TimelineProgressEvidence | undefined = isTimelineProgressEvidenceComplete(evidenceInput)
      ? evidenceInput
      : task?.progressEvidence

    const data: Omit<TimelineTask, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      name: form.name,
      description: form.description,
      duration: form.duration,
      startDate: form.startDate,
      endDate: calculateEndDate(form.startDate, form.duration),
      progress: form.progress,
      progressEvidence,
      status: form.status,
      priority: form.priority,
      wbsId: form.wbsId || undefined,
      rabId: form.rabId || undefined,
      dependencies,
      assignedResources: form.assignedResources,
    }

    let saved: TimelineTask | null = null
    if (task) {
      updateTask(projectId, task.id, data)
      const updated = getTasks(projectId).find(t => t.id === task.id) || null
      saved = updated as TimelineTask | null
    } else {
      const id = addTask(projectId, data)
      saved = (getTasks(projectId).find(t => t.id === id) || null) as TimelineTask | null
    }

    if (saved && onSave) onSave(saved)
    onClose()
  }

  /**
   * Add empty dependency row
   */
  const addDep = () => {
    const dep: TaskDependency = {
      id: `dep-${Date.now()}`,
      predecessorId: '',
      successorId: task?.id || '',
      type: 'FS' as DependencyType,
      lag: 0,
    }
    setDependencies(prev => [...prev, dep])
  }

  /**
   * Update dependency at index
   */
  const setDep = (idx: number, patch: Partial<TaskDependency>) => {
    setDependencies(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  /**
   * Remove dependency at index
   */
  const removeDep = (idx: number) => {
    setDependencies(prev => prev.filter((_, i) => i !== idx))
  }

  const addResource = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && resourceInput.trim() !== '') {
      e.preventDefault()
      if (!form.assignedResources.includes(resourceInput.trim())) {
        setForm(prev => ({
          ...prev,
          assignedResources: [...prev.assignedResources, resourceInput.trim()]
        }))
      }
      setResourceInput('')
    }
  }

  const removeResource = (resourceToRemove: string) => {
    setForm(prev => ({
      ...prev,
      assignedResources: prev.assignedResources.filter(r => r !== resourceToRemove)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-xl border bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{task ? 'Edit Task' : 'Add New Task'}</h2>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Task Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={errors.name ? 'border-red-500' : ''} />
                  {errors.name ? <p className="mt-1 text-sm text-red-500">{errors.name}</p> : null}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (days) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                      className={errors.duration ? 'border-red-500' : ''}
                    />
                    {errors.duration ? <p className="mt-1 text-sm text-red-500">{errors.duration}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={form.priority} onValueChange={(v: 'low' | 'medium' | 'high') => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className={errors.startDate ? 'border-red-500' : ''}
                  />
                  {errors.startDate ? <p className="mt-1 text-sm text-red-500">{errors.startDate}</p> : null}
                </div>

                <div>
                  <Label htmlFor="progress">Progress (%)</Label>
                  <Input
                    id="progress"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                    className={errors.progress ? 'border-red-500' : ''}
                  />
                  {errors.progress ? <p className="mt-1 text-sm text-red-500">{errors.progress}</p> : null}
                  {errors.progressEvidence ? <p className="mt-1 text-sm text-red-500">{errors.progressEvidence}</p> : null}
                </div>

                <div className="rounded-md border p-3 space-y-3 dark:border-neutral-800">
                  <div>
                    <Label htmlFor="evidencePhotoUrl">Evidence Photo URL</Label>
                    <Input
                      id="evidencePhotoUrl"
                      type="url"
                      placeholder="https://..."
                      value={form.evidencePhotoUrl}
                      onChange={(e) => setForm({ ...form, evidencePhotoUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="evidenceCapturedAt">Evidence Timestamp</Label>
                    <Input
                      id="evidenceCapturedAt"
                      type="datetime-local"
                      value={form.evidenceCapturedAt}
                      onChange={(e) => setForm({ ...form, evidenceCapturedAt: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="evidenceLatitude">Latitude</Label>
                      <Input
                        id="evidenceLatitude"
                        type="number"
                        step="any"
                        value={form.evidenceLatitude}
                        onChange={(e) => setForm({ ...form, evidenceLatitude: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="evidenceLongitude">Longitude</Label>
                      <Input
                        id="evidenceLongitude"
                        type="number"
                        step="any"
                        value={form.evidenceLongitude}
                        onChange={(e) => setForm({ ...form, evidenceLongitude: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Progress increase is gated until evidence has photo URL, timestamp, and GPS coordinates.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={form.status} onValueChange={(v: TaskStatus) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not started</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <div className="rounded-md border p-2 text-sm dark:border-neutral-800">
                      {calculateEndDate(form.startDate, form.duration)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resources (New) */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Assigned Resources (Logistics & Labor)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="resourceInput">Add Resource</Label>
                  <p className="text-xs text-slate-500 mb-2">Ketik nama posisi (misal: &quot;Tukang&quot;) atau nama alat (misal: &quot;Excavator&quot;) lalu tekan **Enter**.</p>
                  <Input
                    id="resourceInput"
                    placeholder="Contoh: 1 Unit PC-200, 5 Tukang Besi... (Enter)"
                    value={resourceInput}
                    onChange={(e) => setResourceInput(e.target.value)}
                    onKeyDown={addResource}
                  />
                </div>
                {form.assignedResources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.assignedResources.map((res) => (
                      <Badge key={res} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {res}
                        <X
                          size={14}
                          className="ml-1 cursor-pointer hover:text-red-500"
                          onClick={() => removeResource(res)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link to WBS / RAB</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>WBS Item</Label>
                <Select value={form.wbsId} onValueChange={(v: string) => setForm({ ...form, wbsId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select WBS..." /></SelectTrigger>
                  <SelectContent>
                    {wbsItems.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RAB Item</Label>
                <Select value={form.rabId} onValueChange={(v: string) => setForm({ ...form, rabId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select RAB..." /></SelectTrigger>
                  <SelectContent>
                    {rabItems.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.item_code ?? r.code ?? r.itemCode ?? r.id} — {r.item_name ?? r.name ?? ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Dependencies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dependencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dependencies.length === 0 ? (
                <div className="text-sm text-neutral-500">No dependencies added.</div>
              ) : null}

              {errors.dependencies && (
                <div className="mb-2 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                  {errors.dependencies}
                </div>
              )}

              {dependencies.map((dep, idx) => (
                <div key={dep.id} className="grid gap-3 md:grid-cols-4 items-end">
                  <div>
                    <Label>Predecessor</Label>
                    <Select value={dep.predecessorId} onValueChange={(v: string) => setDep(idx, { predecessorId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select task..." /></SelectTrigger>
                      <SelectContent>
                        {availableTasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={dep.type} onValueChange={(v: DependencyType) => setDep(idx, { type: v })}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FS">Finish to Start (FS)</SelectItem>
                        <SelectItem value="SS">Start to Start (SS)</SelectItem>
                        <SelectItem value="FF">Finish to Finish (FF)</SelectItem>
                        <SelectItem value="SF">Start to Finish (SF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lag (days)</Label>
                    <Input type="number" value={dep.lag} onChange={(e) => setDep(idx, { lag: parseInt(e.target.value || '0', 10) })} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => removeDep(idx)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                </div>
              ))}

              <Button type="button" onClick={addDep}>
                <Plus className="h-4 w-4 mr-2" /> Add Dependency
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save Task</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
