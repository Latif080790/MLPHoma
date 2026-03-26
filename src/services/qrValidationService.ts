/**
 * qrValidationService.ts
 * Logic for verifying scanned QR codes against project items.
 */

export interface QRPayload {
    id: string
    type: 'MATERIAL' | 'ASSET' | 'TASK'
    project_id: string
    issued_at: string
    signature?: string
}

export const qrValidationService = {
    /**
     * verifyScannedPayload
     * Checks if the scanned QR code is valid for the current context.
     */
    verifyScannedPayload(raw: string, expectedId: string): { 
        valid: boolean
        payload?: QRPayload 
        error?: string
    } {
        try {
            // In a production app, this would be a decrypted JWT or signed hash.
            // For the audit, we simulate a structured JSON string.
            const payload: QRPayload = JSON.parse(raw)

            if (payload.id !== expectedId) {
                return { valid: false, error: 'ID mismatch' }
            }

            // Expiry check (e.g., 48 hours for temporary material tags)
            const issued = new Date(payload.issued_at).getTime()
            const now = Date.now()
            if (now - issued > 48 * 3600 * 1000) {
                return { valid: false, error: 'Tag expired' }
            }

            return { valid: true, payload }
        } catch (err) {
            return { valid: false, error: 'Invalid QR format' }
        }
    }
}
