
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
import { useTimelineStore } from "@/store/timelineStore"
import { toast } from "sonner"
import { smartMRService, type MaterialSuggestion } from "@/services/smartMRService"
import { Loader2, Sparkles, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
    const getTasks = useTimelineStore(s => s.getTasks)
    const tasks = getTasks(projectId)

    // Smart MR: auto-suggestions from AHSP
    const [suggestions, setSuggestions] = useState<MaterialSuggestion[]>([])
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    const form = useForm<MrFormValues>({
        resolver: zodResolver(mrSchema),
        defaultValues: {
            item_name: "",
            unit: "pcs",
            quantity_requested: 0,
            notes: ""
        }
    })

    // eslint-disable-next-line react-hooks/incompatible-library
    const selectedWbsId = form.watch("wbs_id")

    // Fetch Smart MR suggestions when WBS changes
    useEffect(() => {
        if (!selectedWbsId || !projectId) {
            setSuggestions([])
            return
        }

        let cancelled = false
        setLoadingSuggestions(true)

        smartMRService.getSuggestionsForWBS(projectId, selectedWbsId)
            .then((data) => {
                if (!cancelled) setSuggestions(data)
            })
            .catch(() => {
                if (!cancelled) setSuggestions([])
            })
            .finally(() => {
                if (!cancelled) setLoadingSuggestions(false)
            })

        return () => { cancelled = true }
    }, [selectedWbsId, projectId])

    function applySuggestion(s: MaterialSuggestion) {
        form.setValue("item_name", s.resourceName)
        form.setValue("unit", s.unit)
        form.setValue("quantity_requested", Math.round(s.netDemand * 100) / 100)
        toast.info(`Applied: ${s.resourceName}`, { description: `${s.netDemand} ${s.unit} (net demand)` })
    }

    async function onSubmit(data: MrFormValues) {
        try {
            await createMaterialRequest({
                projectId,
                ...data,
                status: 'PENDING',
                requestedBy: 'current-user-id' // Replace with actual auth user
            })
            toast.success("Material Request created")
            onOpenChange(false)
            form.reset()
            setSuggestions([])
        } catch (err: unknown) {
            toast.error("Failed to create request: " + (err as Error).message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSuggestions([]); form.reset() } }}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Material Request</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>WBS Task (Optional)</Label>
                        <Select
                            onValueChange={(val) => form.setValue("wbs_id", val)}
                            // eslint-disable-next-line react-hooks/incompatible-library
                            value={form.watch("wbs_id")}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.wbsCode ? `[${t.wbsCode}] ` : ''}{t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Smart MR Suggestions Panel */}
                    {selectedWbsId && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                <span>Smart Suggestions (from AHSP)</span>
                                {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                            {!loadingSuggestions && suggestions.length === 0 && (
                                <p className="text-xs text-muted-foreground">No material suggestions for this WBS item.</p>
                            )}
                            {suggestions.length > 0 && (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {suggestions.map((s, i) => (
                                        <div
                                            key={s.resourceId || i}
                                            className="flex items-center justify-between gap-2 rounded-md bg-background p-2 text-xs border hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{s.resourceName}</div>
                                                <div className="text-muted-foreground">
                                                    Need: <span className="font-mono">{s.netDemand.toFixed(2)}</span> {s.unit}
                                                    {s.currentStock > 0 && (
                                                        <Badge variant="outline" className="ml-1 text-xs">
                                                            Stock: {s.currentStock.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs shrink-0"
                                                onClick={() => applySuggestion(s)}
                                            >
                                                Apply <ArrowRight className="ml-1 h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

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
