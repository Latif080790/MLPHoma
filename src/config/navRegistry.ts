export type NavGroup = 'Overview' | 'Project' | 'Portfolio' | 'System'

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
    colorClass: 'text-blue-500',
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
    colorClass: 'text-yellow-600',
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
    colorClass: 'text-sky-500',
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
    group: 'Project',
    order: 40,
    iconKey: 'Calculator',
    colorClass: 'text-emerald-500',
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
    group: 'Project',
    order: 50,
    iconKey: 'BarChart3',
    colorClass: 'text-rose-500',
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
    group: 'Project',
    order: 60,
    iconKey: 'CalendarClock',
    colorClass: 'text-indigo-500',
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
    group: 'Project',
    order: 70,
    iconKey: 'Truck',
    colorClass: 'text-orange-500',
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
    group: 'Project',
    order: 75,
    iconKey: 'ClipboardCheck',
    colorClass: 'text-amber-500',
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
    group: 'Project',
    order: 80,
    iconKey: 'Wallet',
    colorClass: 'text-teal-500',
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
    group: 'Project',
    order: 90,
    iconKey: 'FileDiff',
    colorClass: 'text-rose-500',
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
    group: 'Project',
    order: 100,
    iconKey: 'FolderOpen',
    colorClass: 'text-slate-500',
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
    group: 'Project',
    order: 110,
    iconKey: 'ClipboardCheck',
    colorClass: 'text-violet-500',
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
    group: 'Project',
    order: 120,
    iconKey: 'Flag',
    colorClass: 'text-green-600',
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
    colorClass: 'text-cyan-500',
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
    colorClass: 'text-fuchsia-500',
    keywords: ['portfolio', 'kpi', 'cpi', 'spi', 'phi'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'PortfolioAnalytics',
  },
  {
    id: 'strategy-simulation',
    path: '/strategy-simulation',
    label: 'Strategy Simulation',
    description: 'Scenario & risk modelling',
    group: 'Portfolio',
    order: 150,
    iconKey: 'Zap',
    colorClass: 'text-yellow-500',
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
    colorClass: 'text-purple-500',
    keywords: ['feature', 'toggle', 'config'],
    protected: true,
    inSidebar: true,
    inCommandPalette: true,
    componentKey: 'FeatureEditor',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    description: 'App preferences',
    group: 'System',
    order: 170,
    iconKey: 'Settings',
    colorClass: 'text-gray-500',
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
        Project: [],
        Portfolio: [],
        System: [],
      }
    )

  return (Object.keys(grouped) as NavGroup[]).map((label) => ({
    label,
    items: grouped[label],
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
