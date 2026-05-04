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
  /** Controls whether profit is calculated on base alone or on (base + overhead). Default: base_plus_overhead */
  profitBasis: z.enum(['base_plus_overhead', 'base']).optional(),
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
  profitBasis: z.enum(['base_plus_overhead', 'base']).optional(),
  /** Anti-double-counting: 'baked_in' skips all markup; 'none' same; default 'project_level' applies markup */
  markupSource: z.enum(['project_level', 'baked_in', 'none']).optional(),
  /** If true, this item IS an overhead line — zeroes overheadPercent to prevent double-counting */
  isOverheadItem: z.boolean().optional(),
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
  /**
   * profitBasis — controls whether profit is compounded on (base + overhead) or applied to base only.
   * Default 'base_plus_overhead' preserves existing SNI-standard behavior.
   */
  profitBasis?: 'base_plus_overhead' | 'base'
}

/** Result type for preventDoubleMarkup() */
export interface DoubleMarkupCheckResult {
  /** True when the input unitPrice appears to already contain markup */
  isDoubleMarkupRisk: boolean
  /** Back-calculated pure base price (markup stripped) */
  strippedBasePrice: number
  /** Human-readable warning message */
  warning: string
}

/** Input type for calculateRABItemTotalSafe() */
export interface RABItemTotalSafeInput {
  volume: number
  unitPrice: number
  overheadPercent?: number
  profitPercent?: number
  taxPercent?: number
  profitBasis?: 'base_plus_overhead' | 'base'
  /** Discriminant: 'baked_in' means unitPrice already includes markup — skip re-applying */
  markupSource?: 'project_level' | 'baked_in' | 'none'
  /** True if this RAB line IS an overhead item — prevents double-applying overheadPercent */
  isOverheadItem?: boolean
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
 *
 * profitBasis controls compound vs simple profit:
 *  - 'base_plus_overhead' (default/SNI): profit = (base + overhead) × profitPct
 *  - 'base': profit = base × profitPct  (avoids OH amplification)
 */
export function calculatePriceWithMarkup(input: PriceInput): PriceBreakdown {
  // Validate input
  const validated = PriceInputSchema.parse(input)

  const basePrice = validated.basePrice
  const overheadPercent = validated.overheadPercent || 0
  const profitPercent = validated.profitPercent || 0
  const taxPercent = validated.taxPercent || 0
  const profitBasis = validated.profitBasis ?? 'base_plus_overhead'

  // Step 1: Apply overhead
  const overheadAmount = basePrice * (overheadPercent / 100)
  const priceWithOverhead = basePrice + overheadAmount

  // Step 2: Apply profit — basis-aware
  //   'base_plus_overhead': profit on (base + overhead)  ← SNI default
  //   'base':              profit on base only           ← simple margin
  const profitBase = profitBasis === 'base' ? basePrice : priceWithOverhead
  const profitAmount = profitBase * (profitPercent / 100)
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
  profitBasis?: 'base_plus_overhead' | 'base'
  markupSource?: 'project_level' | 'baked_in' | 'none'
  isOverheadItem?: boolean
}) {
  // Validate
  const validated = VolumeCalculationSchema.parse(input)

  const subtotal = validated.volume * validated.unitPrice

  // Anti-double-counting: baked_in / none → skip all markup, return subtotal as-is
  if (validated.markupSource === 'baked_in' || validated.markupSource === 'none') {
    return {
      volume: validated.volume,
      unitPrice: validated.unitPrice,
      subtotal: Number(subtotal.toFixed(2)),
      basePrice: Number(subtotal.toFixed(2)),
      overheadAmount: 0,
      overheadPercent: 0,
      priceWithOverhead: Number(subtotal.toFixed(2)),
      profitAmount: 0,
      profitPercent: 0,
      priceWithProfit: Number(subtotal.toFixed(2)),
      taxAmount: 0,
      taxPercent: 0,
      finalPrice: Number(subtotal.toFixed(2)),
    }
  }

  // is_overhead guard: if this line IS an overhead item, applying overheadPercent again = double-count
  const effectiveOverhead = validated.isOverheadItem ? 0 : (validated.overheadPercent ?? 0)

  const breakdown = calculatePriceWithMarkup({
    basePrice: subtotal,
    overheadPercent: effectiveOverhead,
    profitPercent: validated.profitPercent,
    taxPercent: validated.taxPercent,
    profitBasis: validated.profitBasis,
  })

  return {
    volume: validated.volume,
    unitPrice: validated.unitPrice,
    subtotal: Number(subtotal.toFixed(2)),
    ...breakdown,
  }
}

/**
 * calculateRABItemTotalSafe
 *
 * Type-safe wrapper that accepts RABItem-shaped input including markup_source and is_overhead.
 * Preferred entry point for all RAB item cost calculations — replaces ad-hoc calls to
 * calculateRABItemTotal with raw inputs.
 *
 * Rules applied (in order):
 *  1. markup_source === 'baked_in' | 'none' → return volume × unitPrice, no markup
 *  2. is_overhead === true → zero out overheadPercent (item IS overhead; don't stack)
 *  3. profitBasis controls compound vs simple profit
 */
export function calculateRABItemTotalSafe(input: RABItemTotalSafeInput) {
  return calculateRABItemTotal({
    volume: input.volume,
    unitPrice: input.unitPrice,
    overheadPercent: input.overheadPercent,
    profitPercent: input.profitPercent,
    taxPercent: input.taxPercent,
    profitBasis: input.profitBasis,
    markupSource: input.markupSource ?? 'project_level',
    isOverheadItem: input.isOverheadItem ?? false,
  })
}

/**
 * preventDoubleMarkup
 *
 * Pure validation helper. Given an AHSP finalPrice and the overhead/profit percentages
 * that were applied to produce it, checks whether passing that price into a new
 * markup calculation would constitute double-counting.
 *
 * Returns:
 *  - isDoubleMarkupRisk: true when the markup multiplier > 1 (i.e. markup IS applied)
 *  - strippedBasePrice: the back-calculated pure base cost (markup removed)
 *  - warning: human-readable message for UI display or console warning
 *
 * @example
 *   preventDoubleMarkup(1210, 10, 0)  // ahsp finalPrice=1210, OH=10%, profit=0%
 *   // → { isDoubleMarkupRisk: true, strippedBasePrice: 1100, warning: '...' }
 */
export function preventDoubleMarkup(
  ahspFinalPrice: number,
  ahspOverheadPct: number,
  ahspProfitPct: number,
  ahspProfitBasis: 'base_plus_overhead' | 'base' = 'base_plus_overhead',
): DoubleMarkupCheckResult {
  const oh = Math.max(0, ahspOverheadPct || 0)
  const p = Math.max(0, ahspProfitPct || 0)

  // Compute the combined markup multiplier that was applied
  const ohMultiplier = 1 + oh / 100
  const profitMultiplier = ahspProfitBasis === 'base'
    ? 1 + p / 100
    : 1 + p / 100  // profit amount differs but total multiplier chain is the same

  // When profitBasis === 'base_plus_overhead': finalPrice = base × ohM × profitM_on_ohPrice
  // When profitBasis === 'base':               finalPrice = base × ohM + base × profitPct
  //   = base × (ohM + profitPct/100)
  let divisor: number
  if (ahspProfitBasis === 'base') {
    divisor = ohMultiplier + p / 100
  } else {
    divisor = ohMultiplier * profitMultiplier
  }

  const strippedBasePrice = divisor > 0 ? ahspFinalPrice / divisor : ahspFinalPrice
  const isDoubleMarkupRisk = (oh > 0 || p > 0)

  const warning = isDoubleMarkupRisk
    ? `Unit price Rp ${ahspFinalPrice.toLocaleString('id-ID')} contains embedded markup ` +
      `(OH ${oh}% + Profit ${p}%). ` +
      `Setting markup_source='baked_in' will use this price as-is. ` +
      `Stripped base cost ≈ Rp ${Math.round(strippedBasePrice).toLocaleString('id-ID')}.`
    : 'No markup detected in AHSP price — safe to apply project-level markup.'

  return { isDoubleMarkupRisk, strippedBasePrice: Number(strippedBasePrice.toFixed(2)), warning }
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
  calculateRABItemTotalSafe,
  preventDoubleMarkup,
  calculateAHSPPrice,
  calculateRABTotals,
  roundPrice,
  formatPercent,
  calculatePercentage,
  isValidPrice,
  isValidPercent,
}
