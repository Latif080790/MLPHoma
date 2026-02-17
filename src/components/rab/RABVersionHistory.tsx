/**
 * RABVersionHistory.tsx
 * Version history panel with comparison and restore functionality
 */

import React, { useState, useEffect } from 'react'
import { History, RotateCcw, GitCompare, Trash2, Check, X, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
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
import { toast } from 'sonner'
import type { RABVersion, RABVersionComparison } from '../../types/rabVersion'

interface RABVersionHistoryProps {
  projectId: string
  open: boolean
  onClose: () => void
}

export function RABVersionHistory({ projectId, open, onClose }: RABVersionHistoryProps) {
  const {
    getVersionHistory,
    getVersion,
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

  const getChangeTypeColor = (type: RABVersion['changeType']) => {
    switch (type) {
      case 'create': return 'bg-green-100 text-green-800'
      case 'update': return 'bg-blue-100 text-blue-800'
      case 'delete': return 'bg-red-100 text-red-800'
      case 'bulk_update': return 'bg-purple-100 text-purple-800'
      case 'import': return 'bg-yellow-100 text-yellow-800'
      case 'restore': return 'bg-cyan-100 text-cyan-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getChangeTypeIcon = (type: RABVersion['changeType']) => {
    switch (type) {
      case 'restore': return <RotateCcw className="h-3 w-3" />
      default: return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <History className="h-6 w-6 text-blue-600" />
                RAB Version History
              </DialogTitle>
              <DialogDescription>
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
            >
              <GitCompare className="h-4 w-4 mr-2" />
              {compareMode ? 'Exit Compare' : 'Compare Versions'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6 p-6">
          {/* Version List */}
          <div className="w-1/3 flex flex-col gap-4">
            {compareMode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Select Versions to Compare</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">From Version</label>
                    <Select value={compareFrom?.toString()} onValueChange={(v) => setCompareFrom(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
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
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">To Version</label>
                    <Select value={compareTo?.toString()} onValueChange={(v) => setCompareTo(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
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
                    className="w-full"
                    size="sm"
                  >
                    Compare
                  </Button>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="flex-1 rounded-lg border bg-slate-50 p-4">
              <div className="space-y-2">
                {versions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No version history yet</p>
                  </div>
                ) : (
                  versions.slice().reverse().map((version) => (
                    <Card
                      key={version.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedVersion?.id === version.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              v{version.version}
                            </Badge>
                            <Badge className={`text-xs ${getChangeTypeColor(version.changeType)}`}>
                              {getChangeTypeIcon(version.changeType)}
                              {version.changeType}
                            </Badge>
                          </div>
                          {version.status === 'published' && (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Published
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          {version.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(version.createdAt).toLocaleString()} • {version.createdByName}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                          <span>{version.snapshot.totalItems} items</span>
                          <span>•</span>
                          <span>{formatIDR(version.snapshot.totalCost)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Version Details/Comparison */}
          <div className="flex-1 flex flex-col">
            {comparison ? (
              <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="border-b bg-slate-50">
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="h-5 w-5" />
                    Version Comparison
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm mt-2">
                    <Badge variant="outline">v{compareFrom}</Badge>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <Badge variant="outline">v{compareTo}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6">
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-green-50">
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold text-green-700">
                            {comparison.summary.itemsAdded}
                          </div>
                          <div className="text-xs text-green-600">Added</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-50">
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold text-red-700">
                            {comparison.summary.itemsRemoved}
                          </div>
                          <div className="text-xs text-red-600">Removed</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50">
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold text-blue-700">
                            {comparison.summary.itemsModified}
                          </div>
                          <div className="text-xs text-blue-600">Modified</div>
                        </CardContent>
                      </Card>
                      <Card className={comparison.summary.costDifference >= 0 ? 'bg-orange-50' : 'bg-purple-50'}>
                        <CardContent className="p-4">
                          <div className={`text-2xl font-bold ${comparison.summary.costDifference >= 0 ? 'text-orange-700' : 'text-purple-700'} flex items-center gap-1`}>
                            {comparison.summary.costDifference >= 0 ? (
                              <TrendingUp className="h-5 w-5" />
                            ) : (
                              <TrendingDown className="h-5 w-5" />
                            )}
                            {formatIDR(Math.abs(comparison.summary.costDifference))}
                          </div>
                          <div className={`text-xs ${comparison.summary.costDifference >= 0 ? 'text-orange-600' : 'text-purple-600'}`}>
                            Cost {comparison.summary.costDifference >= 0 ? 'Increase' : 'Decrease'}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Changes Detail */}
                    {comparison.added.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          Added Items ({comparison.added.length})
                        </h4>
                        <div className="space-y-1 bg-green-50 p-4 rounded-lg">
                          {comparison.added.map((item, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2 text-green-800">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                              <span className="font-mono text-xs">{item.item_code}</span>
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {comparison.removed.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                          <X className="h-4 w-4" />
                          Removed Items ({comparison.removed.length})
                        </h4>
                        <div className="space-y-1 bg-red-50 p-4 rounded-lg">
                          {comparison.removed.map((item, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2 text-red-800">
                              <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                              <span className="font-mono text-xs">{item.item_code}</span>
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {comparison.modified.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                          <GitCompare className="h-4 w-4" />
                          Modified Items ({comparison.modified.length})
                        </h4>
                        <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
                          {comparison.modified.map((mod, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border">
                              <div className="text-sm font-medium text-blue-900 mb-2">
                                {mod.item.item_code} - {mod.item.name}
                              </div>
                              <div className="space-y-1 text-xs">
                                {mod.changes.map((change, cidx) => (
                                  <div key={cidx} className="flex items-center gap-2 text-blue-700">
                                    <Badge variant="outline" className="text-xs">
                                      {change.field}
                                    </Badge>
                                    <span className="line-through text-red-600">
                                      {typeof change.oldValue === 'number' ? formatIDR(change.oldValue) : change.oldValue}
                                    </span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="font-semibold text-green-600">
                                      {typeof change.newValue === 'number' ? formatIDR(change.newValue) : change.newValue}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : selectedVersion ? (
              <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="border-b bg-slate-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Version {selectedVersion.version} Details
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRestore(selectedVersion.version)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVersion(projectId, selectedVersion.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Description</h4>
                      <p className="text-slate-600">{selectedVersion.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-1">Created</h4>
                        <p className="text-sm text-slate-600">
                          {new Date(selectedVersion.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-1">Created By</h4>
                        <p className="text-sm text-slate-600">{selectedVersion.createdByName}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Snapshot Summary</h4>
                      <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Total Items:</span>
                          <span className="font-semibold">{selectedVersion.snapshot.totalItems}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Total Cost:</span>
                          <span className="font-semibold">{formatIDR(selectedVersion.snapshot.totalCost)}</span>
                        </div>
                        {selectedVersion.snapshot.metadata.categories && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Categories:</span>
                            <span className="font-semibold">{selectedVersion.snapshot.metadata.categories.length}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedVersion.changes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">
                          Changes ({selectedVersion.changes.length})
                        </h4>
                        <ScrollArea className="h-64 bg-slate-50 rounded-lg p-4">
                          <div className="space-y-2">
                            {selectedVersion.changes.map((change, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border text-xs">
                                <div className="font-semibold text-slate-900 mb-1">
                                  {change.itemCode} - {change.itemName}
                                </div>
                                <div className="text-slate-600">{change.changeDescription}</div>
                                <div className="flex items-center gap-2 mt-1 text-slate-500">
                                  <Badge variant="outline" className="text-xs">{change.field}</Badge>
                                  {change.oldValue !== undefined && (
                                    <>
                                      <span className="line-through">{change.oldValue}</span>
                                      <ArrowRight className="h-3 w-3" />
                                      <span className="font-semibold">{change.newValue}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Select a version to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Restore Confirmation */}
        <Dialog open={confirmRestore !== null} onOpenChange={() => setConfirmRestore(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Version {confirmRestore}?</DialogTitle>
              <DialogDescription>
                This will create a new version restoring the state from version {confirmRestore}.
                Current data will not be lost.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmRestore(null)}>
                Cancel
              </Button>
              <Button onClick={() => confirmRestore && handleRestore(confirmRestore)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
