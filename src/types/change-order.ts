
export type ChangeOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface ChangeOrder {
    id: string
    project_id: string
    vo_number: string // e.g. VO-001

    title: string
    description?: string
    status: ChangeOrderStatus

    cost_impact: number
    schedule_impact_days: number

    created_by?: string
    created_at: string
    updated_at?: string

    // Joins
    items?: ChangeOrderItem[]
}

export interface ChangeOrderItem {
    id: string
    change_order_id: string

    item_description: string
    volume_delta: number
    unit_price: number
    total_delta: number

    target_wbs_id?: string

    // Joins
    wbs_name?: string
}
