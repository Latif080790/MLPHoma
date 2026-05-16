/**
 * useEVMAlerts.ts
 *
 * Proactive EVM cost-overrun and schedule-slip monitoring hook.
 * Reads CPI/SPI from curvaSStore and fires toast alerts when
 * CPI < 0.85 or SPI < 0.85 (critical) or < 0.95 (warning).
 *
 * Alert deduplication: each project+status combo is shown at most
 * once per browser session via sessionStorage.
 */

import { useEffect } from 'react'
import { useCurvaSStore } from '../store/curvaSStore'
import { notify } from '../lib/toast'
import { classifyHealth } from '../services/evmService'
import type { HealthStatus } from '../services/evmService'

const SESSION_KEY_PREFIX = 'evm_alert_shown_'

function alertKey(projectId: string, status: HealthStatus): string {
  return `${SESSION_KEY_PREFIX}${projectId}_${status}`
}

function wasAlreadyShown(projectId: string, status: HealthStatus): boolean {
  return sessionStorage.getItem(alertKey(projectId, status)) === '1'
}

function markShown(projectId: string, status: HealthStatus): void {
  sessionStorage.setItem(alertKey(projectId, status), '1')
}

/**
 * Drop this hook in any component that loads project EVM data.
 * It silently monitors the curvaSStore and fires one toast per
 * project per health degradation per browser session.
 *
 * @param projectId - Active project ID (skip if undefined/null)
 */
export function useEVMAlerts(projectId: string | null | undefined): void {
  const analysis = useCurvaSStore(
    (state) => (projectId ? state.analyses[projectId] : null)
  )

  useEffect(() => {
    if (!projectId || !analysis) return

    const cpi = analysis.metrics?.cpi ?? 1
    const spi = analysis.metrics?.spi ?? 1
    const { status, insights } = classifyHealth(cpi, spi)

    if (status === 'critical' && !wasAlreadyShown(projectId, 'critical')) {
      markShown(projectId, 'critical')
      notify.error(
        '⚠️ Proyek Dalam Status KRITIS',
        `CPI: ${cpi.toFixed(2)} | SPI: ${spi.toFixed(2)}. ` +
          (insights[0] ?? 'Segera lakukan tindakan korektif.'),
      )
    } else if (status === 'warning' && !wasAlreadyShown(projectId, 'warning')) {
      markShown(projectId, 'warning')
      notify.warning(
        'Perhatian: Kinerja Proyek Menurun',
        `CPI: ${cpi.toFixed(2)} | SPI: ${spi.toFixed(2)}. ` +
          (insights[0] ?? 'Monitor lebih ketat.'),
      )
    }
  }, [projectId, analysis])
}
