
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { toast } from "sonner"

const transactionSchema = z.object({
    material_name: z.string().min(1, "Material name is required"),
    transaction_type: z.enum(["IN", "OUT", "TRANSFER", "RETURN"]),
    quantity: z.coerce.number().min(0.0001, "Quantity must be > 0"),
    unit: z.string().min(1, "Unit is required"),
    reference_doc: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

interface InventoryTransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    defaultType?: "IN" | "OUT"
}

export function InventoryTransactionDialog({ open, onOpenChange, projectId, defaultType = "IN" }: InventoryTransactionDialogProps) {
    const { recordTransaction, loading } = useSupplyChainStore()

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            material_name: "",
            transaction_type: defaultType,
            quantity: 0,
            unit: "",
            reference_doc: ""
        }
    })

    // Reset type when defaultType changes or dialog opens
    useEffect(() => {
        if (open) {
            form.reset({
                material_name: "",
                transaction_type: defaultType,
                quantity: 0,
                unit: "",
                reference_doc: ""
            })
        }
    }, [defaultType, open, form])


    async function onSubmit(data: TransactionFormValues) {
        try {
            await recordTransaction({
                project_id: projectId,
                ...data
            })
            toast.success(`Transaction ${data.transaction_type} recorded`)
            onOpenChange(false)
        } catch (err: any) {
            toast.error("Failed to record transaction: " + err.message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Inventory Transaction</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>Transaction Type</Label>
                        <Select
                            onValueChange={(val) => form.setValue("transaction_type", val as any)}
                            value={form.watch("transaction_type")}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="IN">Stock In (Receive)</SelectItem>
                                <SelectItem value="OUT">Stock Out (Use)</SelectItem>
                                <SelectItem value="TRANSFER">Transfer</SelectItem>
                                <SelectItem value="RETURN">Return</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Material Name</Label>
                        <Input {...form.register("material_name")} placeholder="e.g. Semen" />
                        {form.formState.errors.material_name && <p className="text-red-500 text-xs">{form.formState.errors.material_name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Quantity</Label>
                            <Input type="number" step="any" {...form.register("quantity")} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Unit</Label>
                            <Input {...form.register("unit")} placeholder="e.g. sak" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Reference Doc (Optional)</Label>
                        <Input {...form.register("reference_doc")} placeholder="PO Number or DO Number" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading.inventory}>
                            {loading.inventory ? "Recording..." : "Record Transaction"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
