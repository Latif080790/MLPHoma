import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAHSPStore } from '@/store/ahspStore'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'

function clampPct(v: number): number {
  return Math.min(100, Math.max(0, isNaN(v) ? 0 : v))
}

export function AHSPSettings() {
  const { settings, updateSettings } = useAHSPStore()
  const [confirmApplyAllOpen, setConfirmApplyAllOpen] = useState(false)
  const [formData, setFormData] = useState({
    overhead: settings.defaultOverhead,
    profit: settings.defaultProfit,
    tax: settings.taxRate ?? 0,
  })

  useEffect(() => {
    setFormData({
      overhead: settings.defaultOverhead,
      profit: settings.defaultProfit,
      tax: settings.taxRate ?? 0,
    })
  }, [settings])

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: clampPct(parseFloat(value)) }))
  }

  const handleSave = () => {
    updateSettings({
      defaultOverhead: formData.overhead,
      defaultProfit: formData.profit,
      taxRate: formData.tax,
    })
    toast.success('Pengaturan AHSP berhasil disimpan')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Parameter Kalkulasi AHSP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Nilai default ini digunakan saat membuat item AHSP baru. Gunakan &quot;Terapkan ke Semua&quot; untuk memperbarui semua item yang sudah ada. Semua nilai dalam rentang 0–100%.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="overhead" className="text-sm">Overhead Default (%)</Label>
              <Input
                id="overhead"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.overhead}
                onChange={(e) => handleChange('overhead', e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">Biaya tidak langsung: administrasi, asuransi, risiko proyek.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profit" className="text-sm">Profit Default (%)</Label>
              <Input
                id="profit"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.profit}
                onChange={(e) => handleChange('profit', e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">Keuntungan kontraktor di atas harga dasar + overhead.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax" className="text-sm">PPN (%)</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.tax}
                onChange={(e) => handleChange('tax', e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">Pajak Pertambahan Nilai — umumnya 11% per regulasi perpajakan saat ini.</p>
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Rumus harga final:</strong> Harga Dasar × (1 + Overhead%) × (1 + Profit%)
            {formData.tax > 0 && <> × (1 + PPN%)</>}
          </div>

          <div className="flex justify-between pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmApplyAllOpen(true)}>
              Terapkan ke Semua Item
            </Button>
            <Button size="sm" onClick={handleSave}>
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmApplyAllOpen} onOpenChange={setConfirmApplyAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terapkan pengaturan ke semua item AHSP?</AlertDialogTitle>
            <AlertDialogDescription>
              Overhead ({formData.overhead}%) dan Profit ({formData.profit}%) akan ditimpa pada semua item AHSP yang ada.
              Harga final akan dihitung ulang. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              useAHSPStore.getState().applySettingsToAll()
              toast.success('Pengaturan diterapkan ke semua item AHSP')
              setConfirmApplyAllOpen(false)
            }}>
              Terapkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
