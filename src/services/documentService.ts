

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'

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
}

export const documentService = {
    async getDocuments(projectId: string): Promise<ProjectDocument[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[document] getDocuments error:', error.message)
            return []
        }
        return data || []
    },

    async uploadDocument(doc: Partial<ProjectDocument>, file?: File) {
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
                is_active: true
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async deleteDocument(id: string) {
        const client = assertSupabase()
        // Soft delete
        const { error } = await client
            .from('documents')
            .update({ is_active: false })
            .eq('id', id)

        if (error) throw error
    }
}
