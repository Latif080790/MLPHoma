/**
 * AHSPCostSummary.tsx
 * Display-only right sidebar showing the AHSP cost distribution / price breakdown.
 * Pure presentation — no mutations.
 */

import { Check } from 'lucide-react'
import { formatIDR } from '../../lib/utils'

/** Props for AHSPCostSummary component */
export interface AHSPCostSummaryProps {
  /** Subtotal of base costs (material + labor + equipment + subcontractor) */
  basePrice: number
  /** Final price after overhead and profit */
  finalPrice: number
  /** Material cost subtotal */
  price_material: number
  /** Labor cost subtotal */
  price_labor: number
  /** Equipment cost subtotal */
  price_equipment: number
  /** Subcontractor cost subtotal */
  price_subcon: number
  /** Overhead percentage */
  overheadPercentage: number
  /** Profit percentage */
  profitPercentage: number
  /** Display unit for the final unit price */
  unit: string
}

/**
 * AHSPCostSummary Component — sticky right sidebar with the cost breakdown.
 */
export function AHSPCostSummary({
  basePrice,
  finalPrice,
  price_material,
  price_labor,
  price_equipment,
  price_subcon,
  overheadPercentage,
  profitPercentage,
  unit,
}: AHSPCostSummaryProps) {
  return (
    <div className="bg-card p-4 sm:p-5 space-y-5 lg:col-[2] lg:row-[1/span_2] lg:border-l lg:border-border lg:sticky lg:top-0 lg:h-fit lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="bg-emerald-500/10 p-2 rounded-xl ring-1 ring-emerald-500/20">
          <Check className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Distribusi Biaya</h3>
          <p className="text-xs text-muted-foreground font-medium">Ringkasan komposisi dan harga</p>
        </div>
      </div>
      <div className="grid gap-6">
        {/* Kalkulasi Akhir — accent hero */}
        <div className="flex flex-col items-center justify-center py-5 px-5 rounded-xl bg-muted/40 border border-border relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-muted-foreground mb-3">Kalkulasi Akhir AHSP</span>
            <div className="text-2xl lg:text-3xl font-bold font-mono tracking-tight tabular-nums text-amber-500 dark:text-amber-400 mb-2 break-all">
              {formatIDR(finalPrice)}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase tracking-[0.1em] text-xs">
              Harga Satuan per <span className="bg-muted px-2 py-0.5 rounded font-mono text-foreground">{unit}</span>
            </div>
          </div>
        </div>

        {/* Rincian Biaya Dasar */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-0.5 bg-blue-500 rounded-full" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Rincian Biaya Dasar</h3>
          </div>
          <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biaya Material</span>
                <span className="font-mono text-xs font-bold text-foreground">{formatIDR(price_material)}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${(price_material / (basePrice || 1)) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biaya Tenaga Kerja</span>
                <span className="font-mono text-xs font-bold text-foreground">{formatIDR(price_labor)}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${(price_labor / (basePrice || 1)) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alat / Peralatan</span>
                <span className="font-mono text-xs font-bold text-foreground">{formatIDR(price_equipment + price_subcon)}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${((price_equipment + price_subcon) / (basePrice || 1)) * 100}%` }} />
              </div>
            </div>
            <div className="pt-3 mt-1 border-t border-border flex justify-between items-center">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Subtotal Biaya Dasar</span>
              <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">{formatIDR(basePrice)}</span>
            </div>
          </div>
        </div>

        {/* Overhead & Keuntungan */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-0.5 bg-emerald-500 rounded-full" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Overhead &amp; Keuntungan</h3>
          </div>
          <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overhead</span>
                <span className="text-xs text-muted-foreground/60 ml-2">{overheadPercentage}%</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatIDR(basePrice * (overheadPercentage / 100))}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Keuntungan</span>
                <span className="text-xs text-muted-foreground/60 ml-2">{profitPercentage}%</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatIDR(basePrice * (profitPercentage / 100))}</span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Penyesuaian</span>
              <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatIDR(finalPrice - basePrice)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AHSPCostSummary
