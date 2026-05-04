import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, History, Trash2 } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import type { AHSPItem } from '@/types/ahsp'

interface AHSPItemWithPrices extends AHSPItem {
  price_material?: number
  price_labor?: number
  price_equipment?: number
  price_subcon?: number
  originalFinalPrice?: number
}

function CostMixBar({ mat, lab, eqp, sub }: { mat: number; lab: number; eqp: number; sub: number }) {
  const total = mat + lab + eqp + sub
  if (total === 0) return null
  const matPct = (mat / total) * 100
  const labPct = (lab / total) * 100
  const eqpPct = (eqp / total) * 100
  const subPct = (sub / total) * 100
  const tip = `Material ${Math.round(matPct)}% · Labor ${Math.round(labPct)}% · Equip ${Math.round(eqpPct)}% · Subcon ${Math.round(subPct)}%`
  return (
    <div
      className="flex h-1.5 w-full max-w-[160px] rounded-full overflow-hidden mt-1 opacity-70"
      title={tip}
    >
      {matPct > 0 && <div className="bg-blue-500 h-full" style={{ width: `${matPct}%` }} />}
      {labPct > 0 && <div className="bg-orange-400 h-full" style={{ width: `${labPct}%` }} />}
      {eqpPct > 0 && <div className="bg-indigo-400 h-full" style={{ width: `${eqpPct}%` }} />}
      {subPct > 0 && <div className="bg-purple-400 h-full" style={{ width: `${subPct}%` }} />}
    </div>
  )
}

export const getAHSPColumns = (
  {
    onEditItem,
    onHistoryClick,
    onDeleteItem,
    hasZoneOverride,
    ahspUsageMap
  }: {
    onEditItem: (item: AHSPItemWithPrices) => void
    onHistoryClick: (item: AHSPItemWithPrices) => void
    onDeleteItem: (item: AHSPItemWithPrices) => void
    hasZoneOverride: boolean
    ahspUsageMap: Map<string, number>
  }
): ColumnDef<AHSPItemWithPrices>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.name}`}
          className="translate-y-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        />
      </div>
    ),
    size: 48,
  },
  {
    accessorKey: 'index',
    header: 'No.',
    cell: ({ row }) => <span className="font-mono text-xs text-slate-400">{row.index + 1}</span>,
    size: 56,
  },
  {
    accessorKey: 'name',
    header: 'Deskripsi Resource',
    cell: ({ row }) => {
      const item = row.original
      const matPrice = item.price_material || 0
      const labPrice = item.price_labor || 0
      const eqpPrice = item.price_equipment || 0
      const subPrice = item.price_subcon || 0
      const isZoneAdjt = hasZoneOverride && item.originalFinalPrice !== undefined
      const useCount = ahspUsageMap.get(item.id) ?? 0

      return (
         <div className="flex flex-col py-1">
           <div className="flex items-center gap-1.5 flex-wrap">
             <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{item.name}</span>
             {(item.currentVersion ?? 1) > 1 ? (
               <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 leading-4">
                 v{item.currentVersion}
               </span>
             ) : (
               <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-slate-100 text-slate-400 leading-4">
                 v1
               </span>
             )}
             {isZoneAdjt && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">Adj Zona</Badge>}
             {useCount > 0 && (
               <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-bold text-emerald-700 border-emerald-300 bg-emerald-50">
                 {useCount} RAB
               </Badge>
             )}
           </div>
           <span className="text-[10px] font-mono font-medium text-slate-400">{item.code}</span>
           <CostMixBar mat={matPrice} lab={labPrice} eqp={eqpPrice} sub={subPrice} />
         </div>
      )
    },
    size: 280,
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    cell: ({ row }) => (
      <div className="text-center">
        <Badge variant="outline" className="text-[10px] h-5 font-black uppercase text-slate-600 bg-slate-50 border-slate-200 justify-center">
          {row.original.unit || '-'}
        </Badge>
      </div>
    ),
    size: 70,
  },
  {
    id: 'material',
    header: () => <div className="text-right text-blue-600 dark:text-blue-400">Material</div>,
    cell: ({ row }) => {
       const matPrice = row.original.price_material || 0
       return (
         <div className="text-right font-mono text-xs text-slate-600 bg-blue-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {matPrice > 0 ? formatIDR(matPrice) : '-'}
         </div>
       )
    },
    size: 110,
  },
  {
    id: 'labor',
    header: () => <div className="text-right text-orange-600 dark:text-orange-400">Labor</div>,
    cell: ({ row }) => {
       const labPrice = row.original.price_labor || 0
       return (
         <div className="text-right font-mono text-xs text-slate-600 bg-orange-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {labPrice > 0 ? formatIDR(labPrice) : '-'}
         </div>
       )
    },
    size: 110,
  },
  {
    id: 'equipment',
    header: () => <div className="text-right text-indigo-600 dark:text-indigo-400">Equipment</div>,
    cell: ({ row }) => {
       const eqpPrice = row.original.price_equipment || 0
       return (
         <div className="text-right font-mono text-xs text-slate-600 bg-indigo-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {eqpPrice > 0 ? formatIDR(eqpPrice) : '-'}
         </div>
       )
    },
    size: 110,
  },
  {
    id: 'subcon',
    header: () => <div className="text-right text-purple-600 dark:text-purple-400">Subcon</div>,
    cell: ({ row }) => {
       const subPrice = row.original.price_subcon || 0
       return (
         <div className="text-right font-mono text-xs text-slate-600 bg-purple-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {subPrice > 0 ? formatIDR(subPrice) : '-'}
         </div>
       )
    },
    size: 110,
  },
  {
    id: 'total',
    header: () => <div className="text-right">Total Harga</div>,
    cell: ({ row }) => {
       const item = row.original
       const matPrice = item.price_material || 0
       const labPrice = item.price_labor || 0
       const eqpPrice = item.price_equipment || 0
       const subPrice = item.price_subcon || 0
       const breakSum = (matPrice + labPrice + eqpPrice + subPrice)
       const isUnallocated = breakSum === 0 && (item.finalPrice || 0) > 0
       const totalPrice = isUnallocated ? item.finalPrice || 0 : breakSum
       
       return (
         <div className="text-right font-mono text-[13px] font-black text-slate-900 dark:text-slate-100">
            {isUnallocated ? (
              <span className="text-amber-600" title="Komponen belum disetup.">
                {formatIDR(totalPrice)} (!)
              </span>
            ) : formatIDR(totalPrice)}
         </div>
       )
    },
    size: 130,
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="flex justify-end gap-0.5 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" aria-label="Riwayat" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); onHistoryClick(row.original) }}><History className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7 text-slate-400 hover:text-slate-900" onClick={(e) => { e.stopPropagation(); onEditItem(row.original) }}><Edit2 className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Hapus" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDeleteItem(row.original) }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    ),
    size: 90,
  },
]
