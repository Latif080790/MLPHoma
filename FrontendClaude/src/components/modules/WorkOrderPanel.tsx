/**
 * WorkOrderPanel.tsx
 * FASE 4.1: SPK (Surat Perintah Kerja) & Opname Mandor UI
 *
 * Full CRUD panel for Work Orders:
 * - Create SPK with mandor, scope, unit price, max volume
 * - Record opname (volume check) with validation against max
 * - Record payment to mandor with validation against opname
 * - Status lifecycle: DRAFT → ACTIVE → COMPLETED
 */

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    ClipboardList, Plus, CheckCircle, Play, ArrowUp, Wallet, Loader2, AlertTriangle
} from "lucide-react"
import { workOrderService } from "@/services/workOrderService"
import { toast } from "sonner"
import type { WorkOrder } from "@/types/work-order"

// ---------- Sub-dialogs ----------

interface CreateSpkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    onCreated: () => void
}

function CreateSpkDialog({ open, onOpenChange, projectId, onCreated }: CreateSpkDialogProps) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        mandorName: '',
        mandorContact: '',
        scopeDescription: '',
        unit: '',
        unitPrice: 0,
        maxVolume: 0,
        wbsName: '',
        notes: '',
    })

    const maxAmount = form.unitPrice * form.maxVolume

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await workOrderService.createWorkOrder({
                projectId,
                mandorName: form.mandorName,
                mandorContact: form.mandorContact,
                scopeDescription: form.scopeDescription,
                unit: form.unit,
                unitPrice: form.unitPrice,
                maxVolume: form.maxVolume,
                wbsName: form.wbsName,
                notes: form.notes,
            })
            toast.success('SPK created')
            onOpenChange(false)
            onCreated()
            setForm({ mandorName: '', mandorContact: '', scopeDescription: '', unit: '', unitPrice: 0, maxVolume: 0, wbsName: '', notes: '' })
        } catch (err: unknown) {
            toast.error((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-orange-600" />
                        Buat SPK Baru
                    </DialogTitle>
                    <DialogDescription>
                        Surat Perintah Kerja untuk mandor / subkontraktor.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nama Mandor</Label>
                            <Input placeholder="Pak Ahmad" value={form.mandorName} onChange={e => setForm(p => ({ ...p, mandorName: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Kontak</Label>
                            <Input placeholder="08xx..." value={form.mandorContact} onChange={e => setForm(p => ({ ...p, mandorContact: e.target.value }))} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>WBS / Lokasi Kerja</Label>
                        <Input placeholder="Lantai 2 - Plesteran" value={form.wbsName} onChange={e => setForm(p => ({ ...p, wbsName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Scope Pekerjaan</Label>
                        <Textarea placeholder="Pekerjaan plesteran dinding lantai 2..." rows={2} value={form.scopeDescription} onChange={e => setForm(p => ({ ...p, scopeDescription: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Satuan</Label>
                            <Input placeholder="m2" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Harga Satuan (Rp)</Label>
                            <Input type="number" value={form.unitPrice || ''} onChange={e => setForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Volume Max</Label>
                            <Input type="number" step="0.01" value={form.maxVolume || ''} onChange={e => setForm(p => ({ ...p, maxVolume: Number(e.target.value) }))} required />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm">
                        <span className="text-muted-foreground">Plafon SPK: </span>
                        <span className="font-bold text-lg">Rp {maxAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" disabled={loading} className="gap-2 bg-orange-600 hover:bg-orange-700">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Buat SPK
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// ---------- Opname Dialog ----------

interface OpnameDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workOrder: WorkOrder | null
    onDone: () => void
}

function OpnameDialog({ open, onOpenChange, workOrder, onDone }: OpnameDialogProps) {
    const [volume, setVolume] = useState(0)
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)

    if (!workOrder) return null

    const remaining = workOrder.maxVolume - workOrder.actualVolume

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await workOrderService.recordOpname({
                workOrderId: workOrder!.id,
                volume,
                notes,
            })
            toast.success(`Opname ${volume} ${workOrder!.unit} recorded`)
            onOpenChange(false)
            onDone()
            setVolume(0)
            setNotes('')
        } catch (err: unknown) {
            toast.error((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Opname Volume — {workOrder.spkNumber}</DialogTitle>
                    <DialogDescription>
                        Mandor: {workOrder.mandorName} | Sisa: {remaining.toFixed(2)} {workOrder.unit}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Volume Terpasang ({workOrder.unit})</Label>
                        <Input
                            type="number"
                            step="0.01"
                            max={remaining}
                            value={volume || ''}
                            onChange={e => setVolume(Number(e.target.value))}
                            required
                        />
                        {volume > remaining && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Melebihi sisa volume ({remaining.toFixed(2)} {workOrder.unit})
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Catatan Opname</Label>
                        <Textarea placeholder="Kondisi lapangan..." rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" disabled={loading || volume <= 0}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Record Opname
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// ---------- Payment Dialog ----------

interface PaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workOrder: WorkOrder | null
    onDone: () => void
}

function PaymentDialog({ open, onOpenChange, workOrder, onDone }: PaymentDialogProps) {
    const [amount, setAmount] = useState(0)
    const [loading, setLoading] = useState(false)

    if (!workOrder) return null

    const maxPayable = workOrder.unitPrice * workOrder.actualVolume
    const remainingPayment = maxPayable - workOrder.paidAmount

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await workOrderService.recordPayment(workOrder!.id, amount)
            toast.success(`Payment Rp ${amount.toLocaleString('id-ID')} recorded`)
            onOpenChange(false)
            onDone()
            setAmount(0)
        } catch (err: unknown) {
            toast.error((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pembayaran — {workOrder.spkNumber}</DialogTitle>
                    <DialogDescription>
                        Mandor: {workOrder.mandorName} | Sisa bayar: Rp {remainingPayment.toLocaleString('id-ID')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Jumlah Pembayaran (Rp)</Label>
                        <Input
                            type="number"
                            value={amount || ''}
                            onChange={e => setAmount(Number(e.target.value))}
                            required
                        />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm space-y-1">
                        <div>Opname: {workOrder.actualVolume} {workOrder.unit} × Rp {workOrder.unitPrice.toLocaleString('id-ID')} = <strong>Rp {maxPayable.toLocaleString('id-ID')}</strong></div>
                        <div>Sudah Bayar: Rp {workOrder.paidAmount.toLocaleString('id-ID')}</div>
                        <div className="text-emerald-600 font-semibold">Sisa: Rp {remainingPayment.toLocaleString('id-ID')}</div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" disabled={loading || amount <= 0} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                            Bayar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// ---------- Main Panel ----------

interface WorkOrderPanelProps {
    projectId: string
}

export function WorkOrderPanel({ projectId }: WorkOrderPanelProps) {
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [_loading, setLoading] = useState(false)

    const [createOpen, setCreateOpen] = useState(false)
    const [opnameOpen, setOpnameOpen] = useState(false)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await workOrderService.getWorkOrders(projectId)
            setWorkOrders(data)
        } catch (err: unknown) {
            toast.error((err as Error).message)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        if (projectId) loadData()
    }, [projectId, loadData])

    const handleActivate = async (wo: WorkOrder) => {
        try {
            await workOrderService.activateWorkOrder(wo.id)
            toast.success(`${wo.spkNumber} activated`)
            loadData()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to activate')
        }
    }

    const handleComplete = async (wo: WorkOrder) => {
        try {
            await workOrderService.completeWorkOrder(wo.id)
            toast.success(`${wo.spkNumber} completed`)
            loadData()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to complete')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-slate-100 text-slate-600 border-slate-200'
            case 'ACTIVE': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'COMPLETED': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-slate-100 text-slate-600'
        }
    }

    const totalPlafon = workOrders.reduce((s, w) => s + w.unitPrice * w.maxVolume, 0)
    const totalOpname = workOrders.reduce((s, w) => s + w.unitPrice * w.actualVolume, 0)
    const totalPaid = workOrders.reduce((s, w) => s + w.paidAmount, 0)

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total SPK</div>
                        <div className="text-2xl font-bold">{workOrders.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Plafon</div>
                        <div className="text-xl font-bold">Rp {totalPlafon.toLocaleString('id-ID')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Opname</div>
                        <div className="text-xl font-bold text-blue-600">Rp {totalOpname.toLocaleString('id-ID')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Dibayar</div>
                        <div className="text-xl font-bold text-emerald-600">Rp {totalPaid.toLocaleString('id-ID')}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Daftar SPK</h3>
                <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-orange-600 hover:bg-orange-700">
                    <Plus className="h-4 w-4" /> Buat SPK
                </Button>
            </div>

            {/* Table */}
            {workOrders.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Belum ada SPK. Buat SPK untuk memulai pengelolaan mandor.
                    </CardContent>
                </Card>
            ) : (
                <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow>
                                <TableHead>No. SPK</TableHead>
                                <TableHead>Mandor</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead className="text-right">Volume (Max)</TableHead>
                                <TableHead className="text-right">Opname</TableHead>
                                <TableHead className="text-right">Dibayar</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workOrders.map(wo => {
                                const maxAmount = wo.unitPrice * wo.maxVolume
                                const opnameAmount = wo.unitPrice * wo.actualVolume
                                const progress = wo.maxVolume > 0 ? (wo.actualVolume / wo.maxVolume) * 100 : 0

                                return (
                                    <TableRow key={wo.id}>
                                        <TableCell className="font-mono font-medium text-orange-600">{wo.spkNumber}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{wo.mandorName}</div>
                                            <div className="text-xs text-muted-foreground">{wo.mandorContact}</div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-sm">{wo.scopeDescription}</TableCell>
                                        <TableCell className="text-right">
                                            <div>{wo.maxVolume} {wo.unit}</div>
                                            <div className="text-xs text-muted-foreground">Rp {maxAmount.toLocaleString('id-ID')}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div>{wo.actualVolume} {wo.unit} ({progress.toFixed(0)}%)</div>
                                            <div className="text-xs text-blue-600">Rp {opnameAmount.toLocaleString('id-ID')}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="text-emerald-600">Rp {wo.paidAmount.toLocaleString('id-ID')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Sisa: Rp {(opnameAmount - wo.paidAmount).toLocaleString('id-ID')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-xs ${getStatusColor(wo.status)}`}>
                                                {wo.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-1 justify-end">
                                                {wo.status === 'DRAFT' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleActivate(wo)} title="Activate">
                                                        <Play className="h-3 w-3" />
                                                    </Button>
                                                )}
                                                {wo.status === 'ACTIVE' && (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => { setSelectedWo(wo); setOpnameOpen(true) }} title="Opname">
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => { setSelectedWo(wo); setPaymentOpen(true) }} title="Bayar">
                                                            <Wallet className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleComplete(wo)} title="Complete">
                                                            <CheckCircle className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Dialogs */}
            <CreateSpkDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} onCreated={loadData} />
            <OpnameDialog open={opnameOpen} onOpenChange={setOpnameOpen} workOrder={selectedWo} onDone={loadData} />
            <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} workOrder={selectedWo} onDone={loadData} />
        </div>
    )
}
