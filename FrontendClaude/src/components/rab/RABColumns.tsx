import { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  ChevronDown, ChevronRight, Info, Trash2, Link2, 
  MapPin, Settings2, Info as InfoIcon 
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CurrencyCell } from '../shared/CurrencyCell'
import { StatusBadge } from '../shared/StatusBadge'

/**
 * RABColumns
 * 
 * Column definitions for the New RAB Table.
 * Encapsulates cell rendering logic, including inline editing and visual badges.
 */
export const getRABColumns = (
  {
    onSelectRow,
    onVolumeChange,
    onPriceChange,
    onRemoveRow,
    onToggleExpand,
    paretoMap,
    projectLocked,
    validLinksByRabItem,
  }: {
    onSelectRow: (id: string, checked: boolean) => void
    onVolumeChange: (id: string, value: string) => void
    onPriceChange: (id: string, value: string) => void
    onRemoveRow: (id: string) => void
    onToggleExpand: (id: string) => void
    paretoMap: Map<string, string>
    projectLocked: boolean
    validLinksByRabItem: Record<string, any[]>
  }
): ColumnDef<any>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    size: 48,
  },
  {
    accessorKey: 'index',
    header: 'No.',
    cell: ({ row }) => <span className="text-slate-400 font-mono">{row.index + 1}</span>,
    size: 56,
  },
  {
    id: 'pareto',
    header: () => (
      <div className="flex items-center gap-1">
        <span>Cls</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3 w-3 text-slate-400" />
            </TooltipTrigger>
            <TooltipContent>Class A = High Impact, B = Medium, C = Low</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
    cell: ({ row }) => {
      const pClass = paretoMap.get(row.original.id) || 'C'
      return (
        <Badge 
          variant={pClass === 'A' ? 'destructive' : pClass === 'B' ? 'secondary' : 'outline'} 
          className="h-5 min-w-5 px-1 text-xs font-black uppercase tracking-tighter"
        >
          {pClass}
        </Badge>
      )
    },
    size: 48,
  },
  {
    accessorKey: 'item_code',
    header: 'Code',
    cell: ({ row }) => <span className="font-mono text-slate-500">{row.original.item_code || row.original.code || '-'}</span>,
    size: 100,
  },
  {
    accessorKey: 'name',
    header: 'Description & Specification',
    cell: ({ row }) => {
      const item = row.original
      const isExpanded = row.getIsExpanded()
      return (
        <div className="flex items-start gap-2 py-1 max-w-[340px]">
          <button 
            onClick={() => row.toggleExpanded()}
            className="mt-0.5 text-slate-400 hover:text-blue-500 transition-colors shrink-0"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span 
              className="font-bold text-slate-900 leading-snug dark:text-slate-100 line-clamp-2 break-words"
              title={item.name}
            >
              {item.name}
            </span>
            {item.notes && item.notes !== 'No specification' ? (
              <span 
                className="text-xs text-slate-400 line-clamp-1 break-words mt-0.5"
                title={item.notes}
              >
                {item.notes}
              </span>
            ) : null}
            
            {/* Linked WBS Tags */}
            {validLinksByRabItem[item.id]?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {validLinksByRabItem[item.id].map((l: any) => (
                  <Link key={l.id} to={`/schedule?taskId=${l.wbsItemId}`} title="Lihat di Timeline">
                    <Badge variant="secondary" className="px-1 py-0 h-4 text-xs bg-indigo-50 text-indigo-600 border-indigo-100 cursor-pointer hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                      <Link2 size={8} className="mr-0.5" /> Gantt
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    },
    size: 320,
  },
  {
    accessorKey: 'volume',
    header: () => <div className="text-right">Volume</div>,
    enableSorting: true,
    sortingFn: 'basic',
    cell: ({ row }) => (
      <Input
        type="number"
        value={row.original.volume || ''}
        className="h-7 text-right text-xs bg-slate-50 border-transparent focus:bg-white focus:border-blue-300 transition-all font-mono"
        onChange={(e) => onVolumeChange(row.original.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault()
            const saveBtn = document.getElementById('btn-publish-drafts')
            if (saveBtn) saveBtn.click()
          }
          if (e.key === 'Enter') {
            e.currentTarget.blur() // exit edit mode mentally
          }
        }}
      />
    ),
    size: 100,
  },
  {
    accessorKey: 'unit',
    header: () => <div className="text-center">SAT.</div>,
    cell: ({ row }) => (
      <div className="text-center">
        <Badge variant="outline" className="text-xs font-bold text-slate-600 bg-slate-50 border-slate-200 uppercase px-1.5 h-5">
          {row.original.unit || '-'}
        </Badge>
      </div>
    ),
    size: 64,
  },
  {
    accessorKey: 'unit_price',
    header: () => <div className="text-right">Unit Price</div>,
    enableSorting: true,
    sortingFn: 'basic',
    cell: ({ row }) => (
      <Input
        type="number"
        value={row.original.unit_price || ''}
        disabled={projectLocked || !!row.original.snapshot_price}
        className="h-7 text-right text-xs font-mono bg-slate-50 border-transparent focus:bg-white focus:border-blue-300 transition-all disabled:opacity-50"
        onChange={(e) => onPriceChange(row.original.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault()
            const saveBtn = document.getElementById('btn-publish-drafts')
            if (saveBtn) saveBtn.click()
          }
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    ),
    size: 140,
  },
  {
    id: 'total',
    header: () => <div className="text-right">Total Amount</div>,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = (rowA.original.volume || 0) * (rowA.original.unit_price || 0)
      const b = (rowB.original.volume || 0) * (rowB.original.unit_price || 0)
      return a - b
    },
    cell: ({ row }) => {
      const total = (row.original.volume || 0) * (row.original.unit_price || 0)
      return <CurrencyCell value={total} variant="default" className="text-xs font-bold" />
    },
    size: 144,
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Aksi</div>,
    cell: ({ row }) => (
      <div className="flex justify-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 transition-colors"
          title="Edit item"
          onClick={() => onSelectRow(row.original.id, true)}
        >
          <Settings2 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 transition-colors"
          title="Link ke WBS"
          onClick={() => onToggleExpand(row.original.id)}
        >
          <Link2 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 transition-colors"
          title="Hapus"
          onClick={() => onRemoveRow(row.original.id)}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    ),
    size: 96,
  },
]
