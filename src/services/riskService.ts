
import { v4 as uuidv4 } from 'uuid'
import { assertSupabase } from '../lib/supabaseClient'
import { Risk, RiskStatus } from '../types/risk'

export const riskService = {
    async getRisks(projectId: string): Promise<Risk[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('risks')
            .select(`
        *,
        wbs_items ( name )
      `)
            .eq('project_id', projectId)
            .order('risk_score', { ascending: false })

        if (error) throw error

        return (data || []).map((row: any) => ({
            id: row.id,
            project_id: row.project_id,
            wbs_id: row.wbs_id,

            description: row.description,
            category: row.category,

            probability: row.probability,
            impact: row.impact,
            risk_score: row.risk_score,

            mitigation_plan: row.mitigation_plan,
            owner: row.owner,
            status: row.status,

            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,

            wbs_name: row.wbs_items?.name
        }))
    },

    async createRisk(risk: Partial<Risk>) {
        const client = assertSupabase()
        const id = uuidv4()

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
