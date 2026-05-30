import React from 'react'
import { Layers } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { AHSPComponent } from '@/types/ahsp'

interface RABSubComponentProps {
  item: any
  analysis: {
    ahsp: {
      code: string
      name: string
    }
    components: any[]
  } | null
  onMarkupChange?: (itemId: string, source: string) => void
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  material: { label: 'MATERIAL', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/60 dark:bg-blue-900/20' },
  labor: { label: 'TENAGA KERJA', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/60 dark:bg-emerald-900/20' },
  equipment: { label: 'PERALATAN', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50/60 dark:bg-amber-900/20' },
  subcontractor: { label: 'SUBKONTRAKTOR', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50/60 dark:bg-purple-900/20' },
  other: { label: 'LAIN-LAIN', color: 'text-muted-foreground', bg: 'bg-muted/30' },
}

/**
 * RABSubComponent
 * 
 * Extracted expansion row from RABTable.
 * Shows detailed AHSP analysis breakdown for a specific RAB item.
 */
export const RABSubComponent: React.FC<RABSubComponentProps> = ({
  item,
  analysis,
  onMarkupChange
}) => {
  if (!analysis) {
    return (
      <div className="px-12 py-6 bg-muted/30/50 italic text-xs text-muted-foreground">
        No AHSP analysis found for this item code ({item.item_code || item.code}).
      </div>
    )
  }

  // Group components by type
  const grouped: Record<string, any[]> = {}
  analysis.components.forEach(c => {
    const type = c.type || c.resource?.type || 'other'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(c)
  })

  let runningTotal = 0

  return (
    <div className="px-12 py-6 bg-muted/30/50 border-y border-border animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden overflow-x-auto">
        <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-blue-500" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
              Analis Harga Satuan: <span className="text-blue-600 ml-1">{analysis.ahsp.code} — {analysis.ahsp.name}</span>
            </span>
          </div>
          <Badge variant="outline" className="text-xs bg-card border-border">DETAILED BREAKDOWN</Badge>
        </div>

        <div className="min-w-[600px]">
          {Object.entries(grouped).map(([type, comps]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other
            return (
              <div key={type} className="border-b border-border last:border-0">
                <div className={`px-4 py-1.5 ${cfg.bg} border-b border-border/50`}>
                  <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                </div>
                {comps.map((comp, ci) => {
                  const name = comp.resource?.name || comp.resourceName || '-'
                  const unit = comp.unit || comp.resource?.unit || '-'
                  const coeff = comp.coefficient || 0
                  const price = comp.unitPrice || comp.resource?.unitPrice || 0
                  const sub = coeff * price
                  runningTotal += sub

                  return (
                    <div key={ci} className="flex items-center px-4 py-1.5 hover:bg-muted/30/80 transition-colors group">
                      <span className="flex-1 text-xs text-muted-foreground font-medium truncate">{name}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-[60px] text-center">
                           <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{unit}</span>
                        </div>
                        <div className="w-[80px] text-right font-mono text-xs text-muted-foreground font-semibold">{coeff.toFixed(4)}</div>
                        <span className="text-xs text-foreground">×</span>
                        <div className="w-[120px] text-right font-mono text-xs text-muted-foreground tracking-tight">{formatIDR(price)}</div>
                        <span className="text-xs text-foreground">=</span>
                        <div className="w-[140px] text-right font-mono text-xs font-bold text-foreground">{formatIDR(sub)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end px-6 py-3 bg-muted/30/80 border-t border-border">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Harga Satuan (Analisa)</span>
            <span className="text-lg font-mono font-black text-foreground mt-0.5 tracking-tighter">
              {formatIDR(runningTotal)}
            </span>
          </div>
        </div>
      </div>

      {onMarkupChange && (
        <div className="mt-4 flex items-center gap-4 bg-card p-3 rounded-lg border border-border shadow-sm max-w-fit">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Costing Override</span>
            <Select onValueChange={(val) => onMarkupChange(item.id, val)} value={item.markup_source || 'ahsp'}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Select Markup Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ahsp">Default (Catalog)</SelectItem>
                <SelectItem value="manual">Manual Override</SelectItem>
                <SelectItem value="project">Project Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
