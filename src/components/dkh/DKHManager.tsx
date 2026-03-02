/**
 * DKHManager.tsx
 * DKH (Daftar Kuantitas & Harga) - Resource/Material Price List Manager
 * Manages Materials, Labor, Equipment, and Subcontractor rates
 */

import React, { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Save, CloudUpload, Search, FileText, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
import { formatIDR } from '@/lib/utils'
import { toast } from 'sonner'
import { importDKHFromFile } from '@/lib/dkhParser'
import type { ParsedResource } from '@/lib/dkhParser'
import type { Resource, ResourceType, ResourceUnit } from '@/types/ahsp'

export function DKHManager() {
    const {
        resources,
        addResource,
        updateResource,
        deleteResource,
        importResources,
    } = useAHSPStore()

    const [showEditor, setShowEditor] = useState(false)
    const [editingResource, setEditingResource] = useState<Resource | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all')
    const [syncing, setSyncing] = useState(false)
    const [pendingDeleteResource, setPendingDeleteResource] = useState<Resource | null>(null)
    const [pendingImportResources, setPendingImportResources] = useState<ParsedResource[]>([])
    const [confirmImportOpen, setConfirmImportOpen] = useState(false)

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: 'material' as ResourceType,
        unit: 'm3' as ResourceUnit,
        unitPrice: 0,
        supplier: '',
        specifications: '',
    })

    // Filter resources
    const filteredResources = useMemo(() => {
        let filtered = resources.filter(r => r.isActive)

        if (selectedType !== 'all') {
            filtered = filtered.filter(r => r.type === selectedType)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(query) ||
                r.code.toLowerCase().includes(query) ||
                r.specifications?.toLowerCase().includes(query)
            )
        }

        return filtered
    }, [resources, selectedType, searchQuery])

    // Group by type for summary
    const summary = useMemo(() => {
        const counts = {
            material: 0,
            labor: 0,
            equipment: 0,
            subcontractor: 0,
            total: 0,
        }

        resources.forEach(r => {
            if (r.isActive) {
                counts[r.type]++
                counts.total++
            }
        })

        return counts
    }, [resources])

    const handleEdit = (resource: Resource) => {
        setEditingResource(resource)
        setFormData({
            code: resource.code,
            name: resource.name,
            type: resource.type,
            unit: resource.unit,
            unitPrice: resource.unitPrice,
            supplier: resource.supplier || '',
            specifications: resource.specifications || '',
        })
        setShowEditor(true)
    }

    const handleDelete = (resource: Resource) => {
        setPendingDeleteResource(resource)
    }

    const handleDeleteConfirm = () => {
        if (!pendingDeleteResource) return
        deleteResource(pendingDeleteResource.id)
        toast.success('Resource deleted successfully')
        setPendingDeleteResource(null)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.code || !formData.name) {
            toast.error('Code and name are required')
            return
        }

        if (editingResource) {
            updateResource(editingResource.id, formData)
            toast.success('Resource updated successfully')
        } else {
            addResource({
                ...formData,
                isActive: true,
            })
            toast.success('Resource added successfully')
        }

        setShowEditor(false)
        setEditingResource(null)
        setFormData({
            code: '',
            name: '',
            type: 'material',
            unit: 'm3',
            unitPrice: 0,
            supplier: '',
            specifications: '',
        })
    }

    const handleSyncToSupabase = async () => {
        setSyncing(true)
        try {
            // Get all current resources
            const currentResources = resources
            if (currentResources.length === 0) {
                toast.info('No resources to sync')
                return
            }

            // Import syncResources dynamically or use from a hook if we moved it to store
            // Since syncResources is exported from service, we can import it.
            // However, best practice is to expose it via store or import directly.
            // We'll import it at top of file. 
            // EDIT: better to move this logic to store? 
            // For now, importing service directly as per plan.
            const { syncResources } = await import('@/lib/supabaseSyncService')

            syncResources(currentResources)

            toast.success(`Sync queued for ${currentResources.length} resources`)
        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Failed to sync resources')
        } finally {
            setSyncing(false)
        }
    }

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string
                const data = JSON.parse(content)

                if (!Array.isArray(data)) {
                    throw new Error('Invalid file format')
                }

                const validResources = data.filter(item =>
                    item.code && item.name && item.type && item.unit && item.unitPrice
                )

                if (validResources.length !== data.length) {
                    toast.warning('Some items were skipped due to missing required fields')
                }

                importResources(validResources)
                toast.success(`Imported ${validResources.length} resources`)
            } catch {
                toast.error('Failed to import resources. Please check the file format.')
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    const handleImportDKH = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            toast.loading('Parsing DKH file...')
            const parsedResources = await importDKHFromFile(file)

            if (parsedResources.length === 0) {
                toast.error('No valid resources found in file')
                return
            }
            setPendingImportResources(parsedResources)
            setConfirmImportOpen(true)
        } catch (error) {
            console.error('DKH import error:', error)
            toast.error('Failed to import DKH file. Please check the file format.')
        }

        event.target.value = ''
    }

    const importSummary = useMemo(() => ({
        material: pendingImportResources.filter(r => r.type === 'material').length,
        labor: pendingImportResources.filter(r => r.type === 'labor').length,
        equipment: pendingImportResources.filter(r => r.type === 'equipment').length,
        subcontractor: pendingImportResources.filter(r => r.type === 'subcontractor').length,
    }), [pendingImportResources])

    const handleConfirmImport = () => {
        if (pendingImportResources.length === 0) return
        importResources(pendingImportResources)
        toast.success(`Successfully imported ${pendingImportResources.length} resources from DKH`)
        setConfirmImportOpen(false)
        setPendingImportResources([])
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">DKH - Daftar Kuantitas & Harga</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage material, labor, equipment, and subcontractor rates
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSyncToSupabase} disabled={syncing}>
                        <CloudUpload className="h-4 w-4 mr-2" />
                        {syncing ? 'Syncing...' : 'Sync to Supabase'}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <label className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2" />
                            Import DKH.txt
                            <input
                                type="file"
                                accept=".txt"
                                onChange={handleImportDKH}
                                className="hidden"
                            />
                        </label>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <label className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" />
                            Import JSON
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="hidden"
                            />
                        </label>
                    </Button>
                    <Button size="sm" onClick={() => {
                        setEditingResource(null)
                        setFormData({
                            code: '',
                            name: '',
                            type: 'material',
                            unit: 'm3',
                            unitPrice: 0,
                            supplier: '',
                            specifications: '',
                        })
                        setShowEditor(true)
                    }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Resource
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Material</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.material}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Labor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.labor}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Equipment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.equipment}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Subcontractor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.subcontractor}</div>
                    </CardContent>
                </Card>
                <Card className="bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{summary.total}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search resources..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={selectedType} onValueChange={(value: ResourceType | 'all') => setSelectedType(value)}>
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Resources Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead className="w-20">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResources.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No resources found. Add your first resource to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredResources.map((resource) => (
                                    <TableRow key={resource.id}>
                                        <TableCell className="font-mono text-sm">{resource.code}</TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{resource.name}</div>
                                                {resource.specifications && (
                                                    <div className="text-sm text-muted-foreground line-clamp-1">
                                                        {resource.specifications}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{resource.type}</Badge>
                                        </TableCell>
                                        <TableCell className="uppercase">{resource.unit}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {formatIDR(resource.unitPrice)}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {resource.supplier || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(resource)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(resource)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Editor Dialog */}
            <Dialog open={showEditor} onOpenChange={setShowEditor}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingResource ? 'Edit Resource' : 'Add New Resource'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Code *</Label>
                                <Input
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="e.g., M-001"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type *</Label>
                                <Select value={formData.type} onValueChange={(value: ResourceType) => setFormData({ ...formData, type: value })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="material">Material</SelectItem>
                                        <SelectItem value="labor">Labor</SelectItem>
                                        <SelectItem value="equipment">Equipment</SelectItem>
                                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Name *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter resource name"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Unit *</Label>
                                <Select value={formData.unit} onValueChange={(value: ResourceUnit) => setFormData({ ...formData, unit: value })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="m3">m³</SelectItem>
                                        <SelectItem value="m2">m²</SelectItem>
                                        <SelectItem value="m">m</SelectItem>
                                        <SelectItem value="kg">kg</SelectItem>
                                        <SelectItem value="ltr">ltr</SelectItem>
                                        <SelectItem value="bh">bh</SelectItem>
                                        <SelectItem value="oh">OH</SelectItem>
                                        <SelectItem value="jam">jam</SelectItem>
                                        <SelectItem value="hr">hr</SelectItem>
                                        <SelectItem value="hari">hari</SelectItem>
                                        <SelectItem value="unit">unit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Unit Price (Rp) *</Label>
                                <Input
                                    type="number"
                                    value={formData.unitPrice}
                                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Supplier</Label>
                                <Input
                                    value={formData.supplier}
                                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                    placeholder="Enter supplier name (optional)"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Specifications</Label>
                                <Input
                                    value={formData.specifications}
                                    onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                                    placeholder="Enter specifications (optional)"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowEditor(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                <Save className="h-4 w-4 mr-2" />
                                {editingResource ? 'Update' : 'Add'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!pendingDeleteResource} onOpenChange={(open) => { if (!open) setPendingDeleteResource(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete resource?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDeleteResource
                                ? `"${pendingDeleteResource.name}" will be removed from the DKH list.`
                                : 'This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Import parsed DKH resources?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {pendingImportResources.length} resources (Material: {importSummary.material}, Labor: {importSummary.labor}, Equipment: {importSummary.equipment}, Subcontractor: {importSummary.subcontractor}).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setPendingImportResources([]); toast.info('Import cancelled') }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmImport}>Import All</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
