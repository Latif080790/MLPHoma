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

// ── QR Validation Record (used by QRValidationBadge) ────────────────────────
export interface QRValidationRecord {
    validationHash: string
    documentId: string
    projectId: string
    documentTitle: string
    versionNumber: number
    category: string
    issuedBy: string
    issuedAt: string
    expiresAt: string | null
    revokedAt: string | null
    revokedBy: string | null
}

// Storage key for localStorage-backed QR records
const STORAGE_KEY = 'mlphoma_qr_records'

function loadRecords(): QRValidationRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveRecords(records: QRValidationRecord[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    } catch {
        // ignore storage errors
    }
}

function generateHash(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const segments = [8, 4, 4, 12]
    return segments
        .map(len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
        .join('-')
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
    },

    /**
     * getActiveQR
     * Returns the active (non-revoked) QR record for a given document, or undefined.
     */
    getActiveQR(documentId: string): QRValidationRecord | undefined {
        const records = loadRecords()
        return records.find(r => r.documentId === documentId && !r.revokedAt)
    },

    /**
     * generate
     * Creates a new QR validation record for a document.
     */
    generate(params: {
        documentId: string
        projectId: string
        documentTitle: string
        versionNumber: number
        category: string
        issuedBy: string
        expiryDays?: number
    }): QRValidationRecord {
        // Revoke any existing active record for this document
        const records = loadRecords()
        const updated = records.map(r =>
            r.documentId === params.documentId && !r.revokedAt
                ? { ...r, revokedAt: new Date().toISOString(), revokedBy: 'system-auto' }
                : r
        )

        const newRecord: QRValidationRecord = {
            validationHash: generateHash(),
            documentId: params.documentId,
            projectId: params.projectId,
            documentTitle: params.documentTitle,
            versionNumber: params.versionNumber,
            category: params.category,
            issuedBy: params.issuedBy,
            issuedAt: new Date().toISOString(),
            expiresAt: params.expiryDays && params.expiryDays > 0
                ? new Date(Date.now() + params.expiryDays * 86_400_000).toISOString()
                : null,
            revokedAt: null,
            revokedBy: null,
        }

        updated.push(newRecord)
        saveRecords(updated)
        return newRecord
    },

    /**
     * revoke
     * Revokes a QR validation record by its hash.
     */
    revoke(hash: string, revokedBy: string): void {
        const records = loadRecords()
        const updated = records.map(r =>
            r.validationHash === hash
                ? { ...r, revokedAt: new Date().toISOString(), revokedBy }
                : r
        )
        saveRecords(updated)
    },

    /**
     * getQRUrl
     * Returns a deep-link URL for verifying a document by its validation hash.
     */
    getQRUrl(hash: string): string {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        return `${base}/verify?hash=${encodeURIComponent(hash)}`
    },
}
