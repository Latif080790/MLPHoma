import React, { useState, useEffect, useRef } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  ChevronDown, ChevronRight, Trash2, Link2,
  Settings2, Info as InfoIcon
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CurrencyCell } from '../shared/CurrencyCell'

/**
 * Editable number cell that uses local state while focused.
 * Calls onCommit only on blur or Enter, preventing store updates (and the
 * cascade of re-renders they trigger) on every keystroke.
 */
function NumberInputCell({
  value: externalValue,
  disabled,
  onCommit,
}: {
  value: number | undefined
  disabled?: boolean
  onCommit: (val: string) => void
}) {
  const toDisplay = (v: number | undefined) => (v != null && v !== 0 ? String(v) : '')
  const [local, setLocal] = useState(() => toDisplay(externalValue))
  const focused = useRef(false)

  // Sync external value into local state only when the cell isn't being edited
  useEffect(() => {
    if (!focused.current) {
      setLocal(toDisplay(externalValue))
    }
  }, [externalValue])

  return (
    <Input
      type="number"
      value={local}
      disabled={disabled}
      className="h-7 text-right text-xs bg-muted/30 border-transparent focus:bg-card focus:border-blue-300 transition-all font-mono disabled:opacity-50"
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => { focused.current = true }}
      onBlur={() => {
        focused.current = false
        onCommit(local)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onCommit(local)
          e.currentTarget.blur()
        }
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault()
          onCommit(local)
          document.getElementById('btn-publish-drafts')?.click()
        }
      }}
    />
  )
}

/**
 * Editable currency cell. Shows thousand-separated value (id-ID) when idle, and a
 * plain editable number while focused. Commits a dot-decimal numeric string on
 * blur/Enter so the existing parseFloat-based handlers work unchanged.
 */
function CurrencyInputCell({
  value: externalValue,
  disabled,
  onCommit,
}: {
  value: number | undefined
  disabled?: boolean
  onCommit: (val: string) => void
}) {
  const fmt = (v: number | undefined) =>
    v != null && v !== 0 ? v.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : ''
  const raw = (v: number | undefined) => (v != null && v !== 0 ? String(v) : '')
  const [local, setLocal] = useState(() => fmt(externalValue))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setLocal(fmt(externalValue))
  }, [externalValue])

  const commit = () => {
    // Strip id-ID thousand dots, convert decimal comma to dot, drop anything else.
    const parsed = local.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
    onCommit(parsed)
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={local}
      disabled={disabled}
      className="h-7 text-right text-xs bg-muted/30 border-transparent focus:bg-card focus:border-blue-300 transition-all font-mono disabled:opacity-50"
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => { focused.current = true; setLocal(raw(externalValue)) }}
      onBlur={() => {
        focused.current = false
        commit()
        const n = parseFloat(local.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, ''))
        setLocal(fmt(Number.isFinite(n) ? n : 0))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); e.currentTarget.blur() }
      }}
    />
  )
}

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
    onMarginChange,
    getSellingUnitPrice,
    getSellingTotal,
    onRemoveRow,
    onToggleExpand,
    paretoMap,
    projectLocked,
    validLinksByRabItem,
    marginMode,
    getEffectiveMargin,
  }: {
    onSelectRow: (id: string, checked: boolean) => void
    onVolumeChange: (id: string, value: string) => void
    onPriceChange: (id: string, value: string) => void
    onMarginChange: (id: string, value: string) => void
    getSellingUnitPrice: (id: string, unitCost: number) => number
    getSellingTotal: (id: string, volume: number, unitCost: number) => number
    onRemoveRow: (id: string) => void
    onToggleExpand: (id: string) => void
    paretoMap: Map<string, string>
    projectLocked: boolean
    validLinksByRabItem: Record<string, any[]>
    marginMode: 'fixed' | 'per_item'
    getEffectiveMargin: (id: string) => number
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
    cell: ({ row }) => <span className="text-muted-foreground font-mono">{row.index + 1}</span>,
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
              <InfoIcon className="h-3 w-3 text-muted-foreground" />
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
    cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.item_code || row.original.code || '-'}</span>,
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
            className="mt-0.5 text-muted-foreground hover:text-blue-500 transition-colors shrink-0"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span 
              className="font-bold text-foreground leading-snug line-clamp-2 break-words"
              title={item.name}
            >
              {item.name}
            </span>
            {item.notes && item.notes !== 'No specification' ? (
              <span 
                className="text-xs text-muted-foreground line-clamp-1 break-words mt-0.5"
                title={item.notes}
              >
                {item.notes}
              </span>
            ) : null}
            
            {/* Linked WBS Tags */}
            {validLinksByRabItem[item.id]?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {validLinksByRabItem[item.id].map((l: any) => (
                  <Link key={l.id} to={`/schedule?taskId=${l.wbsItemId}`} title="View in Timeline">
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
      <NumberInputCell
        value={row.original.volume}
        disabled={projectLocked}
        onCommit={(val) => onVolumeChange(row.original.id, val)}
      />
    ),
    size: 100,
  },
  {
    accessorKey: 'unit',
    header: () => <div className="text-center">SAT.</div>,
    cell: ({ row }) => (
      <div className="text-center">
        <Badge variant="outline" className="text-xs font-bold text-muted-foreground bg-muted/30 border-border uppercase px-1.5 h-5">
          {row.original.unit || '-'}
        </Badge>
      </div>
    ),
    size: 64,
  },
  {
    accessorKey: 'unit_price',
    header: () => <div className="text-right">Unit Cost</div>,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = getSellingUnitPrice(rowA.original.id, rowA.original.unit_price || 0)
      const b = getSellingUnitPrice(rowB.original.id, rowB.original.unit_price || 0)
      return a - b
    },
    cell: ({ row }) => (
      <CurrencyInputCell
        value={getSellingUnitPrice(row.original.id, row.original.unit_price || 0)}
        disabled={projectLocked || !!row.original.snapshot_price}
        onCommit={(val) => onPriceChange(row.original.id, val)}
      />
    ),
    size: 140,
  },
  {
    id: 'margin_pct',
    header: () => <div className="text-right">Margin %</div>,
    enableSorting: true,
    sortingFn: (rowA, rowB) => getEffectiveMargin(rowA.original.id) - getEffectiveMargin(rowB.original.id),
    cell: ({ row }) => {
      const marginValue = getEffectiveMargin(row.original.id)
      if (marginMode === 'per_item') {
        return (
          <NumberInputCell
            value={marginValue}
            disabled={projectLocked}
            onCommit={(val) => onMarginChange(row.original.id, val)}
          />
        )
      }
      return (
        <div className="text-right">
          <Badge variant="outline" className="h-5 px-2 text-xs font-mono text-slate-600">
            {marginValue.toFixed(1)}%
          </Badge>
        </div>
      )
    },
    size: 100,
  },
  {
    id: 'total',
    header: () => <div className="text-right">Total Cost</div>,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = getSellingTotal(rowA.original.id, rowA.original.volume || 0, rowA.original.unit_price || 0)
      const b = getSellingTotal(rowB.original.id, rowB.original.volume || 0, rowB.original.unit_price || 0)
      return a - b
    },
    cell: ({ row }) => {
      const total = getSellingTotal(row.original.id, row.original.volume || 0, row.original.unit_price || 0)
      return <CurrencyCell value={total} variant="default" className="text-xs font-bold text-indigo-600" />
    },
    size: 144,
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => (
      <div className="flex justify-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 transition-colors"
          title="Edit item"
          onClick={() => onSelectRow(row.original.id, true)}
        >
          <Settings2 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-indigo-600 transition-colors"
          title="Link to WBS"
          onClick={() => onToggleExpand(row.original.id)}
        >
          <Link2 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 transition-colors"
          title="Delete"
          onClick={() => onRemoveRow(row.original.id)}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    ),
    size: 96,
  },
]
