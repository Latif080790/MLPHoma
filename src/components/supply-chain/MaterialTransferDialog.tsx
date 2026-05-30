/**
 * MaterialTransferDialog.tsx
 * Dialog for requesting material transfer between WBS/site locations.
 * Integrates with approval workflow for non-emergency transfers.
 * Emergency transfers bypass approval but trigger PM notification.
 */

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRightLeft, AlertTriangle, Loader2, CheckCircle2, Zap } from "lucide-react"
import { materialTransferService } from "@/services/materialTransferService"
import { useAuthStore } from "@/store/authStore"
import { toast } from "sonner"

// ---------- Schema ----------

const transferSchemaBase = z.object({
    sourceWbsId: z.string().min(1, "Source WBS required"),
    sourceWbsName: z.string().min(1, "Source WBS name required"),
    targetWbsId: z.string().min(1, "Target WBS required"),
    targetWbsName: z.string().min(1, "Target WBS name required"),
    materialName: z.string().min(1, "Material name required"),
    quantity: z.coerce.number().min(0.001, "Quantity > 0"),
    unit: z.string().min(1, "Unit required"),
    reason: z.string().min(3, "Alasan transfer diperlukan"),
    isEmergency: z.boolean(),
})

const _transferSchema = transferSchemaBase.refine(data => data.sourceWbsId !== data.targetWbsId, {
    message: "Source and Target WBS must be different",
    path: ["targetWbsId"],
})

type TransferFormValues = z.infer<typeof transferSchemaBase>

// ---------- WBS options (would be loaded from store in production) ----------

interface WbsOption {
    id: string
    name: string
}

// ---------- Component ----------

interface MaterialTransferDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    wbsOptions?: WbsOption[]
}

export function MaterialTransferDialog({
    open,
    onOpenChange,
    projectId,
    wbsOptions = [],
}: MaterialTransferDialogProps) {
    const [submitting, setSubmitting] = useState(false)

    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchemaBase),
        defaultValues: {
            sourceWbsId: "",
            sourceWbsName: "",
            targetWbsId: "",
            targetWbsName: "",
            materialName: "",
            quantity: 0,
            unit: "",
            reason: "",
            isEmergency: false,
        },
    })

    const isEmergency = form.watch("isEmergency")

    // Handle WBS selection and auto-fill name
    const handleWbsSelect = (field: "sourceWbsId" | "targetWbsId", value: string) => {
        form.setValue(field, value)
        const wbs = wbsOptions.find(w => w.id === value)
        const nameField = field === "sourceWbsId" ? "sourceWbsName" : "targetWbsName"
        form.setValue(nameField, wbs?.name || value)
    }

    async function onSubmit(data: TransferFormValues) {
        setSubmitting(true)
        try {
            const user = useAuthStore.getState().user
            const profile = useAuthStore.getState().profile
            const requesterId = user?.id || 'unknown'
            const requesterName = profile?.full_name || user?.email || 'Unknown User'

            await materialTransferService.createTransfer(
                {
                    projectId,
                    sourceWbsId: data.sourceWbsId,
                    sourceWbsName: data.sourceWbsName,
                    targetWbsId: data.targetWbsId,
                    targetWbsName: data.targetWbsName,
                    itemName: data.materialName,
                    quantity: data.quantity,
                    unit: data.unit,
                    reason: data.reason,
                    isEmergency: data.isEmergency ?? false,
                },
                requesterId,
                requesterName
            )

            if (data.isEmergency) {
                toast.success("Emergency Transfer Created", {
                    description: "Transfer darurat telah dibuat dan PM telah diberitahu.",
                })
            } else {
                toast.success("Transfer Request Submitted", {
                    description: "Menunggu persetujuan PM sebelum eksekusi.",
                })
            }

            onOpenChange(false)
            form.reset()
        } catch (err: unknown) {
            toast.error("Failed to create transfer", { description: (err as Error).message })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                        Transfer Material Antar WBS
                    </DialogTitle>
                    <DialogDescription>
                        Pindahkan material dari satu lokasi kerja ke lokasi lain. Transfer non-darurat memerlukan approval PM.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
                    {/* Source & Target WBS */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Dari WBS (Source)</Label>
                            {wbsOptions.length > 0 ? (
                                <Select
                                    value={form.watch("sourceWbsId")}
                                    onValueChange={(val) => handleWbsSelect("sourceWbsId", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih WBS asal..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {wbsOptions.map(wbs => (
                                            <SelectItem key={wbs.id} value={wbs.id}>{wbs.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <>
                                    <Input
                                        placeholder="WBS ID..."
                                        {...form.register("sourceWbsId")}
                                    />
                                    <Input
                                        placeholder="Nama WBS..."
                                        className="mt-1"
                                        {...form.register("sourceWbsName")}
                                    />
                                </>
                            )}
                            {form.formState.errors.sourceWbsId && (
                                <p className="text-xs text-red-500">{form.formState.errors.sourceWbsId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Ke WBS (Target)</Label>
                            {wbsOptions.length > 0 ? (
                                <Select
                                    value={form.watch("targetWbsId")}
                                    onValueChange={(val) => handleWbsSelect("targetWbsId", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih WBS tujuan..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {wbsOptions.map(wbs => (
                                            <SelectItem key={wbs.id} value={wbs.id}>{wbs.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <>
                                    <Input
                                        placeholder="WBS ID..."
                                        {...form.register("targetWbsId")}
                                    />
                                    <Input
                                        placeholder="Nama WBS..."
                                        className="mt-1"
                                        {...form.register("targetWbsName")}
                                    />
                                </>
                            )}
                            {form.formState.errors.targetWbsId && (
                                <p className="text-xs text-red-500">{form.formState.errors.targetWbsId.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Flow direction indicator */}
                    <div className="flex items-center justify-center gap-3 py-2">
                        <Badge variant="secondary" className="text-xs">
                            {form.watch("sourceWbsName") || "Source"}
                        </Badge>
                        <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                        <Badge variant="secondary" className="text-xs">
                            {form.watch("targetWbsName") || "Target"}
                        </Badge>
                    </div>

                    {/* Material & Quantity */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Nama Material</Label>
                            <Input
                                placeholder="Semen, Pasir, Besi..."
                                {...form.register("materialName")}
                            />
                            {form.formState.errors.materialName && (
                                <p className="text-xs text-red-500">{form.formState.errors.materialName.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                step="0.01"
                                {...form.register("quantity", { valueAsNumber: true })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <Input
                                placeholder="kg, m3, sak..."
                                {...form.register("unit")}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label>Alasan Transfer</Label>
                        <Textarea
                            placeholder="Kebutuhan mendesak di WBS target, stock surplus di WBS source..."
                            rows={3}
                            {...form.register("reason")}
                        />
                        {form.formState.errors.reason && (
                            <p className="text-xs text-red-500">{form.formState.errors.reason.message}</p>
                        )}
                    </div>

                    {/* Emergency Toggle */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${isEmergency
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-muted/30'
                        }`}>
                        <div className="flex items-center gap-3">
                            {isEmergency ? (
                                <Zap className="h-5 w-5 text-red-500" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                                <div className="text-sm font-medium">
                                    {isEmergency ? "Mode Darurat Aktif" : "Transfer Normal"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {isEmergency
                                        ? "Bypass approval — PM akan langsung diberitahu"
                                        : "Memerlukan persetujuan PM sebelum eksekusi"
                                    }
                                </div>
                            </div>
                        </div>
                        <Switch
                            checked={isEmergency}
                            onCheckedChange={(checked) => form.setValue("isEmergency", checked)}
                        />
                    </div>

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
                            disabled={submitting}
                            className={`gap-2 ${isEmergency
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-primary hover:bg-primary/90'
                                }`}
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isEmergency ? (
                                <Zap className="h-4 w-4" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {isEmergency ? "Transfer Darurat" : "Submit Request"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
