/**
 * documentVersionService.ts
 * FASE 4.2: Document Versioning System
 *
 * Extends the existing documentService with:
 * 1. Version tracking — upload new version of existing doc, old versions preserved
 * 2. Version history — list all versions of a document
 * 3. Diff tracking — record what changed between versions
 * 4. Latest version auto-detection
 * 5. Audit trail for document lifecycle
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'

// ---------- Types ----------

export interface DocumentVersion {
    id: string
    documentId: string       // parent document group ID
    projectId: string
    category: string
    title: string
    fileUrl: string
    versionNumber: number
    changeNotes: string
    uploadedBy: string
    isLatest: boolean
    fileSize?: number
    mimeType?: string
    createdAt: string
}

export interface UploadVersionInput {
    documentId: string       // parent document ID to version
    projectId: string
    fileUrl: string
    changeNotes: string
    uploadedBy?: string
    fileSize?: number
    mimeType?: string
}

// ---------- Service ----------

export const documentVersionService = {

    /**
     * Get all versions of a document, ordered by version number desc
     */
    async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
        const client = assertSupabase()

        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('document_group_id', documentId)
            .order('version_number', { ascending: false })

        if (error) {
            // Fallback: try querying by ID directly if document_group_id doesn't exist
            const { data: fallback, error: fallbackErr } = await client
                .from('documents')
                .select('*')
                .eq('id', documentId)

            if (fallbackErr) {
                console.warn('[documentVersion] getVersionHistory error:', fallbackErr.message)
                return []
            }
            return (fallback || []).map(rowToVersion)
        }

        return (data || []).map(rowToVersion)
    },

    /**
     * Upload a new version of an existing document.
     * Marks previous version as not-latest.
     */
    async uploadNewVersion(input: UploadVersionInput): Promise<DocumentVersion> {
        const client = assertSupabase()

        // 1. Get the existing document to inherit metadata
        const { data: existing, error: fetchErr } = await client
            .from('documents')
            .select('*')
            .eq('id', input.documentId)
            .single()

        if (fetchErr) throw new Error(`Document ${input.documentId} not found`)

        // 2. Find current max version number
        const { data: versions } = await client
            .from('documents')
            .select('version_number')
            .or(`id.eq.${input.documentId},document_group_id.eq.${input.documentId}`)
            .order('version_number', { ascending: false })
            .limit(1)

        const currentMaxVersion = versions?.[0]?.version_number || existing.version_number || 1
        const newVersionNumber = currentMaxVersion + 1

        // 3. Mark all existing versions as not-latest
        await client
            .from('documents')
            .update({ is_latest: false })
            .or(`id.eq.${input.documentId},document_group_id.eq.${input.documentId}`)

        // Also update the original doc (which might not have document_group_id)
        await client
            .from('documents')
            .update({ is_latest: false })
            .eq('id', input.documentId)

        // 4. Insert new version
        const newId = generateId('doc')
        const { data: newDoc, error: insertErr } = await client
            .from('documents')
            .insert({
                id: newId,
                project_id: input.projectId,
                document_group_id: input.documentId,  // Link to parent
                category: existing.category,
                title: existing.title,
                file_url: input.fileUrl,
                version_number: newVersionNumber,
                change_notes: input.changeNotes,
                uploaded_by: input.uploadedBy || 'system',
                is_latest: true,
                is_active: true,
                file_size: input.fileSize,
                mime_type: input.mimeType,
            })
            .select()
            .single()

        if (insertErr) throw insertErr

        // 5. Audit
        try {
            await auditService.log({
                action: 'UPDATE',
                entity: 'documents',
                entityType: 'DOCUMENT',
                entityId: input.documentId,
                details: {
                    newVersionId: newId,
                    versionNumber: newVersionNumber,
                    changeNotes: input.changeNotes,
                    title: existing.title,
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return rowToVersion(newDoc)
    },

    /**
     * Get only the latest version of each document in a project
     */
    async getLatestDocuments(projectId: string): Promise<DocumentVersion[]> {
        const client = assertSupabase()

        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[documentVersion] getLatestDocuments error:', error.message)
            return []
        }

        // Group by document_group_id and pick latest version
        const groupMap = new Map<string, any>()

        for (const doc of (data || [])) {
            const groupKey = doc.document_group_id || doc.id
            const existing = groupMap.get(groupKey)

            if (!existing || (doc.version_number || 1) > (existing.version_number || 1)) {
                groupMap.set(groupKey, doc)
            }
        }

        return Array.from(groupMap.values()).map(rowToVersion)
    },

    /**
     * Revert to a previous version (mark it as latest, deactivate current)
     */
    async revertToVersion(versionId: string, documentGroupId: string): Promise<void> {
        const client = assertSupabase()

        // Mark all versions as not-latest
        await client
            .from('documents')
            .update({ is_latest: false })
            .or(`id.eq.${documentGroupId},document_group_id.eq.${documentGroupId}`)

        // Mark target version as latest
        const { error } = await client
            .from('documents')
            .update({ is_latest: true })
            .eq('id', versionId)

        if (error) throw error

        try {
            await auditService.log({
                action: 'REVERT',
                entity: 'documents',
                entityType: 'DOCUMENT',
                entityId: documentGroupId,
                details: { revertedToVersionId: versionId },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },
}

// ---------- Helper ----------

function rowToVersion(row: any): DocumentVersion {
    return {
        id: row.id,
        documentId: row.document_group_id || row.id,
        projectId: row.project_id,
        category: row.category || 'General',
        title: row.title,
        fileUrl: row.file_url,
        versionNumber: row.version_number || 1,
        changeNotes: row.change_notes || '',
        uploadedBy: row.uploaded_by || 'system',
        isLatest: row.is_latest !== false,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
    }
}
