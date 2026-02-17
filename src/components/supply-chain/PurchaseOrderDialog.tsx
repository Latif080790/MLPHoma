
import React, { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, Plus, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react"
import { useSupplyChainStore } from "@/store/supplyChainStore"
import { useRapStore } from "@/store/rapStore"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { checkBudgetAvailability, formatBudgetCheckMessage, BudgetCheckResult } from "@/services/budgetGuardService"

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
    const { items: rapItems, fetchItems } = useRapStore()
    const [budgetCheck, setBudgetCheck] = useState<BudgetCheckResult | null>(null)
    const [isCheckingBudget, setIsCheckingBudget] = useState(false) 

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

    // Fetch RAP items when dialog opens
    React.useEffect(() => {
        if (open && projectId) {
            fetchItems(projectId)
        }
    }, [open, projectId, fetchItems])

    // Real-time budget check on items change
    useEffect(() => {
        const checkBudget = async () => {
            if (!projectId || searchedItems.length === 0) {
                setBudgetCheck(null)
                return
            }

            setIsCheckingBudget(true)
            try {
                const checkableItems = searchedItems.map(item => ({
                    rapItemId: item.rap_item_id,
                    itemName: item.item_name || 'Unnamed Item',
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unit_price) || 0
                }))

                const result = await checkBudgetAvailability(projectId, checkableItems)
                setBudgetCheck(result)
            } catch (error: any) {
                console.error('Budget check failed:', error)
                setBudgetCheck(null)
            } finally {
                setIsCheckingBudget(false)
            }
        }

        // Debounce budget check
        const timer = setTimeout(() => {
            checkBudget()
        }, 500)

        return () => clearTimeout(timer)
    }, [searchedItems, projectId])

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
                    <DialogTitle className="flex items-center gap-2">
                        New Purchase Order
                        {budgetCheck && (
                            budgetCheck.hasExceeded ? (
                                <Badge variant="destructive" className="gap-1">
                                    <ShieldAlert className="h-3 w-3" />
                                    Budget Exceeded
                                </Badge>
                            ) : budgetCheck.requiresApproval ? (
                                <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                                    <AlertTriangle className="h-3 w-3" />
                                    Approval Required
                                </Badge>
                            ) : budgetCheck.items.length > 0 ? (
                                <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Within Budget
                                </Badge>
                            ) : null
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* BUDGET GUARD FEEDBACK */}
                {budgetCheck && budgetCheck.items.length > 0 && (
                    <Alert variant={budgetCheck.hasExceeded ? "destructive" : budgetCheck.requiresApproval ? "default" : "default"}
                        className={budgetCheck.hasExceeded ? "" : budgetCheck.requiresApproval ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"}>
                        {budgetCheck.hasExceeded ? (
                            <ShieldAlert className="h-4 w-4" />
                        ) : budgetCheck.requiresApproval ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        <AlertDescription className="text-sm">
                            {formatBudgetCheckMessage(budgetCheck)}
                        </AlertDescription>
                    </Alert>
                )}

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
                        <Button 
                            type="submit" 
                            disabled={loading.po || isCheckingBudget || (budgetCheck?.hasExceeded ?? false)}
                            className={budgetCheck?.requiresApproval ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                        >
                            {loading.po ? "Creating..." : isCheckingBudget ? "Checking Budget..." : budgetCheck?.requiresApproval ? "Create PO (Approval Required)" : "Create PO"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
