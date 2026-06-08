/**
 * AHSPStatusBadge.tsx
 * Displays the AHSP approval workflow status as a colored badge.
 * When transitions are available, renders as a dropdown to change status.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import type { AHSPStatus } from '@/types/ahsp'

const STATUS_LABELS: Record<AHSPStatus, string> = {
  draft: 'Draft',
  review: 'Dalam Review',
  approved: 'Disetujui',
  archived: 'Diarsipkan',
}

const STATUS_CLASSES: Record<AHSPStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  archived: 'bg-red-100 text-red-700 border-red-200',
}

const ALLOWED_TRANSITIONS: Record<AHSPStatus, AHSPStatus[]> = {
  draft: ['review'],
  review: ['draft', 'approved'],
  approved: ['archived'],
  archived: [],
}

interface AHSPStatusBadgeProps {
  status: AHSPStatus
  onStatusChange?: (newStatus: AHSPStatus) => void
  readonly?: boolean
}

export function AHSPStatusBadge({ status, onStatusChange, readonly }: AHSPStatusBadgeProps) {
  const transitions = ALLOWED_TRANSITIONS[status]

  if (readonly || !onStatusChange || transitions.length === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${STATUS_CLASSES[status]}`}
        >
          {STATUS_LABELS[status]}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {transitions.map(next => (
          <DropdownMenuItem key={next} onClick={() => onStatusChange(next)}>
            → {STATUS_LABELS[next]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
