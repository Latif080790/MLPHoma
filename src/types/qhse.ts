export type IncidentType = 'NEAR_MISS' | 'FIRST_AID' | 'MEDICAL_TREATMENT' | 'LOST_TIME' | 'FATALITY' | 'PROPERTY_DAMAGE' | 'ENVIRONMENTAL'
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IncidentStatus = 'REPORTED' | 'UNDER_INVESTIGATION' | 'CORRECTIVE_ACTION' | 'CLOSED'
export type InspectionType = 'ROUTINE' | 'SPECIAL' | 'AUDIT' | 'THIRD_PARTY'
export type InspectionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type HazardType = 'PHYSICAL' | 'CHEMICAL' | 'BIOLOGICAL' | 'ERGONOMIC' | 'PSYCHOSOCIAL' | 'ELECTRICAL' | 'MECHANICAL'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IBPRStatus = 'ACTIVE' | 'MITIGATED' | 'ACCEPTED' | 'ELIMINATED'

export interface SafetyIncident {
    id: string
    project_id: string
    incident_number: string
    title: string
    description?: string
    type: IncidentType
    severity: IncidentSeverity
    status: IncidentStatus
    incident_date: string
    location?: string
    reported_by?: string
    injured_person?: string
    injury_type?: string
    root_cause?: string
    corrective_actions?: string
    preventive_measures?: string
    lost_time_days?: number
    attachments: string[]
    created_at: string
    updated_at: string
}

export interface HSEInspection {
    id: string
    project_id: string
    inspection_number: string
    title: string
    type: InspectionType
    status: InspectionStatus
    scheduled_date: string
    completed_date?: string
    inspector?: string
    area?: string
    checklist: { item: string; status: 'OK' | 'NOT_OK' | 'NA'; notes?: string }[]
    findings: { description: string; severity: IncidentSeverity; action_required?: string }[]
    score?: number
    max_score?: number
    action_items: { description: string; responsible: string; due_date: string; done: boolean }[]
    created_at: string
    updated_at: string
}

export interface IBPREntry {
    id: string
    project_id: string
    activity: string
    hazard: string
    hazard_type: HazardType
    potential_risk: string
    likelihood: number
    severity: number
    risk_score: number
    risk_level: RiskLevel
    control_measures?: string
    residual_likelihood?: number
    residual_severity?: number
    responsible_person?: string
    review_date?: string
    status: IBPRStatus
    created_at: string
    updated_at: string
}

export interface QHSESummary {
    totalIncidents: number
    ltiCount: number
    nearMissCount: number
    openInspections: number
    overdueInspections: number
    criticalHazards: number
    avgInspectionScore: number
    trir: number  // Total Recordable Incident Rate
    openCorrectiveActions?: number
    overdueCorrectiveActions?: number
}

// ------------------------------------------------------------------
// Corrective Actions
// ------------------------------------------------------------------

export type CorrectiveActionStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'CLOSED' | 'OVERDUE'
export type CorrectiveActionSource = 'INCIDENT' | 'INSPECTION' | 'IBPR' | 'AUDIT' | 'MANUAL'

export interface CorrectiveAction {
    id: string
    projectId: string

    /** Human-readable reference number */
    caNumber: string
    title: string
    description?: string

    /** What triggered this corrective action */
    source: CorrectiveActionSource
    sourceId?: string   // ID of incident / inspection / ibpr entry
    sourceRef?: string  // Human-readable reference (e.g. "INC-2601-0042")

    status: CorrectiveActionStatus

    priority: IncidentSeverity   // LOW | MEDIUM | HIGH | CRITICAL

    /** Person responsible for completing the action */
    assignedTo?: string
    assignedToName?: string

    dueDate: string
    completedDate?: string
    verifiedDate?: string
    verifiedBy?: string

    /** Evidence / attachments uploaded after completion */
    evidenceUrls?: string[]
    closureNotes?: string

    createdBy?: string
    createdAt: string
    updatedAt: string
}
