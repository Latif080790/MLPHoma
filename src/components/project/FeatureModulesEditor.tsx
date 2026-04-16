import React, { useState } from 'react'
import { 
  Settings2, 
  Check, 
  ChevronRight, 
  Search,
  Zap,
  ShieldCheck,
  Bell,
  RefreshCw,
  Layout,
  Layers,
  Calculator,
  CalendarClock,
  TrendingUp,
  Truck,
  Wallet,
  Activity,
  BarChart3
} from 'lucide-react'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { ScrollArea } from '../ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import type { FeatureConfig } from '../../config/features/featureConfig'

interface FeatureModulesEditorProps {
  config: FeatureConfig
  onUpdate: (updates: Partial<FeatureConfig>) => void
}

export function FeatureModulesEditor({ config, onUpdate }: FeatureModulesEditorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleToggle = (module: keyof FeatureConfig, section: string, key: string, value: boolean) => {
    const moduleConfig = config[module] as any
    if (!moduleConfig) return

    const newModuleConfig = {
      ...moduleConfig,
      [section]: {
        ...moduleConfig[section],
        [key]: value
      }
    }

    onUpdate({ [module]: newModuleConfig })
  }

  const handleInputChange = (module: keyof FeatureConfig, section: string, key: string, value: any) => {
    const moduleConfig = config[module] as any
    if (!moduleConfig) return

    const newModuleConfig = {
      ...moduleConfig,
      [section]: {
        ...moduleConfig[section],
        [key]: value
      }
    }

    onUpdate({ [module]: newModuleConfig })
  }

  const sections = [
    { id: 'rab', label: 'RAB', icon: Calculator, color: 'text-indigo-600' },
    { id: 'timeline', label: 'Timeline', icon: CalendarClock, color: 'text-blue-600' },
    { id: 'rap', label: 'RAP', icon: TrendingUp, color: 'text-emerald-600' },
    { id: 'resources', label: 'Resources', icon: Truck, color: 'text-orange-600' },
    { id: 'cashflow', label: 'Cashflow', icon: Wallet, color: 'text-teal-600' },
    { id: 'curvas', label: 'Curva-S', icon: Activity, color: 'text-rose-600' },
    { id: 'progress', label: 'Progress', icon: BarChart3, color: 'text-sky-600' },
    { id: 'reporting', label: 'Reports', icon: Layout, color: 'text-slate-600' },
    { id: 'projectManagement', label: 'Project Mgmt', icon: Settings2, color: 'text-violet-600' },
  ]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-slate-50/50 dark:bg-neutral-900/50 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-full h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200">
              <Zap className="h-3 w-3 mr-1 fill-emerald-500 text-emerald-500" /> Live Sync
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="rab" className="flex-1 flex overflow-hidden">
          <TabsList className="flex flex-col h-full w-56 bg-slate-50 dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 p-2 gap-1 rounded-none overflow-y-auto">
            {sections.map(s => (
              <TabsTrigger 
                key={s.id} 
                value={s.id}
                className="w-full justify-start gap-3 px-3 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-neutral-800 border-none"
              >
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-sm font-semibold">{s.label}</span>
                <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-data-[state=active]:opacity-100" />
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-hidden bg-white dark:bg-neutral-950">
            {sections.map(s => (
              <TabsContent key={s.id} value={s.id} className="h-full m-0 p-0 overflow-hidden data-[state=active]:flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-8 max-w-3xl space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800`}>
                        <s.icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{s.label} Module Policy</h2>
                        <p className="text-sm text-slate-500">Configure business logic and automation for {s.label}.</p>
                      </div>
                    </div>

                    {/* Rendering module specific sections dynamically or hardcoded for high-touch */}
                    {s.id === 'rab' && (
                       <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Calculation Section */}
                          <div className="bg-slate-50/50 dark:bg-neutral-900/30 rounded-2xl p-6 border border-slate-100 dark:border-neutral-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Calculator className="h-4 w-4 text-indigo-500" />
                              <h3 className="font-bold text-slate-800 dark:text-slate-200">Calculation Engine</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Label className="text-xs uppercase font-black text-slate-400 tracking-wider">Default Overhead (%)</Label>
                                <Input 
                                  type="number" 
                                  value={config.rab.calculation.includeOverheadPct} 
                                  onChange={e => handleInputChange('rab', 'calculation', 'includeOverheadPct', parseFloat(e.target.value) || 0)}
                                  className="h-9 font-mono"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs uppercase font-black text-slate-400 tracking-wider">Default Profit (%)</Label>
                                <Input 
                                  type="number" 
                                  value={config.rab.calculation.includeProfitPct} 
                                  onChange={e => handleInputChange('rab', 'calculation', 'includeProfitPct', parseFloat(e.target.value) || 0)}
                                  className="h-9 font-mono"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Auto-Recalculate on AHSP Change</Label>
                                <p className="text-xs text-slate-500">Automatically update RAB totals when linked AHSP price changes.</p>
                              </div>
                              <Switch 
                                checked={config.rab.calculation.autoRecalcOnAhspChange}
                                onCheckedChange={(v: boolean) => handleToggle('rab', 'calculation', 'autoRecalcOnAhspChange', v)}
                              />
                            </div>
                          </div>

                          {/* Control Section */}
                          <div className="bg-slate-50/50 dark:bg-neutral-900/30 rounded-2xl p-6 border border-slate-100 dark:border-neutral-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                              <h3 className="font-bold text-slate-800 dark:text-slate-200">Financial Control</h3>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Budget Lock on Approval</Label>
                                <p className="text-xs text-slate-500">Prevent any modification to RAB items once the budget is approved.</p>
                              </div>
                              <Switch 
                                checked={config.rab.costControl.budgetLockOnApproval}
                                onCheckedChange={(v: boolean) => handleToggle('rab', 'costControl', 'budgetLockOnApproval', v)}
                              />
                            </div>
                            <div className="space-y-2 pt-2">
                              <Label className="text-xs uppercase font-black text-slate-400 tracking-wider">Approval Threshold (IDR)</Label>
                              <Input 
                                type="number" 
                                value={config.rab.costControl.approvalThresholdAmount} 
                                onChange={e => handleInputChange('rab', 'costControl', 'approvalThresholdAmount', parseInt(e.target.value) || 0)}
                                className="h-9 font-mono"
                              />
                            </div>
                          </div>

                          {/* Alerts Section */}
                          <div className="bg-slate-50/50 dark:bg-neutral-900/30 rounded-2xl p-6 border border-slate-100 dark:border-neutral-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Bell className="h-4 w-4 text-amber-500" />
                              <h3 className="font-bold text-slate-800 dark:text-slate-200">Thresholds & Alerts</h3>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center mb-1">
                                <Label className="text-xs uppercase font-black text-slate-400 tracking-wider">Critical Budget Threshold (%)</Label>
                                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-1.5 rounded">{config.rab.notifications.thresholds.budgetThresholdPct}%</span>
                              </div>
                              <Input 
                                type="range" 
                                min="50"
                                max="100"
                                value={config.rab.notifications.thresholds.budgetThresholdPct} 
                                onChange={e => handleInputChange('rab', 'notifications', 'thresholds', { ...config.rab.notifications.thresholds, budgetThresholdPct: parseInt(e.target.value) || 0 })}
                                className="h-6"
                              />
                            </div>
                          </div>
                       </div>
                    )}

                    {/* Default fallback for other modules */}
                    {s.id !== 'rab' && (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                        <Layers className="h-12 w-12 text-slate-300" />
                        <div>
                          <p className="text-lg font-bold">Module Configuration Ready</p>
                          <p className="text-sm max-w-[200px]">Specific UI controls for {s.label} are being connected.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
