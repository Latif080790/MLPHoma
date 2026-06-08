import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useAHSPStore } from '@/store/ahspStore'
import { formatIDR } from '@/lib/utils'

const COST_COLORS = {
  material: '#F97316',
  labor: '#22D3EE',
  equipment: '#3B82F6',
  subcon: '#A855F7',
}

const RESOURCE_COLORS = ['#F97316', '#22D3EE', '#3B82F6', '#A855F7', '#EC4899']

const STATUS_COLORS: Record<string, string> = {
  'Draft': '#94A3B8',
  'Review': '#F59E0B',
  'Disetujui': '#22C55E',
  'Diarsipkan': '#6B7280',
}

export function BenchmarkingDashboard() {
  const { ahspItems, resources } = useAHSPStore()

  const kpis = useMemo(() => {
    const active = ahspItems.filter(i => i.isActive)
    const avgPrice = active.length > 0 ? active.reduce((s, i) => s + i.finalPrice, 0) / active.length : 0
    return {
      totalItems: ahspItems.length,
      activeItems: active.length,
      avgFinalPrice: avgPrice,
      totalCategories: new Set(ahspItems.map(i => i.category)).size,
      totalResources: resources.filter(r => r.isActive).length,
      approvedItems: ahspItems.filter(i => i.status === 'approved').length,
    }
  }, [ahspItems, resources])

  const avgPriceByCategoryData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    ahspItems.forEach(item => {
      if (!map[item.category]) map[item.category] = { total: 0, count: 0 }
      map[item.category].total += item.finalPrice
      map[item.category].count++
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, avgPrice: v.count > 0 ? Math.round(v.total / v.count) : 0 }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 10)
  }, [ahspItems])

  const costBreakdownData = useMemo(() => {
    const map: Record<string, { material: number; labor: number; equipment: number; subcon: number; count: number }> = {}
    ahspItems.forEach(item => {
      if (!map[item.category]) map[item.category] = { material: 0, labor: 0, equipment: 0, subcon: 0, count: 0 }
      map[item.category].material += item.price_material ?? 0
      map[item.category].labor += item.price_labor ?? 0
      map[item.category].equipment += item.price_equipment ?? 0
      map[item.category].subcon += item.price_subcon ?? 0
      map[item.category].count++
    })
    return Object.entries(map)
      .map(([name, v]) => ({
        name: name.length > 22 ? name.slice(0, 22) + '…' : name,
        material: v.count > 0 ? Math.round(v.material / v.count) : 0,
        labor: v.count > 0 ? Math.round(v.labor / v.count) : 0,
        equipment: v.count > 0 ? Math.round(v.equipment / v.count) : 0,
        subcon: v.count > 0 ? Math.round(v.subcon / v.count) : 0,
      }))
      .sort((a, b) => (b.material + b.labor + b.equipment + b.subcon) - (a.material + a.labor + a.equipment + a.subcon))
      .slice(0, 10)
  }, [ahspItems])

  const top10Items = useMemo(() => {
    return [...ahspItems]
      .sort((a, b) => b.finalPrice - a.finalPrice)
      .slice(0, 10)
      .map(item => ({
        name: item.name.length > 38 ? item.name.slice(0, 38) + '…' : item.name,
        price: item.finalPrice,
      }))
  }, [ahspItems])

  const resourceDistData = useMemo(() => {
    const counts: Record<string, number> = {}
    resources.filter(r => r.isActive).forEach(r => { counts[r.type] = (counts[r.type] ?? 0) + 1 })
    const labels: Record<string, string> = { material: 'Material', labor: 'Tenaga Kerja', equipment: 'Peralatan', subcontractor: 'Subkontraktor' }
    return Object.entries(counts).map(([type, value]) => ({ name: labels[type] ?? type, value }))
  }, [resources])

  const approvalStatusData = useMemo(() => {
    const counts = { draft: 0, review: 0, approved: 0, archived: 0 }
    ahspItems.forEach(item => { counts[item.status ?? 'draft']++ })
    return [
      { name: 'Draft', value: counts.draft },
      { name: 'Review', value: counts.review },
      { name: 'Disetujui', value: counts.approved },
      { name: 'Diarsipkan', value: counts.archived },
    ].filter(d => d.value > 0)
  }, [ahspItems])

  if (ahspItems.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Belum ada data AHSP untuk ditampilkan
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total AHSP</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold">{kpis.totalItems.toLocaleString('id')}</div>
            <div className="text-xs text-muted-foreground">{kpis.activeItems} aktif</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rata-rata Harga</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-sm font-bold leading-tight">{formatIDR(Math.round(kpis.avgFinalPrice))}</div>
            <div className="text-xs text-muted-foreground">per satuan</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Kategori</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold">{kpis.totalCategories}</div>
            <div className="text-xs text-muted-foreground">jenis pekerjaan</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Resource DKH</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold">{kpis.totalResources}</div>
            <div className="text-xs text-muted-foreground">resource aktif</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Disetujui</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-green-600">{kpis.approvedItems}</div>
            <div className="text-xs text-muted-foreground">item approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-2xl font-bold text-slate-400">{ahspItems.filter(i => (i.status ?? 'draft') === 'draft').length}</div>
            <div className="text-xs text-muted-foreground">belum direview</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Avg price by category + Cost breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rata-rata Harga per Kategori (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgPriceByCategoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} style={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={115} style={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [formatIDR(v), 'Rata-rata Harga']} />
                  <Bar dataKey="avgPrice" fill="#F97316" radius={[0, 4, 4, 0]} name="Rata-rata Harga" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Komposisi Biaya per Kategori (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costBreakdownData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} style={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={115} style={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, name: string) => [formatIDR(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="material" stackId="a" fill={COST_COLORS.material} name="Material" />
                  <Bar dataKey="labor" stackId="a" fill={COST_COLORS.labor} name="Tenaga Kerja" />
                  <Bar dataKey="equipment" stackId="a" fill={COST_COLORS.equipment} name="Peralatan" />
                  <Bar dataKey="subcon" stackId="a" fill={COST_COLORS.subcon} name="Subkontraktor" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Top-10 items + two small pies */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">10 AHSP Termahal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Items} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} style={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={170} style={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [formatIDR(v), 'Harga Total']} />
                  <Bar dataKey="price" fill="#22D3EE" radius={[0, 4, 4, 0]} name="Harga Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm">Distribusi Resource</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={resourceDistData}
                      cx="50%" cy="50%"
                      outerRadius={48}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ fontSize: 9 }}
                    >
                      {resourceDistData.map((_, i) => (
                        <Cell key={i} fill={RESOURCE_COLORS[i % RESOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm">Status Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[130px]">
                {approvalStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={approvalStatusData}
                        cx="50%" cy="50%"
                        outerRadius={48}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: 9 }}
                      >
                        {approvalStatusData.map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[d.name] ?? '#94A3B8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Tidak ada data</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
