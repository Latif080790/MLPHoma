/**
 * calculationService.ts
 * 
 * Centralized calculation service for all pricing, cost, and financial calculations.
 * This ensures consistency across AHSP, RAB, RAP, and other modules.
 * 
 * Key Principles:
 * 1. Single source of truth for all calculation formulas
 * 2. Type-safe with runtime validation
 * 3. Immutable calculations (pure functions)
 * 4. Well-documented with examples
 */

import { z } from 'zod'

/**
 * ===========================
 * VALIDATION SCHEMAS
 * ===========================
 */

const PriceInputSchema = z.object({
  basePrice: z.number().min(0, 'Base price cannot be negative'),
  overheadPercent: z.number().min(0).max(100).optional(),
  profitPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
})

const ComponentSchema = z.object({
  coefficient: z.number().min(0, 'Coefficient cannot be negative'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
})

const VolumeCalculationSchema = z.object({
  volume: z.number().min(0, 'Volume cannot be negative'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  overheadPercent: z.number().min(0).max(100).optional(),
  profitPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
})

/**
 * ===========================
 * TYPE DEFINITIONS
 * ===========================
 */

export interface PriceInput {
  basePrice: number
  overheadPercent?: number
  profitPercent?: number
  taxPercent?: number
}

export interface ComponentInput {
  coefficient: number
  unitPrice: number
  type?: string // 'material' | 'labor' | 'equipment' | 'subcontractor'
}

export interface ComponentCalculationResult {
  subtotal: number
  components: Array<{
    coefficient: number
    unitPrice: number
    amount: number
  }>
  breakdown: {
    material: number
    labor: number
    equipment: number
    subcontractor: number
  }
}

export interface PriceBreakdown {
  basePrice: number
  overheadAmount: number
  overheadPercent: number
  priceWithOverhead: number
  profitAmount: number
  profitPercent: number
  priceWithProfit: number
  taxAmount: number
  taxPercent: number
  finalPrice: number
}

/**
 * ===========================
 * CORE CALCULATION FUNCTIONS
 * ===========================
 */

/**
 * Calculate price with overhead, profit, and tax applied sequentially.
 */
export function calculatePriceWithMarkup(input: PriceInput): PriceBreakdown {
  // Validate input
  const validated = PriceInputSchema.parse(input)

  const basePrice = validated.basePrice
  const overheadPercent = validated.overheadPercent || 0
  const profitPercent = validated.profitPercent || 0
  const taxPercent = validated.taxPercent || 0

  // Step 1: Apply overhead
  const overheadAmount = basePrice * (overheadPercent / 100)
  const priceWithOverhead = basePrice + overheadAmount

  // Step 2: Apply profit (on price including overhead)
  const profitAmount = priceWithOverhead * (profitPercent / 100)
  const priceWithProfit = priceWithOverhead + profitAmount

  // Step 3: Apply tax (on price including overhead and profit)
  const taxAmount = priceWithProfit * (taxPercent / 100)
  const finalPrice = priceWithProfit + taxAmount

  return {
    basePrice,
    overheadAmount,
    overheadPercent,
    priceWithOverhead,
    profitAmount,
    profitPercent,
    priceWithProfit,
    taxAmount,
    taxPercent,
    finalPrice: Number(finalPrice.toFixed(2)),
  }
}

// ... schemas ...

/**
 * Calculate base price from components (AHSP calculation).
 * 
 * Formula: basePrice = Σ(coefficient * unitPrice)
 * 
 * @example
 * calculateComponentsTotal([
 *   { coefficient: 0.1, unitPrice: 152900, type: 'labor' }, 
 *   { coefficient: 0.005, unitPrice: 230000, type: 'labor' }
 * ])
 */
export function calculateComponentsTotal(components: ComponentInput[]): ComponentCalculationResult {
  // Validate each component
  const validated = components.map(c => ({
    ...ComponentSchema.parse(c),
    type: c.type || 'material' // Default to material if undefined
  }))

  let subtotal = 0
  const breakdown = {
    material: 0,
    labor: 0,
    equipment: 0,
    subcontractor: 0
  }

  const detailedComponents = validated.map(comp => {
    const amount = comp.coefficient * comp.unitPrice
    subtotal += amount

    // Accumulate breakdown
    switch (comp.type?.toLowerCase()) {
      case 'labor':
        breakdown.labor += amount
        break
      case 'equipment':
        breakdown.equipment += amount
        break
      case 'subcontractor':
      case 'subcon':
        breakdown.subcontractor += amount
        break
      default:
        breakdown.material += amount
    }

    return {
      coefficient: comp.coefficient,
      unitPrice: comp.unitPrice,
      amount: Number(amount.toFixed(2)),
    }
  })

  return {
    subtotal: Number(subtotal.toFixed(2)),
    components: detailedComponents,
    breakdown: {
      material: Number(breakdown.material.toFixed(2)),
      labor: Number(breakdown.labor.toFixed(2)),
      equipment: Number(breakdown.equipment.toFixed(2)),
      subcontractor: Number(breakdown.subcontractor.toFixed(2)),
    }
  }
}

/**
 * Calculate RAB item total (volume-based calculation).
 * 
 * Formula:
 * 1. subtotal = volume * unitPrice
 * 2. Apply markup calculations (overhead, profit, tax)
 * 
 * @example
 * calculateRABItemTotal({
 *   volume: 10,
 *   unitPrice: 1000,
 *   overheadPercent: 10,
 *   profitPercent: 5,
 *   taxPercent: 11
 * })
 * // Returns: {
 * //   volume: 10,
 * //   unitPrice: 1000,
 * //   subtotal: 10000,
 * //   ...priceBreakdown
 * // }
 */
export function calculateRABItemTotal(input: {
  volume: number
  unitPrice: number
  overheadPercent?: number
  profitPercent?: number
  taxPercent?: number
}) {
  // Validate
  const validated = VolumeCalculationSchema.parse(input)

  const subtotal = validated.volume * validated.unitPrice

  const breakdown = calculatePriceWithMarkup({
    basePrice: subtotal,
    overheadPercent: validated.overheadPercent,
    profitPercent: validated.profitPercent,
    taxPercent: validated.taxPercent,
  })

  return {
    volume: validated.volume,
    unitPrice: validated.unitPrice,
    subtotal: Number(subtotal.toFixed(2)),
    ...breakdown,
  }
}

/**
 * ===========================
 * AHSP SPECIFIC FUNCTIONS
 * ===========================
 */

/**
 * Calculate AHSP final price from components and markup.
 * 
 * This is the complete AHSP pricing formula:
 * 1. Calculate base price from components
 * 2. Apply overhead and profit
 * 
 * @example
 * calculateAHSPPrice({
 *   components: [
 *     { coefficient: 0.1, unitPrice: 152900 },
 *     { coefficient: 0.005, unitPrice: 230000 }
 *   ],
 *   overheadPercent: 10,
 *   profitPercent: 5
 * })
 */
export function calculateAHSPPrice(input: {
  components: ComponentInput[]
  overheadPercent?: number
  profitPercent?: number
}) {
  const componentResult = calculateComponentsTotal(input.components)

  const breakdown = calculatePriceWithMarkup({
    basePrice: componentResult.subtotal,
    overheadPercent: input.overheadPercent,
    profitPercent: input.profitPercent,
    taxPercent: 0, // AHSP typically doesn't include tax
  })

  return {
    componentBreakdown: componentResult,
    priceBreakdown: breakdown,
  }
}

/**
 * ===========================
 * RAB AGGREGATE FUNCTIONS
 * ===========================
 */

/**
 * Calculate RAB totals from multiple items.
 * 
 * @example
 * calculateRABTotals({
 *   items: [
 *     { volume: 10, unitPrice: 1000 },
 *     { volume: 5, unitPrice: 500 }
 *   ],
 *   overheadPercent: 10,
 *   profitPercent: 5,
 *   taxPercent: 11
 * })
 */
export function calculateRABTotals(input: {
  items: Array<{ volume: number; unitPrice: number }>
  overheadPercent?: number
  profitPercent?: number
  taxPercent?: number
}) {
  // Calculate subtotal from all items
  const subtotal = input.items.reduce((sum, item) => {
    return sum + (item.volume * item.unitPrice)
  }, 0)

  // Apply markup to total
  const breakdown = calculatePriceWithMarkup({
    basePrice: subtotal,
    overheadPercent: input.overheadPercent,
    profitPercent: input.profitPercent,
    taxPercent: input.taxPercent,
  })

  return {
    itemCount: input.items.length,
    subtotal: Number(subtotal.toFixed(2)),
    ...breakdown,
  }
}

/**
 * ===========================
 * UTILITY FUNCTIONS
 * ===========================
 */

/**
 * Round price to specified decimal places (default 2).
 */
export function roundPrice(price: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals)
  return Math.round(price * multiplier) / multiplier
}

/**
 * Format percentage for display (e.g., 10 => "10%").
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

/**
 * Calculate percentage from two values.
 */
export function calculatePercentage(part: number, whole: number): number {
  if (whole === 0) return 0
  return (part / whole) * 100
}

/**
 * ===========================
 * VALIDATION HELPERS
 * ===========================
 */

/**
 * Validate if a number is a valid price (non-negative).
 */
export function isValidPrice(price: unknown): price is number {
  return typeof price === 'number' && !isNaN(price) && price >= 0
}

/**
 * Validate if a number is a valid percentage (0-100).
 */
export function isValidPercent(percent: unknown): percent is number {
  return typeof percent === 'number' && !isNaN(percent) && percent >= 0 && percent <= 100
}

/**
 * ===========================
 * EXPORTS
 * ===========================
 */

export default {
  calculatePriceWithMarkup,
  calculateComponentsTotal,
  calculateRABItemTotal,
  calculateAHSPPrice,
  calculateRABTotals,
  roundPrice,
  formatPercent,
  calculatePercentage,
  isValidPrice,
  isValidPercent,
}
