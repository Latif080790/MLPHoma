/**
 * TKDNItemDialog.tsx
 * Dialog for creating/editing a TKDN item.
 */

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TKDNItem } from '@/types/tkdn'

const tkdnItemSchema = z.object({
  name: z.string().min(1, 'Nama item wajib diisi'),
  category: z.enum(['material', 'labor', 'equipment', 'service']),
  origin: z.enum(['domestic', 'imported']),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  quantity: z.coerce.number().positive('Harus > 0'),
  unit_price: z.coerce.number().nonnegative('Harus >= 0'),
  supplier: z.string().optional(),
  country_of_origin: z.string().optional(),
  hs_code: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof tkdnItemSchema>

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormData) => void
  editItem?: TKDNItem | null
  loading?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  material: 'Material',
  labor: 'Tenaga Kerja',
  equipment: 'Peralatan',
  service: 'Jasa',
}

export function TKDNItemDialog({ open, onClose, onSubmit, editItem, loading }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(tkdnItemSchema),
    defaultValues: {
      name: '',
      category: 'material',
      origin: 'domestic',
      unit: '',
      quantity: 0,
      unit_price: 0,
      supplier: '',
      country_of_origin: 'Indonesia',
      hs_code: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (editItem) {
      form.reset({
        name: editItem.name,
        category: editItem.category,
        origin: editItem.origin,
        unit: editItem.unit,
        quantity: editItem.quantity,
        unit_price: editItem.unit_price,
        supplier: editItem.supplier || '',
        country_of_origin: editItem.country_of_origin || '',
        hs_code: editItem.hs_code || '',
        notes: editItem.notes || '',
      })
    } else {
      form.reset({
        name: '',
        category: 'material',
        origin: 'domestic',
        unit: '',
        quantity: 0,
        unit_price: 0,
        supplier: '',
        country_of_origin: 'Indonesia',
        hs_code: '',
        notes: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItem, open])

  const watchQty = form.watch('quantity')
  const watchPrice = form.watch('unit_price')
  const totalValue = (watchQty || 0) * (watchPrice || 0)

  const handleSubmit = (data: FormData) => {
    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Item TKDN' : 'Tambah Item TKDN'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label>Nama Item *</Label>
            <Input placeholder="e.g. Semen Portland" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Category + Origin row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kategori *</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(v) => form.setValue('category', v as 'material' | 'labor' | 'equipment' | 'service')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Asal *</Label>
              <Select
                value={form.watch('origin')}
                onValueChange={(v) => form.setValue('origin', v as 'domestic' | 'imported')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestic">Dalam Negeri</SelectItem>
                  <SelectItem value="imported">Impor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity + Unit + Price */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Volume *</Label>
              <Input type="number" step="any" {...form.register('quantity')} />
              {form.formState.errors.quantity && (
                <p className="text-xs text-red-500">{form.formState.errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Satuan *</Label>
              <Input placeholder="kg, m³, ls" {...form.register('unit')} />
            </div>
            <div className="space-y-1">
              <Label>Harga Satuan (Rp)</Label>
              <Input type="number" step="any" {...form.register('unit_price')} />
            </div>
          </div>

          {/* Total preview */}
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-3 text-sm">
            <span className="text-neutral-500">Total Nilai:</span>{' '}
            <span className="font-semibold">Rp {totalValue.toLocaleString('id-ID')}</span>
          </div>

          {/* Supplier + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Input placeholder="Nama vendor" {...form.register('supplier')} />
            </div>
            <div className="space-y-1">
              <Label>Negara Asal</Label>
              <Input placeholder="Indonesia" {...form.register('country_of_origin')} />
            </div>
          </div>

          {/* HS Code */}
          <div className="space-y-1">
            <Label>HS Code</Label>
            <Input placeholder="2523.29.00" {...form.register('hs_code')} />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Catatan</Label>
            <Textarea placeholder="Optional notes..." {...form.register('notes')} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
