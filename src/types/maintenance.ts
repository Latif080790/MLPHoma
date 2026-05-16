export type AssetCategory = 'EQUIPMENT' | 'VEHICLE' | 'TOOL' | 'INSTRUMENT' | 'FACILITY'
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'SCRAPPED'
export type PPMFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
export type PPMStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED'
export type WOType = 'CORRECTIVE' | 'PREVENTIVE' | 'PREDICTIVE' | 'EMERGENCY'
export type WOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type WOStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_PARTS' | 'COMPLETED' | 'CANCELLED'

export interface Asset {
    id: string
    project_id: string
    asset_code: string
    name: string
    category: AssetCategory
    model?: string
    serial_number?: string
    purchase_date?: string
    purchase_value?: number
    condition: AssetCondition
    location?: string
    responsible_person?: string
    next_service_date?: string
    notes?: string
    created_at: string
    updated_at: string
}

export interface PPMSchedule {
    id: string
    asset_id: string
    project_id: string
    task_name: string
    frequency: PPMFrequency
    last_done_date?: string
    next_due_date: string
    responsible_person?: string
    checklist: { item: string; checked: boolean }[]
    status: PPMStatus
    created_at: string
    updated_at: string
}

export interface WorkOrder {
    id: string
    project_id: string
    asset_id?: string
    wo_number: string
    title: string
    description?: string
    type: WOType
    priority: WOPriority
    status: WOStatus
    reported_by?: string
    assigned_to?: string
    reported_at: string
    target_completion?: string
    completed_at?: string
    estimated_cost?: number
    actual_cost?: number
    downtime_hours?: number
    notes?: string
    created_at: string
    updated_at: string
}

export interface SparePart {
    id: string
    project_id: string
    part_code: string
    name: string
    unit: string
    stock_qty: number
    min_stock: number
    unit_price?: number
    location?: string
    compatible_assets: string[]
    created_at: string
    updated_at: string
}

export interface MaintenanceSummary {
    totalAssets: number
    assetsGoodCondition: number
    openWorkOrders: number
    criticalWorkOrders: number
    overdueMaintenances: number
    lowStockParts: number
    totalDowntimeHours: number
}
