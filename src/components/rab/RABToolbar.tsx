import React, { useState } from 'react'
import {
  CheckCircle2, Layers, Lock, LockKeyhole, Plus, Search, Trash2, X, Zap,
  Download, Upload, ChevronDown, ListFilter, Percent, MoreHorizontal,
  GitBranch, CalendarClock, History,
} from 'lucide-react'
import { VisibilityState } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface RABToolbarProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  activeTab: 'direct' | 'overhead'
  onTabChange: (tab: 'direct' | 'overhead') => void
  isLocked: boolean
  draftCount: number
  selectedCount: number
  scenarioVersion?: string | null
  onAddItem: () => void
  onBulkDelete: () => void
  onBulkOverhead?: (percent: number) => void
  onGenerateWBS: () => void
  onDownloadTemplate: () => void
  onImportExcel: () => void
  onAutoSchedule: () => void
  onPriceDrift: () => void
  onToggleLock: () => void
  onShowHistory: () => void
  onPublish: () => void
  onSwitchScenario: (version: string | null) => void
  onSaveScenario: () => void
  scenarios: any[]
  availableColumns?: { id: string; label: string }[]
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (columnId: string, isVisible: boolean) => void
}

export const RABToolbar: React.FC<RABToolbarProps> = ({
  searchQuery, onSearchChange, activeTab, onTabChange,
  isLocked, draftCount, selectedCount, scenarioVersion,
  onAddItem, onBulkDelete, onBulkOverhead,
  onGenerateWBS, onAutoSchedule, onShowHistory,
  onDownloadTemplate, onImportExcel, onPriceDrift, onToggleLock,
  onPublish, onSwitchScenario, onSaveScenario, scenarios,
  availableColumns = [], columnVisibility = {}, onColumnVisibilityChange,
}) => {
  const [overheadPct, setOverheadPct] = useState('')
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5 flex-nowrap px-3 py-2 bg-muted/30/95 backdrop-blur-md border-b border-border overflow-x-auto">

      {/* Search */}
      <div className="relative flex-shrink-0 w-40">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search items, codes..."
          className="h-7 pl-8 pr-7 text-xs bg-card border-border"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
            <X size={11} />
          </button>
        )}
      </div>

      {/* DC / Overhead toggle */}
      <div className="flex bg-card border border-border rounded-md p-0.5 flex-shrink-0">
        <button
          onClick={() => onTabChange('direct')}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
            activeTab === 'direct' ? 'bg-muted text-white shadow-sm' : 'text-muted-foreground hover:text-muted-foreground'
          }`}
        >
          Direct
        </button>
        <button
          onClick={() => onTabChange('overhead')}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
            activeTab === 'overhead' ? 'bg-muted text-white shadow-sm' : 'text-muted-foreground hover:text-muted-foreground'
          }`}
        >
          OH
        </button>
      </div>

      <div className="w-px h-4 bg-muted flex-shrink-0 mx-0.5" />

      {/* Column visibility */}
      {availableColumns.length > 0 && onColumnVisibilityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 border-border flex-shrink-0">
              <ListFilter size={11} className="text-muted-foreground" />
              Columns
              <ChevronDown size={10} className="opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground py-1">Column Visibility</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableColumns.map(col => {
              const isVisible = columnVisibility[col.id] !== false
              return (
                <DropdownMenuItem
                  key={col.id}
                  className="flex items-center justify-between cursor-pointer text-xs"
                  onClick={e => { e.preventDefault(); onColumnVisibilityChange(col.id, !isVisible) }}
                >
                  <span>{col.label}</span>
                  {isVisible && <CheckCircle2 size={12} className="text-blue-500" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Scenario / Baseline version */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 border-border flex-shrink-0">
            <Layers size={11} className="text-muted-foreground" />
            {scenarioVersion ? `v${scenarioVersion}` : 'vBaseline'}
            <ChevronDown size={10} className="opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground py-1">Scenarios</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSwitchScenario(null)} className="flex items-center justify-between text-xs">
            <span>Live RAB</span>
            {!scenarioVersion && <CheckCircle2 size={12} className="text-emerald-500" />}
          </DropdownMenuItem>
          {scenarios.map(s => (
            <DropdownMenuItem key={s.id} onClick={() => onSwitchScenario(s.version)} className="flex items-center justify-between text-xs">
              <span>Scenario v{s.version}</span>
              {scenarioVersion === s.version && <CheckCircle2 size={12} className="text-emerald-500" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSaveScenario} className="text-blue-600 font-semibold text-xs">
            <Plus size={12} className="mr-1.5" />
            Save as Scenario
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-muted flex-shrink-0 mx-0.5" />

      {/* Overflow: Template + Import + Analyze Drift */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 border-border flex-shrink-0">
            <MoreHorizontal size={13} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground py-1">Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onImportExcel} className="text-xs gap-2">
            <Upload size={12} className="text-emerald-600" /> Import Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownloadTemplate} className="text-xs gap-2">
            <Download size={12} className="text-emerald-600" /> Download Template
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground py-1">Generate & Sync</DropdownMenuLabel>
          <DropdownMenuItem onClick={onGenerateWBS} className="text-xs gap-2">
            <GitBranch size={12} className="text-violet-600" /> Generate WBS from RAB
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAutoSchedule} className="text-xs gap-2">
            <CalendarClock size={12} className="text-blue-600" /> Auto Schedule
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onShowHistory} className="text-xs gap-2">
            <History size={12} className="text-muted-foreground" /> Version History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPriceDrift} className="text-xs gap-2">
            <Zap size={12} className="text-amber-600" /> Analyze Drift
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lock */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleLock}
        className={`h-7 px-2 text-xs gap-1 flex-shrink-0 ${
          isLocked
            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
            : 'text-muted-foreground border-border hover:border-amber-200 hover:text-amber-600'
        }`}
      >
        {isLocked ? <LockKeyhole size={11} /> : <Lock size={11} />}
        {isLocked ? 'Locked' : 'Lock'}
      </Button>

      {/* Bulk actions when items selected */}
      {selectedCount > 0 && (
        <>
          {onBulkOverhead && (
            <Popover open={bulkPopoverOpen} onOpenChange={setBulkPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-indigo-600 border-indigo-100 hover:bg-indigo-50 flex-shrink-0">
                  <Percent size={11} />
                  Margin ({selectedCount})
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Apply Margin Adjustment</p>
                <p className="text-xs text-muted-foreground mb-2">Scale base unit cost of {selectedCount} items × (1 + %)</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input type="number" min={-100} max={500} step={0.5} placeholder="15" value={overheadPct}
                      onChange={e => setOverheadPct(e.target.value)} className="h-7 text-xs pr-6" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                  </div>
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    const pct = parseFloat(overheadPct)
                    if (isNaN(pct)) return
                    onBulkOverhead(pct)
                    setOverheadPct('')
                    setBulkPopoverOpen(false)
                  }}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="destructive" size="sm" onClick={onBulkDelete} className="h-7 px-2 text-xs gap-1 flex-shrink-0">
            <Trash2 size={11} />
            Delete ({selectedCount})
          </Button>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Primary CTA: Add Item or Publish */}
      {draftCount > 0 ? (
        <Button id="btn-publish-drafts" onClick={onPublish} size="sm"
          className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow shadow-emerald-200 flex-shrink-0">
          <CheckCircle2 size={12} />
          Publish ({draftCount})
        </Button>
      ) : (
        <Button onClick={onAddItem} size="sm"
          className="h-7 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90 shadow shadow-blue-200/30 flex-shrink-0">
          <Plus size={12} />
          Add Item
        </Button>
      )}
    </div>
  )
}
