/**
 * GRNDialog.tsx
 * Dialog for creating Goods Receipt Note (GRN) when materials arrive on-site.
 * Links to a PO and validates received quantities against ordered quantities.
 * Upon verification, cascades: auto-creates Invoice AP, updates RAP actual_cost, updates PO status.
 */

import React, { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PackageCheck, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { grnService } from "@/services/grnService"
import { toast } from "sonner"

// ---------- Schema ----------

const grnItemSchema = z.object({
    itemName: z.string().min(1, "Item name required"),
    orderedQty: z.coerce.number().min(0),
    receivedQty: z.coerce.number().min(0.001, "Qty must be > 0"),
    unit: z.string().min(1, "Unit required"),
    notes: z.string().optional(),
})

// G15 Fix: add superRefine to block receivedQty > orderedQty at form level
const grnSchema = z.object({
    poId: z.string().min(1, "Please select a PO"),
    receivedDate: z.string().min(1, "Date required"),
    deliveryNote: z.string().optional(),
    items: z.array(grnItemSchema).min(1, "At least one item required").superRefine((items, ctx) => {
        items.forEach((item, idx) => {
            if (item.orderedQty > 0 && item.receivedQty > item.orderedQty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.too_big,
                    maximum: item.orderedQty,
                    type: 'number',
                    inclusive: true,
                    message: `Qty diterima (${item.receivedQty}) melebihi qty dipesan (${item.orderedQty})`,
                    path: [idx, 'receivedQty'],
                })
            }
        })
    }),
})

type GrnFormValues = z.infer<typeof grnSchema>

// ---------- Component ----------

interface GRNDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export function GRNDialog({ open, onOpenChange, projectId }: GRNDialogProps) {
    const { purchaseOrders, fetchPoItems, activePoItems } = useSupplyChainStore()
    const [submitting, setSubmitting] = useState(false)

    const eligiblePOs = purchaseOrders.filter(
        po => po.status === 'APPROVED' || po.status === 'COMPLETED'
    )

    const form = useForm<GrnFormValues>({
        resolver: zodResolver(grnSchema),
        defaultValues: {
            poId: "",
            receivedDate: new Date().toISOString().split("T")[0],
            deliveryNote: "",
            items: [],
        },
    })

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const selectedPoId = form.watch("poId")

    // When PO changes, fetch PO items and pre-fill the GRN item list
    useEffect(() => {
        if (selectedPoId) {
            fetchPoItems(selectedPoId)
        }
    }, [selectedPoId, fetchPoItems])

    useEffect(() => {
        if (activePoItems.length > 0 && selectedPoId) {
            const newItems = activePoItems.map(item => ({
                itemName: item.itemName || item.rapItemName || "",
                orderedQty: Number(item.quantity) || 0,
                receivedQty: Number(item.quantity) || 0, // default to full qty
                unit: "unit",
                notes: "",
            }))
            replace(newItems)
        }
    }, [activePoItems, selectedPoId, replace])

    async function onSubmit(data: GrnFormValues) {
        setSubmitting(true)
        try {
            await grnService.createGRN(
                {
                    projectId,
                    poId: data.poId,
                    receivedDate: data.receivedDate,
                    notes: data.deliveryNote,
                    items: data.items.map(item => ({
                        itemName: item.itemName,
                        qtyOrdered: item.orderedQty,
                        qtyReceived: item.receivedQty,
                        unit: item.unit,
                        notes: item.notes,
                    })),
                },
                'current-user',
                'Current User'
            )
            toast.success("GRN created successfully", {
                description: "Goods receipt has been recorded. Verify via GRN tab to complete the cycle.",
            })
            onOpenChange(false)
            form.reset()
        } catch (err: unknown) {
            toast.error("Failed to create GRN", { description: (err as Error).message })
        } finally {
            setSubmitting(false)
        }
    }

    // Qty mismatch detection
    const watchedItems = form.watch("items")
    const hasMismatch = watchedItems?.some(
        item => item.receivedQty !== item.orderedQty && item.orderedQty > 0
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-emerald-600" />
                        Penerimaan Barang (GRN)
                    </DialogTitle>
                    <DialogDescription>
                        Catat material yang diterima di lapangan, lalu verifikasi untuk memproses ke Invoice & RAP.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
                    {/* PO Selector */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Purchase Order</Label>
                            <Select
                                value={form.watch("poId")}
                                onValueChange={(val) => form.setValue("poId", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih PO..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {eligiblePOs.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">
                                            Tidak ada PO yang eligible (APPROVED/ORDERED)
                                        </div>
                                    ) : (
                                        eligiblePOs.map(po => (
                                            <SelectItem key={po.id} value={po.id}>
                                                {po.poNumber} — {po.vendorName || 'No Vendor'} (Rp {po.totalAmount.toLocaleString('id-ID')})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.poId && (
                                <p className="text-xs text-red-500">{form.formState.errors.poId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Tanggal Terima</Label>
                            <Input
                                type="date"
                                {...form.register("receivedDate")}
                            />
                        </div>
                    </div>

                    {/* Delivery Note */}
                    <div className="space-y-2">
                        <Label>Surat Jalan / Delivery Note (Optional)</Label>
                        <Input
                            placeholder="No. surat jalan..."
                            {...form.register("deliveryNote")}
                        />
                    </div>

                    {/* Mismatch Warning */}
                    {hasMismatch && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            Qty diterima berbeda dengan Qty order. Pastikan sudah benar sebelum submit.
                        </div>
                    )}

                    {/* Items */}
                    {fields.length > 0 ? (
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Detail Item</Label>
                            <div className="rounded-lg border overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-500">
                                    <div className="col-span-4">Item</div>
                                    <div className="col-span-2 text-right">Ordered</div>
                                    <div className="col-span-2 text-right">Received</div>
                                    <div className="col-span-2">Unit</div>
                                    <div className="col-span-2">Notes</div>
                                </div>
                                {fields.map((field, idx) => {
                                    const ordered = watchedItems?.[idx]?.orderedQty ?? 0
                                    const received = watchedItems?.[idx]?.receivedQty ?? 0
                                    const match = received === ordered
                                    // G15 Fix: flag over-receive validation error
                                    const overReceived = ordered > 0 && received > ordered
                                    const itemError = form.formState.errors.items?.[idx]?.receivedQty
                                    return (
                                        <div
                                            key={field.id}
                                            className={`grid grid-cols-12 gap-2 px-3 py-2 border-t items-start ${
                                                overReceived ? 'bg-red-50/50 dark:bg-red-900/10' : !match ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                                            }`}
                                        >
                                            <div className="col-span-4 text-sm font-medium truncate pt-1.5">
                                                {field.itemName}
                                            </div>
                                            <div className="col-span-2 text-right text-sm text-slate-500 pt-1.5">
                                                {ordered}
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className={`h-8 text-sm text-right ${overReceived ? 'border-red-500' : !match ? 'border-amber-400' : ''}`}
                                                    {...form.register(`items.${idx}.receivedQty`, { valueAsNumber: true })}
                                                />
                                                {itemError && (
                                                    <p className="mt-0.5 text-xs text-red-600">{itemError.message}</p>
                                                )}
                                            </div>
                                            <div className="col-span-2 text-sm text-slate-500 pt-1.5">
                                                {field.unit}
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    placeholder="..."
                                                    className="h-8 text-xs"
                                                    {...form.register(`items.${idx}.notes`)}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : selectedPoId ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            Loading PO items...
                        </div>
                    ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            Pilih PO untuk menampilkan daftar item
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting || fields.length === 0}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            Simpan GRN
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
