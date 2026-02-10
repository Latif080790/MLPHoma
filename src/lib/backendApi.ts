/**
 * backendApi.ts
 * Backend API client stub for AHSP-related API calls.
 * Replace with actual API implementation when backend is ready.
 */

/** Price history entry from API */
export interface ApiPriceHistory {
  id: string
  ahspItemId: string
  oldPrice: number | null
  newPrice: number
  changeType: string
  changeReason?: string
  changedAt?: string
  createdAt?: string
}

/**
 * Backend API client (stub implementation).
 * In production, this should connect to a real backend.
 */
const backendApi = {
  ahsp: {
    /**
     * Get price history for an AHSP item.
     * Returns empty array as stub — replace with real API call.
     */
    async getHistory(ahspItemId: string): Promise<ApiPriceHistory[]> {
      console.warn(`backendApi.ahsp.getHistory(${ahspItemId}): stub — no backend configured`)
      return []
    },
  },
}

export default backendApi
