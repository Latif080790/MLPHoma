/**
 * OpnameBoard.tsx
 *
 * Operations/Finance board to track Progress Claims (Opnames) from Active SPKs.
 * Shows gross progress, calculates deductions (Retensi, DP repayment), and computes Net Payable.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/shared/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/store/projectStore'
import { subcontractorService, type Opname, type SPK } from '@/services/subcontractorService'
import { useAuthStore } from '@/store/authStore'
import { FileDown, Calculator, Wallet, Play } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function OpnameBoard() {
    const { activeProjectId } = useProjectStore()
    const profile = useAuthStore(s => s.profile)

    const [spks, setSpks] = useState<SPK[]>([])
    const [opnames, setOpnames] = useState<Opname[]>([])

    // Only ACTIVE SPKs for drafting new opnames
    const activeSpks = spks.filter(s => s.status === 'ACTIVE')

    // Create Opname Dialog State
    const [createOpen, setCreateOpen] = useState(false)
    const [selectedSpk, setSelectedSpk] = useState<SPK | null>(null)
    const [draftOpname, setDraftOpname] = useState<Omit<Opname, 'id'> | null>(null)
    const [reqProgress, setReqProgress] = useState<number>(0)
    const [otherDed, setOtherDed] = useState(0)

    // Review Opname Dialog State
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewOpname, setReviewOpname] = useState<Opname | null>(null)

    const refreshData = useCallback(async () => {
        if (!activeProjectId) return
        try {
            const [fetchedSpks, fetchedOpnames] = await Promise.all([
                subcontractorService.getSPKs(activeProjectId),
                subcontractorService.getOpnames(activeProjectId),
            ])
            setSpks(fetchedSpks)
            setOpnames(fetchedOpnames)
        } catch (err) {
            console.error('Failed to load opname board data:', err)
        }
    }, [activeProjectId])

    useEffect(() => {
        refreshData()
    }, [refreshData])

    if (!activeProjectId) return null

    // ─── Create Flow ───

    const handleStartDraft = async (spk: SPK) => {
        setSelectedSpk(spk)
        try {
            const existing = await subcontractorService.getOpnamesBySPK(spk.id)
            const nonRejected = existing.filter(o => o.status !== 'REJECTED')
            const prev = nonRejected.reduce((a, c) => a + c.currentPeriodProgressPercentage, 0)
            const defaultProgress = prev + 10
            setReqProgress(defaultProgress)
            setOtherDed(0)
            const draft = subcontractorService.draftOpname(spk, nonRejected, defaultProgress, 0)
            setDraftOpname(draft)
            setCreateOpen(true)
        } catch (e: unknown) {
            toast.error((e as Error).message)
        }
    }

    const handleProgressChange = async (val: number) => {
        setReqProgress(val)
        if (!selectedSpk) return
        try {
            const existing = await subcontractorService.getOpnamesBySPK(selectedSpk.id)
            const nonRejected = existing.filter(o => o.status !== 'REJECTED')
            const draft = subcontractorService.draftOpname(selectedSpk, nonRejected, val, otherDed)
            setDraftOpname(draft)
        } catch {
            // Just catch visual errors during typing
        }
    }

    const handleDedChange = async (val: number) => {
        setOtherDed(val)
        if (!selectedSpk) return
        try {
            const existing = await subcontractorService.getOpnamesBySPK(selectedSpk.id)
            const nonRejected = existing.filter(o => o.status !== 'REJECTED')
            const draft = subcontractorService.draftOpname(selectedSpk, nonRejected, reqProgress, val)
            setDraftOpname(draft)
        } catch { /* Intentionally empty - draft calculation is optional */ }
    }

    const handleSaveDraft = async () => {
        if (!draftOpname) return
        const userName = profile?.full_name || 'System'
        await subcontractorService.saveOpname(draftOpname, userName)
        setCreateOpen(false)
        setDraftOpname(null)
        await refreshData()
    }

    // ─── Workflow Actions ───

    const handleSubmit = async (id: string) => {
        await subcontractorService.submitOpname(id)
        await refreshData()
    }

    const handleApprove = async () => {
        if (!reviewOpname) return
        const userName = profile?.full_name || 'System'
        await subcontractorService.approveOpname(reviewOpname.id, userName)
        setReviewOpen(false)
        await refreshData()
    }

    const handlePostToAP = async (id: string) => {
        const userName = profile?.full_name || 'System'
        try {
            await subcontractorService.postToFinance(id, userName)
            await refreshData()
        } catch (e: unknown) {
            toast.error((e as Error).message)
        }
    }

    return (
        <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2 border-b">
                        <CardTitle className="text-sm">Active SPKs (Ready for Opname)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable
                            data={activeSpks}
                            emptyMessage="No active SPKs available."
                            columns={[
                                { accessorKey: 'spkNumber', header: 'SPK Number', size: 100, cell: ({ row }) => <span className="text-xs font-mono">{row.original.spkNumber}</span> },
                                { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="text-xs truncate max-w-[120px]" title={row.original.description}>{row.original.description}</span> },
                                { id: 'actions', header: () => <div className="text-right">Aksi</div>, cell: ({ row }) => (
                                    <div className="flex justify-end">
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-600 bg-blue-50" onClick={() => handleStartDraft(row.original)}>
                                            <Calculator size={12} className="mr-1" /> Claim
                                        </Button>
                                    </div>
                                ), size: 100 }
                            ] as ColumnDef<SPK>[]}
                        />
                    </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-2 shadow-sm border border-slate-200 dark:border-slate-800">
                    <CardHeader className="p-4 bg-slate-50 dark:bg-slate-900 border-b">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FileDown size={14} className="text-emerald-600" /> Opname Approval Queue
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable
                            data={opnames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                            emptyMessage="No progress claims recorded."
                            columns={[
                                {
                                    id: 'spk',
                                    header: 'SPK / Period',
                                    cell: ({ row }) => {
                                        const op = row.original;
                                        const parentSpk = spks.find(s => s.id === op.spkId);
                                        return (
                                            <div>
                                                <div className="font-mono font-medium">{parentSpk?.spkNumber}</div>
                                                <div className="text-xs text-slate-500">Period: {op.periodNumber} • {format(new Date(op.date), 'dd MMM yyyy')}</div>
                                            </div>
                                        );
                                    }
                                },
                                {
                                    id: 'progress',
                                    header: 'Progress',
                                    cell: ({ row }) => (
                                        <div>
                                            <div className="font-medium text-blue-700">{row.original.progressPercentage}%</div>
                                            <div className="text-xs text-slate-500">(+{row.original.currentPeriodProgressPercentage}%)</div>
                                        </div>
                                    )
                                },
                                {
                                    id: 'payable',
                                    header: () => <div className="text-right">Net Payable</div>,
                                    cell: ({ row }) => (
                                        <div className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                            Rp {row.original.netPayable.toLocaleString('id-ID')}
                                        </div>
                                    )
                                },
                                {
                                    id: 'status',
                                    header: () => <div className="text-center">Status</div>,
                                    cell: ({ row }) => (
                                        <div className="flex justify-center">
                                            <Badge variant="outline" className={`text-xs ${row.original.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    row.original.status === 'POSTED_TO_FINANCE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        row.original.status === 'SUBMITTED' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                            'bg-slate-50 text-slate-600'
                                                }`}>
                                                {row.original.status.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                    ),
                                    size: 150
                                },
                                {
                                    id: 'actions',
                                    header: () => <div className="text-right">Action</div>,
                                    cell: ({ row }) => {
                                        const op = row.original;
                                        return (
                                            <div className="flex justify-end gap-1 border-t-0">
                                                {op.status === 'DRAFT' && (
                                                    <Button size="icon" variant="ghost" aria-label="Submit" className="h-6 w-6 text-blue-600" onClick={() => handleSubmit(op.id)}><Play size={12} /></Button>
                                                )}
                                                {op.status === 'SUBMITTED' && (
                                                    <Button size="sm" variant="outline" className="h-6 text-xs bg-orange-50 text-orange-700 border-orange-200" onClick={() => { setReviewOpname(op); setReviewOpen(true) }}>
                                                        Review
                                                    </Button>
                                                )}
                                                {op.status === 'APPROVED' && (
                                                    <Button size="sm" variant="outline" className="h-6 text-xs bg-blue-50 text-blue-700 border-blue-200" onClick={() => handlePostToAP(op.id)}>
                                                        <Wallet size={12} className="mr-1" /> Post AP
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    },
                                    size: 120
                                }
                            ] as ColumnDef<Opname>[]}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Create Draft Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Calculate Opname Progress</DialogTitle>
                        <DialogDescription>{selectedSpk?.spkNumber} - {selectedSpk?.description}</DialogDescription>
                    </DialogHeader>
                    {draftOpname && selectedSpk && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Cumulative Target %</Label>
                                    <Input type="number" value={reqProgress} onChange={e => handleProgressChange(Number(e.target.value))} />
                                    <div className="text-xs flex justify-between">
                                        <span className="text-slate-400">Previous: {draftOpname.previousProgressPercentage}%</span>
                                        <span className="text-blue-600 font-bold">This period: +{draftOpname.currentPeriodProgressPercentage}%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Other Deductions (Rp)</Label>
                                    <Input type="number" value={otherDed} onChange={e => handleDedChange(Number(e.target.value))} />
                                </div>
                            </div>

                            {/* Calculation Breakdown */}
                            <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3 space-y-2 text-sm font-mono">
                                <div className="flex justify-between text-slate-600">
                                    <span>Gross Claim ({draftOpname.currentPeriodProgressPercentage}%)</span>
                                    <span>Rp {draftOpname.grossAmount.toLocaleString('id-ID')}</span>
                                </div>
                                {selectedSpk.retainagePercentage > 0 && (
                                    <div className="flex justify-between text-red-600/80">
                                        <span>Less Retensi ({selectedSpk.retainagePercentage}%)</span>
                                        <span>- Rp {draftOpname.retentionDeduction.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {selectedSpk.downPaymentPercentage > 0 && (
                                    <div className="flex justify-between text-red-600/80">
                                        <span>Less DP Return ({selectedSpk.downPaymentPercentage}%)</span>
                                        <span>- Rp {draftOpname.dpRepaymentDeduction.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {draftOpname.otherDeductions > 0 && (
                                    <div className="flex justify-between text-red-600/80">
                                        <span>Other Deductions</span>
                                        <span>- Rp {draftOpname.otherDeductions.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1" />
                                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                                    <span>Net Payable</span>
                                    <span className="text-emerald-600">Rp {draftOpname.netPayable.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleSaveDraft}>Save Draft</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Dialog */}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review Opname</DialogTitle>
                        <DialogDescription>Verify calculation before PM approval.</DialogDescription>
                    </DialogHeader>
                    {reviewOpname && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                                <div className="text-xs text-emerald-600 uppercase font-bold mb-1">Final Net to Pay</div>
                                <div className="text-2xl font-mono font-bold text-emerald-900">
                                    Rp {reviewOpname.netPayable.toLocaleString('id-ID')}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                                <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Progress:</span> <strong className="text-slate-900">+{reviewOpname.currentPeriodProgressPercentage}%</strong></div>
                                <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Total %:</span> <strong className="text-blue-600">{reviewOpname.progressPercentage}%</strong></div>
                                <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Retensi Cut:</span> <span>Rp {reviewOpname.retentionDeduction.toLocaleString()}</span></div>
                                <div className="flex justify-between p-2 bg-slate-50 rounded"><span>DP Cut:</span> <span>Rp {reviewOpname.dpRepaymentDeduction.toLocaleString()}</span></div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" className="text-red-600" onClick={() => { toast.error("Add rejection logic later"); setReviewOpen(false) }}>Reject</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove}>Approve Payment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
