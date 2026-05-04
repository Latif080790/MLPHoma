/**
 * OverheadCostPanel.tsx
 *
 * Finance panel to manage overhead and indirect costs.
 * Displays summary ratios, category breakdown, and list of items.
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/shared/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useProjectStore } from '@/store/projectStore'
import {
    overheadCostService,
    OVERHEAD_CATEGORY_LABELS,
    OVERHEAD_CATEGORY_ICONS,
    type OverheadItem,
    type OverheadCategory,
    type CalculationMethod
} from '@/services/overheadCostService'
import { Plus, Trash2, Edit2, Wallet, PieChart, CopyPlus } from 'lucide-react'
import { Building2 } from 'lucide-react' // Using standard lucide icons

export function OverheadCostPanel() {
    const { activeProjectId } = useProjectStore()
    // Try to get direct cost from RAB/CurvaS if available, otherwise mock or default
    // In a real implementation this would pull total from rabItemsStore
    const mockDirectCost = 15000000000 // 15M IDR mock direct cost for summary

    const [refreshKey, setRefreshKey] = useState(0)
    const [createOpen, setCreateOpen] = useState(false)
    const [isEdit, setIsEdit] = useState(false)

    // Form State
    const [itemId, setItemId] = useState('')
    const [category, setCategory] = useState<OverheadCategory>('OVERHEAD_SITE')
    const [label, setLabel] = useState('')
    const [method, setMethod] = useState<CalculationMethod>('PERCENTAGE')
    const [percentage, setPercentage] = useState(0)
    const [fixedAmount, setFixedAmount] = useState(0)
    const [notes, setNotes] = useState('')

    const summary = useMemo(
        () => {
            if (!activeProjectId) return null;
            return overheadCostService.getSummary(activeProjectId, mockDirectCost)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeProjectId, refreshKey]
    )

    const refresh = () => setRefreshKey(k => k + 1)

    const handleApplyTemplate = () => {
        if (!activeProjectId) return
        overheadCostService.applyTemplate(activeProjectId, mockDirectCost)
        refresh()
    }

    const handleOpenCreate = () => {
        setIsEdit(false)
        setCategory('OVERHEAD_SITE')
        setLabel('')
        setMethod('PERCENTAGE')
        setPercentage(0)
        setFixedAmount(0)
        setNotes('')
        setCreateOpen(true)
    }

    const handleOpenEdit = (item: OverheadItem) => {
        setIsEdit(true)
        setItemId(item.id)
        setCategory(item.category)
        setLabel(item.label)
        setMethod(item.method)
        setPercentage(item.percentage || 0)
        setFixedAmount(item.fixedAmount || 0)
        setNotes(item.notes || '')
        setCreateOpen(true)
    }

    const handleSave = () => {
        if (!activeProjectId || !label) return

        const input = {
            projectId: activeProjectId,
            category,
            label,
            method,
            percentage: method === 'PERCENTAGE' ? percentage : undefined,
            fixedAmount: method !== 'PERCENTAGE' ? fixedAmount : undefined,
            notes,
        }

        if (isEdit) {
            overheadCostService.updateItem(itemId, input, mockDirectCost)
        } else {
            overheadCostService.addItem(input, mockDirectCost)
        }

        setCreateOpen(false)
        refresh()
    }

    const handleDelete = (id: string) => {
        overheadCostService.removeItem(id)
        refresh()
    }

    if (!activeProjectId || !summary) return null

    return (
        <div className="space-y-4">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900">
                    <CardContent className="p-4 flex flex-col justify-center">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-300 flex justify-between">
                            Direct Cost (RAB)<Building2 size={16} />
                        </div>
                        <div className="text-xl font-bold font-mono mt-1 text-slate-800 dark:text-slate-100">
                            Rp {summary.directCost.toLocaleString('id-ID')}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Base calculation</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900">
                    <CardContent className="p-4 flex flex-col justify-center">
                        <div className="text-sm font-medium text-amber-800 dark:text-amber-300 flex justify-between">
                            Total Overhead<PieChart size={16} />
                        </div>
                        <div className="text-xl font-bold font-mono mt-1 text-slate-800 dark:text-slate-100">
                            Rp {summary.totalOverhead.toLocaleString('id-ID')}
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                            {summary.overheadRatio.toFixed(2)}% dari Direct Cost
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900 col-span-2">
                    <CardContent className="p-4 flex flex-col justify-center h-full">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex justify-between gap-2">
                                    Grand Total (Direct + OH)<Wallet size={16} />
                                </div>
                                <div className="text-2xl font-bold font-mono mt-1 text-emerald-900 dark:text-emerald-50">
                                    Rp {summary.grandTotal.toLocaleString('id-ID')}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-8" onClick={handleApplyTemplate} disabled={summary.items.length > 0}>
                                    <CopyPlus size={14} className="mr-1.5" /> Load Template
                                </Button>
                                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={handleOpenCreate}>
                                    <Plus size={14} className="mr-1.5" /> Add Target
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Category Breakdown */}
                <div className="col-span-4 space-y-3">
                    <Card>
                        <CardHeader className="p-4 pb-0">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <PieChart size={16} className="text-slate-500" /> Breakdown by Category
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {summary.byCategory.length === 0 ? (
                                <div className="text-sm text-center text-slate-500 py-8">No overhead data</div>
                            ) : (
                                <div className="space-y-3">
                                    {summary.byCategory.sort((a, b) => b.total - a.total).map(c => (
                                        <div key={c.category} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span>{OVERHEAD_CATEGORY_ICONS[c.category] || '📋'}</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">{c.label}</span>
                                            </div>
                                            <div className="font-mono text-slate-900 dark:text-white font-semibold flex flex-col items-end">
                                                Rp {c.total.toLocaleString('id-ID')}
                                                <span className="text-xs text-slate-400 font-sans font-normal">
                                                    {((c.total / summary.totalOverhead) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Items Table */}
                <div className="col-span-8">
                    <Card className="h-full">
                        <CardContent className="p-0">
                            <DataTable
                                data={summary.items}
                                emptyMessage="No indirect costs defined. Click 'Load Template' to start."
                                columns={[
                                    {
                                        id: 'category',
                                        header: 'Category & Label',
                                        cell: ({ row }) => {
                                            const item = row.original;
                                            return (
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                        {OVERHEAD_CATEGORY_ICONS[item.category] || '📋'} {item.label}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{OVERHEAD_CATEGORY_LABELS[item.category]}</div>
                                                </div>
                                            )
                                        },
                                        size: 180
                                    },
                                    {
                                        id: 'method',
                                        header: 'Method',
                                        cell: ({ row }) => (
                                            <Badge variant="outline" className="text-xs uppercase font-normal bg-slate-50 dark:bg-slate-900">
                                                {row.original.method}
                                            </Badge>
                                        )
                                    },
                                    {
                                        id: 'rate',
                                        header: () => <div className="text-right">Value/Rate</div>,
                                        cell: ({ row }) => {
                                            const item = row.original;
                                            return (
                                                <div className="text-right font-mono text-slate-600 dark:text-slate-300 text-xs">
                                                    {item.method === 'PERCENTAGE'
                                                        ? <span className="text-blue-600 font-semibold">{item.percentage}%</span>
                                                        : `Rp ${item.fixedAmount?.toLocaleString('id-ID')}`
                                                    }
                                                </div>
                                            )
                                        }
                                    },
                                    {
                                        id: 'calculated',
                                        header: () => <div className="text-right">Calculated (Rp)</div>,
                                        cell: ({ row }) => (
                                            <div className="text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                Rp {row.original.calculatedAmount.toLocaleString('id-ID')}
                                            </div>
                                        )
                                    },
                                    {
                                        id: 'actions',
                                        header: () => <div className="text-right">Actions</div>,
                                        cell: ({ row }) => (
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" aria-label="Edit" className="h-6 w-6 text-blue-600" onClick={() => handleOpenEdit(row.original)}>
                                                    <Edit2 size={12} />
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label="Hapus" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleDelete(row.original.id)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ),
                                        size: 80
                                    }
                                ]}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? 'Edit Overhead Cost' : 'Add Overhead Cost'}</DialogTitle>
                        <DialogDescription>Define indirect cost items calculation methodology.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Category</Label>
                                <Select value={category} onValueChange={(v) => setCategory(v as OverheadCategory)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(OVERHEAD_CATEGORY_LABELS).map(([key, val]) => (
                                            <SelectItem key={key} value={key}>
                                                {val}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Label</Label>
                                <Input placeholder="e.g. Pajak PPN" value={label} onChange={e => setLabel(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Calculation Method</Label>
                                <Select value={method} onValueChange={(v) => setMethod(v as CalculationMethod)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERCENTAGE">Percentage of Direct Cost</SelectItem>
                                        <SelectItem value="FIXED">Fixed Amount / Monthly</SelectItem>
                                        <SelectItem value="LUMP_SUM">Lump Sum Total</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {method === 'PERCENTAGE' ? (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Percentage (%)</Label>
                                    <Input type="number" step="0.1" value={percentage || ''} onChange={e => setPercentage(Number(e.target.value))} />
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Amount (Rp)</Label>
                                    <Input type="number" value={fixedAmount || ''} onChange={e => setFixedAmount(Number(e.target.value))} />
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Input placeholder="Description or calculation notes" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{isEdit ? 'Save Changes' : 'Add Item'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
