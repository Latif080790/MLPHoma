import { assertSupabase } from '../lib/supabaseClient'

export const timelineService = {
    async updateTaskProgress(id: string, progress: number) {
        const client = assertSupabase()

        const { data, error } = await client
            .from('wbs_items')
            .update({
                progress: progress,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()

        if (error) throw error
        return data
    },

    async uploadProgressPhoto(file: File, path: string) {
        const client = assertSupabase()

        // 1. Upload to Supabase Storage
        // Generate a clean file name
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${path}/${fileName}`

        // Ensure bucket exists or use a common public one
        const bucketName = 'project-evidence'

        const { error: uploadError } = await client.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (uploadError) {
            // Handle "Bucket not found" error gracefully if possible, but throwing is correct for now
            throw new Error(`Upload failed: ${uploadError.message}. Ensure '${bucketName}' bucket exists.`)
        }

        // 2. Get Public URL
        const { data } = client.storage
            .from(bucketName)
            .getPublicUrl(filePath)

        return data.publicUrl
    }
}
