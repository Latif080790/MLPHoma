/**
 * marginSettings.ts
 * Pure resolver for project-level margin configuration stored in project.meta.
 */

export type MarginMode = 'fixed' | 'per_item'
export type CostBasis = 'rap' | 'rapp'

export interface MarginSettings {
  marginMode: MarginMode
  defaultMarginPct: number
  costBasis: CostBasis
  itemMargins: Record<string, number>
}

const DEFAULTS: MarginSettings = {
  marginMode: 'fixed',
  defaultMarginPct: 0,
  costBasis: 'rap',
  itemMargins: {},
}

/** Read margin settings from an arbitrary project.meta object with safe defaults. */
export function readMarginSettings(meta: unknown): MarginSettings {
  const m = (meta ?? {}) as Record<string, unknown>
  const marginMode: MarginMode = m.marginMode === 'per_item' ? 'per_item' : DEFAULTS.marginMode
  const costBasis: CostBasis = m.costBasis === 'rapp' ? 'rapp' : DEFAULTS.costBasis
  const defaultMarginPct = Number.isFinite(Number(m.defaultMarginPct)) ? Number(m.defaultMarginPct) : DEFAULTS.defaultMarginPct

  const itemMargins =
    m.itemMargins && typeof m.itemMargins === 'object'
      ? (m.itemMargins as Record<string, number>)
      : DEFAULTS.itemMargins

  return { marginMode, defaultMarginPct, costBasis, itemMargins }
}

/** Resolve the effective margin percentage for a given RAB item id. */
export function effectiveMarginPct(settings: MarginSettings, rabItemId: string): number {
  if (settings.marginMode === 'fixed') return settings.defaultMarginPct
  const override = settings.itemMargins[rabItemId]
  return Number.isFinite(override) ? override : settings.defaultMarginPct
}
