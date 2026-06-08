/**
 * AHSPComponentsTable.tsx
 * Step 2 content ("Komponen"): the component analysis table (manual + library
 * resource components) with inline coefficient editing, add/remove actions, and the
 * integrated resource library search.
 */

import { Plus, Trash2, Calculator, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'
import { formatIDR } from '../../lib/utils'
import type { AHSPComponent, Resource, ResourceType, ResourceUnit } from '../../types/ahsp'

/** A manually entered (not-yet-persisted) component row */
export interface ManualComponent {
  tempId: string
  type: ResourceType
  resourceName: string
  unit: ResourceUnit
  coefficient: number
  unitPrice: number
  editing: boolean
}

/** Props for AHSPComponentsTable component */
export interface AHSPComponentsTableProps {
  /** Persisted/draft resource-based components */
  components: AHSPComponent[]
  /** All resources (for resolving component names) */
  resources: Resource[]
  /** Manual (custom) component rows */
  manualComponents: ManualComponent[]
  /** Add an empty manual component row */
  onAddManualComponent: () => void
  /** Update a field on a manual component row */
  onUpdateManualComponent: (tempId: string, field: string, value: unknown) => void
  /** Delete a manual component row */
  onDeleteManualComponent: (tempId: string) => void
  /** Update a field on a resource-based component */
  onUpdateComponent: (componentId: string, field: string, value: unknown) => void
  /** Request deletion of a resource-based component */
  onDeleteComponent: (componentId: string) => void
  /** Add a resource from the library as a component */
  onAddResource: (resource: Resource) => void

  /** Currently selected resource type filter */
  selectedComponentType: ResourceType
  /** Resource type filter setter */
  setSelectedComponentType: (type: ResourceType) => void
  /** Resource library search term */
  resourceSearch: string
  /** Resource library search setter */
  setResourceSearch: (value: string) => void
  /** Resources filtered by type + search */
  filteredResources: Resource[]
}

/**
 * AHSPComponentsTable Component — Step 2 component analysis.
 */
export function AHSPComponentsTable({
  components,
  resources,
  manualComponents,
  onAddManualComponent,
  onUpdateManualComponent,
  onDeleteManualComponent,
  onUpdateComponent,
  onDeleteComponent,
  onAddResource,
  selectedComponentType,
  setSelectedComponentType,
  resourceSearch,
  setResourceSearch,
  filteredResources,
}: AHSPComponentsTableProps) {
  return (
    <div className="min-h-[600px] border-b border-border bg-background lg:col-[1]">
      <div className="px-4 sm:px-6 lg:px-8 py-5 bg-card border-b border-border flex items-center gap-3">
        <div className="bg-amber-500/10 p-2 rounded-xl ring-1 ring-amber-500/20">
          <Calculator className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-display font-bold text-base text-foreground uppercase tracking-wide">Analisa Komponen</h3>
          <p className="text-xs text-muted-foreground font-medium">Struktur rincian biaya pekerjaan</p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-border bg-background flex items-center justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddManualComponent}
            className="h-8 px-3 rounded-lg border-border text-blue-600 hover:bg-blue-500/10 hover:border-blue-400/50 font-bold text-xs dark:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Komponen Kustom
          </Button>
        </div>

        <div className="p-4 md:p-6 min-h-[400px]">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table className="w-full min-w-[680px]">
                <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border">
                  <TableRow className="hover:bg-transparent border-0">
                    <TableHead className="w-24 text-xs font-bold uppercase tracking-widest text-muted-foreground py-3 pl-6">Type</TableHead>
                    <TableHead className="min-w-[180px] text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Deskripsi Resource</TableHead>
                    <TableHead className="w-16 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Unit</TableHead>
                    <TableHead className="w-28 text-right text-xs font-bold uppercase tracking-widest text-muted-foreground py-3">Rate</TableHead>
                    <TableHead className="w-24 text-center text-xs font-bold uppercase tracking-widest text-blue-600 py-3 bg-blue-500/5 italic dark:text-blue-400">Koef</TableHead>
                    <TableHead className="w-32 text-right text-xs font-bold uppercase tracking-widest text-amber-600 py-3 pr-6 dark:text-amber-400">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {manualComponents.length === 0 && components.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center bg-muted/30/30">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Plus className="h-10 w-10" />
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">Belum ada komponen analisa.</p>
                        <p className="text-xs text-muted-foreground">Cari resource di bawah untuk memulai analisa.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Manual Components */}
                    {manualComponents.map((comp) => (
                      <TableRow key={comp.tempId} className="group hover:bg-muted/30/30 transition-colors border-b border-border last:border-0">
                        <TableCell className="pl-6">
                          <Badge variant="secondary" className="font-semibold text-xs uppercase tracking-wider h-5 bg-muted/50 text-muted-foreground border-none">
                            {comp.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {comp.editing ? (
                            <Input
                              value={comp.resourceName}
                              onChange={(e) => onUpdateManualComponent(comp.tempId, 'resourceName', e.target.value)}
                              className="h-9 border-border rounded-lg text-sm font-bold bg-background"
                            />
                          ) : (
                            <div className="font-bold text-muted-foreground text-sm flex items-center gap-2">
                              {comp.resourceName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">{comp.unit}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatIDR(comp.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right bg-blue-50/20">
                          <Input
                            type="number"
                            value={comp.coefficient}
                            onChange={(e) => onUpdateManualComponent(comp.tempId, 'coefficient', parseFloat(e.target.value) || 0)}
                            className="h-8 py-0 text-right font-semibold border-transparent bg-transparent hover:border-border focus:bg-background focus:border-primary/40 transition-all rounded-lg"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-foreground pr-6">
                          {formatIDR(comp.coefficient * comp.unitPrice)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Hapus komponen"
                            onClick={() => onDeleteManualComponent(comp.tempId)}
                            className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-80 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Resource-based Components */}
                    {components.map((component) => (
                      <TableRow key={component.id} className="group hover:bg-accent/40/20 transition-colors border-b border-border last:border-0">
                        <TableCell className="pl-6">
                          <Badge
                            className={`font-semibold text-xs uppercase tracking-wider h-5 border-none ${component.type === 'material' ? 'bg-primary/10 text-primary' :
                              component.type === 'labor' ? 'bg-orange-100 text-orange-700' :
                                'bg-indigo-100 text-indigo-700'
                              }`}
                          >
                            {component.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const res = component.resource ?? resources.find(r => r.id === component.resourceId)
                            return (
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground text-sm">{res?.name || 'Komponen tanpa nama'}</span>
                                <span className="text-xs font-mono text-muted-foreground tracking-wide">{res?.code || '—'}</span>
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-xs text-muted-foreground uppercase">
                          {component.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatIDR(component.unitPrice)}
                        </TableCell>
                        <TableCell className="bg-blue-50/10">
                          <Input
                            type="number"
                            value={component.coefficient}
                            onChange={(e) => onUpdateComponent(component.id, 'coefficient', parseFloat(e.target.value) || 0)}
                            className="h-8 px-2 text-right font-semibold text-foreground border-transparent bg-transparent hover:border-border focus:bg-background focus:border-primary/40 transition-all rounded-lg"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-foreground pr-6">
                          {formatIDR(component.subtotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Hapus komponen"
                            onClick={() => onDeleteComponent(component.id)}
                            className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-80 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

        {/* Integrated Import / Resource Search */}
        <div className="shrink-0 p-4 sm:p-6 lg:p-8 border-t bg-card z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Integrasi Resource Library</h4>
              </div>
              <Badge variant="outline" className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-border">
                {filteredResources.length} tersedia di katalog
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedComponentType} onValueChange={(value: string) => setSelectedComponentType(value as ResourceType)}>
                <SelectTrigger className="w-full sm:w-40 h-10 rounded-lg border-border bg-muted/30 font-bold text-xs uppercase tracking-wider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-xl">
                  <SelectItem value="material" className="py-3 font-semibold">MATERIAL</SelectItem>
                  <SelectItem value="labor" className="py-3 font-semibold">LABOR / TENAGA</SelectItem>
                  <SelectItem value="equipment" className="py-3 font-semibold">EQUIPMENT / ALAT</SelectItem>
                  <SelectItem value="subcontractor" className="py-3 font-semibold">SUBCONTRACTOR</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder={`Cari resource ${selectedComponentType}...`}
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  className="h-10 pl-12 pr-4 rounded-lg border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                />
              </div>
            </div>

            {resourceSearch && filteredResources.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-background shadow-2xl max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-300 divide-y divide-border z-50 relative pointer-events-auto">
                {filteredResources.map((res) => (
                  <div
                    key={res.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-accent/40/50 cursor-pointer transition-colors group"
                    onClick={() => onAddResource(res)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground font-semibold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        {res.name[0]}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-muted-foreground text-sm group-hover:text-blue-700">{res.name}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs font-mono font-medium text-muted-foreground uppercase">{res.code}</span>
                          <div className="h-1 w-1 rounded-full bg-muted" />
                          <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground font-semibold uppercase">{res.unit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-sm font-semibold text-foreground">{formatIDR(res.unitPrice)}</span>
                      <Button size="sm" variant="ghost" className="h-8 px-4 text-xs font-semibold uppercase text-blue-600 opacity-100 transition-opacity">
                        Tambahkan
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AHSPComponentsTable
