/**
 * SnapshotDiffViewer.tsx
 *
 * Small utility component that shows a JSON diff between two objects.
 * The diff is rendered as a list of changed paths with before / after values.
 */

import React, { FC, useMemo } from 'react'

/**
 * DiffEntry
 * Represents a single change at a dot-separated path.
 */
interface DiffEntry {
  path: string
  before: any
  after: any
}

/**
 * Props for SnapshotDiffViewer
 */
interface Props {
  /** Current object snapshot (base) */
  base?: any | null
  /** Snapshot to compare against base */
  compare?: any | null
}

/**
 * deepDiff
 *
 * Compute simple differences between two objects.
 * - Returns array of DiffEntry with dot-paths.
 *
 * Note: purposefully lightweight — not a full structural diff engine.
 *
 * @param a - base object
 * @param b - compare object
 * @returns DiffEntry[]
 */
function deepDiff(a: any, b: any, prefix = ''): DiffEntry[] {
  const entries: DiffEntry[] = []

  // Helper to check plain objects
  const isObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v)

  const keys = new Set<string>()
  if (isObject(a)) Object.keys(a).forEach((k) => keys.add(k))
  if (isObject(b)) Object.keys(b).forEach((k) => keys.add(k))

  keys.forEach((k) => {
    const p = prefix ? `${prefix}.${k}` : k
    const va = isObject(a) ? a[k] : undefined
    const vb = isObject(b) ? b[k] : undefined

    if (isObject(va) || isObject(vb)) {
      entries.push(...deepDiff(va, vb, p))
      return
    }

    // Arrays and primitives comparison
    const same =
      Array.isArray(va) && Array.isArray(vb)
        ? JSON.stringify(va) === JSON.stringify(vb)
        : va === vb

    if (!same) {
      entries.push({ path: p, before: va, after: vb })
    }
  })

  // If top-level values are not objects (e.g., primitives), handle full replace
  if (!isObject(a) && !isObject(b)) {
    if (a !== b) entries.push({ path: prefix || 'root', before: a, after: b })
  }

  return entries
}

/**
 * SnapshotDiffViewer
 *
 * Renders differences between base and compare objects in a compact list.
 */
const SnapshotDiffViewer: FC<Props> = ({ base, compare }) => {
  const diffs = useMemo(() => deepDiff(base ?? {}, compare ?? {}), [base, compare])

  if (!base && !compare) {
    return <div className="text-xs text-neutral-500">No data to compare.</div>
  }

  if (diffs.length === 0) {
    return <div className="text-xs text-green-600">No differences detected.</div>
  }

  return (
    <div className="max-h-56 overflow-auto text-xs">
      <ul className="space-y-2">
        {diffs.map((d) => (
          <li key={d.path} className="rounded-md border p-2 dark:border-neutral-800">
            <div className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 mb-1">{d.path}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-rose-600">
                <div className="text-[11px] text-neutral-500">Before</div>
                <pre className="whitespace-pre-wrap text-[12px]">{JSON.stringify(d.before, null, 2)}</pre>
              </div>
              <div className="text-green-600">
                <div className="text-[11px] text-neutral-500">After</div>
                <pre className="whitespace-pre-wrap text-[12px]">{JSON.stringify(d.after, null, 2)}</pre>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SnapshotDiffViewer