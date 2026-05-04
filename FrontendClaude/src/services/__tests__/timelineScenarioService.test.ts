import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null }) }),
}))

import { timelineScenarioService } from '../timelineScenarioService'

describe('timelineScenarioService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('propagates predecessor delay to dependent tasks', async () => {
    tableResults.timeline_tasks = {
      data: [
        { id: 'a', name: 'A', wbs_id: 'w1', start_date: '2026-01-01', end_date: '2026-01-03', duration_days: 2, dependencies: [] },
        { id: 'b', name: 'B', wbs_id: 'w1', start_date: '2026-01-03', end_date: '2026-01-05', duration_days: 2, dependencies: ['a'] },
      ],
      error: null,
    }

    const result = await timelineScenarioService.runScenario('p1', 'Delay A', [
      {
        taskId: 'a',
        taskName: 'A',
        field: 'duration_days',
        originalValue: 2,
        newValue: 5,
      },
    ])

    expect(result.totalDelayDays).toBeGreaterThan(0)
    expect(result.tasks.find((t) => t.id === 'b')?.deltaFromOriginal).toBeGreaterThanOrEqual(0)
    expect(result.impactSummary.length).toBeGreaterThan(0)
  })
})
