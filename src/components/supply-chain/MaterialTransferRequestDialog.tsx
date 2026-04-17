import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useSupplyChainStore } from '@/store/supplyChainStore'
import { useAuthStore } from '@/store/authStore'

interface MaterialTransferRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onCreated?: () => void
}

export function MaterialTransferRequestDialog({ open, onOpenChange, projectId, onCreated }: MaterialTransferRequestDialogProps) {
  const { createMaterialTransfer, loading } = useSupplyChainStore()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)

  const [sourceWbsId, setSourceWbsId] = useState('')
  const [sourceWbsName, setSourceWbsName] = useState('')
  const [targetWbsId, setTargetWbsId] = useState('')
  const [targetWbsName, setTargetWbsName] = useState('')
  const [itemName, setItemName] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [reason, setReason] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)

  const resetForm = () => {
    setSourceWbsId('')
    setSourceWbsName('')
    setTargetWbsId('')
    setTargetWbsName('')
    setItemName('')
    setUnit('')
    setQuantity(1)
    setUnitCost(0)
    setReason('')
    setIsEmergency(false)
  }

  const handleSubmit = async () => {
    if (!projectId || !sourceWbsId || !targetWbsId || !itemName || quantity <= 0 || !reason.trim()) {
      toast.error('Please complete required fields')
      return
    }

    try {
      await createMaterialTransfer(
        {
          projectId,
          sourceWbsId,
          sourceWbsName,
          targetWbsId,
          targetWbsName,
          itemName,
          unit,
          quantity,
          unitCost,
          reason,
          isEmergency,
        },
        user?.id || 'unknown',
        profile?.full_name || user?.email || 'Unknown User'
      )

      toast.success('Material transfer request submitted')
      onOpenChange(false)
      onCreated?.()
      resetForm()
    } catch (error: unknown) {
      toast.error((error as Error)?.message || 'Failed to submit transfer request')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Create Material Transfer Request</DialogTitle>
          <DialogDescription>
            Request inter-WBS transfer. This request will enter approval workflow when submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sourceWbsId">Source WBS ID *</Label>
              <Input id="sourceWbsId" value={sourceWbsId} onChange={(e) => setSourceWbsId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetWbsId">Target WBS ID *</Label>
              <Input id="targetWbsId" value={targetWbsId} onChange={(e) => setTargetWbsId(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sourceWbsName">Source WBS Name</Label>
              <Input id="sourceWbsName" value={sourceWbsName} onChange={(e) => setSourceWbsName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetWbsName">Target WBS Name</Label>
              <Input id="targetWbsName" value={targetWbsName} onChange={(e) => setTargetWbsName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="itemName">Material Item *</Label>
              <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / m3 / unit" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" type="number" min={0.0001} step="any" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input id="unitCost" type="number" min={0} step="any" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="isEmergency" checked={isEmergency} onCheckedChange={(checked) => setIsEmergency(Boolean(checked))} />
            <Label htmlFor="isEmergency" className="font-normal">Emergency transfer (high-priority approval)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading.transfer}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
