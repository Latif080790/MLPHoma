/**
 * src/lib/rabUtils.ts
 *
 * Utility calculation functions untuk AHSP → RAB.
 * Berisi fungsi untuk menghitung harga satuan AHSP dari komponen,
 * dan menghitung subtotal & final total untuk RAB item berdasarkan
 * overhead/profit/tax project.
 */

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
 * @param components array of AHSPComponentMini
 * @returns basePrice (sum of coefficient * unitPrice)
 */
export function computeAHSPUnitPrice(components: AHSPComponentMini[]): number {
  if (!components || components.length === 0) return 0
  return components.reduce((s, c) => s + (Number(c.coefficient || 0) * Number(c.unitPrice || 0)), 0)
}

/**
 * Compute subtotal for a RAB item
 *
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
  let result = Number(subtotal || 0)
  if (overhead) result = result * (1 + Number(overhead) / 100)
  if (profit) result = result * (1 + Number(profit) / 100)
  if (tax) result = result * (1 + Number(tax) / 100)
  return result
}

/**
 * Convenience: compute subtotal & finalTotal from item inputs
 *
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
  const subtotal = computeSubtotal(params.volume || 0, params.unitPrice || 0)
  const finalTotal = computeFinalTotal(subtotal, params.overhead || 0, params.profit || 0, params.tax || 0)
  return { subtotal, finalTotal }
}

export default {
  computeAHSPUnitPrice,
  computeSubtotal,
  computeFinalTotal,
  computeItemTotals,
}