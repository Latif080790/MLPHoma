
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
import { useRiskStore } from "@/store/riskStore"
import { useTimelineStore } from "@/store/timelineStore"
import { RISK_CATEGORIES, RISK_STATUSES } from "@/types/risk"
import { toast } from "sonner"

const riskSchema = z.object({
    description: z.string().min(1, "Description is required"),
    category: z.string(),
    probability: z.coerce.number().min(1).max(5),
    impact: z.coerce.number().min(1).max(5),
    mitigation_plan: z.string().optional(),
    owner: z.string().optional(),
    wbs_id: z.string().optional(),
    status: z.string()
})

type RiskFormValues = z.infer<typeof riskSchema>

interface RiskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    riskToEdit?: any
}

export function RiskDialog({ open, onOpenChange, projectId, riskToEdit }: RiskDialogProps) {
    const { createRisk, updateRisk, loading } = useRiskStore()
    const getTasks = useTimelineStore((s) => s.getTasks)
    const tasks = projectId ? getTasks(projectId) : []

    useEffect(() => {
        if (open && projectId) {
            getTasks(projectId)
        }
    }, [open, projectId, getTasks])

    const form = useForm<RiskFormValues>({
        resolver: zodResolver(riskSchema),
        defaultValues: {
            description: "",
            category: "Technical",
            probability: 1,
            impact: 1,
            mitigation_plan: "",
            owner: "",
            status: "OPEN"
        }
    })

    useEffect(() => {
        if (riskToEdit) {
            form.reset({
                description: riskToEdit.description,
                category: riskToEdit.category,
                probability: riskToEdit.probability,
                impact: riskToEdit.impact,
                mitigation_plan: riskToEdit.mitigation_plan || "",
                owner: riskToEdit.owner || "",
                wbs_id: riskToEdit.wbs_id || undefined,
                status: riskToEdit.status
            })
        } else {
            form.reset({
                description: "",
                category: "Technical",
                probability: 3,
                impact: 3,
                mitigation_plan: "",
                owner: "",
                status: "OPEN"
            })
        }
    }, [riskToEdit, open, form])

    async function onSubmit(data: RiskFormValues) {
        try {
            if (riskToEdit) {
                await updateRisk(riskToEdit.id, data)
                toast.success("Risk updated")
            } else {
                await createRisk({
                    project_id: projectId,
                    ...data
                })
                toast.success("Risk created")
            }
            onOpenChange(false)
        } catch (err: any) {
            toast.error("Failed to save risk: " + err.message)
        }
    }

    // Helper for slider/select display
    const prob = form.watch("probability")
    const imp = form.watch("impact")
    const score = (prob || 0) * (imp || 0)

    let scoreColor = "bg-green-100 text-green-800"
    if (score >= 10) scoreColor = "bg-yellow-100 text-yellow-800"
    if (score >= 15) scoreColor = "bg-red-100 text-red-800"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{riskToEdit ? "Edit Risk" : "New Risk"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">

                    <div className="grid gap-2">
                        <Label>Risk Description</Label>
                        <Textarea {...form.register("description")} placeholder="What could go wrong?" />
                        {form.formState.errors.description && <p className="text-red-500 text-xs">{form.formState.errors.description.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select onValueChange={(val) => form.setValue("category", val)} value={form.watch("category")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RISK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Related Task (Optional)</Label>
                            <Select onValueChange={(val) => form.setValue("wbs_id", val === "none" ? undefined : val)} value={form.watch("wbs_id") || "none"}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Project Wide" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Project Wide</SelectItem>
                                    {(tasks || []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-neutral-50">
                        <div className="grid gap-2">
                            <Label>Probability (1-5)</Label>
                            <Input type="number" min={1} max={5} {...form.register("probability")} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Impact (1-5)</Label>
                            <Input type="number" min={1} max={5} {...form.register("impact")} />
                        </div>
                        <div className="col-span-2 flex justify-between items-center">
                            <span className="text-sm font-medium">Risk Score: {score}</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${scoreColor}`}>
                                {score >= 15 ? 'HIGH' : score >= 10 ? 'MEDIUM' : 'LOW'}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Mitigation Plan</Label>
                        <Textarea {...form.register("mitigation_plan")} placeholder="How will we prevent or handle this?" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Owner</Label>
                            <Input {...form.register("owner")} placeholder="Person responsible" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select onValueChange={(val) => form.setValue("status", val)} value={form.watch("status")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RISK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Risk"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
