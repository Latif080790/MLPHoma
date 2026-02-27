/**
 * auditTrail.ts
 * High-level audit trail helpers for critical business actions.
 * Provides convenient wrappers around auditService for consistent logging.
 */

import { auditService } from '../services/auditService'
import type { CreateAuditInput, AuditAction } from '../types/audit'

/**
 * Base audit log function with defaults
 */
async function logAction(
    action: AuditAction,
    entity: string,
    options: {
        userId?: string
        userName?: string
        entityType?: string
        entityId?: string
        details?: Record<string, any>
    } = {}
): Promise<void> {
    const input: CreateAuditInput = {
        userId: options.userId,
        userName: options.userName || 'Unknown User',
        action,
        entity,
        entityType: options.entityType,
        entityId: options.entityId,
        details: options.details,
    }
    
    await auditService.log(input)
}

// ------------------------------------------------------------------
// Finance Actions
// ------------------------------------------------------------------

export const auditTrail = {
    
    /**
     * Log invoice payment
     */
    async logInvoicePayment(
        invoiceId: string,
        invoiceNumber: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('INVOICE_PAID', `Invoice ${invoiceNumber} paid`, {
            userId,
            userName,
            entityType: 'INVOICE',
            entityId: invoiceId,
            details: { amount, invoiceNumber },
        })
    },

    /**
     * Log payment approval request submission
     */
    async logPaymentApprovalRequested(
        invoiceId: string,
        invoiceNumber: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('PAYMENT', `Payment approval requested for invoice ${invoiceNumber}`, {
            userId,
            userName,
            entityType: 'INVOICE',
            entityId: invoiceId,
            details: { invoiceNumber, amount, mode: 'APPROVAL_REQUEST' },
        })
    },

    /**
     * Log invoice creation
     */
    async logInvoiceCreated(
        invoiceId: string,
        invoiceNumber: string,
        vendor: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('INVOICE_CREATED', `Invoice ${invoiceNumber} created for ${vendor}`, {
            userId,
            userName,
            entityType: 'INVOICE',
            entityId: invoiceId,
            details: { invoiceNumber, vendor, amount },
        })
    },

    /**
     * Log claim submission
     */
    async logClaimSubmitted(
        claimId: string,
        claimNumber: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CLAIM_SUBMITTED', `Claim ${claimNumber} submitted`, {
            userId,
            userName,
            entityType: 'CLAIM',
            entityId: claimId,
            details: { claimNumber, amount },
        })
    },

    /**
     * Log claim approval
     */
    async logClaimApproved(
        claimId: string,
        claimNumber: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CLAIM_APPROVED', `Claim ${claimNumber} approved`, {
            userId,
            userName,
            entityType: 'CLAIM',
            entityId: claimId,
            details: { claimNumber, amount },
        })
    },

    /**
     * Log claim payment
     */
    async logClaimPaid(
        claimId: string,
        claimNumber: string,
        amount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CLAIM_PAID', `Claim ${claimNumber} paid`, {
            userId,
            userName,
            entityType: 'CLAIM',
            entityId: claimId,
            details: { claimNumber, amount },
        })
    },

    // ------------------------------------------------------------------
    // Document Actions
    // ------------------------------------------------------------------

    /**
     * Log document upload
     */
    async logDocumentUploaded(
        docId: string,
        title: string,
        category: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_UPLOADED', `Document "${title}" uploaded`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title, category },
        })
    },

    /**
     * Log document version creation
     */
    async logDocumentVersionCreated(
        docId: string,
        title: string,
        versionNumber: number,
        changeNotes: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_VERSION_CREATED', `Document "${title}" v${versionNumber} created`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title, versionNumber, changeNotes },
        })
    },

    /**
     * Log document lock
     */
    async logDocumentLocked(
        docId: string,
        title: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_LOCKED', `Document "${title}" locked`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title },
        })
    },

    /**
     * Log document unlock
     */
    async logDocumentUnlocked(
        docId: string,
        title: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_UNLOCKED', `Document "${title}" unlocked`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title },
        })
    },

    /**
     * Log document archive
     */
    async logDocumentArchived(
        docId: string,
        title: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_ARCHIVED', `Document "${title}" archived`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title },
        })
    },

    /**
     * Log document deletion
     */
    async logDocumentDeleted(
        docId: string,
        title: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DOCUMENT_DELETED', `Document "${title}" deleted`, {
            userId,
            userName,
            entityType: 'DOCUMENT',
            entityId: docId,
            details: { title },
        })
    },

    // ------------------------------------------------------------------
    // Change Order Actions
    // ------------------------------------------------------------------

    /**
     * Log change order creation
     */
    async logChangeOrderCreated(
        coId: string,
        coNumber: string,
        title: string,
        costImpact: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CO_CREATED', `Change Order ${coNumber} created: ${title}`, {
            userId,
            userName,
            entityType: 'CHANGE_ORDER',
            entityId: coId,
            details: { coNumber, title, costImpact },
        })
    },

    /**
     * Log change order approval
     */
    async logChangeOrderApproved(
        coId: string,
        coNumber: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CO_APPROVED', `Change Order ${coNumber} approved`, {
            userId,
            userName,
            entityType: 'CHANGE_ORDER',
            entityId: coId,
            details: { coNumber },
        })
    },

    /**
     * Log change order rejection
     */
    async logChangeOrderRejected(
        coId: string,
        coNumber: string,
        reason: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('CO_REJECTED', `Change Order ${coNumber} rejected`, {
            userId,
            userName,
            entityType: 'CHANGE_ORDER',
            entityId: coId,
            details: { coNumber, reason },
        })
    },

    /**
     * Log change order deletion
     */
    async logChangeOrderDeleted(
        coId: string,
        coNumber: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('DELETE', `Change Order ${coNumber} deleted`, {
            userId,
            userName,
            entityType: 'CHANGE_ORDER',
            entityId: coId,
            details: { coNumber },
        })
    },

    // ------------------------------------------------------------------
    // Approval Actions
    // ------------------------------------------------------------------

    /**
     * Log approval granted
     */
    async logApprovalGranted(
        entityType: string,
        entityId: string,
        entityRef: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('APPROVAL_GRANTED', `${entityType} ${entityRef} approved`, {
            userId,
            userName,
            entityType,
            entityId,
            details: { entityRef },
        })
    },

    /**
     * Log approval rejected
     */
    async logApprovalRejected(
        entityType: string,
        entityId: string,
        entityRef: string,
        reason: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('APPROVAL_REJECTED', `${entityType} ${entityRef} rejected`, {
            userId,
            userName,
            entityType,
            entityId,
            details: { entityRef, reason },
        })
    },

    // ------------------------------------------------------------------
    // Procurement Actions
    // ------------------------------------------------------------------

    /**
     * Log PO creation
     */
    async logPOCreated(
        poId: string,
        poNumber: string,
        vendor: string,
        totalAmount: number,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('PO_CREATED', `Purchase Order ${poNumber} created for ${vendor}`, {
            userId,
            userName,
            entityType: 'PO',
            entityId: poId,
            details: { poNumber, vendor, totalAmount },
        })
    },

    /**
     * Log PO approval
     */
    async logPOApproved(
        poId: string,
        poNumber: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('PO_APPROVED', `Purchase Order ${poNumber} approved`, {
            userId,
            userName,
            entityType: 'PO',
            entityId: poId,
            details: { poNumber },
        })
    },

    /**
     * Log GRN verification
     */
    async logGRNVerified(
        grnId: string,
        grnNumber: string,
        poNumber: string,
        userId: string,
        userName: string
    ): Promise<void> {
        await logAction('GRN_VERIFIED', `GRN ${grnNumber} verified for PO ${poNumber}`, {
            userId,
            userName,
            entityType: 'GRN',
            entityId: grnId,
            details: { grnNumber, poNumber },
        })
    },
}
