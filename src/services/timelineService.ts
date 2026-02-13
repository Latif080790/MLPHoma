import { supabase } from '../lib/supabaseClient'

export const timelineService = {
    async updateTaskProgress(id: string, progress: number) {
        if (!supabase) throw new Error("Supabase client not initialized")

        const { data, error } = await supabase
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
        if (!supabase) throw new Error("Supabase client not initialized")

        // 1. Upload to Supabase Storage
        // Generate a clean file name
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${path}/${fileName}`

        // Ensure bucket exists or use a common public one
        const bucketName = 'project-evidence'

        const { error: uploadError } = await supabase.storage
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
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath)

        return data.publicUrl
    }
}
