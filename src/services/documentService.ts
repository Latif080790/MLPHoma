

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import { auditTrail } from '../lib/auditTrail'

export type DocumentStatus = 'ACTIVE' | 'ARCHIVED' | 'SUPERSEDED'

export interface ProjectDocument {
    id: string
    project_id: string
    category: string // e.g. 'Contracts', 'Drawings', 'Reports'
    title: string
    file_url: string
    version_number: number
    created_at: string
    document_group_id?: string
    change_notes?: string
    is_latest?: boolean
    file_size?: number
    mime_type?: string
    
    // Version chain governance
    status: DocumentStatus
    is_locked?: boolean
    locked_by?: string
    locked_at?: string
    
    // Version lineage
    predecessor_id?: string // Previous version
    successor_id?: string   // Next version
}

export const documentService = {
    async getDocuments(projectId: string, includeArchived = false): Promise<ProjectDocument[]> {
        const client = assertSupabase()
        let query = client
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
        
        if (!includeArchived) {
            query = query.neq('status', 'ARCHIVED')
        }
        
        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
            console.warn('[document] getDocuments error:', error.message)
            return []
        }
        return data || []
    },

    async getDocumentVersions(documentGroupId: string): Promise<ProjectDocument[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('document_group_id', documentGroupId)
            .order('version_number', { ascending: false })

        if (error) {
            console.warn('[document] getDocumentVersions error:', error.message)
            return []
        }
        return data || []
    },

    async uploadDocument(doc: Partial<ProjectDocument>, file?: File, userId?: string, userName?: string) {
        const client = assertSupabase()
        const id = generateId()
        let file_url = doc.file_url || ''
        let file_size = doc.file_size
        let mime_type = doc.mime_type

        // Upload to Supabase Storage if file provided
        if (file) {
            const filePath = `${doc.project_id}/${id}_${file.name}`
            const { error: uploadError } = await client.storage
                .from('documents')
                .upload(filePath, file, { contentType: file.type, upsert: false })

            if (uploadError) {
                // If bucket doesn't exist, fall back to mock URL
                console.warn('Storage upload failed (bucket may not exist), using mock URL:', uploadError.message)
                file_url = `https://storage.example.com/${filePath}`
            } else {
                const { data: urlData } = client.storage.from('documents').getPublicUrl(filePath)
                file_url = urlData?.publicUrl || `https://storage.example.com/${filePath}`
            }
            file_size = file.size
            mime_type = file.type
        }

        const { data, error } = await client
            .from('documents')
            .insert({
                id,
                ...doc,
                file_url,
                file_size,
                mime_type,
                version_number: 1,
                is_active: true,
                status: 'ACTIVE',
                is_locked: false,
                document_group_id: doc.document_group_id || id, // New docs are their own group
                is_latest: true
            })
            .select()
            .single()

        if (error) throw error
        
        // Audit log
        if (userId && userName) {
            await auditTrail.logDocumentUploaded(
                data.id,
                data.title,
                data.category,
                userId,
                userName
            )
        }
        
        return data
    },

    /**
     * Create a new version of an existing document.
     * Marks the old version as SUPERSEDED and creates a new version with incremented number.
     */
    async createNewVersion(
        oldDocId: string, 
        file: File, 
        changeNotes: string,
        uploadedBy?: string,
        userId?: string,
        userName?: string
    ): Promise<ProjectDocument> {
        const client = assertSupabase()
        
        // Get the old document
        const { data: oldDoc, error: fetchError } = await client
            .from('documents')
            .select('*')
            .eq('id', oldDocId)
            .single()
        
        if (fetchError || !oldDoc) throw new Error('Original document not found')
        
        // Check if document is locked
        if (oldDoc.is_locked) {
            throw new Error(`Document is locked by ${oldDoc.locked_by || 'another user'}. Cannot create new version.`)
        }
        
        const newId = generateId()
        const newVersionNumber = oldDoc.version_number + 1
        const documentGroupId = oldDoc.document_group_id || oldDoc.id
        
        // Upload new file
        const filePath = `${oldDoc.project_id}/${newId}_${file.name}`
        const { error: uploadError } = await client.storage
            .from('documents')
            .upload(filePath, file, { contentType: file.type, upsert: false })
        
        let file_url = ''
        if (uploadError) {
            console.warn('Storage upload failed, using mock URL:', uploadError.message)
            file_url = `https://storage.example.com/${filePath}`
        } else {
            const { data: urlData } = client.storage.from('documents').getPublicUrl(filePath)
            file_url = urlData?.publicUrl || `https://storage.example.com/${filePath}`
        }
        
        // Mark old version as superseded and not latest
        await client
            .from('documents')
            .update({ 
                status: 'SUPERSEDED', 
                is_latest: false,
                successor_id: newId
            })
            .eq('id', oldDocId)
        
        // Create new version
        const { data: newDoc, error: insertError } = await client
            .from('documents')
            .insert({
                id: newId,
                project_id: oldDoc.project_id,
                category: oldDoc.category,
                title: oldDoc.title,
                file_url,
                file_size: file.size,
                mime_type: file.type,
                version_number: newVersionNumber,
                document_group_id: documentGroupId,
                change_notes: changeNotes,
                is_latest: true,
                is_active: true,
                status: 'ACTIVE',
                is_locked: false,
                predecessor_id: oldDocId
            })
            .select()
            .single()
        
        if (insertError) throw insertError
        
        // Audit log
        if (userId && userName) {
            await auditTrail.logDocumentVersionCreated(
                newDoc.id,
                newDoc.title,
                newVersionNumber,
                changeNotes,
                userId,
                userName
            )
        }
        
        return newDoc
    },

    /**
     * Archive a document (soft delete with status change)
     */
    async archiveDocument(id: string, userId?: string, userName?: string): Promise<void> {
        const client = assertSupabase()
        
        // Get document title for audit
        const { data: doc } = await client
            .from('documents')
            .select('title')
            .eq('id', id)
            .single()
        
        const { error } = await client
            .from('documents')
            .update({ status: 'ARCHIVED' })
            .eq('id', id)

        if (error) throw error
        
        // Audit log
        if (doc && userId && userName) {
            await auditTrail.logDocumentArchived(id, doc.title, userId, userName)
        }
    },

    /**
     * Unarchive a document
     */
    async unarchiveDocument(id: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('documents')
            .update({ status: 'ACTIVE' })
            .eq('id', id)

        if (error) throw error
    },

    /**
     * Lock a document to prevent modifications
     */
    async lockDocument(id: string, userId: string, userName: string): Promise<void> {
        const client = assertSupabase()
        
        // Get document title for audit
        const { data: doc } = await client
            .from('documents')
            .select('title')
            .eq('id', id)
            .single()
        
        const { error } = await client
            .from('documents')
            .update({ 
                is_locked: true,
                locked_by: userName,
                locked_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) throw error
        
        // Audit log
        if (doc) {
            await auditTrail.logDocumentLocked(id, doc.title, userId, userName)
        }
    },

    /**
     * Unlock a document
     */
    async unlockDocument(id: string, userId?: string, userName?: string): Promise<void> {
        const client = assertSupabase()
        
        // Get document title for audit
        const { data: doc } = await client
            .from('documents')
            .select('title')
            .eq('id', id)
            .single()
        
        const { error } = await client
            .from('documents')
            .update({ 
                is_locked: false,
                locked_by: null,
                locked_at: null
            })
            .eq('id', id)

        if (error) throw error
        
        // Audit log
        if (doc && userId && userName) {
            await auditTrail.logDocumentUnlocked(id, doc.title, userId, userName)
        }
    },

    async deleteDocument(id: string, userId?: string, userName?: string) {
        const client = assertSupabase()
        
        // Get document title for audit
        const { data: doc } = await client
            .from('documents')
            .select('title')
            .eq('id', id)
            .single()
        
        // Soft delete
        const { error } = await client
            .from('documents')
            .update({ is_active: false })
            .eq('id', id)

        if (error) throw error
        
        // Audit log
        if (doc && userId && userName) {
            await auditTrail.logDocumentDeleted(id, doc.title, userId, userName)
        }
    }
}
