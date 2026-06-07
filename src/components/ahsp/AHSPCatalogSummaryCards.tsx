/**
 * AHSPCatalogSummaryCards.tsx
 * Summary cards block for the AHSP catalog (totals / averages / categories).
 * Extracted from AHSPCatalog.tsx — pure presentational, no logic changes.
 */

import { Calculator, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { formatIDR } from '../../lib/utils'

export interface AHSPCatalogSummaryCardsProps {
  /** Total number of AHSP items */
  totalAHSPItems: number
  /** Number of active AHSP items */
  activeAHSPItems: number
  /** Total number of resources across all types */
  totalResources: number
  /** Average price per AHSP item */
  averagePrice: number
  /** Number of distinct categories */
  categoryCount: number
}

/**
 * Renders the 4 summary cards shown at the top of the AHSP catalog.
 */
export function AHSPCatalogSummaryCards({
  totalAHSPItems,
  activeAHSPItems,
  totalResources,
  averagePrice,
  categoryCount,
}: AHSPCatalogSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total AHSP Items</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAHSPItems}</div>
          <p className="text-xs text-muted-foreground">
            {activeAHSPItems} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalResources}</div>
          <p className="text-xs text-muted-foreground">Across all types</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Harga Rata-rata</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatIDR(averagePrice)}</div>
          <p className="text-xs text-muted-foreground">Per item AHSP</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Kategori</CardTitle>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{categoryCount}</div>
          <p className="text-xs text-muted-foreground">Jumlah kategori berbeda</p>
        </CardContent>
      </Card>
    </div>
  )
}
