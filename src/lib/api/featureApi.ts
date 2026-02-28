/**
 * featureApi.ts
 *
 * Small API client for feature config persistence.
 * - Provides getFeatureConfig / saveFeatureConfig which call backend endpoints.
 * - If backend returns 404 or network unavailable, falls back to localStorage via featureStore.
 *
 * Note: backend endpoints are placeholders; backend integration required to make persistent.
 */

import type { FeatureConfig } from '../../config/features'
import { useFeatureStore } from '../../store/featureStore'

const BASE = '/api/v1' // expected backend base (placeholder)

/**
 * getFeatureConfig
 * Try backend endpoint, fallback to local storage via featureStore.
 *
 * @param projectId - project identifier
 * @returns FeatureConfig or null
 */
export async function getFeatureConfig(projectId: string): Promise<FeatureConfig | null> {
  if (!projectId) return null
  try {
    const res = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}/feature-config`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })
    if (!res.ok) {
      // fallback to local store
      return useFeatureStore.getState().loadConfig(projectId)
    }
    const json = await res.json()
    return json?.data ?? null
  } catch (e) {
    // network error -> fallback
    // eslint-disable-next-line no-console
    console.warn('featureApi.getFeatureConfig fallback to local', e)
    return useFeatureStore.getState().loadConfig(projectId)
  }
}

/**
 * saveFeatureConfig
 * Send config to backend if available. Always persist locally via featureStore.
 *
 * @param projectId - project identifier
 * @param cfg - FeatureConfig to save
 */
export async function saveFeatureConfig(projectId: string, cfg: FeatureConfig): Promise<boolean> {
  if (!projectId || !cfg) return false
  // persist locally first
  useFeatureStore.getState().setConfig(projectId, cfg)
  try {
    const res = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}/feature-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: cfg }),
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('featureApi.saveFeatureConfig backend returned error', res.status)
      return false
    }
    return true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('featureApi.saveFeatureConfig network failed', e)
    return false
  }
}