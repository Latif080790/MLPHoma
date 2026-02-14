
import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { useAHSPStore } from '../../store/ahspStore'
import { Trash2, Edit2, Plus, MapPin } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'

export function ZoneManager() {
    const { zones, fetchZones, addZone, updateZone, deleteZone, loading } = useAHSPStore()
    const [isOpen, setIsOpen] = useState(false)
    const [editingZone, setEditingZone] = useState<{ id?: string, name: string, description: string } | null>(null)

    useEffect(() => {
        if (isOpen) {
            fetchZones()
        }
    }, [isOpen])

    const handleSave = () => {
        if (!editingZone) return
        if (!editingZone.name) return

        if (editingZone.id) {
            updateZone(editingZone.id, { name: editingZone.name, description: editingZone.description })
        } else {
            addZone({ name: editingZone.name, description: editingZone.description, isActive: true })
        }
        setEditingZone(null)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <MapPin className="mr-2 h-4 w-4" />
                    Manage Zones
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Pricing Zones</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setEditingZone({ name: '', description: '' })}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Zone
                        </Button>
                    </div>

                    {editingZone && (
                        <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Zone Name</Label>
                                    <Input
                                        value={editingZone.name}
                                        onChange={e => setEditingZone({ ...editingZone, name: e.target.value })}
                                        placeholder="e.g. Jakarta, Remote Site A"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Description</Label>
                                    <Input
                                        value={editingZone.description}
                                        onChange={e => setEditingZone({ ...editingZone, description: e.target.value })}
                                        placeholder="Optional details"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setEditingZone(null)}>Cancel</Button>
                                <Button size="sm" onClick={handleSave}>Save</Button>
                            </div>
                        </div>
                    )}

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Zone Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {zones.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                            No pricing zones defined.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    zones.map(zone => (
                                        <TableRow key={zone.id}>
                                            <TableCell className="font-medium">{zone.name}</TableCell>
                                            <TableCell>{zone.description}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingZone({ id: zone.id, name: zone.name, description: zone.description || '' })}>
                                                        <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteZone(zone.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
