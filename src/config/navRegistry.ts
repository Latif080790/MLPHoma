export type NavGroup = 'Overview' | 'Cost Control' | 'Schedule' | 'Operations' | 'Portfolio' | 'System'

export type NavIconKey =
  | 'LayoutDashboard'
  | 'FolderKanban'
  | 'ClipboardList'
  | 'Calculator'
  | 'BarChart3'
  | 'CalendarClock'
  | 'Truck'
  | 'Wallet'
  | 'FileDiff'
  | 'FolderOpen'
  | 'ClipboardCheck'
  | 'Flag'
  | 'Layers'
  | 'PieChart'
  | 'Zap'
  | 'Sliders'
  | 'Settings'
  | 'Wrench'
  | 'ShieldCheck'
  | 'HardHat'

export type NavComponentKey =
  | 'CommandCenter'
  | 'ProjectManagement'
  | 'ProjectOverview'
  | 'ProjectCosting'
  | 'CostForecastDashboard'
  | 'ScheduleOps'
  | 'SupplyChain'
  | 'Finance'
  | 'ChangeManagement'
  | 'Documents'
  | 'HandoverWizard'
  | 'PortfolioResources'
  | 'PortfolioAnalytics'
  | 'StrategySimulation'
  | 'TKDNPage'
  | 'FeatureEditor'
  | 'Settings'
  | 'FieldTasks'
  | 'Maintenance'
  | 'QHSE'
  | 'BIReportBuilder'
  | 'SubcontractorManagement'

export interface NavRegistryItem {
  id: string
  path: string
  label: string
  breadcrumbLabel?: string
  description?: string
  group: NavGroup
  order: number
  iconKey: NavIconKey
  colorClass: string
  keywords: string[]
  protected: boolean
  inSidebar: boolean
  inCommandPalette: boolean
  componentKey?: NavComponentKey
}

export const NAV_REGISTRY: NavRegistryItem[] = [
  {
    id: 'command-center',
    path: '/',
    label: 'Command Center',
    description: 'Project telemetry & overview',
    group: 'Overview',
    order: 10,
    iconKey: 'LayoutDashboard',
    colorClass: 'text-muted-foreground',
    keywords: ['dashboard', 'overview', 'telemetry', 'home'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'CommandCenter',
  },
  {
    id: 'projects',
    path: '/projects',
    label: 'Projects',
    description: 'Manage all projects',
    group: 'Overview',
    order: 20,
    iconKey: 'FolderKanban',
    colorClass: 'text-muted-foreground',
    keywords: ['projects', 'portfolio', 'management'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'ProjectManagement',
  },
  {
    id: 'project-overview',
    path: '/project-overview',
    label: 'Project Overview',
    breadcrumbLabel: 'Overview',
    description: 'Single-project dashboard',
    group: 'Overview',
    order: 30,
    iconKey: 'ClipboardList',
    colorClass: 'text-muted-foreground',
    keywords: ['project overview', 'summary', 'status'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'ProjectOverview',
  },
  {
    id: 'costing',
    path: '/costing',
    label: 'Project Costing',
    breadcrumbLabel: 'Costing',
    description: 'Budget & cost breakdown',
    group: 'Cost Control',
    order: 40,
    iconKey: 'Calculator',
    colorClass: 'text-muted-foreground',
    keywords: ['rab', 'costing', 'budget', 'boq'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'ProjectCosting',
  },
  {
    id: 'cost-forecast',
    path: '/cost-forecast',
    label: 'Cost Forecast',
    description: 'EVM & cost-at-completion',
    group: 'Cost Control',
    order: 50,
    iconKey: 'BarChart3',
    colorClass: 'text-muted-foreground',
    keywords: ['forecast', 'evm', 'cpi', 'spi', 'eac'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'CostForecastDashboard',
  },
  {
    id: 'schedule',
    path: '/schedule',
    label: 'Schedule & Operations',
    breadcrumbLabel: 'Schedule & Ops',
    description: 'Timeline, critical path, and progress',
    group: 'Schedule',
    order: 60,
    iconKey: 'CalendarClock',
    colorClass: 'text-muted-foreground',
    keywords: ['schedule', 'timeline', 'gantt', 'operations'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'ScheduleOps',
  },
  {
    id: 'supply-chain',
    path: '/supply-chain',
    label: 'Supply Chain',
    description: 'Purchase orders & suppliers',
    group: 'Operations',
    order: 70,
    iconKey: 'Truck',
    colorClass: 'text-muted-foreground',
    keywords: ['supply', 'procurement', 'inventory', 'po'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'SupplyChain',
  },
  {
    id: 'field-tasks',
    path: '/field-tasks',
    label: 'Field Tasks',
    breadcrumbLabel: 'Daily Tasks',
    description: 'Mobile daily task logging',
    group: 'Operations',
    order: 75,
    iconKey: 'ClipboardCheck',
    colorClass: 'text-muted-foreground',
    keywords: ['mobile', 'field', 'tasks', 'todo', 'progress'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'FieldTasks',
  },
  {
    id: 'finance',
    path: '/finance',
    label: 'Finance',
    description: 'Invoices, AP/AR, cashflow',
    group: 'Operations',
    order: 80,
    iconKey: 'Wallet',
    colorClass: 'text-muted-foreground',
    keywords: ['finance', 'invoice', 'ap', 'ar', 'cashflow'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'Finance',
  },
  {
    id: 'change-management',
    path: '/change-management',
    label: 'Change Management',
    breadcrumbLabel: 'Change Mgmt',
    description: 'Variation orders',
    group: 'Operations',
    order: 90,
    iconKey: 'FileDiff',
    colorClass: 'text-muted-foreground',
    keywords: ['change', 'variation', 'cco', 'vo'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'ChangeManagement',
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents',
    description: 'Project documents & QR codes',
    group: 'Operations',
    order: 100,
    iconKey: 'FolderOpen',
    colorClass: 'text-muted-foreground',
    keywords: ['document', 'files', 'repository'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'Documents',
  },
  {
    id: 'handover',
    path: '/handover',
    label: 'Handover',
    description: 'Project closeout checklist',
    group: 'Operations',
    order: 110,
    iconKey: 'ClipboardCheck',
    colorClass: 'text-muted-foreground',
    keywords: ['handover', 'closeout', 'commissioning'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'HandoverWizard',
  },
  {
    id: 'tkdn',
    path: '/tkdn',
    label: 'TKDN',
    description: 'Local content compliance',
    group: 'Operations',
    order: 120,
    iconKey: 'Flag',
    colorClass: 'text-muted-foreground',
    keywords: ['tkdn', 'compliance', 'local content'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'TKDNPage',
  },
  {
    id: 'portfolio-resources',
    path: '/portfolio-resources',
    label: 'Resource Heatmap',
    breadcrumbLabel: 'Portfolio Resources',
    description: 'Cross-project resource view',
    group: 'Portfolio',
    order: 130,
    iconKey: 'Layers',
    colorClass: 'text-muted-foreground',
    keywords: ['portfolio', 'resource', 'heatmap', 'allocation'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'PortfolioResources',
  },
  {
    id: 'portfolio-analytics',
    path: '/portfolio-analytics',
    label: 'Portfolio KPIs',
    breadcrumbLabel: 'Portfolio Analytics',
    description: 'CPI/SPI/PHI across all projects',
    group: 'Portfolio',
    order: 140,
    iconKey: 'PieChart',
    colorClass: 'text-muted-foreground',
    keywords: ['portfolio', 'kpi', 'cpi', 'spi', 'phi'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'PortfolioAnalytics',
  },
  {
    id: 'bi-report-builder',
    path: '/bi-report-builder',
    label: 'BI Report Builder',
    description: 'Template-driven BI reports',
    group: 'Portfolio',
    order: 145,
    iconKey: 'BarChart3',
    colorClass: 'text-muted-foreground',
    keywords: ['bi', 'report', 'template', 'analytics', 'builder'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'BIReportBuilder',
  },
  {
    id: 'strategy-simulation',
    path: '/strategy-simulation',
    label: 'Strategy Simulation',
    description: 'Scenario & risk modelling',
    group: 'Portfolio',
    order: 150,
    iconKey: 'Zap',
    colorClass: 'text-muted-foreground',
    keywords: ['strategy', 'simulation', 'scenario', 'what-if'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'StrategySimulation',
  },
  {
    id: 'features',
    path: '/features',
    label: 'Feature Config',
    breadcrumbLabel: 'Features',
    description: 'Toggle module features',
    group: 'System',
    order: 160,
    iconKey: 'Sliders',
    colorClass: 'text-muted-foreground',
    keywords: ['feature', 'toggle', 'config'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'FeatureEditor',
  },
  {
    id: 'maintenance',
    path: '/maintenance',
    label: 'Maintenance',
    description: 'Asset register, PM schedules, work orders',
    group: 'Operations',
    order: 125,
    iconKey: 'Wrench',
    colorClass: 'text-muted-foreground',
    keywords: ['maintenance', 'aset', 'work order', 'ppm', 'preventive'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'Maintenance',
  },
  {
    id: 'qhse',
    path: '/qhse',
    label: 'QHSE / K3',
    description: 'Safety incidents, HSE inspections, IBPR',
    group: 'Operations',
    order: 126,
    iconKey: 'ShieldCheck',
    colorClass: 'text-muted-foreground',
    keywords: ['qhse', 'k3', 'safety', 'incident', 'ibpr', 'hse'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'QHSE',
  },
  {
    id: 'subcontractor',
    path: '/subcontractor',
    label: 'Subkontraktor',
    description: 'SPK, opname progres, dan retensi subkontraktor',
    group: 'Operations',
    order: 127,
    iconKey: 'HardHat',
    colorClass: 'text-muted-foreground',
    keywords: ['subkontraktor', 'spk', 'opname', 'mandor', 'retensi'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'SubcontractorManagement',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    description: 'App preferences',
    group: 'System',
    order: 170,
    iconKey: 'Settings',
    colorClass: 'text-muted-foreground',
    keywords: ['settings', 'preferences', 'configuration'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'Settings',
  },
]

export const NAV_BY_PATH = Object.fromEntries(
  NAV_REGISTRY.map((item) => [item.path, item])
) as Record<string, NavRegistryItem>

export function getSidebarGroups() {
  const grouped = NAV_REGISTRY
    .filter((item) => item.inSidebar)
    .sort((a, b) => a.order - b.order)
    .reduce<Record<NavGroup, NavRegistryItem[]>>(
      (acc, item) => {
        acc[item.group].push(item)
        return acc
      },
      {
        Overview: [],
        'Cost Control': [],
        Schedule: [],
        Operations: [],
        Portfolio: [],
        System: [],
      }
    )

  const defaultCollapsedGroups: Partial<Record<NavGroup, boolean>> = {
    Portfolio: true,
    System: true,
  }

  return (Object.keys(grouped) as NavGroup[]).map((label) => ({
    label,
    items: grouped[label],
    defaultCollapsed: defaultCollapsedGroups[label] ?? false,
  }))
}

export function getCommandPaletteItems() {
  return NAV_REGISTRY
    .filter((item) => item.inCommandPalette)
    .sort((a, b) => a.order - b.order)
}

export function getProtectedRouteItems() {
  return NAV_REGISTRY
    .filter((item) => item.protected && item.componentKey)
    .sort((a, b) => a.order - b.order)
}

export function getBreadcrumbLabel(path: string) {
  const found = NAV_BY_PATH[path]
  return found?.breadcrumbLabel || found?.label
}
