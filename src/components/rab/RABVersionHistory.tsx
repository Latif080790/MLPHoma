/**
 * RABVersionHistory.tsx
 * Version history panel with comparison and restore functionality
 * Redesigned for better readability and usability
 */

import React, { useState, useEffect } from 'react'
import { History, RotateCcw, GitCompare, Trash2, Check, X, ArrowRight, TrendingUp, TrendingDown, Clock, User, Package, Coins } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { useRABVersionStore } from '../../store/rabVersionStore'
import { formatIDR } from '../../lib/utils'
import type { RABVersion, RABVersionComparison } from '../../types/rabVersion'

interface RABVersionHistoryProps {
  projectId: string
  open: boolean
  onClose: () => void
}

export function RABVersionHistory({ projectId, open, onClose }: RABVersionHistoryProps) {
  const {
    getVersionHistory,
    compareVersions,
    restoreVersion,
    deleteVersion,
    fetchVersionsFromSupabase
  } = useRABVersionStore()

  const [versions, setVersions] = useState<RABVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<RABVersion | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState<number | null>(null)
  const [compareTo, setCompareTo] = useState<number | null>(null)
  const [comparison, setComparison] = useState<RABVersionComparison | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      fetchVersionsFromSupabase(projectId)
      const history = getVersionHistory(projectId)
      setVersions(history)
    }
  }, [open, projectId, getVersionHistory, fetchVersionsFromSupabase])

  const handleCompare = () => {
    if (compareFrom && compareTo) {
      const comp = compareVersions(projectId, compareFrom, compareTo)
      setComparison(comp)
    }
  }

  const handleRestore = async (version: number) => {
    await restoreVersion(projectId, version)
    setConfirmRestore(null)
    const history = getVersionHistory(projectId)
    setVersions(history)
  }

  const getChangeTypeStyle = (type: RABVersion['changeType']) => {
    switch (type) {
      case 'create': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'bulk_update': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      case 'import': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      case 'restore': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
      default: return 'bg-muted/50 text-muted-foreground'
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ─── Header ─── */}
        <DialogHeader className="px-6 py-5 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-foreground">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary shadow-md shadow-blue-200/20 shrink-0">
                  <History className="h-5 w-5" />
                </div>
                RAB Version History
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Track changes, compare versions, and restore previous states
              </DialogDescription>
            </div>
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode)
                setComparison(null)
                setCompareFrom(null)
                setCompareTo(null)
              }}
              className="shrink-0 gap-2 h-9"
            >
              <GitCompare className="h-4 w-4" />
              {compareMode ? 'Exit Compare' : 'Compare Versions'}
            </Button>
          </div>
        </DialogHeader>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* ─── Left: Version List ─── */}
          <div className="w-full md:w-[340px] lg:w-[380px] shrink-0 border-r border-border flex flex-col bg-muted/30/50">
            {/* Compare selectors */}
            {compareMode && (
              <div className="p-4 border-b border-border bg-blue-50/50 dark:bg-blue-950/20">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
                  Select Versions to Compare
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">From</label>
                    <Select value={compareFrom?.toString()} onValueChange={(v) => setCompareFrom(Number(v))}>
                      <SelectTrigger className="h-9 bg-card text-sm">
                        <SelectValue placeholder="v..." />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map(v => (
                          <SelectItem key={v.id} value={v.version.toString()}>
                            Version {v.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mb-2.5 shrink-0" />
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">To</label>
                    <Select value={compareTo?.toString()} onValueChange={(v) => setCompareTo(Number(v))}>
                      <SelectTrigger className="h-9 bg-card text-sm">
                        <SelectValue placeholder="v..." />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map(v => (
                          <SelectItem key={v.id} value={v.version.toString()}>
                            Version {v.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCompare}
                    disabled={!compareFrom || !compareTo || compareFrom === compareTo}
                    size="sm"
                    className="h-9 px-4 shrink-0"
                  >
                    Compare
                  </Button>
                </div>
              </div>
            )}

            {/* Version cards list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {versions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No version history yet</p>
                    <p className="text-xs mt-1">Save a scenario to create first version</p>
                  </div>
                ) : (
                  versions.slice().reverse().map((version) => {
                    const isSelected = selectedVersion?.id === version.id
                    return (
                      <button
                        type="button"
                        key={version.id}
                        className={`w-full text-left rounded-xl border transition-all duration-150 p-4 ${isSelected
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600 shadow-md shadow-blue-100 dark:shadow-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-700'
                            : 'border-border bg-card hover:border-border dark:hover:border-border hover:shadow-sm'
                          }`}
                        onClick={() => setSelectedVersion(version)}
                      >
                        {/* Row 1: Version badge + change type + status */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="inline-flex items-center justify-center h-7 min-w-[40px] rounded-lg bg-background dark:bg-card text-white text-xs font-black tracking-wide px-2 shrink-0">
                            v{version.version}
                          </span>
                          <Badge className={`text-xs font-semibold uppercase tracking-wider border ${getChangeTypeStyle(version.changeType)}`}>
                            {version.changeType.replace('_', ' ')}
                          </Badge>
                          {version.status === 'published' && (
                            <Badge variant="default" className="ml-auto bg-emerald-600 text-xs gap-1 shrink-0">
                              <Check className="h-2.5 w-2.5" />
                              Published
                            </Badge>
                          )}
                        </div>

                        {/* Row 2: Description */}
                        <p className="text-sm font-semibold text-foreground leading-snug mb-2 line-clamp-2">
                          {version.description}
                        </p>

                        {/* Row 3: Metadata */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(version.createdAt)}, {formatTime(version.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.createdByName}
                          </span>
                        </div>

                        {/* Row 4: Stats */}
                        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border text-xs">
                          <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                            <Package className="h-3 w-3" />
                            {version.snapshot.totalItems} items
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-muted-foreground">
                            <Coins className="h-3 w-3" />
                            {formatIDR(version.snapshot.totalCost)}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ─── Right: Details / Comparison ─── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {comparison ? (
              /* ─── Comparison View ─── */
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-border bg-muted/30/50 shrink-0">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                    <GitCompare className="h-5 w-5 text-purple-600" />
                    Version Comparison
                  </h3>
                  <div className="flex items-center gap-3 text-sm mt-2">
                    <Badge variant="outline" className="font-mono font-bold">v{compareFrom}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="font-mono font-bold">v{compareTo}</Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{comparison.summary.itemsAdded}</div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 mt-0.5">Added</div>
                      </div>
                      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                        <div className="text-2xl font-black text-red-700 dark:text-red-400">{comparison.summary.itemsRemoved}</div>
                        <div className="text-xs font-semibold text-red-600 dark:text-red-500 mt-0.5">Removed</div>
                      </div>
                      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                        <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{comparison.summary.itemsModified}</div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-500 mt-0.5">Modified</div>
                      </div>
                      <div className={`rounded-xl border p-4 ${comparison.summary.costDifference >= 0
                          ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30'
                          : 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30'
                        }`}>
                        <div className={`text-lg font-black flex items-center gap-1 ${comparison.summary.costDifference >= 0 ? 'text-orange-700 dark:text-orange-400' : 'text-purple-700 dark:text-purple-400'
                          }`}>
                          {comparison.summary.costDifference >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {formatIDR(Math.abs(comparison.summary.costDifference))}
                        </div>
                        <div className={`text-xs font-semibold mt-0.5 ${comparison.summary.costDifference >= 0 ? 'text-orange-600 dark:text-orange-500' : 'text-purple-600 dark:text-purple-500'
                          }`}>
                          Cost {comparison.summary.costDifference >= 0 ? 'Increase' : 'Decrease'}
                        </div>
                      </div>
                    </div>

                    {/* Added Items */}
                    {comparison.added.length > 0 && (
                      <div>
                        <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4" />
                          Added Items ({comparison.added.length})
                        </h4>
                        <div className="space-y-1.5 bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          {comparison.added.map((item, idx) => {
                            const it = item as { item_code?: string; name?: string }
                            return (
                              <div key={idx} className="text-sm flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{it.item_code}</span>
                                <span className="truncate">{it.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Removed Items */}
                    {comparison.removed.length > 0 && (
                      <div>
                        <h4 className="font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2 text-sm">
                          <X className="h-4 w-4" />
                          Removed Items ({comparison.removed.length})
                        </h4>
                        <div className="space-y-1.5 bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900">
                          {comparison.removed.map((item, idx) => {
                            const it = item as { item_code?: string; name?: string }
                            return (
                              <div key={idx} className="text-sm flex items-center gap-2.5 text-red-800 dark:text-red-300">
                                <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                                <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">{it.item_code}</span>
                                <span className="truncate">{it.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Modified Items */}
                    {comparison.modified.length > 0 && (
                      <div>
                        <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2 text-sm">
                          <GitCompare className="h-4 w-4" />
                          Modified Items ({comparison.modified.length})
                        </h4>
                        <div className="space-y-3 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                          {comparison.modified.map((mod, idx) => {
                            const modItem = mod.item as { item_code?: string; name?: string }
                            return (
                              <div key={idx} className="bg-card p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                                  {modItem.item_code} — {modItem.name}
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  {mod.changes.map((change, cidx) => (
                                    <div key={cidx} className="flex items-center gap-2 text-blue-700 dark:text-blue-300 flex-wrap">
                                      <Badge variant="outline" className="text-xs font-bold uppercase">
                                        {change.field}
                                      </Badge>
                                      <span className="line-through text-red-500 dark:text-red-400 font-mono">
                                        {typeof change.oldValue === 'number' ? formatIDR(change.oldValue) : String(change.oldValue ?? '')}
                                      </span>
                                      <ArrowRight className="h-3 w-3 shrink-0" />
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                        {typeof change.newValue === 'number' ? formatIDR(change.newValue) : String(change.newValue ?? '')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : selectedVersion ? (
              /* ─── Version Detail View ─── */
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-border bg-muted/30/50 shrink-0">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
                      <span className="inline-flex items-center justify-center h-7 min-w-[40px] rounded-lg bg-background dark:bg-card text-white text-xs font-black px-2">
                        v{selectedVersion.version}
                      </span>
                      Version Details
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-8 text-xs"
                        onClick={() => setConfirmRestore(selectedVersion.version)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => deleteVersion(projectId, selectedVersion.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-6 space-y-5">
                    {/* Description */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedVersion.description}</p>
                    </div>

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-muted/30 p-3 border border-border">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Created
                        </h4>
                        <p className="text-sm font-medium text-muted-foreground">
                          {formatDate(selectedVersion.createdAt)}, {formatTime(selectedVersion.createdAt)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3 border border-border">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          Author
                        </h4>
                        <p className="text-sm font-medium text-muted-foreground">{selectedVersion.createdByName}</p>
                      </div>
                    </div>

                    {/* Snapshot */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Snapshot Summary</h4>
                      <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-800 dark:to-blue-900/20 p-4 space-y-2.5 border border-border">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            Total Items
                          </span>
                          <span className="font-bold text-foreground">{selectedVersion.snapshot.totalItems}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5" />
                            Total Cost
                          </span>
                          <span className="font-bold font-mono text-foreground">{formatIDR(selectedVersion.snapshot.totalCost)}</span>
                        </div>
                        {selectedVersion.snapshot.metadata.categories && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-medium">Categories</span>
                            <span className="font-bold text-foreground">{selectedVersion.snapshot.metadata.categories.length}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Change log */}
                    {selectedVersion.changes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Changes ({selectedVersion.changes.length})
                        </h4>
                        <div className="space-y-2 rounded-xl bg-muted/30 p-4 border border-border max-h-64 overflow-y-auto">
                          {selectedVersion.changes.map((change, idx) => (
                            <div key={idx} className="bg-card p-3 rounded-lg border border-border text-xs">
                              <div className="font-semibold text-foreground mb-1 text-sm">
                                {change.itemCode} — {change.itemName}
                              </div>
                              <div className="text-muted-foreground mb-1">{change.changeDescription}</div>
                              <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                                <Badge variant="outline" className="text-xs font-bold uppercase">{change.field}</Badge>
                                {change.oldValue !== undefined && (
                                  <>
                                    <span className="line-through font-mono text-red-500 dark:text-red-400">{String(change.oldValue ?? '')}</span>
                                    <ArrowRight className="h-3 w-3 shrink-0" />
                                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{String(change.newValue ?? '')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* ─── Empty State ─── */
              <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/30/30">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                    <History className="h-8 w-8 opacity-30" />
                  </div>
                  <p className="font-semibold text-muted-foreground">Select a version to view details</p>
                  <p className="text-xs text-muted-foreground mt-1">Click on any version card on the left</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Restore Confirmation Dialog (nested) ─── */}
        <Dialog open={confirmRestore !== null} onOpenChange={() => setConfirmRestore(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-blue-600" />
                Restore Version {confirmRestore}?
              </DialogTitle>
              <DialogDescription>
                This will create a new version restoring the state from version {confirmRestore}.
                Current data will not be lost.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmRestore(null)}>
                Cancel
              </Button>
              <Button onClick={() => confirmRestore && handleRestore(confirmRestore)} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
