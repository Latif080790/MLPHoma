import { assertSupabase } from '../lib/supabaseClient'
import { dashboardService } from './dashboardService'
import type {
  CreateReportTemplateInput,
  ReportPreviewResult,
  ReportTemplate,
  UpdateReportTemplateInput,
} from '../types/report'

type ReportTemplateRow = {
  id: string
  project_id: string | null
  name: string
  description: string | null
  scope: string | null
  dataset: string
  chart_type: string | null
  config: Record<string, unknown> | null
  is_shared: boolean | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type GenericRow = Record<string, string | number | null>

const DEFAULT_LIMIT = 50

function normalizeTemplate(row: ReportTemplateRow): ReportTemplate {
  return {
    id: row.id,
    project_id: row.project_id ?? null,
    name: row.name,
    description: row.description ?? null,
    scope: (row.scope ?? 'PROJECT') as ReportTemplate['scope'],
    dataset: row.dataset as ReportTemplate['dataset'],
    chart_type: (row.chart_type ?? 'TABLE') as ReportTemplate['chart_type'],
    config: (row.config ?? {}) as ReportTemplate['config'],
    is_shared: !!row.is_shared,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function inDateRange(value: string | null | undefined, from?: string, to?: string) {
  if (!value) return true
  const point = new Date(value).getTime()
  if (from && point < new Date(from).getTime()) return false
  if (to && point > new Date(to).getTime()) return false
  return true
}

export const reportBuilderService = {
  async listTemplates(projectId?: string): Promise<ReportTemplate[]> {
    const supabase = assertSupabase()
    let query = supabase
      .from('report_templates')
      .select('*')
      .order('updated_at', { ascending: false })

    if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`)
    } else {
      query = query.is('project_id', null)
    }

    const { data, error } = await query
    if (error) throw error

    return ((data || []) as ReportTemplateRow[]).map(normalizeTemplate)
  },

  async createTemplate(input: CreateReportTemplateInput): Promise<ReportTemplate> {
    const supabase = assertSupabase()
    const payload = {
      project_id: input.project_id ?? null,
      name: input.name,
      description: input.description ?? null,
      scope: input.scope ?? 'PROJECT',
      dataset: input.dataset,
      chart_type: input.chart_type ?? 'TABLE',
      config: input.config ?? {},
      is_shared: input.is_shared ?? false,
    }

    const { data, error } = await supabase
      .from('report_templates')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return normalizeTemplate(data as ReportTemplateRow)
  },

  async updateTemplate(id: string, patch: UpdateReportTemplateInput): Promise<ReportTemplate> {
    const supabase = assertSupabase()
    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('report_templates')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return normalizeTemplate(data as ReportTemplateRow)
  },

  async deleteTemplate(id: string): Promise<void> {
    const supabase = assertSupabase()
    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async runTemplate(projectId: string, template: ReportTemplate): Promise<ReportPreviewResult> {
    const supabase = assertSupabase()
    const limit = template.config?.limit ?? DEFAULT_LIMIT

    if (template.dataset === 'DASHBOARD_KPI') {
      const stats = await dashboardService.getProjectStats(projectId)
      return {
        columns: ['Metric', 'Value'],
        rows: [
          { Metric: 'Total Budget', Value: stats.totalBudget },
          { Metric: 'Utilized Budget', Value: stats.utilizedBudget },
          { Metric: 'CPI', Value: stats.cpi ?? 0 },
          { Metric: 'SPI', Value: stats.spi ?? 0 },
          { Metric: 'Overall Progress (%)', Value: stats.overallProgress },
          { Metric: 'Critical Risks', Value: stats.criticalRisks },
          { Metric: 'Overdue Tasks', Value: stats.overdueTasks },
        ],
        generatedAt: new Date().toISOString(),
      }
    }

    if (template.dataset === 'RISK_REGISTER') {
      const { data, error } = await supabase
        .from('risks')
        .select('id, description, category, risk_score, status, owner, created_at')
        .eq('project_id', projectId)
        .order('risk_score', { ascending: false })
        .limit(limit)

      if (error) throw error

      const statusIn = template.config?.statusIn || []
      const rows: GenericRow[] = ((data || []) as Array<Record<string, unknown>>)
        .filter((risk) => (statusIn.length ? statusIn.includes(String(risk.status || '')) : true))
        .filter((risk) => inDateRange(risk.created_at as string | undefined, template.config?.dateFrom, template.config?.dateTo))
        .map((risk) => ({
          ID: String(risk.id || ''),
          Description: String(risk.description || ''),
          Category: String(risk.category || ''),
          Score: Number(risk.risk_score || 0),
          Status: String(risk.status || ''),
          Owner: String(risk.owner || ''),
          CreatedAt: String(risk.created_at || ''),
        }))

      return {
        columns: ['ID', 'Description', 'Category', 'Score', 'Status', 'Owner', 'CreatedAt'],
        rows,
        generatedAt: new Date().toISOString(),
      }
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, po_number, vendor_name, total_amount, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const statusIn = template.config?.statusIn || []
    const rows: GenericRow[] = ((data || []) as Array<Record<string, unknown>>)
      .filter((po) => (statusIn.length ? statusIn.includes(String(po.status || '')) : true))
      .filter((po) => inDateRange(po.created_at as string | undefined, template.config?.dateFrom, template.config?.dateTo))
      .map((po) => ({
        ID: String(po.id || ''),
        PONumber: String(po.po_number || ''),
        Vendor: String(po.vendor_name || ''),
        TotalAmount: Number(po.total_amount || 0),
        Status: String(po.status || ''),
        CreatedAt: String(po.created_at || ''),
      }))

    return {
      columns: ['ID', 'PONumber', 'Vendor', 'TotalAmount', 'Status', 'CreatedAt'],
      rows,
      generatedAt: new Date().toISOString(),
    }
  },
}
