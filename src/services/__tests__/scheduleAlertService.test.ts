/**
 * scheduleAlertService.test.ts
 * Unit tests for scheduleAlertService parsing and threshold behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any>

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

const mockFrom = vi.fn((table: string) => {
  const result = tableResults[table] ?? { data: null, error: null }
  return makeChain(result)
})

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => mockFrom(table) }),
}))

import { scheduleAlertService } from '../scheduleAlertService'

describe('scheduleAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tableResults = {}
  })

  it('normalizes object-based dependencies and returns critical path tasks', async () => {
    tableResults = {
      timeline_tasks: {
        data: [
          {
            id: 't1',
            name: 'Task 1',
            start_date: '2025-01-01',
            end_date: '2025-01-03',
            dependencies: [],
            duration: 3,
          },
          {
            id: 't2',
            name: 'Task 2',
            start_date: '2025-01-04',
            end_date: '2025-01-06',
            dependencies: [{ predecessorId: 't1', successorId: 't2', type: 'FS', lag: 0 }],
            duration: 3,
          },
        ],
        error: null,
      },
    }

    const result = await scheduleAlertService.getCriticalPath('proj-1')
    expect(result.criticalTasks.length).toBeGreaterThan(0)
    expect(result.criticalTasks).toContain('t1')
    expect(result.criticalTasks).toContain('t2')
  })

  it('supports stricter thresholds through getProjectAlerts options', async () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 4)
    const end = new Date(now)
    end.setDate(end.getDate() + 6)

    tableResults = {
      timeline_tasks: {
        data: [
          {
            id: 't1',
            name: 'Slow Task',
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            progress: 20,
            dependencies: [],
            duration: 10,
          },
        ],
        error: null,
      },
    }

    const defaultAlerts = await scheduleAlertService.getProjectAlerts('proj-1')
    const strictAlerts = await scheduleAlertService.getProjectAlerts('proj-1', {
      minProgressGapPercent: 1,
      moderateDays: 2,
      criticalDays: 4,
    })

    expect(strictAlerts.length).toBeGreaterThanOrEqual(defaultAlerts.length)
    if (strictAlerts.length > 0 && defaultAlerts.length > 0) {
      const order = { CRITICAL: 3, MODERATE: 2, MINOR: 1 }
      expect(order[strictAlerts[0].severity]).toBeGreaterThanOrEqual(order[defaultAlerts[0].severity])
    }
  })

  it('returns default threshold config', () => {
    const cfg = scheduleAlertService.getDefaultThresholds()
    expect(cfg.minorDays).toBe(2)
    expect(cfg.moderateDays).toBe(5)
    expect(cfg.criticalDays).toBe(10)
    expect(cfg.minProgressGapPercent).toBe(5)
  })
})
