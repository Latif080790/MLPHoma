import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAHSPStore } from '@/store/ahspStore'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'

export function AHSPSettings() {
    const { settings, updateSettings } = useAHSPStore()
    const [confirmApplyAllOpen, setConfirmApplyAllOpen] = useState(false)
    const [formData, setFormData] = useState({
        overhead: settings.defaultOverhead,
        profit: settings.defaultProfit,
        tax: settings.taxRate || 0
    })

    // Sync with store on load
    useEffect(() => {
        setFormData({
            overhead: settings.defaultOverhead,
            profit: settings.defaultProfit,
            tax: settings.taxRate || 0
        })
    }, [settings])

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }))
    }

    const handleSave = () => {
        updateSettings({
            defaultOverhead: formData.overhead,
            defaultProfit: formData.profit,
            taxRate: formData.tax
        })
        toast.success('Settings saved successfully')
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle>AHSP Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <p className="text-muted-foreground">Configure default values and calculation parameters for AHSP.</p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="overhead">Default Overhead (%)</Label>
                        <Input
                            id="overhead"
                            type="number"
                            value={formData.overhead}
                            onChange={(e) => handleChange('overhead', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="profit">Default Profit (%)</Label>
                        <Input
                            id="profit"
                            type="number"
                            value={formData.profit}
                            onChange={(e) => handleChange('profit', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tax">Tax Rate (PPN) (%)</Label>
                        <Input
                            id="tax"
                            type="number"
                            value={formData.tax}
                            onChange={(e) => handleChange('tax', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setConfirmApplyAllOpen(true)}>
                        Apply to All Items
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </div>

                <AlertDialog open={confirmApplyAllOpen} onOpenChange={setConfirmApplyAllOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Apply settings to all AHSP items?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will overwrite overhead and profit percentages on all existing AHSP items.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                useAHSPStore.getState().applySettingsToAll()
                                toast.success('Settings applied to all items')
                                setConfirmApplyAllOpen(false)
                            }}>
                                Apply
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}
