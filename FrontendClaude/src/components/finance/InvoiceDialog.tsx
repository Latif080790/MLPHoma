/**
 * InvoiceDialog.tsx
 * Dialog form for creating/editing AP invoices.
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
import { Invoice } from "@/types/finance"

const invoiceSchema = z.object({
  vendor_name: z.string().min(1, "Vendor name required"),
  invoice_number: z.string().min(1, "Invoice number required"),
  description: z.string().optional(),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  tax_amount: z.coerce.number().min(0),
  due_date: z.string().min(1, "Due date required"),
  po_id: z.string().optional()
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

interface InvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoiceToEdit?: Invoice | null
}

export function InvoiceDialog({ open, onOpenChange, projectId, invoiceToEdit }: InvoiceDialogProps) {
  const { createInvoice, loading } = useFinanceStore()

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      vendor_name: invoiceToEdit?.vendor_name || "",
      invoice_number: invoiceToEdit?.invoice_number || "",
      description: invoiceToEdit?.description || "",
      amount: invoiceToEdit?.amount || 0,
      tax_amount: invoiceToEdit?.tax_amount || 0,
      due_date: invoiceToEdit?.due_date?.substring(0, 10) || "",
      po_id: invoiceToEdit?.po_id || ""
    }
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        vendor_name: invoiceToEdit?.vendor_name || "",
        invoice_number: invoiceToEdit?.invoice_number || "",
        description: invoiceToEdit?.description || "",
        amount: invoiceToEdit?.amount || 0,
        tax_amount: invoiceToEdit?.tax_amount || 0,
        due_date: invoiceToEdit?.due_date?.substring(0, 10) || "",
        po_id: invoiceToEdit?.po_id || ""
      })
    }
  }, [open, invoiceToEdit, form])

  async function onSubmit(data: InvoiceFormValues) {
    try {
      const total_amount = data.amount + data.tax_amount
      await createInvoice({
        project_id: projectId,
        vendor_name: data.vendor_name,
        invoice_number: data.invoice_number,
        description: data.description,
        amount: data.amount,
        tax_amount: data.tax_amount,
        total_amount,
        due_date: data.due_date,
        po_id: data.po_id || undefined,
        status: 'UNPAID'
      })
      onOpenChange(false)
    } catch { /* handled by store */ }
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchAmount = form.watch("amount") || 0
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchTax = form.watch("tax_amount") || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{invoiceToEdit ? "Edit Invoice" : "Record Invoice"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Vendor Name *</Label>
              <Input {...form.register("vendor_name")} placeholder="PT Supplier ABC" />
              {form.formState.errors.vendor_name && <p className="text-red-500 text-xs">{form.formState.errors.vendor_name.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Invoice Number *</Label>
              <Input {...form.register("invoice_number")} placeholder="INV-2025-001" />
              {form.formState.errors.invoice_number && <p className="text-red-500 text-xs">{form.formState.errors.invoice_number.message}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea {...form.register("description")} placeholder="Material batu split 1-2 cm" rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Amount (Rp) *</Label>
              <Input type="number" step="1" {...form.register("amount")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Tax / PPN (Rp)</Label>
              <Input type="number" step="1" {...form.register("tax_amount")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Total</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-semibold">
                Rp {(watchAmount + watchTax).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Due Date *</Label>
              <Input type="date" {...form.register("due_date")} />
              {form.formState.errors.due_date && <p className="text-red-500 text-xs">{form.formState.errors.due_date.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>PO Reference</Label>
              <Input {...form.register("po_id")} placeholder="PO ID (optional)" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Invoice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
