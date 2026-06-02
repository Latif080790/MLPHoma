
import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { formatIDR } from '../../lib/utils'
import { AHSPItem, AhspZonePrice } from '../../types/ahsp'
import { useAHSPStore } from '../../store/ahspStore'

interface ZonePriceEditorProps {
    item: AHSPItem | null
    zoneId: string
    currentPrice?: AhspZonePrice
    open: boolean
    onClose: () => void
}

export function ZonePriceEditor({ item, zoneId, currentPrice, open, onClose }: ZonePriceEditorProps) {
    const { updateZonePrice } = useAHSPStore()

    const [formData, setFormData] = useState({
        price_material: 0,
        price_labor: 0,
        price_equipment: 0,
        price_subcon: 0,
        overheadPercentage: 0,
        profitPercentage: 0
    })

    // Load initial data
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (open && item) {
            if (currentPrice) {
                setFormData({
                    price_material: currentPrice.price_material,
                    price_labor: currentPrice.price_labor,
                    price_equipment: currentPrice.price_equipment,
                    price_subcon: currentPrice.price_subcon,
                    overheadPercentage: currentPrice.overheadPercentage,
                    profitPercentage: currentPrice.profitPercentage
                })
            } else {
                // Fallback to base item prices
                setFormData({
                    price_material: item.price_material || 0,
                    price_labor: item.price_labor || 0,
                    price_equipment: item.price_equipment || 0,
                    price_subcon: item.price_subcon || 0,
                    overheadPercentage: item.overheadPercentage || 0,
                    profitPercentage: item.profitPercentage || 0
                })
            }
        }
    }, [open, item, currentPrice])

    const handleChange = (field: string, val: string) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(val) || 0 }))
    }

    const handleSave = () => {
        if (!item) return
        updateZonePrice({
            zoneId,
            ahspId: item.id,
            ...formData,
            finalPrice
        })
        onClose()
    }

    const finalPrice = (
        formData.price_material +
        formData.price_labor +
        formData.price_equipment +
        formData.price_subcon
    ) * (1 + (formData.overheadPercentage + formData.profitPercentage) / 100)

    // Delta vs base item price
    const basePrice = item?.finalPrice ?? item?.basePrice ?? 0
    const deltaAbs = finalPrice - basePrice
    const deltaPct = basePrice > 0 ? (deltaAbs / basePrice) * 100 : 0
    const deltaPositive = deltaPct > 0

    if (!item) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ubah Harga Zona: {item.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">Timpa harga dasar khusus untuk zona ini.</p>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Cost Components */}
                    <div className="space-y-2 border p-3 rounded-md">
                        <h4 className="font-medium text-sm">Biaya Dasar</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Material</Label>
                                <Input
                                    type="number"
                                    value={formData.price_material}
                                    onChange={e => handleChange('price_material', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Labor</Label>
                                <Input
                                    type="number"
                                    value={formData.price_labor}
                                    onChange={e => handleChange('price_labor', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Equipment</Label>
                                <Input
                                    type="number"
                                    value={formData.price_equipment}
                                    onChange={e => handleChange('price_equipment', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Subcon</Label>
                                <Input
                                    type="number"
                                    value={formData.price_subcon}
                                    onChange={e => handleChange('price_subcon', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Markups */}
                    <div className="space-y-2 border p-3 rounded-md">
                        <h4 className="font-medium text-sm">Markup (%)</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Overhead %</Label>
                                <Input
                                    type="number"
                                    value={formData.overheadPercentage}
                                    onChange={e => handleChange('overheadPercentage', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Profit %</Label>
                                <Input
                                    type="number"
                                    value={formData.profitPercentage}
                                    onChange={e => handleChange('profitPercentage', e.target.value)}
                                    className="text-right h-8"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Summary with delta badge */}
                    <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">Harga Akhir Zona:</span>
                            {basePrice > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    Base: {formatIDR(basePrice)}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-lg">{formatIDR(finalPrice)}</span>
                            {basePrice > 0 && Math.abs(deltaPct) >= 0.01 && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold font-mono ${
                                    deltaPositive
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                }`}>
                                    {deltaPositive ? '+' : ''}{deltaPct.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSave}>Simpan Harga Zona</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
