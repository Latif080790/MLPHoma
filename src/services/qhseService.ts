import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { notificationService } from './notificationService'
import type { SafetyIncident, HSEInspection, IBPREntry, QHSESummary, CorrectiveAction, CorrectiveActionStatus, CorrectiveActionSource } from '../types/qhse'

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
        const [incidents, inspections, ibpr, cas] = await Promise.all([
            this.getIncidents(projectId),
            this.getInspections(projectId),
            this.getIBPR(projectId),
            this.getCorrectiveActions(projectId).catch(() => [] as CorrectiveAction[]),
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

        const openCAs = cas.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS' || c.status === 'PENDING_VERIFICATION')
        const overdueCAs = cas.filter(c => c.status === 'OVERDUE' || (
            (c.status === 'OPEN' || c.status === 'IN_PROGRESS') && new Date(c.dueDate) < new Date()
        ))

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
            openCorrectiveActions: openCAs.length,
            overdueCorrectiveActions: overdueCAs.length,
        }
    },

    // ── Corrective Actions ───────────────────────────────────────────────────

    generateCANumber(_projectId?: string): string {
        const d = new Date()
        const yy = d.getFullYear().toString().slice(-2)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        return `CA-${yy}${mm}-${d.getTime().toString().slice(-4)}`
    },

    async getCorrectiveActions(projectId: string): Promise<CorrectiveAction[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('qhse_corrective_actions')
            .select('*')
            .eq('project_id', projectId)
            .order('due_date', { ascending: true })
        if (error) throw error
        return (data ?? []).map(rowToCA)
    },

    async getCorrectiveActionsBySource(
        projectId: string,
        source: CorrectiveActionSource,
        sourceId: string
    ): Promise<CorrectiveAction[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('qhse_corrective_actions')
            .select('*')
            .eq('project_id', projectId)
            .eq('source', source)
            .eq('source_id', sourceId)
            .order('due_date', { ascending: true })
        if (error) throw error
        return (data ?? []).map(rowToCA)
    },

    async getOverdueCorrectiveActions(projectId?: string): Promise<CorrectiveAction[]> {
        const supabase = assertSupabase()
        const now = new Date().toISOString().split('T')[0]
        let query = supabase
            .from('qhse_corrective_actions')
            .select('*')
            .in('status', ['OPEN', 'IN_PROGRESS'])
            .lt('due_date', now)
            .order('due_date', { ascending: true })

        if (projectId) query = query.eq('project_id', projectId)
        const { data, error } = await query
        if (error) throw error
        return (data ?? []).map(rowToCA)
    },

    async createCorrectiveAction(
        input: Omit<CorrectiveAction, 'id' | 'caNumber' | 'status' | 'createdAt' | 'updatedAt'>
    ): Promise<CorrectiveAction> {
        const supabase = assertSupabase()
        const id = generateId('ca')
        const now = new Date().toISOString()

        const row = {
            id,
            project_id: input.projectId,
            ca_number: this.generateCANumber(input.projectId),
            title: input.title,
            description: input.description ?? null,
            source: input.source,
            source_id: input.sourceId ?? null,
            source_ref: input.sourceRef ?? null,
            status: 'OPEN',
            priority: input.priority,
            assigned_to: input.assignedTo ?? null,
            assigned_to_name: input.assignedToName ?? null,
            due_date: input.dueDate,
            evidence_urls: input.evidenceUrls ?? [],
            created_by: input.createdBy ?? null,
            created_at: now,
            updated_at: now,
        }

        const { data, error } = await supabase
            .from('qhse_corrective_actions')
            .insert(row)
            .select()
            .single()
        if (error) throw error

        // Notify assigned person
        if (input.assignedTo) {
            notificationService.notifyUser(input.assignedTo, {
                projectId: input.projectId,
                type: 'QUALITY_ALERT',
                severity: input.priority === 'CRITICAL' ? 'critical' : input.priority === 'HIGH' ? 'warning' : 'info',
                title: `Corrective Action Ditugaskan: ${input.title}`,
                message: `Anda ditugaskan untuk menyelesaikan corrective action "${input.title}" sebelum ${input.dueDate}.`,
                entityType: 'PURCHASE_ORDER', // placeholder entity type
                entityId: id,
                deepLink: `/qhse?ca=${id}`,
            }).catch(() => {})
        }

        return rowToCA(data)
    },

    async updateCorrectiveActionStatus(
        id: string,
        status: CorrectiveActionStatus,
        fields?: {
            closureNotes?: string
            evidenceUrls?: string[]
            completedDate?: string
            verifiedBy?: string
        }
    ): Promise<void> {
        const supabase = assertSupabase()
        const updates: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        }
        if (fields?.closureNotes) updates.closure_notes = fields.closureNotes
        if (fields?.evidenceUrls) updates.evidence_urls = fields.evidenceUrls
        if (status === 'PENDING_VERIFICATION' && fields?.completedDate) {
            updates.completed_date = fields.completedDate ?? new Date().toISOString().split('T')[0]
        }
        if (status === 'VERIFIED' || status === 'CLOSED') {
            updates.verified_date = new Date().toISOString().split('T')[0]
            if (fields?.verifiedBy) updates.verified_by = fields.verifiedBy
        }

        const { error } = await supabase
            .from('qhse_corrective_actions')
            .update(updates)
            .eq('id', id)
        if (error) throw error
    },

    async updateCorrectiveActionAssignment(
        id: string,
        assignedTo: string,
        assignedToName: string,
        projectId: string
    ): Promise<void> {
        const supabase = assertSupabase()
        const { data: ca, error: fetchErr } = await supabase
            .from('qhse_corrective_actions')
            .select('title, due_date')
            .eq('id', id)
            .maybeSingle()
        if (fetchErr) throw fetchErr

        const { error } = await supabase
            .from('qhse_corrective_actions')
            .update({
                assigned_to: assignedTo,
                assigned_to_name: assignedToName,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error

        // Notify newly assigned person
        if (ca) {
            notificationService.notifyUser(assignedTo, {
                projectId,
                type: 'QUALITY_ALERT',
                severity: 'warning',
                title: `Corrective Action Ditugaskan: ${ca.title}`,
                message: `Anda ditugaskan menyelesaikan corrective action ini sebelum ${ca.due_date}.`,
                entityType: 'PURCHASE_ORDER',
                entityId: id,
                deepLink: `/qhse?ca=${id}`,
            }).catch(() => {})
        }
    },
}

// ------------------------------------------------------------------
// Row mapper
// ------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function rowToCA(r: any): CorrectiveAction {
    return {
        id: r.id,
        projectId: r.project_id,
        caNumber: r.ca_number,
        title: r.title,
        description: r.description,
        source: r.source as CorrectiveActionSource,
        sourceId: r.source_id,
        sourceRef: r.source_ref,
        status: r.status as CorrectiveActionStatus,
        priority: r.priority,
        assignedTo: r.assigned_to,
        assignedToName: r.assigned_to_name,
        dueDate: r.due_date,
        completedDate: r.completed_date,
        verifiedDate: r.verified_date,
        verifiedBy: r.verified_by,
        evidenceUrls: r.evidence_urls ?? [],
        closureNotes: r.closure_notes,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}
