/**
 * cpm.ts
 *
 * Critical Path Method utilities.
 *
 * - computeCPM(tasks): Runs topological sort and computes ES/EF (forward pass),
 *   LS/LF (backward pass) and TF (total float) for FS dependencies with lag support.
 * - Handles cycles by returning an empty metrics map and marking project as cyclic.
 *
 * Notes:
 * - Tasks: { id, duration, dependencies?: [{ predecessorId, type?, lag? }] }
 * - Dependency types other than 'FS' are ignored in this simple CPM (can be extended).
 */

export interface CPMDependency {
  predecessorId: string
  type?: 'FS' | 'SS' | 'FF' | 'SF'
  lag?: number
}

export interface CPMTask {
  id: string
  duration: number
  dependencies?: CPMDependency[]
}

export interface CPMMetrics {
  ES: number
  EF: number
  LS: number
  LF: number
  TF: number
}

export interface CPMResult {
  metrics: Record<string, CPMMetrics>
  criticalIds: Set<string>
  projectDuration: number
  order: string[] // topological order (if cyclic, may be shorter)
  cyclic: boolean
}

/**
 * computeCPM
 * Compute CPM metrics for given tasks (FS + lag considered).
 *
 * @param tasks array of CPMTask
 * @returns CPMResult
 */
export function computeCPM(tasks: CPMTask[]): CPMResult {
  const ids = tasks.map((t) => t.id)
  const dur: Record<string, number> = {}
  const preds: Record<string, Array<{ id: string; lag: number }>> = {}
  const succs: Record<string, Array<{ id: string; lag: number }>> = {}

  ids.forEach((id) => {
    const t = tasks.find((x) => x.id === id)
    dur[id] = Math.max(1, Number(t?.duration || 1))
    preds[id] = []
    succs[id] = []
  })

  tasks.forEach((t) => {
    const deps = t.dependencies || []
    deps.forEach((d) => {
      if (!d || !d.predecessorId) return
      if (!ids.includes(d.predecessorId)) return
      // only handle FS for now (can extend)
      if (d.type && d.type !== 'FS') return
      const lag = Number.isFinite(d.lag as number) ? (d.lag as number) : 0
      preds[t.id].push({ id: d.predecessorId, lag })
      succs[d.predecessorId].push({ id: t.id, lag })
    })
  })

  // Kahn's algorithm for topological sort to detect cycles
  const indeg: Record<string, number> = {}
  ids.forEach((id) => (indeg[id] = preds[id].length))
  const q: string[] = []
  ids.forEach((id) => {
    if (indeg[id] === 0) q.push(id)
  })
  const order: string[] = []
  while (q.length) {
    const u = q.shift()!
    order.push(u)
    succs[u].forEach((v) => {
      indeg[v.id] -= 1
      if (indeg[v.id] === 0) q.push(v.id)
    })
  }

  const cyclic = order.length !== ids.length
  // if cyclic, return safe empty result
  if (cyclic) {
    return {
      metrics: {},
      criticalIds: new Set<string>(),
      projectDuration: 0,
      order,
      cyclic: true,
    }
  }

  // Forward pass
  const ES: Record<string, number> = {}
  const EF: Record<string, number> = {}
  order.forEach((id) => {
    const earliest = preds[id].reduce((m, p) => Math.max(m, (EF[p.id] ?? 0) + (p.lag || 0)), 0)
    ES[id] = earliest
    EF[id] = ES[id] + dur[id]
  })
  const projectDuration = Math.max(...order.map((id) => EF[id] ?? 0))

  // Backward pass
  const LS: Record<string, number> = {}
  const LF: Record<string, number> = {}
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    if (!succs[id] || succs[id].length === 0) {
      LF[id] = projectDuration
    } else {
      LF[id] = Math.min(...succs[id].map((s) => (LS[s.id] ?? 0) - (s.lag || 0)))
    }
    LS[id] = (LF[id] ?? 0) - dur[id]
  }

  const metrics: Record<string, CPMMetrics> = {}
  const TF: Record<string, number> = {}
  ids.forEach((id) => {
    TF[id] = (LS[id] ?? 0) - (ES[id] ?? 0)
    metrics[id] = {
      ES: ES[id] ?? 0,
      EF: EF[id] ?? 0,
      LS: LS[id] ?? 0,
      LF: LF[id] ?? 0,
      TF: TF[id] ?? 0,
    }
  })

  const criticalIds = new Set(ids.filter((id) => (TF[id] ?? 0) === 0))

  return {
    metrics,
    criticalIds,
    projectDuration,
    order,
    cyclic: false,
  }
}

export default { computeCPM }