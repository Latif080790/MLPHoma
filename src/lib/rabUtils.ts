/**
 * src/lib/rabUtils.ts
 *
 * DEPRECATED: This file now re-exports from calculationService for backward compatibility.
 * New code should import directly from calculationService.ts
 * 
 * Utility calculation functions untuk AHSP → RAB.
 * Berisi fungsi untuk menghitung harga satuan AHSP dari komponen,
 * dan menghitung subtotal & final total untuk RAB item berdasarkan
 * overhead/profit/tax project.
 */

import { 
  calculateComponentsTotal,
  calculatePriceWithMarkup,
  calculateRABItemTotal 
} from './calculationService'

/**
 * AHSPComponentMini
 * Minimal shape for calculation: coefficient * unitPrice
 */
export interface AHSPComponentMini {
  coefficient: number
  unitPrice: number
}

/**
 * Compute AHSP unit price from components.
 * 
 * @deprecated Use calculateComponentsTotal from calculationService instead
 * @param components array of AHSPComponentMini
 * @returns ComponentCalculationResult with subtotal and detailed breakdown
 */
export function computeAHSPUnitPrice(components: AHSPComponentMini[]) {
  return calculateComponentsTotal(components)
}

/**
 * Compute subtotal for a RAB item
 *
 * @deprecated Simple multiplication, use inline calculation or calculationService
 * @param volume item volume
 * @param unitPrice unit price (AHSP unit price or override)
 * @returns subtotal
 */
export function computeSubtotal(volume: number, unitPrice: number): number {
  return Number(volume || 0) * Number(unitPrice || 0)
}

/**
 * Compute final total applying overhead, profit, tax (percentages)
 *
 * @deprecated Use calculatePriceWithMarkup from calculationService instead
 * Calculation order:
 *  - subtotal = volume * unitPrice
 *  - withOverhead = subtotal * (1 + overhead/100)
 *  - withProfit = withOverhead * (1 + profit/100)
 *  - finalTotal = withProfit * (1 + tax/100)
 *
 * @param subtotal number
 * @param overhead percent (e.g., 10)
 * @param profit percent
 * @param tax percent
 * @returns final total (number)
 */
export function computeFinalTotal(
  subtotal: number,
  overhead = 0,
  profit = 0,
  tax = 0
): number {
  const result = calculatePriceWithMarkup({
    basePrice: subtotal,
    overheadPercent: overhead,
    profitPercent: profit,
    taxPercent: tax
  })
  return result.finalPrice
}

/**
 * Convenience: compute subtotal & finalTotal from item inputs
 *
 * @deprecated Use calculateRABItemTotal from calculationService instead
 * @param params object with volume, unitPrice, overhead, profit, tax
 * @returns { subtotal, finalTotal }
 */
export function computeItemTotals(params: {
  volume: number
  unitPrice: number
  overhead?: number
  profit?: number
  tax?: number
}) {
  const result = calculateRABItemTotal({
    volume: params.volume,
    unitPrice: params.unitPrice,
    overheadPercent: params.overhead,
    profitPercent: params.profit,
    taxPercent: params.tax
  })
  
  return { 
    subtotal: result.subtotal, 
    finalTotal: result.finalPrice 
  }
}

export default {
  computeAHSPUnitPrice,
  computeSubtotal,
  computeFinalTotal,
  computeItemTotals,
}