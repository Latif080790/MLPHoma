import { assertSupabase } from '../lib/supabaseClient'
import type { SafetyIncident, HSEInspection, IBPREntry, QHSESummary } from '../types/qhse'

export const qhseService = {
    // ── Safety Incidents ────────────────────────────────────────────────────

    async getIncidents(projectId: string): Promise<SafetyIncident[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('safety_incidents')
            .select('*')
            .eq('project_id', projectId)
            .order('incident_date', { ascending: false })
        if (error) throw error
        return (data || []).map(r => ({ ...r, attachments: r.attachments || [] }))
    },

    async createIncident(incident: Omit<SafetyIncident, 'id' | 'created_at' | 'updated_at'>): Promise<SafetyIncident> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('safety_incidents')
            .insert(incident)
            .select()
            .single()
        if (error) throw error
        return { ...data, attachments: data.attachments || [] }
    },

    async updateIncidentStatus(id: string, status: SafetyIncident['status'], fields?: Partial<SafetyIncident>): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase
            .from('safety_incidents')
            .update({ status, ...fields, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    generateIncidentNumber(_projectId?: string): string {
        const d = new Date()
        const yy = d.getFullYear().toString().slice(-2)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const seq = d.getTime().toString().slice(-4)
        return `INC-${yy}${mm}-${seq}`
    },

    // ── HSE Inspections ─────────────────────────────────────────────────────

    async getInspections(projectId: string): Promise<HSEInspection[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('hse_inspections')
            .select('*')
            .eq('project_id', projectId)
            .order('scheduled_date', { ascending: false })
        if (error) throw error
        return (data || []).map(r => ({
            ...r,
            checklist: r.checklist || [],
            findings: r.findings || [],
            action_items: r.action_items || [],
        }))
    },

    async createInspection(inspection: Omit<HSEInspection, 'id' | 'created_at' | 'updated_at'>): Promise<HSEInspection> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('hse_inspections')
            .insert(inspection)
            .select()
            .single()
        if (error) throw error
        return { ...data, checklist: data.checklist || [], findings: data.findings || [], action_items: data.action_items || [] }
    },

    async completeInspection(id: string, score: number, findings: HSEInspection['findings'], actionItems: HSEInspection['action_items']): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase
            .from('hse_inspections')
            .update({
                status: 'COMPLETED',
                completed_date: new Date().toISOString().split('T')[0],
                score,
                findings,
                action_items: actionItems,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    generateInspectionNumber(projectId: string): string {
        const seq = Date.now().toString().slice(-5)
        return `INS-${projectId.slice(0, 4).toUpperCase()}-${seq}`
    },

    // ── IBPR ────────────────────────────────────────────────────────────────

    async getIBPR(projectId: string): Promise<IBPREntry[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('ibpr_entries')
            .select('*')
            .eq('project_id', projectId)
            .order('risk_score', { ascending: false })
        if (error) throw error
        return data || []
    },

    async createIBPREntry(entry: Omit<IBPREntry, 'id' | 'risk_score' | 'risk_level' | 'created_at' | 'updated_at'>): Promise<IBPREntry> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('ibpr_entries')
            .insert(entry)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateIBPRStatus(id: string, status: IBPREntry['status'], controlMeasures?: string): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase
            .from('ibpr_entries')
            .update({ status, control_measures: controlMeasures, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    // ── Summary ─────────────────────────────────────────────────────────────

    async getSummary(projectId: string): Promise<QHSESummary> {
        const [incidents, inspections, ibpr] = await Promise.all([
            this.getIncidents(projectId),
            this.getInspections(projectId),
            this.getIBPR(projectId),
        ])

        const ltiCount = incidents.filter(i => i.type === 'LOST_TIME' || i.type === 'FATALITY').length
        const nearMissCount = incidents.filter(i => i.type === 'NEAR_MISS').length
        const completedInspections = inspections.filter(i => i.status === 'COMPLETED' && i.score != null)
        const avgInspectionScore = completedInspections.length > 0
            ? completedInspections.reduce((s, i) => s + ((i.score || 0) / (i.max_score || 100)) * 100, 0) / completedInspections.length
            : 0

        // TRIR = (recordable incidents × 200000) / total man-hours (assume 10000 man-hours if not tracked)
        const recordableIncidents = incidents.filter(i => ['MEDICAL_TREATMENT', 'LOST_TIME', 'FATALITY'].includes(i.type)).length
        const trir = (recordableIncidents * 200000) / 10000

        return {
            totalIncidents: incidents.length,
            ltiCount,
            nearMissCount,
            openInspections: inspections.filter(i => i.status === 'PLANNED' || i.status === 'IN_PROGRESS').length,
            overdueInspections: inspections.filter(i => {
                const isOpen = i.status === 'PLANNED' || i.status === 'IN_PROGRESS'
                return isOpen && new Date(i.scheduled_date) < new Date()
            }).length,
            criticalHazards: ibpr.filter(i => i.risk_level === 'CRITICAL' && i.status === 'ACTIVE').length,
            avgInspectionScore,
            trir,
        }
    },
}
