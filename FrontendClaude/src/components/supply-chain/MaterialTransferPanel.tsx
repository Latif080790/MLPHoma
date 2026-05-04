/**
 * MaterialTransferPanel.tsx
 * Full CRUD panel for Material Transfer Requests (MTR).
 * Displays transfer list with status badges, filters, and create/execute actions.
 *
 * Epic S1.2: Material Transfer Workflow
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    ArrowRightLeft,
    Plus,
    Play,
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    Loader2,
} from 'lucide-react'
import { useSupplyChainStore } from '@/store/supplyChainStore'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import type { TransferStatus, CreateTransferInput } from '@/types/material-transfer'

const STATUS_CONFIG: Record<TransferStatus, { label: string; icon: React.ReactNode; className: string }> = {
    PENDING: { label: 'Pending', icon: <Clock className="h-3 w-3" />, className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    APPROVED: { label: 'Approved', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    REJECTED: { label: 'Rejected', icon: <XCircle className="h-3 w-3" />, className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    EXECUTED: { label: 'Executed', icon: <Package className="h-3 w-3" />, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

const FILTER_OPTIONS: { label: string; value: TransferStatus | 'ALL' }[] = [
    { label: 'Semua', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Executed', value: 'EXECUTED' },
]

export function MaterialTransferPanel() {
    const activeProjectId = useProjectStore((s) => s.activeProjectId)
    const user = useAuthStore((s) => s.user)

    const {
        materialTransfers,
        loading,
        fetchTransfers,
        createMaterialTransfer,
        executeMaterialTransfer,
    } = useSupplyChainStore()

    const [filter, setFilter] = useState<TransferStatus | 'ALL'>('ALL')
    const [createOpen, setCreateOpen] = useState(false)
    const [executeConfirmId, setExecuteConfirmId] = useState<string | null>(null)

    // Form state
    const [form, setForm] = useState<Partial<CreateTransferInput>>({
        sourceWbsId: '', sourceWbsName: '',
        targetWbsId: '', targetWbsName: '',
        itemName: '', unit: '', quantity: 0, unitCost: 0,
        reason: '', isEmergency: false,
    })

    useEffect(() => {
        if (activeProjectId) {
            fetchTransfers(activeProjectId)
        }
    }, [activeProjectId, fetchTransfers])

    const filtered = filter === 'ALL'
        ? materialTransfers
        : materialTransfers.filter(t => t.status === filter)

    const handleCreate = async () => {
        if (!activeProjectId || !form.itemName || !form.sourceWbsId || !form.targetWbsId || !form.reason) return
        try {
            await createMaterialTransfer(
                { ...form, projectId: activeProjectId },
                user?.id || '',
                user?.user_metadata?.full_name || user?.email || 'Unknown'
            )
            setCreateOpen(false)
            setForm({ sourceWbsId: '', sourceWbsName: '', targetWbsId: '', targetWbsName: '', itemName: '', unit: '', quantity: 0, unitCost: 0, reason: '', isEmergency: false })
        } catch {
            // Error handled in store
        }
    }

    const handleExecute = async () => {
        if (!executeConfirmId) return
        try {
            await executeMaterialTransfer(executeConfirmId)
            setExecuteConfirmId(null)
        } catch {
            // Error handled in store
        }
    }

    return (
        <Card className="border-white/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-blue-400" />
                        Material Transfer Request
                    </CardTitle>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        New Transfer
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-1.5 mt-2">
                    {FILTER_OPTIONS.map(opt => (
                        <Button
                            key={opt.value}
                            size="sm"
                            variant={filter === opt.value ? 'default' : 'ghost'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setFilter(opt.value)}
                        >
                            {opt.label}
                            {opt.value !== 'ALL' && (
                                <span className="ml-1 opacity-60">
                                    ({materialTransfers.filter(t => t.status === opt.value).length})
                                </span>
                            )}
                        </Button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {loading.transfer ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Memuat transfer…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Belum ada transfer request.
                    </div>
                ) : (
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.03]">
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source → Target</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const cfg = STATUS_CONFIG[t.status]
                                    return (
                                        <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                                            <td className="px-3 py-2.5">
                                                <div className="font-medium">{t.itemName}</div>
                                                {t.isEmergency && (
                                                    <div className="flex items-center gap-1 text-red-400 mt-0.5">
                                                        <AlertTriangle className="h-3 w-3" /> Emergency
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-muted-foreground">
                                                <span className="text-foreground">{t.sourceWbsName || t.sourceWbsId}</span>
                                                <span className="mx-1 opacity-40">→</span>
                                                <span className="text-foreground">{t.targetWbsName || t.targetWbsId}</span>
                                            </td>
                                            <td className="text-right px-3 py-2.5 font-mono">{t.quantity} {t.unit}</td>
                                            <td className="text-right px-3 py-2.5 font-mono">{formatCurrency(t.totalCost)}</td>
                                            <td className="text-center px-3 py-2.5">
                                                <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                                                    {cfg.icon}{cfg.label}
                                                </Badge>
                                            </td>
                                            <td className="text-right px-3 py-2.5">
                                                {t.status === 'APPROVED' && (
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => setExecuteConfirmId(t.id)}>
                                                        <Play className="h-3 w-3 mr-1" />Execute
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            {/* Create Transfer Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5" />
                            New Material Transfer
                        </DialogTitle>
                        <DialogDescription>
                            Transfer material antar WBS. Akan otomatis membuat approval request ke PM.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Source WBS</label>
                                <Input
                                    placeholder="e.g. Kolom"
                                    value={form.sourceWbsName || ''}
                                    onChange={e => setForm(f => ({ ...f, sourceWbsName: e.target.value, sourceWbsId: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Target WBS</label>
                                <Input
                                    placeholder="e.g. Dinding"
                                    value={form.targetWbsName || ''}
                                    onChange={e => setForm(f => ({ ...f, targetWbsName: e.target.value, targetWbsId: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
                                <Input
                                    placeholder="e.g. Semen PCC"
                                    value={form.itemName || ''}
                                    onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                                <Input
                                    placeholder="sak"
                                    value={form.unit || ''}
                                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                                <Input
                                    type="number"
                                    value={form.quantity || ''}
                                    onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Unit Cost (Rp)</label>
                                <Input
                                    type="number"
                                    value={form.unitCost || ''}
                                    onChange={e => setForm(f => ({ ...f, unitCost: Number(e.target.value) }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Reason</label>
                            <Input
                                placeholder="Alasan transfer material…"
                                value={form.reason || ''}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.isEmergency || false}
                                onChange={e => setForm(f => ({ ...f, isEmergency: e.target.checked }))}
                                className="rounded"
                            />
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                            Emergency Transfer (urgent, critical severity)
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)}>Batal</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!form.itemName || !form.sourceWbsId || !form.targetWbsId || !form.reason || loading.transfer}
                        >
                            {loading.transfer && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                            Submit Transfer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Execute Confirmation */}
            <AlertDialog open={!!executeConfirmId} onOpenChange={o => !o && setExecuteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Execute Material Transfer?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ini akan memindahkan material dari source ke target WBS. Inventory dan cost akan dimutasi.
                            Aksi ini tidak bisa di-undo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExecute} className="bg-emerald-600 hover:bg-emerald-700">
                            Execute Transfer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
