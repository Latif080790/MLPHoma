/**
 * DKHManager.tsx
 * DKH (Daftar Kuantitas & Harga) — manajer daftar harga resource
 */
import React, { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Search, FileText, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAHSPStore } from '@/store/ahspStore'
import { formatIDR } from '@/lib/utils'
import { toast } from 'sonner'
import { importDKHFromFile } from '@/lib/dkhParser'
import type { ParsedResource } from '@/lib/dkhParser'
import type { Resource, ResourceType, ResourceUnit } from '@/types/ahsp'
import { SyncStatusBadge } from '@/components/ahsp/SyncStatusBadge'
import { exportResourcesToXLSX } from '@/lib/ahspExport'

const TYPE_LABELS: Record<ResourceType, string> = {
  material: 'Material',
  labor: 'Tenaga Kerja',
  equipment: 'Peralatan',
  subcontractor: 'Subkontraktor',
}

const EMPTY_FORM = {
  code: '',
  name: '',
  type: 'material' as ResourceType,
  unit: 'm3' as ResourceUnit,
  unitPrice: 0,
  supplier: '',
  specifications: '',
}

export function DKHManager() {
  const { resources, addResource, updateResource, deleteResource, importResources, exportResources, bulkUpdatePrices } = useAHSPStore()

  const [showEditor, setShowEditor] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all')
  const [pendingDeleteResource, setPendingDeleteResource] = useState<Resource | null>(null)
  const [pendingImportResources, setPendingImportResources] = useState<ParsedResource[]>([])
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [bulkType, setBulkType] = useState<ResourceType | 'all'>('material')
  const [bulkPercentage, setBulkPercentage] = useState<number>(0)
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false)

  const filteredResources = useMemo(() => {
    let list = resources.filter(r => r.isActive)
    if (selectedType !== 'all') list = list.filter(r => r.type === selectedType)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.specifications?.toLowerCase().includes(q)
      )
    }
    return list
  }, [resources, selectedType, searchQuery])

  const summary = useMemo(() => {
    const counts = { material: 0, labor: 0, equipment: 0, subcontractor: 0, total: 0 }
    resources.forEach(r => { if (r.isActive) { counts[r.type]++; counts.total++ } })
    return counts
  }, [resources])

  const importSummary = useMemo(() => ({
    material: pendingImportResources.filter(r => r.type === 'material').length,
    labor: pendingImportResources.filter(r => r.type === 'labor').length,
    equipment: pendingImportResources.filter(r => r.type === 'equipment').length,
    subcontractor: pendingImportResources.filter(r => r.type === 'subcontractor').length,
  }), [pendingImportResources])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code || !formData.name) { toast.error('Kode dan nama resource wajib diisi'); return }
    if (editingResource) {
      updateResource(editingResource.id, formData)
      toast.success('Resource berhasil diperbarui')
    } else {
      addResource({ ...formData, isActive: true })
      toast.success('Resource berhasil ditambahkan')
    }
    setShowEditor(false)
    setEditingResource(null)
    setFormData(EMPTY_FORM)
  }

  const handleDeleteConfirm = () => {
    if (!pendingDeleteResource) return
    deleteResource(pendingDeleteResource.id)
    toast.success('Resource berhasil dihapus')
    setPendingDeleteResource(null)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!Array.isArray(data)) throw new Error('Format file tidak valid')
        const valid = data.filter((item: Record<string, unknown>) => item.code && item.name && item.type && item.unit && item.unitPrice !== undefined)
        if (valid.length !== data.length) toast.warning('Beberapa item dilewati karena field wajib tidak lengkap')
        importResources(valid)
        toast.success(`Berhasil mengimpor ${valid.length} resource`)
      } catch { toast.error('Gagal mengimpor file. Periksa format file JSON.') }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleImportDKH = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      toast.loading('Memproses file DKH...')
      const parsed = await importDKHFromFile(file)
      if (parsed.length === 0) { toast.error('Tidak ada resource valid dalam file'); return }
      setPendingImportResources(parsed)
      setConfirmImportOpen(true)
    } catch { toast.error('Gagal memproses file DKH. Periksa format file.') }
    event.target.value = ''
  }

  const handleConfirmImport = () => {
    if (!pendingImportResources.length) return
    importResources(pendingImportResources)
    toast.success(`Berhasil mengimpor ${pendingImportResources.length} resource dari DKH`)
    setConfirmImportOpen(false)
    setPendingImportResources([])
  }

  const handleExportXLSX = () => {
    try {
      exportResourcesToXLSX(filteredResources)
      toast.success(`Berhasil mengekspor ${filteredResources.length} resource ke Excel`)
    } catch (err) { toast.error((err as Error).message) }
  }

  const handleExportJSON = () => {
    const data = exportResources()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DKH_Resources_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Berhasil mengekspor ${data.length} resource`)
  }

  const handleBulkUpdate = () => {
    const types: ResourceType[] = bulkType === 'all'
      ? ['material', 'labor', 'equipment', 'subcontractor']
      : [bulkType as ResourceType]
    types.forEach(t => bulkUpdatePrices(t, bulkPercentage))
    const sign = bulkPercentage > 0 ? '+' : ''
    toast.success(`Harga ${bulkType === 'all' ? 'semua resource' : TYPE_LABELS[bulkType as ResourceType]} diperbarui ${sign}${bulkPercentage}%`)
    setConfirmBulkOpen(false)
    setBulkPercentage(0)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">DKH — Daftar Kuantitas & Harga</h2>
          <p className="text-xs text-muted-foreground">Kelola daftar harga material, tenaga kerja, peralatan, dan subkontraktor</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider>
            <SyncStatusBadge />
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={filteredResources.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Ekspor XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={resources.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Ekspor JSON
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <FileText className="h-4 w-4 mr-1.5" />Impor DKH.txt
              <input type="file" accept=".txt" onChange={handleImportDKH} className="hidden" />
            </label>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1.5" />Impor JSON
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </Button>
          <Button size="sm" onClick={() => { setEditingResource(null); setFormData(EMPTY_FORM); setShowEditor(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />Tambah Resource
          </Button>
        </div>
      </div>

      {/* Summary Cards — clickable type filter */}
      <div className="grid gap-3 grid-cols-5">
        {(Object.entries(TYPE_LABELS) as [ResourceType, string][]).map(([type, label]) => (
          <Card
            key={type}
            className={`cursor-pointer transition-colors ${selectedType === type ? 'ring-2 ring-orange-400' : ''}`}
            onClick={() => setSelectedType(prev => prev === type ? 'all' : type)}
          >
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold">{summary[type]}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-primary">Total</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className="text-xl font-bold text-primary">{summary.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-8 text-sm"
          />
        </div>
        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ResourceType | 'all')}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            {(Object.entries(TYPE_LABELS) as [ResourceType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredResources.length} resource</span>
      </div>

      {/* Resources Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Belum ada resource. Tambah resource pertama untuk memulai.
                  </TableCell>
                </TableRow>
              ) : filteredResources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-mono text-sm">{resource.code}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{resource.name}</div>
                    {resource.specifications && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{resource.specifications}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[resource.type]}</Badge>
                  </TableCell>
                  <TableCell className="uppercase text-sm">{resource.unit}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-sm">
                    {formatIDR(resource.unitPrice)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{resource.supplier || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(resource)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPendingDeleteResource(resource)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Price Update */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">Pembaruan Harga Massal</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Naikkan atau turunkan harga satuan resource secara persentase. Harga AHSP yang menggunakan resource ini akan dihitung ulang otomatis.
          </p>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Tipe Resource</Label>
              <Select value={bulkType} onValueChange={(v) => setBulkType(v as ResourceType | 'all')}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  {(Object.entries(TYPE_LABELS) as [ResourceType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Persentase (%)</Label>
              <Input
                type="number"
                value={bulkPercentage || ''}
                onChange={(e) => setBulkPercentage(parseFloat(e.target.value) || 0)}
                placeholder="mis. 5 atau -3"
                className="h-8 text-xs w-36"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={bulkPercentage === 0}
              onClick={() => {
                if (bulkPercentage === 0) { toast.warning('Masukkan persentase perubahan'); return }
                setConfirmBulkOpen(true)
              }}
            >
              Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Edit Resource' : 'Tambah Resource Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kode *</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="mis. M-001" required />
              </div>
              <div className="space-y-2">
                <Label>Tipe *</Label>
                <Select value={formData.type} onValueChange={(v: ResourceType) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TYPE_LABELS) as [ResourceType, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Nama *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Masukkan nama resource" required />
              </div>
              <div className="space-y-2">
                <Label>Satuan *</Label>
                <Select value={formData.unit} onValueChange={(v: ResourceUnit) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['m3','m2','m','kg','ltr','bh','oh','jam','hr','hari','unit','ha','set','ls','btg','lembar'] as ResourceUnit[]).map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Harga Satuan (Rp) *</Label>
                <Input type="number" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0" min="0" step="0.01" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Supplier</Label>
                <Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} placeholder="Nama supplier (opsional)" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Spesifikasi</Label>
                <Input value={formData.specifications} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} placeholder="Spesifikasi teknis (opsional)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>Batal</Button>
              <Button type="submit">{editingResource ? 'Simpan' : 'Tambah'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!pendingDeleteResource} onOpenChange={(open) => { if (!open) setPendingDeleteResource(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus resource?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteResource ? `"${pendingDeleteResource.name}" akan dihapus dari daftar DKH. Tindakan ini tidak dapat dibatalkan.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import DKH confirm */}
      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impor resource dari DKH?</AlertDialogTitle>
            <AlertDialogDescription>
              Ditemukan {pendingImportResources.length} resource — Material: {importSummary.material}, Tenaga Kerja: {importSummary.labor}, Peralatan: {importSummary.equipment}, Subkontraktor: {importSummary.subcontractor}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingImportResources([]); toast.info('Impor dibatalkan') }}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Impor Semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk update confirm */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi pembaruan harga massal?</AlertDialogTitle>
            <AlertDialogDescription>
              Harga satuan {bulkType === 'all' ? 'semua resource' : TYPE_LABELS[bulkType as ResourceType]} akan diubah sebesar{' '}
              <strong>{bulkPercentage > 0 ? '+' : ''}{bulkPercentage}%</strong>.
              Harga AHSP yang menggunakan resource ini akan dihitung ulang otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkUpdate}>Terapkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
