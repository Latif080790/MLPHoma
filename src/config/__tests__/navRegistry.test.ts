import { describe, expect, it } from 'vitest'
import {
  NAV_REGISTRY,
  getBreadcrumbLabel,
  getCommandPaletteItems,
  getProtectedRouteItems,
  getSidebarGroups,
} from '../navRegistry'
import { MODULE_ROUTES } from '../routes'

describe('navRegistry Wave 1 parity', () => {
  it('ensures nav ids and paths are unique', () => {
    const ids = NAV_REGISTRY.map((item) => item.id)
    const paths = NAV_REGISTRY.map((item) => item.path)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('builds sidebar groups with stable group order', () => {
    const groups = getSidebarGroups()
    expect(groups.map((group) => group.label)).toEqual([
      'Overview',
      'Cost Control',
      'Schedule',
      'Operations',
      'Portfolio',
      'System',
    ])

    const sidebarItems = groups.flatMap((group) => group.items)
    expect(sidebarItems.length).toBeGreaterThan(0)
    expect(sidebarItems.every((item) => item.inSidebar)).toBe(true)
  })

  it('maps breadcrumb labels for critical routes', () => {
    expect(getBreadcrumbLabel('/')).toBe('Command Center')
    expect(getBreadcrumbLabel('/cost-forecast')).toBe('Cost Forecast')
    expect(getBreadcrumbLabel('/portfolio-resources')).toBe('Portfolio Resources')
    expect(getBreadcrumbLabel('/portfolio-analytics')).toBe('Portfolio Analytics')
    expect(getBreadcrumbLabel('/strategy-simulation')).toBe('Strategy Simulation')
  })

  it('keeps command palette and protected routes in sync with registry', () => {
    const palette = getCommandPaletteItems()
    const protectedRoutes = getProtectedRouteItems()

    expect(palette.every((item) => item.inCommandPalette)).toBe(true)
    expect(protectedRoutes.every((item) => item.protected && item.componentKey)).toBe(true)

    const palettePaths = new Set(palette.map((item) => item.path))
    const protectedPaths = new Set(protectedRoutes.map((item) => item.path))

    expect(palettePaths).toEqual(protectedPaths)
  })

  it('exposes module routes for all registry ids plus legacy aliases', () => {
    for (const item of NAV_REGISTRY) {
      expect(MODULE_ROUTES[item.id as keyof typeof MODULE_ROUTES]).toBe(item.path)
    }

    expect(MODULE_ROUTES['change-order']).toBe('/change-management')
    expect(MODULE_ROUTES['wbs']).toBe('/wbs')
    expect(MODULE_ROUTES['rap']).toBe('/rap')
  })
})
