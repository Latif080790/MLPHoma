import React from 'react'
import {
  Calculator, CheckCircle2, History, Layers, Lock,
  LockKeyhole, Plus, Search, Trash2, X, Zap,
  Download, Upload, CalendarClock, ChevronDown, ListFilter
} from 'lucide-react'
import { VisibilityState } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface RABToolbarProps {
  // Search & Filters
  searchQuery: string
  onSearchChange: (val: string) => void
  activeTab: 'direct' | 'overhead'
  onTabChange: (tab: 'direct' | 'overhead') => void
  
  // States
  isLocked: boolean
  draftCount: number
  selectedCount: number
  scenarioVersion?: number | null
  
  // Actions
  onAddItem: () => void
  onBulkDelete: () => void
  onGenerateWBS: () => void
  onDownloadTemplate: () => void
  onImportExcel: () => void
  onAutoSchedule: () => void
  onPriceDrift: () => void
  onToggleLock: () => void
  onShowHistory: () => void
  onPublish: () => void
  onSwitchScenario: (version: number | null) => void
  onSaveScenario: () => void
  
  // Data for Scenarios
  // Data for Scenarios
  scenarios: any[]
  
  // Column Visibility
  availableColumns?: { id: string, label: string }[]
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (columnId: string, isVisible: boolean) => void
}

/**
 * RABToolbar
 * 
 * Extracted toolbar from RABTable monolith.
 * Consolidates search, view toggles, and all action buttons.
 */
export const RABToolbar: React.FC<RABToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  isLocked,
  draftCount,
  selectedCount,
  scenarioVersion,
  onAddItem,
  onBulkDelete,
  onGenerateWBS,
  onDownloadTemplate,
  onImportExcel,
  onAutoSchedule,
  onPriceDrift,
  onToggleLock,
  onShowHistory,
  onPublish,
  onSwitchScenario,
  onSaveScenario,
  scenarios,
  availableColumns = [],
  columnVisibility = {},
  onColumnVisibilityChange
}) => {
  return (
    <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md p-4 -m-4 border-b border-slate-200 dark:border-slate-800 transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search items, codes..."
            className="h-9 pl-9 pr-8 text-xs bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
          />
          {searchQuery && (
            <button 
              onClick={() => onSearchChange('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => onTabChange('direct')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'direct' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Direct Costs
          </button>
          <button
            onClick={() => onTabChange('overhead')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'overhead' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overhead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Column Manager */}
        {availableColumns.length > 0 && onColumnVisibilityChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-2 border-slate-200 dark:border-slate-800 hidden md:flex">
                <ListFilter className="h-3.5 w-3.5 text-slate-400" />
                Kolom
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
                Atur Visibilitas Kolom
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map(col => {
                const isVisible = columnVisibility[col.id] !== false
                return (
                  <DropdownMenuItem 
                    key={col.id} 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      onColumnVisibilityChange(col.id, !isVisible)
                    }}
                  >
                    <span>{col.label}</span>
                    {isVisible && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Scenarios Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-2 border-slate-200 dark:border-slate-800">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              {scenarioVersion ? `v${scenarioVersion}` : 'Live RAB'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">Project Scenarios</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSwitchScenario(null)} className="flex items-center justify-between">
              <span>Live RAB</span>
              {!scenarioVersion && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            </DropdownMenuItem>
            {scenarios.map(s => (
              <DropdownMenuItem key={s.id} onClick={() => onSwitchScenario(s.version)} className="flex items-center justify-between">
                <span>Scenario v{s.version}</span>
                {scenarioVersion === s.version && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSaveScenario} className="text-blue-600 font-semibold focus:text-blue-700">
              <Plus className="h-3.5 w-3.5 mr-2" />
              Store current as Scenario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden lg:block" />

        {/* Primary Actions */}
        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={onBulkDelete} className="h-9 text-xs gap-2">
            <Trash2 className="h-3.5 w-3.5" />
            Delete ({selectedCount})
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="h-9 text-xs gap-2 text-emerald-600 hover:bg-emerald-50 border-emerald-100">
          <Download className="h-3.5 w-3.5" />
          Template
        </Button>

        <Button variant="outline" size="sm" onClick={onImportExcel} className="h-9 text-xs gap-2 text-emerald-600 hover:bg-emerald-50 border-emerald-100">
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        <Button variant="outline" size="sm" onClick={onPriceDrift} className="h-9 text-xs gap-2 text-blue-600 hover:bg-blue-50 border-blue-100">
          <Zap className="h-3.5 w-3.5" />
          Analyze Drift
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleLock}
          className={`h-9 text-xs gap-2 ${isLocked ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
        >
          {isLocked ? <LockKeyhole className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {isLocked ? 'Locked' : 'Lock Baseline'}
        </Button>

        {draftCount > 0 ? (
          <Button onClick={onPublish} size="sm" className="h-9 text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Publish ({draftCount})
          </Button>
        ) : (
          <Button onClick={onAddItem} size="sm" className="h-9 text-xs gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none">
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        )}
      </div>
    </div>
  )
}
