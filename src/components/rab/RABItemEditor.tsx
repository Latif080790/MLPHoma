/**
 * src/components/rab/RABItemEditor.tsx
 *
 * Standalone editor for a single RAB item.
 * Allows editing name, unit, volume, and unit price with save/cancel actions.
 * Currently a placeholder — inline editing lives in RABTable.
 */

import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import type { RABItem } from '../../types/rab'

interface RABItemEditorProps {
  item: RABItem
  onSave: (updates: Partial<RABItem>) => void
  onCancel: () => void
}

export default function RABItemEditor({ item, onSave, onCancel }: RABItemEditorProps) {
  const [name, setName] = useState(item.name || item.item_name || '')
  const [unit, setUnit] = useState(item.unit || '')
  const [volume, setVolume] = useState(String(item.volume || 0))
  const [unitPrice, setUnitPrice] = useState(String(item.unit_price ?? item.unitPrice ?? 0))

  const handleSave = () => {
    const vol = parseFloat(volume) || 0
    const price = parseFloat(unitPrice) || 0
    const total = vol * price
    onSave({
      name,
      item_name: name,
      unit,
      volume: vol,
      unit_price: price,
      unitPrice: price,
      finalTotal: total,
      final_total: total,
      finalPrice: total,
    })
  }

  return (
    <div className="rounded-md border p-4 bg-white shadow-sm space-y-3">
      <div className="font-medium text-sm">Edit RAB Item</div>

      <div className="space-y-2">
        <label className="text-xs text-neutral-500">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Unit</label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Volume</label>
          <Input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Unit Price</label>
          <Input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
}