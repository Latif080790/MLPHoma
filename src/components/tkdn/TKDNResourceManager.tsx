/**
 * TKDNResourceManager.tsx
 * Full TKDN (Tingkat Komponen Dalam Negeri) module.
 *
 * Features:
 * - Summary dashboard with TKDN percentage gauge
 * - Category breakdown cards
 * - Item table with CRUD
 * - Filter by category/origin
 * - Export capability
 */

import React, { useEffect, useState, useMemo } from 'react'
import { Flag, Plus, Pencil, Trash2, Download, Filter, Search, CheckCircle2, XCircle, Package, Users, Wrench, Briefcase } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjectStore } from '@/store/projectStore'
import { useTKDNStore } from '@/store/tkdnStore'
import { TKDNItemDialog } from './TKDNItemDialog'
import type { TKDNItem, TKDNCategory, ResourceOrigin } from '@/types/tkdn'

const CATEGORY_LABELS: Record<TKDNCategory, string> = {
  material: 'Material',
  labor: 'Tenaga Kerja',
  equipment: 'Peralatan',
  service: 'Jasa',
}

const CATEGORY_ICONS: Record<TKDNCategory, React.ReactNode> = {
  material: <Package size={16} />,
  labor: <Users size={16} />,
  equipment: <Wrench size={16} />,
  service: <Briefcase size={16} />,
}

function formatRp(value: number) {
  return 'Rp ' + value.toLocaleString('id-ID')
}

function pct(value: number) {
  return value.toFixed(1) + '%'
}

/** Gauge-like ring that shows TKDN percentage */
function TKDNGauge({ percentage, target, size = 160 }: { percentage: number; target: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(percentage, 100) / 100
  const offset = circumference * (1 - progress)
  const meetsTarget = percentage >= target

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          className="text-neutral-200 dark:text-neutral-700" strokeWidth={10} />
        {/* Progress ring */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={meetsTarget ? '#10b981' : '#f59e0b'}
          strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out" />
        {/* Target marker */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={meetsTarget ? '#10b981' : '#ef4444'}
          strokeWidth={2} strokeDasharray={`${(target / 100) * circumference} ${circumference}`}
          opacity={0.4} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">{pct(percentage)}</span>
        <span className="text-xs text-neutral-500">TKDN</span>
      </div>
    </div>
  )
}

export function TKDNResourceManager() {
  const { activeProjectId } = useProjectStore()
  const { items, summary, loading, targetPercentage, fetchItems, addItem, updateItem, removeItem, setTargetPercentage } = useTKDNStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<TKDNItem | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<TKDNCategory | 'all'>('all')
  const [filterOrigin, setFilterOrigin] = useState<ResourceOrigin | 'all'>('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeProjectId) fetchItems(activeProjectId)
  }, [activeProjectId])

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(i =>
        i.name.toLowerCase().includes(lower) ||
        (i.supplier?.toLowerCase().includes(lower)) ||
        (i.hs_code?.toLowerCase().includes(lower))
      )
    }
    if (filterCategory !== 'all') {
      result = result.filter(i => i.category === filterCategory)
    }
    if (filterOrigin !== 'all') {
      result = result.filter(i => i.origin === filterOrigin)
    }
    return result
  }, [items, search, filterCategory, filterOrigin])

  if (!activeProjectId) {
    return <EmptyState title="Pilih Proyek" description="Pilih proyek terlebih dahulu untuk mengelola TKDN." />
  }

  const handleAdd = () => {
    setEditItem(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: TKDNItem) => {
    setEditItem(item)
    setDialogOpen(true)
  }

  const handleSubmit = async (data: any) => {
    setSaving(true)
    try {
      if (editItem) {
        await updateItem(editItem.id, data)
      } else {
        await addItem({ ...data, project_id: activeProjectId })
      }
      setDialogOpen(false)
      setEditItem(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Hapus item ini?')) {
      await removeItem(id)
    }
  }

  const handleExportCSV = () => {
    if (items.length === 0) return
    const headers = ['Nama', 'Kategori', 'Asal', 'Satuan', 'Volume', 'Harga Satuan', 'Total', 'Supplier', 'Negara Asal', 'HS Code']
    const rows = items.map(i => [
      i.name, CATEGORY_LABELS[i.category], i.origin === 'domestic' ? 'Dalam Negeri' : 'Impor',
      i.unit, i.quantity, i.unit_price, i.total_value,
      i.supplier || '', i.country_of_origin || '', i.hs_code || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TKDN_${activeProjectId}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<Flag size={18} />}
        title="TKDN Management"
        description="Tingkat Komponen Dalam Negeri — Kelola & hitung persentase konten lokal proyek."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV} disabled={items.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button size="sm" className="gap-2" onClick={handleAdd}>
              <Plus size={16} /> Tambah Item
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Data Item ({items.length})</TabsTrigger>
        </TabsList>

        {/* ========== DASHBOARD TAB ========== */}
        <TabsContent value="dashboard" className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-neutral-500">Memuat data TKDN...</div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Belum Ada Data TKDN"
              description="Tambahkan item material, tenaga kerja, peralatan, atau jasa untuk mulai menghitung TKDN."
              actions={
                <Button className="gap-2" onClick={handleAdd}>
                  <Plus size={16} /> Tambah Item Pertama
                </Button>
              }
            />
          ) : summary ? (
            <>
              {/* Top row: Gauge + Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="flex flex-col items-center justify-center p-6">
                  <TKDNGauge percentage={summary.tkdn_percentage} target={summary.target_percentage} />
                  <div className="mt-3 flex items-center gap-2">
                    {summary.meets_target ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                        <CheckCircle2 size={14} /> Memenuhi Target ({pct(summary.target_percentage)})
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                        <XCircle size={14} /> Belum Memenuhi Target ({pct(summary.target_percentage)})
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    Target:{' '}
                    <input
                      type="number"
                      min={0} max={100}
                      value={targetPercentage}
                      onChange={(e) => setTargetPercentage(Number(e.target.value))}
                      className="w-14 rounded border bg-transparent px-1 py-0.5 text-center text-xs"
                    />%
                  </div>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-500">Nilai Dalam Negeri</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{formatRp(summary.total_domestic)}</div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {items.filter(i => i.origin === 'domestic').length} item domestik
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-500">Nilai Impor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{formatRp(summary.total_imported)}</div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {items.filter(i => i.origin === 'imported').length} item impor
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Category breakdown */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summary.by_category.map(cat => (
                  <Card key={cat.category} className="relative overflow-hidden">
                    <div className="absolute inset-x-0 bottom-0 h-1"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${cat.tkdn_percentage}%, #f59e0b ${cat.tkdn_percentage}%)`,
                      }}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="rounded-md bg-neutral-100 p-1.5 dark:bg-neutral-800">
                          {CATEGORY_ICONS[cat.category]}
                        </div>
                        <span className="text-sm font-medium">{CATEGORY_LABELS[cat.category]}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{cat.item_count} item</Badge>
                      </div>
                      <div className="text-lg font-semibold">{pct(cat.tkdn_percentage)}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        DN: {formatRp(cat.domestic_value)} | Impor: {formatRp(cat.imported_value)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ========== ITEMS TAB ========== */}
        <TabsContent value="items" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Cari nama, supplier, HS code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
              <SelectTrigger className="w-[150px]"><Filter size={14} className="mr-1" /><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterOrigin} onValueChange={(v) => setFilterOrigin(v as any)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Asal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Asal</SelectItem>
                <SelectItem value="domestic">Dalam Negeri</SelectItem>
                <SelectItem value="imported">Impor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item Table */}
          {filteredItems.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'Belum Ada Item' : 'Tidak Ada Hasil'}
              description={items.length === 0 ? 'Tambahkan item TKDN pertama Anda.' : 'Coba ubah filter pencarian.'}
              actions={items.length === 0 ? (
                <Button className="gap-2" onClick={handleAdd}><Plus size={16} /> Tambah Item</Button>
              ) : undefined}
            />
          ) : (
            <div className="rounded-lg border bg-white dark:bg-neutral-900 dark:border-neutral-800 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Asal</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Harga Satuan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-[80px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.name}
                        {item.hs_code && <span className="block text-xs text-neutral-400">HS: {item.hs_code}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 text-xs">
                          {CATEGORY_ICONS[item.category]}
                          {CATEGORY_LABELS[item.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={item.origin === 'domestic'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }>
                          {item.origin === 'domestic' ? 'DN' : 'Impor'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString('id-ID')} {item.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRp(item.unit_price)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatRp(item.total_value)}</TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {item.supplier || '-'}
                        {item.country_of_origin && <span className="block">{item.country_of_origin}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(item.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <TKDNItemDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null) }}
        onSubmit={handleSubmit}
        editItem={editItem}
        loading={saving}
      />
    </div>
  )
}

export default TKDNResourceManager
