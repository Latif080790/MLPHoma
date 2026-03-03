
import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import { Risk } from '../types/risk'

type RiskDbRow = { id: string; project_id?: string; wbs_id?: string; description?: string; category?: string; probability?: number; impact?: number; risk_score?: number; mitigation_plan?: string; owner?: string; status?: string; created_by?: string; created_at?: string; wbs?: { name?: string } | null; updated_at?: string }

export const riskService = {
    async getRisks(projectId: string): Promise<Risk[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('risks')
            .select(`
                *,
                wbs:wbs_id ( name )
            `)
            .eq('project_id', projectId)
            .order('risk_score', { ascending: false })

        if (error) {
            console.error('[risk] getRisks 400 error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            })
            return []
        }

        return (data || []).map((row: RiskDbRow) => ({
            id: row.id,
            project_id: row.project_id || '',
            wbs_id: row.wbs_id,

            description: row.description || '',
            category: (row.category as Risk['category']) || 'Technical',

            probability: row.probability || 1,
            impact: row.impact || 1,
            risk_score: row.risk_score || 1,

            mitigation_plan: row.mitigation_plan,
            owner: row.owner,
            status: (row.status as Risk['status']) || 'OPEN',

            created_by: row.created_by,
            created_at: row.created_at || '',
            updated_at: row.updated_at || '',

            wbs_name: row.wbs?.name
        }))
    },

    async createRisk(risk: Partial<Risk>) {
        const client = assertSupabase()
        const id = generateId()

        // Auto calc score (db also does it, but good for optimistic ui)
        const score = (risk.probability || 1) * (risk.impact || 1)

        const { data, error } = await client
            .from('risks')
            .insert({
                id,
                ...risk,
                risk_score: score // Override DB gen for immediate consistency if needed, but DB is gen always
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async updateRisk(id: string, updates: Partial<Risk>) {
        const client = assertSupabase()
        const { data, error } = await client
            .from('risks')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async deleteRisk(id: string) {
        const client = assertSupabase()
        const { error } = await client
            .from('risks')
            .delete()
            .eq('id', id)

        if (error) throw error
    }
}
