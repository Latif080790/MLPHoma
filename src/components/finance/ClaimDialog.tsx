/**
 * ClaimDialog.tsx
 * Dialog form for creating AR claims (progress billings).
 */

import React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useFinanceStore } from "@/store/financeStore"
import { ClientClaim } from "@/types/finance"

const claimSchema = z.object({
  claim_number: z.string().min(1, "Claim number required"),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  progress_percentage: z.coerce.number().min(0).max(100),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  notes: z.string().optional()
})

type ClaimFormValues = z.infer<typeof claimSchema>

interface ClaimDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  claimToEdit?: ClientClaim | null
}

export function ClaimDialog({ open, onOpenChange, projectId, claimToEdit }: ClaimDialogProps) {
  const { createClaim, loading } = useFinanceStore()

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      claim_number: "",
      period_start: "",
      period_end: "",
      progress_percentage: 0,
      amount: 0,
      notes: ""
    }
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        claim_number: claimToEdit?.claim_number || "",
        period_start: claimToEdit?.period_start?.substring(0, 10) || "",
        period_end: claimToEdit?.period_end?.substring(0, 10) || "",
        progress_percentage: claimToEdit?.progress_percentage || 0,
        amount: claimToEdit?.amount || 0,
        notes: claimToEdit?.notes || ""
      })
    }
  }, [open, claimToEdit, form])

  async function onSubmit(data: ClaimFormValues) {
    try {
      await createClaim({
        project_id: projectId,
        claim_number: data.claim_number,
        period_start: data.period_start || undefined,
        period_end: data.period_end || undefined,
        progress_percentage: data.progress_percentage,
        amount: data.amount,
        notes: data.notes,
        status: 'DRAFT'
      })
      onOpenChange(false)
    } catch { /* handled by store */ }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{claimToEdit ? "Edit Claim" : "Create Claim"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Claim Number *</Label>
              <Input {...form.register("claim_number")} placeholder="MC-001" />
              {form.formState.errors.claim_number && <p className="text-red-500 text-xs">{form.formState.errors.claim_number.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Progress %</Label>
              <Input type="number" step="0.1" {...form.register("progress_percentage")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Period Start</Label>
              <Input type="date" {...form.register("period_start")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Period End</Label>
              <Input type="date" {...form.register("period_end")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Amount (Rp) *</Label>
            <Input type="number" step="1" {...form.register("amount")} />
            {form.formState.errors.amount && <p className="text-red-500 text-xs">{form.formState.errors.amount.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} placeholder="Description of works completed" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Claim"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
