
import React, { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { useChangeOrderStore } from "@/store/changeOrderStore"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"

const itemSchema = z.object({
    item_description: z.string().min(1, "Description is required"),
    volume_delta: z.coerce.number(),
    unit_price: z.coerce.number().min(0),
    target_wbs_id: z.string().optional()
})

const coSchema = z.object({
    title: z.string().min(1, "Title is required"),
    vo_number: z.string().min(1, "VO Number is required"),
    description: z.string().optional(),
    schedule_impact_days: z.coerce.number(),
    items: z.array(itemSchema).optional()
})

type CoFormValues = z.infer<typeof coSchema>

interface ChangeOrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export function ChangeOrderDialog({ open, onOpenChange, projectId }: ChangeOrderDialogProps) {
    const { createOrder, loading } = useChangeOrderStore()

    const form = useForm<CoFormValues>({
        resolver: zodResolver(coSchema),
        defaultValues: {
            title: "",
            vo_number: "",
            description: "",
            schedule_impact_days: 0,
            items: [{ item_description: "", volume_delta: 0, unit_price: 0 }]
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    })

    // Auto-generate VO number on open (mock)
    useEffect(() => {
        if (open) {
            form.reset({
                title: "",
                vo_number: `VO-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                description: "",
                schedule_impact_days: 0,
                items: [{ item_description: "", volume_delta: 0, unit_price: 0 }]
            })
        }
    }, [open, form])

    async function onSubmit(data: CoFormValues) {
        try {
            // Calculate total cost impact
            const items = data.items || []
            const cost_impact = items.reduce((sum, item) => sum + (item.volume_delta * item.unit_price), 0)

            await createOrder({
                project_id: projectId,
                title: data.title,
                vo_number: data.vo_number,
                description: data.description,
                schedule_impact_days: data.schedule_impact_days,
                cost_impact: cost_impact,
                status: 'DRAFT'
            }, items.map(i => ({
                ...i,
                total_delta: i.volume_delta * i.unit_price
            })))

            toast.success("Change Order created")
            onOpenChange(false)
        } catch (err: unknown) {
            toast.error("Failed to create CO: " + (err as Error).message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Change Order (VO)</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>VO Number</Label>
                            <Input {...form.register("vo_number")} />
                            {form.formState.errors.vo_number && <p className="text-red-500 text-xs">{form.formState.errors.vo_number.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Title</Label>
                            <Input {...form.register("title")} placeholder="e.g. Design Change L1" />
                            {form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Description & Justification</Label>
                        <Textarea {...form.register("description")} placeholder="Why is this change needed?" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Schedule Impact (Days)</Label>
                        <Input type="number" {...form.register("schedule_impact_days")} placeholder="0 if no delay" />
                        <p className="text-xs text-neutral-500">Positive value means delay (extension of time).</p>
                    </div>

                    <div className="space-y-2 border p-3 rounded-md bg-neutral-50">
                        <div className="flex justify-between items-center mb-2">
                            <Label>Cost Items Impact</Label>
                            <Button type="button" size="sm" variant="outline" onClick={() => append({ item_description: "", volume_delta: 0, unit_price: 0 })}>
                                <Plus size={14} /> Add Item
                            </Button>
                        </div>

                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-end mb-2">
                                <div className="col-span-5">
                                    <Label className="text-xs">Description</Label>
                                    <Input {...form.register(`items.${index}.item_description`)} placeholder="Item name" />
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-xs">Vol Delta</Label>
                                    <Input type="number" step="any" {...form.register(`items.${index}.volume_delta`)} />
                                </div>
                                <div className="col-span-3">
                                    <Label className="text-xs">Unit Price</Label>
                                    <Input type="number" step="any" {...form.register(`items.${index}.unit_price`)} />
                                </div>
                                <div className="col-span-1">
                                    <Label className="text-xs">Total</Label>
                                    <div className="text-xs py-2 font-mono">
                                        {/* Calculated purely for display in real-time if we forced re-render, but simple placeholder for now */}
                                        -
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <Button type="button" size="icon" variant="ghost" className="text-red-500" onClick={() => remove(index)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Draft"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
