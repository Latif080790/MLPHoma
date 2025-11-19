/**
 * rapStore.ts
 * Zustand store untuk menyimpan RAP (time-phased budget) per project.
 * - API: getPlan, setPlan, clearPlan (sesuai penggunaan di RAP.tsx)
 * - Idempotent: tidak set state jika isi rencana identik (hindari render loop)
 * - Menggunakan referensi kosong stabil (EMPTY_PLAN) agar selector tidak memicu rerender tak perlu
 */

import { create } from 'zustand'

/** RapPoint
 * Titik rencana biaya per periode (bulanan) untuk satu proyek.
 */
export interface RapPoint {
  /** Label periode, contoh: "2025-01" */
  period: string
  /** Nilai rencana (planned) pada periode tsb, dalam rupiah */
  planned: number
  /** Nilai aktual (opsional) pada periode tsb, dalam rupiah */
  actual?: number
}

/** Referensi array kosong stabil untuk mencegah pembuatan [] baru pada setiap pemanggilan getter. */
const EMPTY_PLAN: RapPoint[] = Object.freeze([]) as unknown as RapPoint[]

/** RapState
 * Struktur state RAP per projectId.
 */
interface RapState {
  /** Penyimpanan rencana per projectId */
  plans: Record<string, RapPoint[]>

  /** Set rencana untuk satu project (idempotent) */
  setPlan: (projectId: string, plan: RapPoint[]) => void
  /** Hapus rencana untuk satu project (idempotent) */
  clearPlan: (projectId: string) => void
  /** Ambil rencana untuk satu project (referensi stabil bila tidak berubah) */
  getPlan: (projectId: string) => RapPoint[]
}

/**
 * Utility: bandingkan dua array RAP point (by key fields) untuk mencegah set state tidak perlu.
 * - Membandingkan panjang, lalu setiap indeks: period/planned/actual
 * - Diasumsikan urutan konsisten (sesuai builder di RAP.tsx)
 */
function isSamePlan(a: RapPoint[] = [], b: RapPoint[] = []): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.period !== y.period) return false
    if ((x.planned || 0) !== (y.planned || 0)) return false
    if ((x.actual || 0) !== (y.actual || 0)) return false
  }
  return true
}

/**
 * Normalisasi plan:
 * - pastikan nilai planned/actual bertipe number valid
 * - trim label period untuk konsistensi
 */
function normalizePlan(plan: RapPoint[]): RapPoint[] {
  return plan.map((p) => ({
    period: String(p.period).trim(),
    planned: Number.isFinite(p.planned) ? Math.round(p.planned) : 0,
    actual: p.actual != null && Number.isFinite(p.actual) ? Math.round(p.actual) : undefined,
  }))
}

/**
 * useRapStore
 * Store Zustand untuk RAP.
 */
export const useRapStore = create<RapState>((set, get) => ({
  plans: {},

  setPlan: (projectId, plan) => {
    if (!projectId) return
    const next = normalizePlan(plan || [])
    const prev = get().plans[projectId] || EMPTY_PLAN
    if (isSamePlan(prev, next)) return

    set((state) => ({
      plans: {
        ...state.plans,
        [projectId]: next,
      },
    }))
  },

  clearPlan: (projectId) => {
    if (!projectId) return
    const prev = get().plans[projectId]
    if (!prev || prev.length === 0) return
    set((state) => {
      const copy = { ...state.plans }
      delete copy[projectId]
      return { plans: copy }
    })
  },

  getPlan: (projectId) => {
    return get().plans[projectId] || EMPTY_PLAN
  },
}))

export default useRapStore
