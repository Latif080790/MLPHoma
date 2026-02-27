/**
 * MTRPanel.tsx
 *
 * Material Transfer Request (MTR) Panel.
 * Displays MTR list with status badges, create form, and approve/reject actions.
 * Integrates with RBAC via usePermissions for action-level controls.
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import { usePermissions, ACTIONS } from '@/hooks/usePermissions'
import {
    mtrService,
    MTR_STATUS_LABELS,
    MTR_STATUS_COLORS,
    type MaterialTransferRequest,
    type MTRStatus,
} from '@/services/mtrService'
import { ArrowRight, Plus, Send, Check, X, FileText, Truck, Package2 } from 'lucide-react'
import { toast } from 'sonner'

export function MTRPanel() {
    const { activeProjectId } = useProjectStore()
    const profile = useAuthStore(s => s.profile)
    const userId = profile?.full_name || profile?.id || 'User'
    const { can } = usePermissions()

    const [refreshKey, setRefreshKey] = useState(0)
    const [createOpen, setCreateOpen] = useState(false)
    const [actionDialog, setActionDialog] = useState<{ mtr: MaterialTransferRequest; action: MTRStatus } | null>(null)
    const [comment, setComment] = useState('')

    // Form state
    const [sourceWbs, setSourceWbs] = useState('')
    const [sourceLabel, setSourceLabel] = useState('')
    const [targetWbs, setTargetWbs] = useState('')
    const [targetLabel, setTargetLabel] = useState('')
    const [reason, setReason] = useState('')
    const [itemDesc, setItemDesc] = useState('')
    const [itemUnit, setItemUnit] = useState('')
    const [itemQty, setItemQty] = useState(0)
    const [itemPrice, setItemPrice] = useState(0)

    const mtrs = useMemo(
        () => (activeProjectId ? mtrService.getByProject(activeProjectId) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeProjectId, refreshKey]
    )

    const refresh = () => setRefreshKey(k => k + 1)

    const handleCreate = () => {
        if (!activeProjectId || !sourceWbs || !targetWbs || !itemDesc) {
            toast.error('Fill required fields')
            return
        }

        mtrService.createMTR({
            projectId: activeProjectId,
            sourceWbs,
            sourceWbsLabel: sourceLabel || sourceWbs,
            targetWbs,
            targetWbsLabel: targetLabel || targetWbs,
            items: [{ description: itemDesc, unit: itemUnit || 'unit', quantity: itemQty, unitPrice: itemPrice }],
            reason,
            requestedBy: userId,
        })

        // Reset form
        setCreateOpen(false)
        setSourceWbs(''); setSourceLabel(''); setTargetWbs(''); setTargetLabel('')
        setReason(''); setItemDesc(''); setItemUnit(''); setItemQty(0); setItemPrice(0)
        refresh()
    }

    const handleAction = (mtr: MaterialTransferRequest, action: MTRStatus) => {
        if (action === 'REJECTED') {
            setActionDialog({ mtr, action })
            return
        }
        try {
            mtrService.transition(mtr.id, action, { userId, comment: '' })
            refresh()
        } catch {
            // toast already shown by service
        }
    }

    const handleActionConfirm = () => {
        if (!actionDialog) return
        try {
            mtrService.transition(actionDialog.mtr.id, actionDialog.action, { userId, comment })
            setActionDialog(null)
            setComment('')
            refresh()
        } catch {
            // toast shown by service
        }
    }

    if (!activeProjectId) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Truck size={18} className="text-blue-600" />
                    <h3 className="font-semibold text-sm">Material Transfer Requests</h3>
                    <Badge variant="outline" className="text-[10px]">{mtrs.length}</Badge>
                </div>
                {can(ACTIONS.CREATE_MR) && (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus size={14} className="mr-1" /> New MTR
                    </Button>
                )}
            </div>

            {mtrs.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Package2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No material transfer requests yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Create an MTR to reallocate materials between WBS items.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-[11px] uppercase tracking-wider">
                                    <TableHead className="p-3 w-28">ID</TableHead>
                                    <TableHead className="p-3">Transfer</TableHead>
                                    <TableHead className="p-3 text-right">Value</TableHead>
                                    <TableHead className="p-3 w-24">Status</TableHead>
                                    <TableHead className="p-3 w-32 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mtrs.map(mtr => {
                                    const nextStatuses = mtrService.getNextStatuses(mtr.id)
                                    return (
                                        <TableRow key={mtr.id} className="text-xs">
                                            <TableCell className="p-3 font-mono text-[10px]">{mtr.id.slice(0, 12)}</TableCell>
                                            <TableCell className="p-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium">{mtr.sourceWbsLabel}</span>
                                                    <ArrowRight size={12} className="text-slate-400" />
                                                    <span className="font-medium">{mtr.targetWbsLabel}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{mtr.reason}</div>
                                            </TableCell>
                                            <TableCell className="p-3 text-right font-mono font-semibold">
                                                Rp {mtr.totalValue.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="p-3">
                                                <Badge className={`text-[9px] ${MTR_STATUS_COLORS[mtr.status]}`}>
                                                    {MTR_STATUS_LABELS[mtr.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-3 text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    {nextStatuses.includes('SUBMITTED') && (
                                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                                                            onClick={() => handleAction(mtr, 'SUBMITTED')}>
                                                            <Send size={10} className="mr-0.5" /> Submit
                                                        </Button>
                                                    )}
                                                    {nextStatuses.includes('APPROVED') && can(ACTIONS.APPROVE_MR) && (
                                                        <Button size="sm" variant="default" className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                                                            onClick={() => handleAction(mtr, 'APPROVED')}>
                                                            <Check size={10} className="mr-0.5" /> Approve
                                                        </Button>
                                                    )}
                                                    {nextStatuses.includes('REJECTED') && can(ACTIONS.APPROVE_MR) && (
                                                        <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                                            onClick={() => handleAction(mtr, 'REJECTED')}>
                                                            <X size={10} className="mr-0.5" /> Reject
                                                        </Button>
                                                    )}
                                                    {nextStatuses.includes('POSTED') && (
                                                        <Button size="sm" variant="default" className="h-6 text-[10px] px-2"
                                                            onClick={() => handleAction(mtr, 'POSTED')}>
                                                            <FileText size={10} className="mr-0.5" /> Post
                                                        </Button>
                                                    )}
                                                    {nextStatuses.includes('DRAFT') && (
                                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                                                            onClick={() => handleAction(mtr, 'DRAFT')}>
                                                            Revise
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Create MTR Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Material Transfer Request</DialogTitle>
                        <DialogDescription>Transfer materials between WBS items / cost centers.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium mb-1 block">Source WBS</label>
                                <Input placeholder="e.g. WBS-001" value={sourceWbs} onChange={e => setSourceWbs(e.target.value)} />
                                <Input placeholder="Label" className="mt-1" value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block">Target WBS</label>
                                <Input placeholder="e.g. WBS-002" value={targetWbs} onChange={e => setTargetWbs(e.target.value)} />
                                <Input placeholder="Label" className="mt-1" value={targetLabel} onChange={e => setTargetLabel(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Reason</label>
                            <Textarea placeholder="Reason for transfer..." value={reason} onChange={e => setReason(e.target.value)} />
                        </div>
                        <div className="border rounded-lg p-3 space-y-2">
                            <label className="text-xs font-medium block">Transfer Item</label>
                            <Input placeholder="Description" value={itemDesc} onChange={e => setItemDesc(e.target.value)} />
                            <div className="grid grid-cols-3 gap-2">
                                <Input placeholder="Unit" value={itemUnit} onChange={e => setItemUnit(e.target.value)} />
                                <Input type="number" placeholder="Qty" value={itemQty || ''} onChange={e => setItemQty(Number(e.target.value))} />
                                <Input type="number" placeholder="Unit Price" value={itemPrice || ''} onChange={e => setItemPrice(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>
                            <Plus size={14} className="mr-1" /> Create Draft
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejection/Comment Dialog */}
            <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setComment('') }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{actionDialog?.action === 'REJECTED' ? 'Reject MTR' : 'Confirm Action'}</DialogTitle>
                        <DialogDescription>
                            {actionDialog?.action === 'REJECTED' ? 'Provide a reason for rejection.' : 'Add a comment (optional).'}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder={actionDialog?.action === 'REJECTED' ? 'Rejection reason (required)...' : 'Comment...'}
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setActionDialog(null); setComment('') }}>Cancel</Button>
                        <Button
                            variant={actionDialog?.action === 'REJECTED' ? 'destructive' : 'default'}
                            onClick={handleActionConfirm}
                            disabled={actionDialog?.action === 'REJECTED' && !comment.trim()}
                        >
                            {actionDialog?.action === 'REJECTED' ? 'Reject' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
