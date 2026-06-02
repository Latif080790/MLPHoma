import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, History, Trash2 } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import type { AHSPItem } from '@/types/ahsp'
import { sellingFromBase } from '@/lib/costingMargin'

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
      {matPct > 0 && <div className="bg-primary h-full" style={{ width: `${matPct}%` }} />}
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
    ahspUsageMap,
    showBidPrice,
    bidMarginPct,
  }: {
    onEditItem: (item: AHSPItemWithPrices) => void
    onHistoryClick: (item: AHSPItemWithPrices) => void
    onDeleteItem: (item: AHSPItemWithPrices) => void
    hasZoneOverride: boolean
    ahspUsageMap: Map<string, number>
    showBidPrice: boolean
    bidMarginPct: number
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
          className="translate-y-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.name}`}
          className="translate-y-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>
    ),
    size: 48,
  },
  {
    accessorKey: 'index',
    header: 'No.',
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.index + 1}</span>,
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
             <span className="font-bold text-xs text-foreground">{item.name}</span>
             {(item.currentVersion ?? 1) > 1 ? (
               <span className="inline-flex items-center px-1.5 py-0 rounded text-xs font-semibold bg-amber-100 text-amber-700 leading-4">
                 v{item.currentVersion}
               </span>
             ) : (
               <span className="inline-flex items-center px-1.5 py-0 rounded text-xs font-medium bg-muted/50 text-muted-foreground leading-4">
                 v1
               </span>
             )}
             {isZoneAdjt && <Badge variant="secondary" className="h-4 px-1.5 text-xs uppercase tracking-wider">Adj Zona</Badge>}
             {useCount > 0 && (
               <Badge variant="outline" className="h-4 px-1.5 text-xs font-bold text-emerald-700 border-emerald-300 bg-emerald-50">
                 {useCount} RAB
               </Badge>
             )}
           </div>
           <span className="text-xs font-mono font-medium text-muted-foreground">{item.code}</span>
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
        <Badge variant="outline" className="text-xs h-5 font-black uppercase text-muted-foreground bg-muted/30 border-border justify-center">
          {row.original.unit || '-'}
        </Badge>
      </div>
    ),
    size: 70,
  },
  {
    id: 'material',
    header: () => <div className="text-right text-primary">Material</div>,
    cell: ({ row }) => {
       const matPrice = row.original.price_material || 0
       return (
         <div className="text-right font-mono text-xs text-muted-foreground bg-primary/5 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {matPrice > 0 ? formatIDR(matPrice) : <span className="text-foreground select-none" aria-hidden>·</span>}
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
         <div className="text-right font-mono text-xs text-muted-foreground bg-orange-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {labPrice > 0 ? formatIDR(labPrice) : <span className="text-foreground select-none" aria-hidden>·</span>}
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
         <div className="text-right font-mono text-xs text-muted-foreground bg-indigo-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {eqpPrice > 0 ? formatIDR(eqpPrice) : <span className="text-foreground select-none" aria-hidden>·</span>}
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
         <div className="text-right font-mono text-xs text-muted-foreground bg-purple-50/10 h-full flex items-center justify-end px-2 -mx-4 -my-2 py-3">
            {subPrice > 0 ? formatIDR(subPrice) : <span className="text-foreground select-none" aria-hidden>·</span>}
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
       const displayPrice = showBidPrice ? sellingFromBase(totalPrice, bidMarginPct) : totalPrice
       
       return (
         <div className="text-right font-mono text-[13px] font-black text-foreground">
            {isUnallocated ? (
              <span className="text-amber-600" title="Komponen belum disetup.">
                {formatIDR(displayPrice)} (!)
              </span>
            ) : formatIDR(displayPrice)}
            {showBidPrice && (
              <div className="text-xs font-semibold text-violet-600">+{bidMarginPct}% margin</div>
            )}
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
        <Button variant="ghost" size="icon" aria-label="Riwayat" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onHistoryClick(row.original) }}><History className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEditItem(row.original) }}><Edit2 className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Hapus" className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDeleteItem(row.original) }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    ),
    size: 90,
  },
]
