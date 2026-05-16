/**
 * qhseService.test.ts
 * Unit tests for qhseService: Incidents, Inspections, IBPR, Summary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

import { qhseService } from '../qhseService'

// ─── Mock chain builder ───────────────────────────────────────────────────────
function makeChain(result: any) {
  const c: any = {}
  const terminal = () => Promise.resolve(result)
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.insert = () => c
  c.update = () => c
  c.single = terminal
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

// ─── Safety Incidents ─────────────────────────────────────────────────────────

describe('qhseService — getIncidents', () => {
  beforeEach(() => {
    mockFromImpl = () => makeChain({ data: [], error: null })
  })

  it('returns incidents with attachments defaulting to []', async () => {
    mockFromImpl = () => makeChain({
      data: [
        { id: 'i1', project_id: 'P-001', type: 'NEAR_MISS', attachments: null },
        { id: 'i2', project_id: 'P-001', type: 'FIRST_AID', attachments: ['file.pdf'] },
      ],
      error: null,
    })
    const result = await qhseService.getIncidents('P-001')
    expect(result[0].attachments).toEqual([])
    expect(result[1].attachments).toEqual(['file.pdf'])
  })

  it('throws on supabase error', async () => {
    mockFromImpl = () => makeChain({ data: null, error: new Error('DB error') })
    await expect(qhseService.getIncidents('P-001')).rejects.toThrow('DB error')
  })
})

describe('qhseService — createIncident', () => {
  it('inserts and returns new incident', async () => {
    const newIncident = { id: 'i3', project_id: 'P-001', type: 'NEAR_MISS', attachments: [] }
    mockFromImpl = () => makeChain({ data: newIncident, error: null })
    const result = await qhseService.createIncident({ project_id: 'P-001', type: 'NEAR_MISS' } as any)
    expect(result.type).toBe('NEAR_MISS')
    expect(result.attachments).toEqual([])
  })
})

// ─── HSE Inspections ─────────────────────────────────────────────────────────

describe('qhseService — getInspections', () => {
  it('returns inspections with array fields defaulting to []', async () => {
    mockFromImpl = () => makeChain({
      data: [
        { id: 'ins1', checklist: null, findings: null, action_items: null },
      ],
      error: null,
    })
    const result = await qhseService.getInspections('P-001')
    expect(result[0].checklist).toEqual([])
    expect(result[0].findings).toEqual([])
    expect(result[0].action_items).toEqual([])
  })
})

describe('qhseService — completeInspection', () => {
  it('resolves without error on success', async () => {
    mockFromImpl = () => makeChain({ error: null })
    await expect(qhseService.completeInspection('ins1', 85, [], [])).resolves.toBeUndefined()
  })

  it('throws on supabase error', async () => {
    mockFromImpl = () => makeChain({ error: new Error('Update failed') })
    await expect(qhseService.completeInspection('ins1', 85, [], [])).rejects.toThrow('Update failed')
  })
})

// ─── IBPR ────────────────────────────────────────────────────────────────────

describe('qhseService — getIBPR', () => {
  it('returns IBPR entries', async () => {
    const mockIBPR = [{ id: 'r1', project_id: 'P-001', risk_level: 'CRITICAL', status: 'ACTIVE' }]
    mockFromImpl = () => makeChain({ data: mockIBPR, error: null })
    const result = await qhseService.getIBPR('P-001')
    expect(result).toHaveLength(1)
    expect(result[0].risk_level).toBe('CRITICAL')
  })
})

// ─── Summary ─────────────────────────────────────────────────────────────────

describe('qhseService — getSummary', () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const pastDate = '2020-01-01'

  beforeEach(() => {
    let callCount = 0
    mockFromImpl = () => {
      callCount++
      const datasets: any[] = [
        // incidents
        { data: [
          { type: 'NEAR_MISS' },
          { type: 'LOST_TIME' },
          { type: 'FATALITY' },
          { type: 'MEDICAL_TREATMENT' },
        ], error: null },
        // inspections
        { data: [
          { status: 'COMPLETED', score: 80, max_score: 100, scheduled_date: pastDate },
          { status: 'COMPLETED', score: 90, max_score: 100, scheduled_date: pastDate },
          { status: 'PLANNED', score: null, max_score: 100, scheduled_date: pastDate },  // overdue
          { status: 'IN_PROGRESS', score: null, max_score: 100, scheduled_date: futureDate },  // open not overdue
        ], error: null },
        // ibpr
        { data: [
          { risk_level: 'CRITICAL', status: 'ACTIVE' },
          { risk_level: 'HIGH', status: 'CLOSED' },
        ], error: null },
      ]
      return makeChain(datasets[callCount - 1] ?? { data: [], error: null })
    }
  })

  it('computes LTI count correctly', async () => {
    const summary = await qhseService.getSummary('P-001')
    // LOST_TIME + FATALITY = 2
    expect(summary.ltiCount).toBe(2)
  })

  it('computes near miss count', async () => {
    const summary = await qhseService.getSummary('P-001')
    expect(summary.nearMissCount).toBe(1)
  })

  it('computes TRIR (recordable incidents × 200000 / 10000)', async () => {
    const summary = await qhseService.getSummary('P-001')
    // Recordable: MEDICAL_TREATMENT + LOST_TIME + FATALITY = 3
    // TRIR = 3 × 200000 / 10000 = 60
    expect(summary.trir).toBe(60)
  })

  it('computes average inspection score', async () => {
    const summary = await qhseService.getSummary('P-001')
    // Completed: score 80/100 = 80%, score 90/100 = 90% → avg = 85%
    expect(summary.avgInspectionScore).toBe(85)
  })

  it('counts critical hazards (ACTIVE only)', async () => {
    const summary = await qhseService.getSummary('P-001')
    // Only 1 CRITICAL + ACTIVE
    expect(summary.criticalHazards).toBe(1)
  })

  it('counts overdue inspections', async () => {
    const summary = await qhseService.getSummary('P-001')
    // PLANNED with past scheduled_date → overdue = 1
    expect(summary.overdueInspections).toBe(1)
  })
})

// ─── Number generators ────────────────────────────────────────────────────────

describe('qhseService — generateIncidentNumber', () => {
  it('produces INC-YYMM-XXXX format', () => {
    const num = qhseService.generateIncidentNumber()
    expect(num).toMatch(/^INC-\d{4}-\d{4}$/)
  })
})

describe('qhseService — generateInspectionNumber', () => {
  it('produces INS-PROJ-XXXXX format', () => {
    const num = qhseService.generateInspectionNumber('PROJ-1')
    expect(num).toMatch(/^INS-PROJ-\d+$/)
  })
})
