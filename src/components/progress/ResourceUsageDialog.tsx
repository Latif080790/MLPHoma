import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Hammer, Clock, Save, Loader2 } from 'lucide-react'
import { assertSupabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface ResourceUsageDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export function ResourceUsageDialog({ open, onOpenChange, projectId }: ResourceUsageDialogProps) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        tool_name: '',
        hours_used: 8,
        log_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE'
    })

    const handleSubmit = async () => {
        if (!form.tool_name) return toast.error("Please enter tool name")

        setLoading(true)
        try {
            const supabase = assertSupabase()
            const { error } = await supabase.from('tools_usage_logs').insert([{
                project_id: projectId,
                tool_name: form.tool_name,
                hours_used: Number(form.hours_used),
                log_date: form.log_date,
                status: form.status,
                resource_id: 'MANUAL_ENTRY' // Fallback for manual logs
            }])

            if (error) throw error

            toast.success("Resource usage logged successfully")
            onOpenChange(false)
            setForm({
                tool_name: '',
                hours_used: 8,
                log_date: new Date().toISOString().split('T')[0],
                status: 'ACTIVE'
            })
        } catch (err: any) {
            toast.error("Failed to log resource", { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Hammer className="h-5 w-5 text-blue-600" />
                        Log Resource Usage
                    </DialogTitle>
                    <DialogDescription>
                        Input pemakaian alat atau alat berat di lapangan untuk pemantauan Heatmap.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="tool_name">Nama Alat / Sumber Daya</Label>
                        <Input
                            id="tool_name"
                            placeholder="Contoh: Excavator PC200, Crane, dsb."
                            value={form.tool_name}
                            onChange={e => setForm({ ...form, tool_name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="hours">Jam Operasi</Label>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="hours"
                                    type="number"
                                    className="pl-8"
                                    value={form.hours_used}
                                    onChange={e => setForm({ ...form, hours_used: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">⚡ Active</SelectItem>
                                    <SelectItem value="IDLE">💤 Idle / Standby</SelectItem>
                                    <SelectItem value="MAINTENANCE">🛠 Maint</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="log_date">Tanggal</Label>
                        <Input
                            id="log_date"
                            type="date"
                            value={form.log_date}
                            onChange={e => setForm({ ...form, log_date: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Log
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
