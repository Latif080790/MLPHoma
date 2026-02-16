
import React, { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus } from "lucide-react"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { useRapStore } from "@/store/rapStore"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const poItemSchema = z.object({
    rap_item_id: z.string().optional(),
    item_name: z.string().min(1, "Item name required"),
    quantity: z.coerce.number().min(0.0001),
    unit_price: z.coerce.number().min(0),
})

const poSchema = z.object({
    po_number: z.string().min(1, "PO Number required"),
    vendor_name: z.string().optional(),
    items: z.array(poItemSchema).min(1, "At least one item required")
})

type PoFormValues = z.infer<typeof poSchema>

interface PurchaseOrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export function PurchaseOrderDialog({ open, onOpenChange, projectId }: PurchaseOrderDialogProps) {
    const { createPurchaseOrder, loading } = useSupplyChainStore()
    // In a real app, we would load RAP items to link against budget
    // const { rapItems } = useRapStore() 

    const form = useForm<PoFormValues>({
        resolver: zodResolver(poSchema),
        defaultValues: {
            po_number: `PO-${new Date().getTime().toString().slice(-6)}`,
            vendor_name: "",
            items: [{ item_name: "", quantity: 1, unit_price: 0 }]
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    })

    async function onSubmit(data: PoFormValues) {
        try {
            const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

            await createPurchaseOrder({
                project_id: projectId,
                po_number: data.po_number,
                vendor_name: data.vendor_name,
                total_amount: totalAmount,
                status: 'DRAFT',
                created_by: 'current-user-id'
            }, data.items)

            toast.success("Purchase Order created")
            onOpenChange(false)
            form.reset()
        } catch (err: any) {
            toast.error("Failed to create PO: " + err.message)
        }
    }

    const searchedItems = form.watch("items")
    const totalEstimated = searchedItems?.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0

    // BUDGET CALCULATION LOGIC
    const { items: rapItems, fetchItems } = useRapStore()

    React.useEffect(() => {
        if (open && projectId) {
            fetchItems(projectId)
        }
    }, [open, projectId])

    const totalProjectBudget = rapItems.reduce((sum, item) => sum + (item.total_budget || 0), 0)
    const totalCommitted = rapItems.reduce((sum, item) => sum + (item.committed_cost || 0), 0)
    const utilizationPercent = totalProjectBudget > 0
        ? ((totalCommitted + totalEstimated) / totalProjectBudget) * 100
        : 0

    const isOverBudget = utilizationPercent > 100

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Purchase Order</DialogTitle>
                </DialogHeader>

                {/* BUDGET VISUALIZATION */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border my-2">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-500">Budget Utilization (Real-time)</span>
                        <span className={`font-bold ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                            {utilizationPercent.toFixed(1)}% {isOverBudget && '(OVER BUDGET)'}
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
                        <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${Math.min((totalCommitted / totalProjectBudget) * 100, 100)}%` }}
                        />
                        <div
                            className={`${isOverBudget ? 'bg-red-500' : 'bg-amber-400'} h-full transition-all duration-300`}
                            style={{ width: `${Math.min((totalEstimated / totalProjectBudget) * 100, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>Committed: Rp {totalCommitted.toLocaleString()}</span>
                        <span>Total Budget: Rp {totalProjectBudget.toLocaleString()}</span>
                    </div>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>PO Number</Label>
                            <Input {...form.register("po_number")} />
                            {form.formState.errors.po_number && <p className="text-red-500 text-xs">{form.formState.errors.po_number.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Vendor Name</Label>
                            <Input {...form.register("vendor_name")} placeholder="Supplier PT..." />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Order Items</Label>
                            <Button type="button" size="sm" variant="outline" onClick={() => append({ item_name: "", quantity: 1, unit_price: 0 })}>
                                <Plus size={14} className="mr-2" /> Add Item
                            </Button>
                        </div>

                        <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-4">
                                        <Label className="text-xs">Item Name</Label>
                                        <Input {...form.register(`items.${index}.item_name`)} placeholder="Item description" />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">Qty</Label>
                                        <Input type="number" step="any" {...form.register(`items.${index}.quantity`)} />
                                    </div>
                                    <div className="col-span-3">
                                        <Label className="text-xs">Unit Price</Label>
                                        <Input type="number" step="any" {...form.register(`items.${index}.unit_price`)} />
                                    </div>
                                    <div className="col-span-2 text-right text-xs font-mono py-2.5">
                                        {(Number(form.watch(`items.${index}.quantity`) || 0) * Number(form.watch(`items.${index}.unit_price`) || 0)).toLocaleString()}
                                    </div>
                                    <div className="col-span-1">
                                        <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end items-center gap-4 pt-2 border-t">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="text-xl font-bold">Rp {totalEstimated.toLocaleString()}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading.po}>
                            {loading.po ? "Creating..." : "Create PO"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
