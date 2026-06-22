import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { qhseService } from '@/services/qhseService'
import type { IncidentType, IncidentSeverity } from '@/types/qhse'
import {
    INCIDENT_TYPE_LABEL,
    IncidentFormState,
    defaultIncidentForm,
} from '@/components/qhse/qhseConstants'

interface ReportIncidentDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    projectId: string
    onSaved: () => void
}

export function ReportIncidentDialog({ open, onOpenChange, projectId, onSaved }: ReportIncidentDialogProps) {
    const [form, setForm] = useState<IncidentFormState>(defaultIncidentForm)
    const [saving, setSaving] = useState(false)

    // Reset form with fresh incident number each time dialog opens
    useEffect(() => {
        if (open) setForm(defaultIncidentForm())
    }, [open])

    const set = <K extends keyof IncidentFormState>(key: K, value: IncidentFormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error('Title is required'); return }
        setSaving(true)
        try {
            await qhseService.createIncident({
                project_id: projectId,
                incident_number: form.incident_number,
                title: form.title.trim(),
                type: form.type,
                severity: form.severity,
                status: 'REPORTED',
                incident_date: form.incident_date,
                location: form.location.trim() || undefined,
                reported_by: form.reported_by.trim() || undefined,
                description: form.description.trim() || undefined,
                lost_time_days: form.type === 'LOST_TIME' && form.lost_time_days !== ''
                    ? Number(form.lost_time_days)
                    : undefined,
                attachments: [],
            })
            toast.success('Incident reported successfully')
            onOpenChange(false)
            onSaved()
        } catch (err) {
            toast.error(`Failed to report incident: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Report Safety Incident</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Incident Number */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Incident Number</Label>
                        <Input value={form.incident_number} readOnly className="font-mono text-sm bg-muted" />
                    </div>

                    {/* Title */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="inc-title">
                            Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="inc-title"
                            placeholder="Brief description of the incident"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                        />
                    </div>

                    {/* Type */}
                    <div className="grid gap-1.5">
                        <Label>Type</Label>
                        <Select value={form.type} onValueChange={v => set('type', v as IncidentType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(INCIDENT_TYPE_LABEL) as IncidentType[]).map(t => (
                                    <SelectItem key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Severity */}
                    <div className="grid gap-1.5">
                        <Label>Severity</Label>
                        <Select value={form.severity} onValueChange={v => set('severity', v as IncidentSeverity)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as IncidentSeverity[]).map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Incident Date */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="inc-date">Incident Date</Label>
                        <Input
                            id="inc-date"
                            type="date"
                            value={form.incident_date}
                            onChange={e => set('incident_date', e.target.value)}
                        />
                    </div>

                    {/* Location */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="inc-location">Location</Label>
                        <Input
                            id="inc-location"
                            placeholder="Where did the incident occur?"
                            value={form.location}
                            onChange={e => set('location', e.target.value)}
                        />
                    </div>

                    {/* Reported By */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="inc-reporter">Reported By</Label>
                        <Input
                            id="inc-reporter"
                            placeholder="Name of reporter"
                            value={form.reported_by}
                            onChange={e => set('reported_by', e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="inc-desc">Description</Label>
                        <Textarea
                            id="inc-desc"
                            rows={3}
                            placeholder="Detailed description of what happened..."
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                        />
                    </div>

                    {/* Lost Time Days — only visible for LOST_TIME */}
                    {form.type === 'LOST_TIME' && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="inc-lti">Lost Time Days</Label>
                            <Input
                                id="inc-lti"
                                type="number"
                                min={0}
                                placeholder="Number of days lost"
                                value={form.lost_time_days}
                                onChange={e => set('lost_time_days', e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Report Incident'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
