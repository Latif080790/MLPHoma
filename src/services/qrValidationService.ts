/**
 * qrValidationService.ts
 *
 * QR Code Document Validation Service.
 * Generates unique validation codes for approved documents and provides
 * verification APIs to ensure document authenticity.
 *
 * Each approved document gets a unique validation hash which can be
 * encoded as QR and printed/attached to physical copies.
 */

import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'

// ─── Types ───

export interface QRValidationRecord {
    id: string
    documentId: string
    projectId: string
    /** The unique hash used in QR code */
    validationHash: string
    /** Document metadata at time of QR generation */
    documentTitle: string
    versionNumber: number
    category: string
    /** Who approved / generated the QR */
    issuedBy: string
    issuedAt: string
    /** Expiry (optional, e.g. 1 year for compliance docs) */
    expiresAt?: string
    /** Verification count */
    verifyCount: number
    lastVerifiedAt?: string
    /** Status */
    status: 'ACTIVE' | 'REVOKED'
}

export interface QRGenerateInput {
    documentId: string
    projectId: string
    documentTitle: string
    versionNumber: number
    category: string
    issuedBy: string
    /** Days until expiry (0 = never expires) */
    expiryDays?: number
}

export interface QRVerifyResult {
    valid: boolean
    record?: QRValidationRecord
    message: string
}

// ─── In-Memory Store ───

const qrStore = new Map<string, QRValidationRecord>()

// ─── Helpers ───

/**
 * Generate a cryptographic-like validation hash.
 * In production, use crypto.randomUUID() or SHA-256.
 */
function generateValidationHash(docId: string, projectId: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 10)
    const prefix = docId.slice(0, 6).toUpperCase()
    return `QR-${prefix}-${timestamp}-${random}`.toUpperCase()
}

/**
 * Build QR code content URL for validation.
 * This URL would point to the verification endpoint.
 */
function buildQRUrl(hash: string): string {
    return `https://validate.natalaba.id/verify?code=${hash}`
}

// ─── Service ───

export const qrValidationService = {

    /**
     * Generate a QR validation code for an approved document.
     */
    generate(input: QRGenerateInput): QRValidationRecord {
        // Check if already has active QR
        const existing = Array.from(qrStore.values()).find(
            r => r.documentId === input.documentId && r.status === 'ACTIVE'
        )
        if (existing) {
            return existing // Return existing active QR
        }

        const hash = generateValidationHash(input.documentId, input.projectId)

        const record: QRValidationRecord = {
            id: generateId('qr'),
            documentId: input.documentId,
            projectId: input.projectId,
            validationHash: hash,
            documentTitle: input.documentTitle,
            versionNumber: input.versionNumber,
            category: input.category,
            issuedBy: input.issuedBy,
            issuedAt: new Date().toISOString(),
            expiresAt: input.expiryDays
                ? new Date(Date.now() + input.expiryDays * 86400000).toISOString()
                : undefined,
            verifyCount: 0,
            status: 'ACTIVE',
        }

        qrStore.set(hash, record)

        auditService.log({
            action: 'CREATE',
            entity: 'qr_validation',
            entityType: 'DOCUMENT',
            entityId: input.documentId,
            userName: input.issuedBy,
            details: {
                validationHash: hash,
                documentTitle: input.documentTitle,
                versionNumber: input.versionNumber,
            },
        })

        return record
    },

    /**
     * Verify a QR code hash. Returns validation result.
     */
    verify(hash: string): QRVerifyResult {
        const record = qrStore.get(hash)

        if (!record) {
            return { valid: false, message: 'QR code not found. Document may not be registered.' }
        }

        if (record.status === 'REVOKED') {
            return { valid: false, record, message: 'This QR code has been revoked.' }
        }

        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            return { valid: false, record, message: 'This QR code has expired.' }
        }

        // Update verification count
        record.verifyCount++
        record.lastVerifiedAt = new Date().toISOString()

        return {
            valid: true,
            record,
            message: `✓ Valid document: "${record.documentTitle}" v${record.versionNumber} — issued by ${record.issuedBy}`,
        }
    },

    /**
     * Revoke a QR code (e.g., when document is superseded).
     */
    revoke(hash: string, revokedBy: string): void {
        const record = qrStore.get(hash)
        if (!record) return

        record.status = 'REVOKED'

        auditService.log({
            action: 'DEACTIVATE',
            entity: 'qr_validation',
            entityType: 'DOCUMENT',
            entityId: record.documentId,
            userName: revokedBy,
            details: { validationHash: hash, action: 'qr_revoked' },
        })
    },

    /**
     * Get QR validation URL for a hash.
     */
    getQRUrl(hash: string): string {
        return buildQRUrl(hash)
    },

    /**
     * Get all QR records for a document.
     */
    getByDocument(documentId: string): QRValidationRecord[] {
        return Array.from(qrStore.values()).filter(r => r.documentId === documentId)
    },

    /**
     * Get all QR records for a project.
     */
    getByProject(projectId: string): QRValidationRecord[] {
        return Array.from(qrStore.values()).filter(r => r.projectId === projectId)
    },

    /**
     * Get active QR for a document (if exists).
     */
    getActiveQR(documentId: string): QRValidationRecord | undefined {
        return Array.from(qrStore.values()).find(
            r => r.documentId === documentId && r.status === 'ACTIVE'
        )
    },
}
