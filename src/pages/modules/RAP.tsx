/**
 * RAP.tsx
 * RAP Scheduler page — provides UI to generate, edit, baseline, import/export and visualize
 * a monthly time-phased budget (RAP). Uses RapUtils for core plan operations and stores for
 * project context + optional persistence.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'

/**
 * UI & shared pieces
 */
import { AppShell } from '../../components/layout/AppShell'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useRapStore } from '../../store/rapStore'
import { useTimelineStore } from '../../store/timelineStore'
import { useRabStore } from '../../store/rabStore'
import { toast } from 'sonner'

/**
 * RAP helpers and components (named exports)
 */
import {
  RapPlanItem,
  planFromWeights,
  weightsBell,
  clonePlan,
  makeMonthKeys,
  sumPlan,
  normalizePlan,
  smoothPlan,
} from '../../components/rap/RapUtils'
import { BaselineBanner } from '../../components/rap/BaselineBanner'
import { RapToolbar, PresetKind } from '../../components/rap/RapToolbar'
import { RapDistributionChart } from '../../components/rap/RapDistributionChart'
import { RapMonthTable } from '../../components/rap/RapMonthTable'

/**
 * Card UI used in page summary
 */
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

/**
 * LocalStorage key builder for baseline storage per project
 * @param projectId - project identifier
 * @returns key string
 */
function baselineKey(projectId: string) {
  return `rap_baseline_${projectId}`
}

/**
 * Defensive helper to call various possible setter signatures from rapStore
 * @param setter - store setter function (may accept different signatures)
 * @param projectId - project id
 * @param plan - plan to persist
 */
function trySetPlanToStore(setter: any, projectId: string, plan: RapPlanItem[]) {
  try {
    if (!setter) return
    if (typeof setter === 'function') {
      // best-effort: call with (projectId, plan) or with (plan)
      try {
        setter(projectId, plan)
      } catch {
        try {
          setter(plan)
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Defensive helper to read plan from store
 * @param getter - store getter
 * @param projectId - project id
 * @returns plan array or empty
 */
function tryGetPlanFromStore(getter: any, projectId: string): RapPlanItem[] {
  try {
    if (!getter) return []
    const res = getter(projectId)
    if (Array.isArray(res)) return res as RapPlanItem[]
    return (res || []) as RapPlanItem[]
  } catch {
    return []
  }
}

/**
 * RAP page component
 * - Provides generation, normalize, smooth, baseline, import/export
 * - Renders chart + editable table
 */
export default function RAP(): JSX.Element {
  // Project context
  const project = useProjectStore((s) => (s as any).getActiveProject?.() ?? null)
  const projectName = project?.name ?? '—'
  const projectId = project?.id ?? 'demo'

  // rapStore accessors (defensive)
  const getPlan = useRapStore((s) => (s as any).getPlan || null)
  const setPlanFn =
    useRapStore((s) => (s as any).setPlan || (s as any).upsertPlan || (s as any).setProjectPlan || null) ||
    null
  
  const { getTasks } = useTimelineStore()
  const { getItems: getRabItems } = useRabStore()

  // Load initial plan from store or build a default
  const initialStorePlan = useMemo(() => tryGetPlanFromStore(getPlan, projectId), [getPlan, projectId])
  const [plan, setPlan] = useState<RapPlanItem[]>(
    initialStorePlan.length
      ? clonePlan(initialStorePlan)
      : planFromWeights(makeMonthKeys(12), 5_000_000_000, weightsBell(12))
  )

  // Derived KPI values
  const total = useMemo(() => sumPlan(plan), [plan])
  const months = plan.length

  // Toolbar state
  const [monthsInput, setMonthsInput] = useState<number>(months || 12)
  const [targetTotal, setTargetTotal] = useState<number>(total || 5_000_000_000)
  const [activePreset, setActivePreset] = useState<PresetKind>('bell')

  // Baseline state persisted per project
  const [baseline, setBaseline] = useState<RapPlanItem[] | null>(null)
  const [baselineInfo, setBaselineInfo] = useState<any | null>(null)

  // Load baseline from LocalStorage when project changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(baselineKey(projectId))
      if (raw) {
        const parsed = JSON.parse(raw)
        setBaseline(Array.isArray(parsed?.plan) ? (parsed.plan as RapPlanItem[]) : null)
        setBaselineInfo(parsed?.info || null)
      } else {
        setBaseline(null)
        setBaselineInfo(null)
      }
    } catch {
      setBaseline(null)
      setBaselineInfo(null)
    }
  }, [projectId])

  /**
   * Lightweight comparator to avoid unnecessary sync loops between local state
   * and the rap store. Compares period / planned / actual for each entry.
   */
  function isSameRapPlan(a: RapPlanItem[] = [], b: RapPlanItem[] = []) {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const x = a[i]
      const y = b[i]
      if ((x.period ?? '') !== (y.period ?? '')) return false
      if (Number(x.planned ?? 0) !== Number(y.planned ?? 0)) return false
      if (Number(x.actual ?? 0) !== Number(y.actual ?? 0)) return false
    }
    return true
  }

  // Sync to rapStore when plan changes (guarded to avoid write cycles)
  useEffect(() => {
    try {
      // Read current store plan and only write if different
      const currentStorePlan = tryGetPlanFromStore(getPlan, projectId)
      if (!isSameRapPlan(currentStorePlan, plan)) {
        trySetPlanToStore(setPlanFn, projectId, plan)
      }
    } catch {
      // swallow to avoid crashing UI on store mismatch
    }
    // Intentionally exclude getPlan/setPlanFn from deps to avoid resubscribing to store function references.
    // We only re-run this effect when `plan` or `projectId` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, projectId])

  // When store sends a plan for new project, replace local plan (guarded)
  useEffect(() => {
    try {
      const storePlan = tryGetPlanFromStore(getPlan, projectId)
      if (storePlan && storePlan.length) {
        // Only adopt store plan when it differs from local plan to avoid loops
        if (!isSameRapPlan(storePlan, plan)) {
          setPlan(clonePlan(storePlan))
          setMonthsInput(storePlan.length)
          setTargetTotal(sumPlan(storePlan))
        }
      }
    } catch {
      // ignore
    }
    // We intentionally do not include `plan` in deps here to prevent this effect
    // from running whenever we set local `plan` (which could cause a loop).
    // The effect should run when `getPlan` (store getter) or `projectId` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPlan, projectId])

  /**
   * Generate distribution using currently selected preset
   * @param opts - optional override (legacy supports number or preset object)
   */
  const handleGenerate = useCallback(
    (opts?: { preset?: PresetKind } | number) => {
      // Normalize opts
      let useMonths = monthsInput
      let preset: PresetKind = activePreset

      if (typeof opts === 'number') {
        useMonths = opts
      } else if (opts && typeof opts === 'object' && (opts as any).preset) {
        preset = (opts as any).preset
      }

      // small weight generator choices
      const computeWeights = (kind: string, n: number) => {
        if (kind === 'bell') return weightsBell(n)
        if (kind === 'front') return Array.from({ length: n }, (_, i) => n - i)
        if (kind === 'back') return Array.from({ length: n }, (_, i) => i + 1)
        return Array.from({ length: n }, () => 1)
      }

      const w = computeWeights(preset, useMonths)
      const keys = makeMonthKeys(useMonths)
      const generated = planFromWeights(keys, targetTotal, w)
      setActivePreset(preset)
      setPlan(generated)
    },
    [monthsInput, activePreset, targetTotal]
  )

  /**
   * Generate plan from Timeline Schedule + RAB Costs
   */
  const handleGenerateFromSchedule = useCallback(() => {
    const tasks = getTasks(projectId) || []
    const rabItems = getRabItems(projectId) || []
    
    if (!tasks.length) {
      toast.error('No tasks found in Timeline')
      return
    }

    // Map RAB ID to Cost
    const rabCostMap = new Map<string, number>()
    rabItems.forEach(item => {
      const cost = item.finalTotal ?? item.final_total ?? item.finalPrice ?? 0
      rabCostMap.set(item.id, cost)
    })

    // Calculate monthly distribution
    const monthlyCosts = new Map<string, number>()
    let totalCost = 0
    let hasLinkedCosts = false

    tasks.forEach(task => {
      const cost = task.rabId ? (rabCostMap.get(task.rabId) || 0) : 0
      if (cost <= 0) return

      hasLinkedCosts = true
      totalCost += cost
      
      const start = new Date(task.startDate)
      const end = new Date(task.endDate)
      
      // Simple daily distribution
      const duration = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1)
      const dailyCost = cost / duration

      let current = new Date(start)
      // Clone end date to avoid mutation issues if any
      const endDateObj = new Date(end)
      
      while (current <= endDateObj) {
        const monthKey = current.toISOString().slice(0, 7) // YYYY-MM
        monthlyCosts.set(monthKey, (monthlyCosts.get(monthKey) || 0) + dailyCost)
        current.setDate(current.getDate() + 1)
      }
    })

    if (!hasLinkedCosts) {
      toast.warning('No costs found linked to tasks. Link tasks to RAB items first.')
      return
    }

    // Convert to plan array
    const sortedMonths = Array.from(monthlyCosts.keys()).sort()
    const newPlan: RapPlanItem[] = sortedMonths.map(period => ({
      period,
      planned: monthlyCosts.get(period) || 0
    }))

    setPlan(newPlan)
    setMonthsInput(newPlan.length)
    setTargetTotal(totalCost)
    toast.success('RAP generated from Schedule')
  }, [projectId, getTasks, getRabItems])

  /**
   * Change selected preset (doesn't auto-generate)
   * @param kind - preset key
   */
  const handlePreset = useCallback((kind: PresetKind) => {
    setActivePreset(kind)
  }, [])

  /**
   * Normalize current plan to target total
   */
  const handleNormalize = useCallback(() => {
    setPlan((prev) => normalizePlan(prev, targetTotal))
  }, [targetTotal])

  /**
   * Smooth current plan using moving average window
   */
  const handleSmooth = useCallback(() => {
    setPlan((prev) => smoothPlan(prev, 3))
  }, [])

  /**
   * Lock baseline: persist current plan in localStorage with version
   * @param name - optional name for baseline snapshot
   */
  const handleLockBaseline = useCallback(
    (name?: string) => {
      try {
        const nextBaseline = clonePlan(plan)
        const raw = localStorage.getItem(baselineKey(projectId))
        let version = 1
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            version = (parsed?.info?.version || 0) + 1
          } catch {
            version = 1
          }
        }
        const info = { version, name: name || `Baseline v${version}`, lockedAt: new Date().toISOString() }
        localStorage.setItem(baselineKey(projectId), JSON.stringify({ plan: nextBaseline, info }))
        setBaseline(nextBaseline)
        setBaselineInfo(info)
      } catch (err) {
        console.error('Failed to lock baseline', err)
      }
    },
    [plan, projectId]
  )

  /**
   * Export current plan to CSV (Period,Planned)
   */
  const handleExport = useCallback(() => {
    try {
      const lines = ['Period,Planned']
      plan.forEach((p: any) => {
        const period = p.period ?? p.label ?? ''
        const val = p.planned ?? 0
        lines.push(`${period},${val}`)
      })
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RAP_${projectId || 'plan'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed', err)
    }
  }, [plan, projectId])

  /**
   * Import CSV with columns: Period,Planned
   * Accepts either File or input change event
   * @param e - change event or File
   */
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | File | null) => {
      const readFile = (file: File) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const text = String(ev.target?.result || '')
            const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
            const data: RapPlanItem[] = []
            const startIdx = rows[0]?.toLowerCase?.().includes('period') ? 1 : 0
            for (let i = startIdx; i < rows.length; i++) {
              const cols = rows[i].split(',')
              const period = (cols[0] || '').trim()
              const planned = Number(cols[1] || 0)
              data.push({ period, planned } as any)
            }
            if (data.length) {
              setPlan(data)
              setMonthsInput(data.length)
              const sum = data.reduce((s: number, r: any) => s + (Number(r.planned) || 0), 0)
              setTargetTotal(sum)
              trySetPlanToStore(setPlanFn, projectId, data as any)
            }
          } catch (err) {
            console.error('Import parse error', err)
          }
        }
        reader.readAsText(file)
      }

      try {
        if (!e) return
        if (e instanceof File) {
          readFile(e)
          return
        }
        const file = e.target.files?.[0]
        if (!file) return
        readFile(file)
        ;(e.target as HTMLInputElement).value = ''
      } catch (err) {
        console.error('Import failed', err)
      }
    },
    [setPlanFn, projectId]
  )

  /**
   * Update plan rows coming from table edits
   * @param next - new plan array
   */
  const updatePlan = useCallback((next: RapPlanItem[]) => {
    setPlan(next)
  }, [])

  // KPI: month with max planned
  const maxMonth = useMemo(() => {
    const sorted = [...plan].sort((a, b) => String(a.period).localeCompare(String(b.period)))
    let max = { period: '-', planned: 0 }
    for (const p of sorted) {
      if ((p.planned || 0) > max.planned) max = { period: p.period, planned: p.planned || 0 }
    }
    return max
  }, [plan])

  return (
    <AppShell projectName={projectName}>
      <ModuleHeader
        icon={<CalendarDays size={18} />}
        title="RAP Scheduler"
        description="Rencana Anggaran Pelaksanaan bulanan: buat distribusi dari preset, edit angka, kunci Baseline, dan ekspor."
        actions={<div className="hidden md:block text-xs text-neutral-500">Project: {projectName}</div>}
      />

      {/* Baseline summary */}
      <BaselineBanner baseline={baseline} info={baselineInfo} current={plan} />

      {/* Toolbar */}
      <RapToolbar
        months={monthsInput}
        setMonths={setMonthsInput}
        targetTotal={targetTotal}
        setTargetTotal={setTargetTotal}
        onGenerate={() => handleGenerate()}
        onGenerateFromSchedule={handleGenerateFromSchedule}
        onPreset={handlePreset}
        onNormalize={handleNormalize}
        onSmooth={handleSmooth}
        onLockBaseline={() => handleLockBaseline()}
        onExport={handleExport}
        onImport={(file: File) => handleImport(file)}
      />

      {/* KPIs */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-md border p-3 text-sm dark:border-neutral-800">
            <div className="text-neutral-500 text-xs">Total</div>
            <div className="font-medium text-blue-700 dark:text-blue-300">Rp {Math.round(total).toLocaleString('id-ID')}</div>
          </div>
          <div className="rounded-md border p-3 text-sm dark:border-neutral-800">
            <div className="text-neutral-500 text-xs">Months</div>
            <div className="font-medium">{months}</div>
          </div>
          <div className="rounded-md border p-3 text-sm dark:border-neutral-800">
            <div className="text-neutral-500 text-xs">Max Month</div>
            <div className="font-medium">Rp {Math.round(maxMonth.planned).toLocaleString('id-ID')}</div>
            <div className="text-xs text-neutral-500">{maxMonth.period}</div>
          </div>
          <div className="rounded-md border p-3 text-sm dark:border-neutral-800">
            <div className="text-neutral-500 text-xs">Preset</div>
            <div className="font-medium capitalize">{activePreset}</div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <RapDistributionChart plan={plan} baseline={baseline || undefined} title="Distribusi Bulanan" />

      {/* Table */}
      <RapMonthTable plan={plan} setPlan={updatePlan} baseline={baseline || undefined} />

      {/* Tips */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
          <div>- Ubah angka pada tabel untuk fine-tuning per bulan.</div>
          <div>- Klik Normalize agar total sama dengan Target Total.</div>
          <div>- Klik Smooth untuk menghaluskan kurva (moving average).</div>
          <div>- Lock Baseline untuk membekukan versi; grafik akan menampilkan overlay Baseline.</div>
          <div>- Export/Import CSV menggunakan kolom: Period, Planned.</div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
