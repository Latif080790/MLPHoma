
export type RiskCategory = 'Technical' | 'External' | 'Organizational' | 'Project Management' | 'Safety' | 'Financial'
export type RiskStatus = 'OPEN' | 'MITIGATED' | 'CLOSED' | 'ISSUE'

export interface Risk {
    id: string
    project_id: string
    wbs_id?: string

    description: string
    category: RiskCategory

    probability: number // 1-5
    impact: number // 1-5
    risk_score: number // Calc

    mitigation_plan?: string
    owner?: string
    status: RiskStatus

    created_by?: string
    created_at: string
    updated_at: string

    // Joins
    wbs_name?: string
}

export const RISK_CATEGORIES: RiskCategory[] = ['Technical', 'External', 'Organizational', 'Project Management', 'Safety', 'Financial']
export const RISK_STATUSES: RiskStatus[] = ['OPEN', 'MITIGATED', 'CLOSED', 'ISSUE']
