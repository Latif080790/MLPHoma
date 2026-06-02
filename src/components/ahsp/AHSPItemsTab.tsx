import React from 'react'
import { AHSPCatalog } from './AHSPCatalog'

export function AHSPItemsTab({ showBidPrice = false, bidMarginPct = 0 }: { showBidPrice?: boolean; bidMarginPct?: number }) {
    return <AHSPCatalog compact={true} showBidPrice={showBidPrice} bidMarginPct={bidMarginPct} />
}
