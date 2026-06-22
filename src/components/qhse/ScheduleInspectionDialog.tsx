import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { qhseService } from '@/services/qhseService'
import type { InspectionType } from '@/types/qhse'
import {
    InspectionFormState,
    defaultInspectionForm,
} from '@/components/qhse/qhseConstants'

interface ScheduleInspectionDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    projectId: string
    onSaved: () => void
}

export function ScheduleInspectionDialog({ open, onOpenChange, projectId, onSaved }: ScheduleInspectionDialogProps) {
    const [form, setForm] = useState<InspectionFormState>(defaultInspectionForm)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) setForm(defaultInspectionForm())
    }, [open])

    const set = <K extends keyof InspectionFormState>(key: K, value: InspectionFormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error('Title is required'); return }
        if (!form.scheduled_date) { toast.error('Scheduled date is required'); return }
        setSaving(true)
        try {
            await qhseService.createInspection({
                project_id: projectId,
                inspection_number: form.inspection_number,
                title: form.title.trim(),
                type: form.type,
                status: 'PLANNED',
                scheduled_date: form.scheduled_date,
                inspector: form.inspector.trim() || undefined,
                area: form.area.trim() || undefined,
                checklist: [],
                findings: [],
                action_items: [],
            })
            toast.success('Inspection scheduled successfully')
            onOpenChange(false)
            onSaved()
        } catch (err) {
            toast.error(`Failed to schedule inspection: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Schedule HSE Inspection</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Inspection Number */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Inspection Number</Label>
                        <Input value={form.inspection_number} readOnly className="font-mono text-sm bg-muted" />
                    </div>

                    {/* Title */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="ins-title">
                            Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="ins-title"
                            placeholder="Inspection title or scope"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                        />
                    </div>

                    {/* Type */}
                    <div className="grid gap-1.5">
                        <Label>Type</Label>
                        <Select value={form.type} onValueChange={v => set('type', v as InspectionType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['ROUTINE', 'SPECIAL', 'AUDIT', 'THIRD_PARTY'] as InspectionType[]).map(t => (
                                    <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Scheduled Date */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="ins-date">
                            Scheduled Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="ins-date"
                            type="date"
                            value={form.scheduled_date}
                            onChange={e => set('scheduled_date', e.target.value)}
                        />
                    </div>

                    {/* Inspector */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="ins-inspector">Inspector</Label>
                        <Input
                            id="ins-inspector"
                            placeholder="Name of inspector"
                            value={form.inspector}
                            onChange={e => set('inspector', e.target.value)}
                        />
                    </div>

                    {/* Area */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="ins-area">Area / Scope</Label>
                        <Input
                            id="ins-area"
                            placeholder="Work area or scope of inspection"
                            value={form.area}
                            onChange={e => set('area', e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Schedule Inspection'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
