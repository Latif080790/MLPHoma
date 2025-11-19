/**
 * utils.ts
 * Koleksi utilitas umum untuk aplikasi:
 * - CSV export (downloadCSV)
 * - JSON parse + validasi Zod (parseJSONWithSchema)
 * - Format & helpers (formatIDR, formatDate, sumBy, cn, clamp, toCSV, isDefined)
 */

import { z } from 'zod'

/**
 * Gabungkan className secara aman.
 */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/**
 * Penjumlahan terarah untuk array.
 * @param arr Sumber array
 * @param by Pemilih nilai numerik
 */
export function sumBy<T>(arr: T[], by: (item: T) => number): number {
  return (arr || []).reduce((acc, it) => acc + (Number(by(it)) || 0), 0)
}

/**
 * Format angka menjadi Rupiah (IDR) human-readable.
 */
export function formatIDR(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (!isFinite(num as number)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(num)
  )
}

/**
 * Format Date/ISO ke YYYY-MM-DD.
 */
export function formatDate(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Batasi angka pada rentang [min, max].
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Cek non-nullish.
 */
export function isDefined<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined
}

/**
 * Konversi data menjadi CSV string.
 * - Menerima array of objects (header otomatis) atau array of arrays.
 * - Nilai diproteksi dari koma/quote lewat escaping.
 */
export function toCSV(rows: Array<Record<string, any>> | Array<Array<any>>): string {
  if (!rows || rows.length === 0) return ''
  // Array of objects → gunakan header
  if (!Array.isArray(rows[0])) {
    const objs = rows as Array<Record<string, any>>
    const headers = Array.from(
      objs.reduce<Set<string>>((set, obj) => {
        Object.keys(obj).forEach((k) => set.add(k))
        return set
      }, new Set())
    )
    const escape = (v: any) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [
      headers.map(escape).join(','),
      ...objs.map((o) => headers.map((h) => escape(o[h])).join(',')),
    ]
    return lines.join('\n')
  }

  // Array of arrays
  const arr = rows as Array<Array<any>>
  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return arr.map((line) => line.map(escape).join(',')).join('\n')
}

/**
 * Unduh data sebagai file CSV.
 * Kompatibel dua pola argumen:
 * - downloadCSV(rows, fileName?)
 * - downloadCSV(fileName, rows)
 */
export function downloadCSV(
  a: string | Array<Record<string, any>> | Array<Array<any>>,
  b?: string | Array<Record<string, any>> | Array<Array<any>>
): void {
  let fileName = 'data.csv'
  let rows: Array<Record<string, any>> | Array<Array<any>>

  if (typeof a === 'string') {
    fileName = a || fileName
    rows = (b as any) || []
  } else {
    rows = a
    if (typeof b === 'string' && b) fileName = b
  }

  const csv = toCSV(rows || [])
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parse JSON string dan validasi dengan Zod schema.
 * Mengembalikan fallback bila gagal.
 */
export function parseJSONWithSchema<T>(
  raw: string,
  schema: z.Schema<T>,
  fallback: T
): T {
  try {
    const parsed = JSON.parse(raw)
    return schema.parse(parsed)
  } catch {
    try {
      // Jika gagal parse/parse schema, kembalikan fallback tervalidasi jika mungkin
      return schema.parse(fallback)
    } catch {
      return fallback
    }
  }
}
