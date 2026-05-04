/**
 * KPICard.tsx
 * Kartu KPI kecil dan reusable untuk menampilkan metrik ringkas.
 * - Dipakai di Home/dashboard dan modul lain jika dibutuhkan.
 */

import React from 'react'
import { cn } from '../../lib/utils'

/** Props untuk KPICard */
export interface KPICardProps {
  /** Label KPI */
  label: string
  /** Nilai utama (sudah diformat sebelum dikirim) */
  value: string
  /** Keterangan tambahan singkat (opsional) */
  hint?: string
  /** Ikon opsional (lucide-react atau lainnya) */
  icon?: React.ReactNode
  /** Warna aksen teks nilai */
  accentClassName?: string
}

/**
 * KPICard
 * Menampilkan label, value, hint, dan ikon dalam kartu sederhana.
 */
export default function KPICard({
  label,
  value,
  hint,
  icon,
  accentClassName,
}: KPICardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        {icon && <div className="text-neutral-500 dark:text-neutral-400">{icon}</div>}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tracking-tight', accentClassName || 'text-neutral-900 dark:text-neutral-100')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  )
}
