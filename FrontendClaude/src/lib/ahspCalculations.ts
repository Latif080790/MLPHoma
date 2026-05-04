/**
 * ahspCalculations.ts
 * Utility functions for AHSP price calculations and formatting.
 */

/**
 * Format a number as Indonesian Rupiah currency string.
 * @param value - numeric value to format
 * @returns formatted currency string (e.g., "Rp 1.234.567")
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Calculate AHSP final price from components.
 */
export function calculateAHSPPrice(
  basePrice: number,
  overheadPercentage: number = 10,
  profitPercentage: number = 5
): { overheadAmt: number; profitAmt: number; finalPrice: number } {
  const overheadAmt = basePrice * (overheadPercentage / 100)
  const profitAmt = (basePrice + overheadAmt) * (profitPercentage / 100)
  const finalPrice = basePrice + overheadAmt + profitAmt
  return { overheadAmt, profitAmt, finalPrice }
}
