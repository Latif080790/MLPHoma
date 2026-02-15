/**
 * auditService.ts
 * Server-side audit trail service.
 * Logs every critical action to the audit_logs table in Supabase.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import type { AuditLogEntry, CreateAuditInput } from '../types/audit'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

function rowToAuditEntry(row: any): AuditLogEntry {
    return {
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        action: row.action,
        entity: row.entity,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details ?? {},
        ipAddress: row.ip_address,
        createdAt: row.created_at,
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const auditService = {

    /**
     * Log an audit event
     */
    async log(input: CreateAuditInput): Promise<void> {
        try {
            const client = assertSupabase()
            const id = generateId('audit')

            await client.from('audit_logs').insert({
                id,
                user_id: input.userId || null,
                user_name: input.userName || null,
                action: input.action,
                entity: input.entity,
                entity_type: input.entityType || null,
                entity_id: input.entityId || null,
                details: input.details ?? {},
            })
        } catch (error) {
            // Audit logging should never block the main flow
            console.warn('[AuditService] Failed to log:', error)
        }
    },

    /**
     * Get audit logs with optional filters
     */
    async getLogs(options: {
        entityType?: string
        entityId?: string
        userId?: string
        limit?: number
        offset?: number
    } = {}): Promise<AuditLogEntry[]> {
        const client = assertSupabase()
        let query = client
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(options.limit || 100)

        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 100) - 1)
        }

        if (options.entityType) {
            query = query.eq('entity_type', options.entityType)
        }
        if (options.entityId) {
            query = query.eq('entity_id', options.entityId)
        }
        if (options.userId) {
            query = query.eq('user_id', options.userId)
        }

        const { data, error } = await query
        if (error) {
            console.warn('[audit] getLogs error:', error.message)
            return []
        }
        return (data || []).map(rowToAuditEntry)
    },

    /**
     * Get audit count for a specific entity (for badges)
     */
    async getEntityLogCount(entityType: string, entityId: string): Promise<number> {
        const client = assertSupabase()
        const { count, error } = await client
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)

        if (error) {
            console.warn('[audit] getEntityLogCount error:', error.message)
            return 0
        }
        return count ?? 0
    },
}
