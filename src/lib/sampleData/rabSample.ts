/**
 * rabSample.ts
 *
 * Small sample RAB dataset and helper utilities used by ImpactAnalysis.
 * This file provides realistic sample items so the UI can calculate a
 * quick impact preview when configuration values (overhead/profit/tax) change.
 */

import type { FeatureConfig } from '../../config/featureSchema'

/**
 * Minimal RAB item representation for sample calculations.
 */
export interface RabItem {
  id: string
  description: string
  unit: string
  volume: number
  unitPrice: number
}

/**
 * A small representative sample set (based on templates in repository).
 * Values are intentionally modest so calculations remain readable.
 */
export const SAMPLE_RAB_ITEMS: RabItem[] = [
  { id: 'RAB-001', description: 'Galian Tanah Pondasi', unit: 'm3', volume: 285.5, unitPrice: 78750 },
  { id: 'RAB-002', description: 'Urugan Pasir Bawah Pondasi', unit: 'm3', volume: 95.5, unitPrice: 212250 },
  { id: 'RAB-003', description: 'Beton Pondasi Footplate (K-225)', unit: 'm3', volume: 86.4, unitPrice: 945125 },
  { id: 'RAB-004', description: 'Pembesian Pondasi D13', unit: 'kg', volume: 5184, unitPrice: 14903 },
  { id: 'RAB-005', description: 'Pasangan Dinding Bata Merah', unit: 'm2', volume: 2856, unitPrice: 93825 },
]

/**
 * computeRABTotals
 *
 * Compute subtotal and sequentially apply overhead, profit and tax to generate breakdowns.
 *
 * @param items - array of RabItem
 * @param overrides - optionally pass percentages to override defaults (object shape matches RABConfig.calculation)
 * @returns breakdown with subtotal, overheadAmount, profitAmount, taxAmount and finalTotal
 */
export function computeRABTotals(items: RabItem[], overrides?: { overheadPct?: number; profitPct?: number; taxPct?: number }) {
  const subtotal = items.reduce((s, it) => s + it.volume * it.unitPrice, 0)
  const overheadPct = typeof overrides?.overheadPct === 'number' ? overrides.overheadPct : 10
  const profitPct = typeof overrides?.profitPct === 'number' ? overrides.profitPct : 8
  const taxPct = typeof overrides?.taxPct === 'number' ? overrides.taxPct : 11

  const overheadAmount = subtotal * (overheadPct / 100)
  const afterOverhead = subtotal + overheadAmount
  const profitAmount = afterOverhead * (profitPct / 100)
  const afterProfit = afterOverhead + profitAmount
  const taxAmount = afterProfit * (taxPct / 100)
  const finalTotal = afterProfit + taxAmount

  return {
    subtotal,
    overheadPct,
    overheadAmount,
    afterOverhead,
    profitPct,
    profitAmount,
    afterProfit,
    taxPct,
    taxAmount,
    finalTotal,
  }
}

/**
 * computeUsingFeatureConfig
 *
 * Convenience wrapper that reads percentages from FeatureConfig.rab.calculation when available.
 *
 * @param items - RabItem[]
 * @param cfg - FeatureConfig (optional)
 */
export function computeUsingFeatureConfig(items: RabItem[], cfg?: Partial<FeatureConfig>) {
  const overrides = {
    overheadPct: cfg?.rab?.calculation?.includeOverheadPct,
    profitPct: cfg?.rab?.calculation?.includeProfitPct,
    taxPct: cfg?.rab?.calculation?.includeTaxPct,
  }
  return computeRABTotals(items, overrides)
}