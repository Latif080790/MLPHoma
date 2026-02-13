
import React, { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../ui/dialog"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Trash2, Plus } from "lucide-react"
import { useSupplyChainStore } from "../../store/supplyChainStore"
import { useRapStore } from "../../store/rapStore"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"

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

    const watchedItems = form.watch("items")
    const totalEstimated = watchedItems?.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Purchase Order</DialogTitle>
                </DialogHeader>

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
