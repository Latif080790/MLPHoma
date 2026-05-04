/**
 * SnapshotManager.tsx
 *
 * UI for listing, saving, restoring and deleting named snapshots for a project.
 * - Uses useFeatureStore snapshot helpers (saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot).
 * - Shows a SnapshotDiffViewer for the currently selected snapshot vs current config.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Trash2, Save, RefreshCw } from 'lucide-react'
import useFeatureStore, { FeatureSnapshot } from '../../store/featureStore'
import { toast } from 'sonner'
import SnapshotDiffViewer from './SnapshotDiffViewer'

/**
 * Props for SnapshotManager
 */
interface Props {
  projectId: string
  /** Current live config to compare diff against */
  currentConfig?: unknown
  /** Optional callback invoked after restore (receives restored config) */
  onRestore?: (cfg: unknown) => void
}

/**
 * SnapshotManager
 *
 * Provides snapshot lifecycle controls:
 * - Save current config as named snapshot
 * - List existing snapshots
 * - Restore snapshot (writes to store & triggers onRestore)
 * - Delete snapshot
 */
export default function SnapshotManager({ projectId, currentConfig, onRestore }: Props) {
  const listSnapshots = useFeatureStore((s) => s.listSnapshots)
  const saveSnapshotFn = useFeatureStore((s) => s.saveSnapshot)
  const restoreSnapshotFn = useFeatureStore((s) => s.restoreSnapshot)
  const deleteSnapshotFn = useFeatureStore((s) => s.deleteSnapshot)

  const [snapshots, setSnapshots] = useState<FeatureSnapshot[]>([])
  const [name, setName] = useState<string>('')
  const [selected, setSelected] = useState<FeatureSnapshot | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!projectId) {
      setSnapshots([])
      return
    }
    setSnapshots(listSnapshots(projectId))
  }, [projectId, listSnapshots])

  /**
   * handleSave
   *
   * Save a new snapshot with given name (or default)
   */
  function handleSave() {
    if (!projectId) return
    setSaving(true)
    try {
      const snap = saveSnapshotFn(projectId, name || undefined)
      // refresh list and select created snapshot
      const updated = listSnapshots(projectId)
      setSnapshots(updated)
      setSelected(snap)
      setName('')
    } catch (e) {
      toast.error('Failed to save snapshot', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  /**
   * handleRestore
   *
   * Restore snapshot by id and notify parent via onRestore
   */
  function handleRestore(id?: string) {
    if (!projectId || !id) return
    const cfg = restoreSnapshotFn(projectId, id)
    // update snapshot list & selection
    setSnapshots(listSnapshots(projectId))
    const found = snapshots.find((s) => s.id === id) ?? null
    setSelected(found)
    if (onRestore && cfg) onRestore(cfg)
  }

  /**
   * handleDelete
   *
   * Remove snapshot and refresh list.
   */
  function handleDelete(id?: string) {
    if (!projectId || !id) return
    deleteSnapshotFn(projectId, id)
    const updated = listSnapshots(projectId)
    setSnapshots(updated)
    if (selected?.id === id) setSelected(null)
  }

  const listItems = useMemo(() => snapshots, [snapshots])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-medium">Snapshots</h5>
          <div className="text-xs text-neutral-500">Save versions of feature configuration</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent" size="sm" onClick={() => setSnapshots(listSnapshots(projectId))}>
            <RefreshCw className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Snapshot name (optional)"
            className="flex-1 rounded-md border px-2 py-1 text-sm dark:border-neutral-800"
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2" />
            Save
          </Button>
        </div>

        <div className="max-h-40 overflow-auto rounded-md border p-2 dark:border-neutral-800">
          {listItems.length === 0 ? (
            <div className="text-xs text-neutral-500">No snapshots yet.</div>
          ) : (
            <ul className="space-y-2">
              {listItems.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <button
                      type="button"
                      className={`w-full text-left ${selected?.id === s.id ? 'font-medium' : 'text-sm text-neutral-700 dark:text-neutral-300'}`}
                      onClick={() => setSelected(s)}
                    >
                      <div className="text-sm">{s.name}</div>
                      <div className="text-xs text-neutral-500">{new Date(s.createdAt).toLocaleString()}</div>
                    </button>
                  </div>

                  <div className="flex gap-1">
                    <Button variant="outline" className="bg-transparent" size="sm" onClick={() => handleRestore(s.id)}>
                      Restore
                    </Button>
                    <Button variant="ghost" className="text-rose-600" size="sm" onClick={() => handleDelete(s.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h6 className="text-xs font-medium mb-1">Selected snapshot diff</h6>
          <div className="rounded-md border p-2 dark:border-neutral-800">
            <SnapshotDiffViewer base={currentConfig} compare={selected?.config ?? null} />
          </div>
        </div>
      </div>
    </div>
  )
}