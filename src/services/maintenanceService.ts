import { assertSupabase } from '../lib/supabaseClient'
import type { Asset, PPMSchedule, WorkOrder, SparePart, MaintenanceSummary } from '../types/maintenance'

export const maintenanceService = {
    // ── Assets ─────────────────────────────────────────────────────────────

    async getAssets(projectId: string): Promise<Asset[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('assets')
            .select('*')
            .eq('project_id', projectId)
            .order('asset_code')
        if (error) throw error
        return data || []
    },

    async createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('assets')
            .insert(asset)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('assets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async deleteAsset(id: string): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase.from('assets').delete().eq('id', id)
        if (error) throw error
    },

    // ── PPM Schedules ───────────────────────────────────────────────────────

    async getPPMSchedules(projectId: string): Promise<PPMSchedule[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('ppm_schedules')
            .select('*')
            .eq('project_id', projectId)
            .order('next_due_date')
        if (error) throw error
        return (data || []).map(r => ({ ...r, checklist: r.checklist || [] }))
    },

    async createPPMSchedule(schedule: Omit<PPMSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<PPMSchedule> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('ppm_schedules')
            .insert(schedule)
            .select()
            .single()
        if (error) throw error
        return { ...data, checklist: data.checklist || [] }
    },

    async updatePPMStatus(id: string, status: PPMSchedule['status'], lastDoneDate?: string): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase
            .from('ppm_schedules')
            .update({ status, last_done_date: lastDoneDate, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    // ── Work Orders ─────────────────────────────────────────────────────────

    async getWorkOrders(projectId: string): Promise<WorkOrder[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('project_id', projectId)
            .order('reported_at', { ascending: false })
        if (error) throw error
        return data || []
    },

    async createWorkOrder(wo: Omit<WorkOrder, 'id' | 'created_at' | 'updated_at'>): Promise<WorkOrder> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('work_orders')
            .insert(wo)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateWorkOrderStatus(id: string, status: WorkOrder['status'], completedAt?: string): Promise<void> {
        const supabase = assertSupabase()
        const { error } = await supabase
            .from('work_orders')
            .update({ status, completed_at: completedAt, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    // ── Spare Parts ─────────────────────────────────────────────────────────

    async getSpareParts(projectId: string): Promise<SparePart[]> {
        const supabase = assertSupabase()
        const { data, error } = await supabase
            .from('spare_parts')
            .select('*')
            .eq('project_id', projectId)
            .order('name')
        if (error) throw error
        return (data || []).map(r => ({ ...r, compatible_assets: r.compatible_assets || [] }))
    },

    async adjustStock(id: string, delta: number): Promise<void> {
        const supabase = assertSupabase()
        const { data: current, error: fetchErr } = await supabase
            .from('spare_parts')
            .select('stock_qty')
            .eq('id', id)
            .single()
        if (fetchErr) throw fetchErr
        const newQty = Math.max(0, Number(current.stock_qty) + delta)
        const { error } = await supabase
            .from('spare_parts')
            .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    // ── Summary ─────────────────────────────────────────────────────────────

    async getSummary(projectId: string): Promise<MaintenanceSummary> {
        const [assets, workOrders, ppmSchedules, spareParts] = await Promise.all([
            this.getAssets(projectId),
            this.getWorkOrders(projectId),
            this.getPPMSchedules(projectId),
            this.getSpareParts(projectId),
        ])

        const openWOs = workOrders.filter(w => w.status === 'OPEN' || w.status === 'IN_PROGRESS')
        const totalDowntimeHours = workOrders
            .filter(w => w.status === 'COMPLETED')
            .reduce((sum, w) => sum + (w.downtime_hours || 0), 0)

        return {
            totalAssets: assets.length,
            assetsGoodCondition: assets.filter(a => a.condition === 'GOOD' || a.condition === 'NEW').length,
            openWorkOrders: openWOs.length,
            criticalWorkOrders: openWOs.filter(w => w.priority === 'CRITICAL').length,
            overdueMaintenances: ppmSchedules.filter(p => p.status === 'OVERDUE').length,
            lowStockParts: spareParts.filter(p => p.stock_qty <= p.min_stock).length,
            totalDowntimeHours,
        }
    },

    generateWONumber(projectId: string): string {
        const seq = Date.now().toString().slice(-6)
        return `WO-${projectId.slice(0, 4).toUpperCase()}-${seq}`
    },
}
