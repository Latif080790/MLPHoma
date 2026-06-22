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
import type { HazardType } from '@/types/qhse'
import {
    RISK_LEVEL_COLORS,
    HazardFormState,
    defaultHazardForm,
    computeRiskLevel,
} from '@/components/qhse/qhseConstants'

interface AddHazardDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    projectId: string
    onSaved: () => void
}

export function AddHazardDialog({ open, onOpenChange, projectId, onSaved }: AddHazardDialogProps) {
    const [form, setForm] = useState<HazardFormState>(defaultHazardForm)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) setForm(defaultHazardForm())
    }, [open])

    const set = <K extends keyof HazardFormState>(key: K, value: HazardFormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const riskScore = form.likelihood * form.severity
    const riskLevel = computeRiskLevel(riskScore)

    const handleSave = async () => {
        if (!form.activity.trim()) { toast.error('Activity is required'); return }
        if (!form.hazard.trim()) { toast.error('Hazard is required'); return }
        setSaving(true)
        try {
            await qhseService.createIBPREntry({
                project_id: projectId,
                activity: form.activity.trim(),
                hazard: form.hazard.trim(),
                hazard_type: form.hazard_type,
                potential_risk: form.potential_risk.trim(),
                likelihood: form.likelihood,
                severity: form.severity,
                control_measures: form.control_measures.trim() || undefined,
                responsible_person: form.responsible_person.trim() || undefined,
                status: 'ACTIVE',
            })
            toast.success('Hazard entry added successfully')
            onOpenChange(false)
            onSaved()
        } catch (err) {
            toast.error(`Failed to add hazard: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Hazard — IBPR Entry</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Activity */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="haz-activity">
                            Activity <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="haz-activity"
                            placeholder="Work activity where hazard exists"
                            value={form.activity}
                            onChange={e => set('activity', e.target.value)}
                        />
                    </div>

                    {/* Hazard */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="haz-hazard">
                            Hazard <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="haz-hazard"
                            placeholder="Identified hazard"
                            value={form.hazard}
                            onChange={e => set('hazard', e.target.value)}
                        />
                    </div>

                    {/* Hazard Type */}
                    <div className="grid gap-1.5">
                        <Label>Hazard Type</Label>
                        <Select value={form.hazard_type} onValueChange={v => set('hazard_type', v as HazardType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'PSYCHOSOCIAL', 'ELECTRICAL', 'MECHANICAL'] as HazardType[]).map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Potential Risk */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="haz-risk">Potential Risk</Label>
                        <Input
                            id="haz-risk"
                            placeholder="Potential consequence of the hazard"
                            value={form.potential_risk}
                            onChange={e => set('potential_risk', e.target.value)}
                        />
                    </div>

                    {/* Likelihood & Severity side by side */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="haz-likelihood">Likelihood (1–5)</Label>
                            <Input
                                id="haz-likelihood"
                                type="number"
                                min={1}
                                max={5}
                                value={form.likelihood}
                                onChange={e => {
                                    const v = Math.min(5, Math.max(1, Number(e.target.value) || 1))
                                    set('likelihood', v)
                                }}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="haz-severity">Severity (1–5)</Label>
                            <Input
                                id="haz-severity"
                                type="number"
                                min={1}
                                max={5}
                                value={form.severity}
                                onChange={e => {
                                    const v = Math.min(5, Math.max(1, Number(e.target.value) || 1))
                                    set('severity', v)
                                }}
                            />
                        </div>
                    </div>

                    {/* Risk Score & Level — computed, readonly */}
                    <div className="flex items-center gap-4 p-3 rounded-md bg-muted/60 border">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">Risk Score</p>
                            <p className={`text-2xl font-bold tabular-nums ${RISK_LEVEL_COLORS[riskLevel]}`}>{riskScore}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">Risk Level</p>
                            <p className={`text-sm font-semibold ${RISK_LEVEL_COLORS[riskLevel]}`}>{riskLevel}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-auto">= {form.likelihood} × {form.severity}</p>
                    </div>

                    {/* Control Measures */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="haz-controls">Control Measures</Label>
                        <Textarea
                            id="haz-controls"
                            rows={3}
                            placeholder="Describe control measures to mitigate the risk..."
                            value={form.control_measures}
                            onChange={e => set('control_measures', e.target.value)}
                        />
                    </div>

                    {/* Responsible Person */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="haz-person">Responsible Person</Label>
                        <Input
                            id="haz-person"
                            placeholder="Person responsible for control measures"
                            value={form.responsible_person}
                            onChange={e => set('responsible_person', e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Add Hazard'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
