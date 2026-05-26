export type ReportScope = 'PROJECT' | 'PORTFOLIO'
export type ReportDataset = 'DASHBOARD_KPI' | 'RISK_REGISTER' | 'PURCHASE_ORDERS'
export type ReportChartType = 'TABLE' | 'BAR' | 'LINE' | 'AREA' | 'PIE'

export interface ReportTemplateConfig {
  statusIn?: string[]
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface ReportTemplate {
  id: string
  project_id: string | null
  name: string
  description: string | null
  scope: ReportScope
  dataset: ReportDataset
  chart_type: ReportChartType
  config: ReportTemplateConfig
  is_shared: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateReportTemplateInput {
  project_id: string | null
  name: string
  description?: string
  scope?: ReportScope
  dataset: ReportDataset
  chart_type?: ReportChartType
  config?: ReportTemplateConfig
  is_shared?: boolean
}

export interface UpdateReportTemplateInput {
  name?: string
  description?: string
  scope?: ReportScope
  dataset?: ReportDataset
  chart_type?: ReportChartType
  config?: ReportTemplateConfig
  is_shared?: boolean
}

export interface ReportPreviewResult {
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  generatedAt: string
}
