
import React, { useEffect, useState } from "react"
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
import { useProjectStore } from "@/store/projectStore"
import { useTimelineStore } from "@/store/timelineStore"
import { toast } from "sonner"

const mrSchema = z.object({
    wbs_id: z.string().optional(),
    item_name: z.string().min(1, "Item name is required"),
    unit: z.string().min(1, "Unit is required"),
    quantity_requested: z.coerce.number().min(0.0001, "Quantity must be > 0"),
    date_required: z.string().optional(),
    notes: z.string().optional(),
})

type MrFormValues = z.infer<typeof mrSchema>

interface MaterialRequestDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export function MaterialRequestDialog({ open, onOpenChange, projectId }: MaterialRequestDialogProps) {
    const { createMaterialRequest, loading } = useSupplyChainStore()
    const { tasks } = useTimelineStore() // get tasks for WBS dropdown
    const { getTasks } = useTimelineStore()

    // Ensure tasks are loaded
    useEffect(() => {
        if (open && projectId) {
            getTasks(projectId)
        }
    }, [open, projectId, getTasks])

    const form = useForm<MrFormValues>({
        resolver: zodResolver(mrSchema),
        defaultValues: {
            item_name: "",
            unit: "pcs",
            quantity_requested: 0,
            notes: ""
        }
    })

    async function onSubmit(data: MrFormValues) {
        try {
            await createMaterialRequest({
                project_id: projectId,
                ...data,
                status: 'PENDING',
                requested_by: 'current-user-id' // Replace with actual auth user
            })
            toast.success("Material Request created")
            onOpenChange(false)
            form.reset()
        } catch (err: any) {
            toast.error("Failed to create request: " + err.message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>New Material Request</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>WBS Task (Optional)</Label>
                        <Select
                            onValueChange={(val) => form.setValue("wbs_id", val)}
                            value={form.watch("wbs_id")}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.code ? `[${t.code}] ` : ''}{t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Item Name</Label>
                        <Input {...form.register("item_name")} placeholder="e.g. Semen Portland" />
                        {form.formState.errors.item_name && (
                            <p className="text-sm text-red-500">{form.formState.errors.item_name.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Quantity</Label>
                            <Input type="number" step="any" {...form.register("quantity_requested")} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Unit</Label>
                            <Input {...form.register("unit")} placeholder="e.g. sak, m3" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Date Required</Label>
                        <Input type="date" {...form.register("date_required")} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea {...form.register("notes")} placeholder="Specific brand, delivery instructions..." />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading.mr}>
                            {loading.mr ? "Creating..." : "Create Request"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
