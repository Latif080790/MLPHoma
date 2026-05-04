/**
 * SnapshotModal.tsx
 *
 * Modal wrapper for SnapshotManager using shadcn Dialog.
 * Provides a compact dialog UX for listing/saving/restoring/deleting snapshots.
 */

import React from 'react'
import { Button } from '../../components/ui/button'
import SnapshotManager from './SnapshotManager'

/**
 * Note:
 * The shadcn Dialog exports are typically available under components/ui/dialog.
 * We import them below. If the project uses slightly different named exports,
 * update the imports accordingly.
 */
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../../components/ui/dialog'

/**
 * Props for SnapshotModal
 */
interface SnapshotModalProps {
  /** Project identifier for which snapshots belong */
  projectId: string
  /** Current live config to pass into SnapshotManager for diffs */
  currentConfig?: unknown
  /** Callback invoked after a snapshot is restored */
  onRestore?: (cfg: unknown) => void
}

/**
 * SnapshotModal
 *
 * Renders a Dialog trigger button and presents SnapshotManager inside the dialog content.
 * Keeps the SnapshotManager UI self-contained and improves UX compared to inline rendering.
 */
export default function SnapshotModal({ projectId, currentConfig, onRestore }: SnapshotModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-transparent" size="sm">
          Snapshots
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Snapshots</DialogTitle>
          <DialogDescription>Manage saved configuration snapshots for this project.</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <SnapshotManager
            projectId={projectId}
            currentConfig={currentConfig}
            onRestore={(cfg) => {
              if (onRestore) onRestore(cfg)
            }}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="bg-transparent" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}