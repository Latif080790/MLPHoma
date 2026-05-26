/**
 * criticalPathService.test.ts
 * Tests for CPM dependency types — verifies ARCH-01/CPM-01 fix:
 * SS dependency uses earlyStart of predecessor (not earlyFinish).
 */

import { describe, it, expect } from 'vitest'
import { criticalPathService } from '../criticalPathService'
import type { TimelineTask } from '../../store/timelineStore'

// ---------- Helpers ----------

function makeTask(
  id: string,
  name: string,
  startDate: string,
  endDate: string,
  deps: TimelineTask['dependencies'] = []
): TimelineTask {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return {
    id,
    name,
    projectId: 'test-project',
    startDate,
    endDate,
    duration,
    progress: 0,
    status: 'not_started',
    priority: 'medium',
    dependencies: deps,
    wbsCode: id,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }
}

// ---------- Tests ----------

describe('criticalPathService.calculateCPM', () => {
  const projectStart = new Date('2025-01-01')

  it('SS dependency: B.earlyStart = A.earlyStart + lag (not A.earlyFinish + lag)', () => {
    // Task A: duration 5 days (Jan 1–5)
    // Task B: SS with lag 2, duration 3 days
    // Expected: B.earlyStart = A.earlyStart(0) + 2 = 2  (NOT A.earlyFinish(5) + 2 = 7)
    const taskA = makeTask('A', 'Task A', '2025-01-01', '2025-01-05')
    const taskB = makeTask('B', 'Task B', '2025-01-01', '2025-01-03', [
      { id: 'dep-ab', predecessorId: 'A', successorId: 'B', type: 'SS', lag: 2 },
    ])

    const nodes = criticalPathService.calculateCPM([taskA, taskB], projectStart, false)

    const nodeA = nodes.find(n => n.id === 'A')!
    const nodeB = nodes.find(n => n.id === 'B')!

    // A starts at day 0
    expect(nodeA.earlyStart).toBe(0)
    // A duration = 5 days → earlyFinish = 5
    expect(nodeA.earlyFinish).toBe(5)

    // SS: B.earlyStart = A.earlyStart + lag = 0 + 2 = 2
    expect(nodeB.earlyStart).toBe(2)
    // B must NOT start at A.earlyFinish + lag = 7 (that would be FS behavior)
    expect(nodeB.earlyStart).not.toBe(7)
  })

  it('FS dependency: B.earlyStart = A.earlyFinish + lag', () => {
    // Verify FS (default) behavior is not broken by SS fix
    const taskA = makeTask('A', 'Task A', '2025-01-01', '2025-01-05')
    const taskB = makeTask('B', 'Task B', '2025-01-06', '2025-01-08', [
      { id: 'dep-fs', predecessorId: 'A', successorId: 'B', type: 'FS', lag: 0 },
    ])

    const nodes = criticalPathService.calculateCPM([taskA, taskB], projectStart, false)

    const nodeA = nodes.find(n => n.id === 'A')!
    const nodeB = nodes.find(n => n.id === 'B')!

    // FS: B.earlyStart = A.earlyFinish + 0 = 5
    expect(nodeB.earlyStart).toBe(nodeA.earlyFinish)
  })

  it('SS dependency with lag 0: B.earlyStart = A.earlyStart', () => {
    const taskA = makeTask('A', 'Task A', '2025-01-01', '2025-01-10')
    const taskB = makeTask('B', 'Task B', '2025-01-01', '2025-01-05', [
      { id: 'dep-ss0', predecessorId: 'A', successorId: 'B', type: 'SS', lag: 0 },
    ])

    const nodes = criticalPathService.calculateCPM([taskA, taskB], projectStart, false)

    const nodeA = nodes.find(n => n.id === 'A')!
    const nodeB = nodes.find(n => n.id === 'B')!

    expect(nodeB.earlyStart).toBe(nodeA.earlyStart)
    expect(nodeB.earlyStart).toBe(0)
  })

  it('task with no dependencies starts at day 0', () => {
    const taskA = makeTask('A', 'Only Task', '2025-01-01', '2025-01-07')

    const nodes = criticalPathService.calculateCPM([taskA], projectStart, false)

    expect(nodes[0].earlyStart).toBe(0)
    expect(nodes[0].isCritical).toBe(true)
  })
})
