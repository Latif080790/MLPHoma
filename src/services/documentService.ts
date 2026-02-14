

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

        if (error) throw error
        return data || []
    },

    async uploadDocument(doc: Partial<ProjectDocument>) {
        const client = assertSupabase()
        const id = generateId()

        // In a real app, we would upload to Storage bucket here
        // const { data: uploadData, error: uploadError } = await client.storage.from('files').upload(...)

        const { data, error } = await client
            .from('documents')
            .insert({
                id,
                ...doc,
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
