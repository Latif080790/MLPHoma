/**
 * AHSPCreationModeDialog.tsx
 * Mode selection for creating new AHSP items (SNI/Custom/Historical)
 */

import React from 'react'
import { Database, Sparkles, History, ChevronRight, Zap, CalendarDays, Boxes, CircleDollarSign } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { formatIDR } from '../../lib/utils'

export type AHSPCreationMode = 'sni' | 'custom' | 'historical'

interface AHSPCreationModeDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (mode: AHSPCreationMode) => void
  sniItemsPreview?: Array<{
    id: string
    code: string
    name: string
    category: string
    unit: string
    finalPrice: number
    componentCount: number
    updatedAt: string
  }>
}

export function AHSPCreationModeDialog({ open, onClose, onSelect, sniItemsPreview = [] }: AHSPCreationModeDialogProps) {
  const [selectedMode, setSelectedMode] = React.useState<AHSPCreationMode>('sni')

  const averageSNIPrice = React.useMemo(() => {
    if (sniItemsPreview.length === 0) return 0
    const total = sniItemsPreview.reduce((sum, item) => sum + item.finalPrice, 0)
    return total / sniItemsPreview.length
  }, [sniItemsPreview])

  React.useEffect(() => {
    if (open) setSelectedMode('sni')
  }, [open])

  const modes = [
    {
      id: 'sni' as AHSPCreationMode,
      icon: Database,
      title: 'AHSP SNI',
      subtitle: 'Template dari Database',
      description: 'Salin dari AHSP SNI yang sudah ada di database proyek Anda',
      features: [
        'Data real dari project lain',
        'Component & coefficient teruji',
        'Hemat waktu analisa',
        'Konsisten dengan project sebelumnya'
      ],
      color: 'blue',
      badge: 'Direkomendasikan',
      cta: 'Lanjut pakai AHSP SNI'
    },
    {
      id: 'custom' as AHSPCreationMode,
      icon: Zap,
      title: 'Kustom',
      subtitle: 'Buat dari Nol',
      description: 'Buat analisa baru dengan kontrol penuh atas semua komponen',
      features: [
        'Kontrol penuh atas detail',
        'Definisi resource manual',
        'Koefisien kustom',
        'Fleksibel untuk kasus unik'
      ],
      color: 'purple',
      badge: 'Fleksibel',
      cta: 'Lanjut mode Kustom'
    },
    {
      id: 'historical' as AHSPCreationMode,
      icon: History,
      title: 'Historis',
      subtitle: 'Import dari Project Lama',
      description: 'Gunakan data historis dari project yang sudah selesai',
      features: [
        'Data aktual dari lapangan',
        'Sudah teruji dan terbukti',
        'Replikasi project sukses',
        'Benchmark untuk estimasi'
      ],
      color: 'green',
      badge: 'Terverifikasi',
      cta: 'Lanjut mode Historis'
    }
  ]

  const selectedModeData = modes.find((mode) => mode.id === selectedMode) || modes[0]

  const handleSelect = (mode: AHSPCreationMode) => {
    onSelect(mode)
    onClose()
  }

  const getColorClasses = (color: string, isActive = false) => {
    switch (color) {
      case 'blue':
        return {
          bg: isActive ? 'bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 hover:from-blue-100 hover:via-indigo-100 hover:to-blue-200',
          border: isActive ? 'border-primary/60 shadow-orange-200/40' : 'border-border hover:border-primary/40',
          icon: 'bg-gradient-to-br from-blue-600 to-indigo-700',
          text: 'text-foreground',
          badge: 'bg-primary'
        }
      case 'purple':
        return {
          bg: isActive ? 'bg-gradient-to-br from-purple-100 via-pink-100 to-purple-200' : 'bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 hover:from-purple-100 hover:via-pink-100 hover:to-purple-200',
          border: isActive ? 'border-purple-500 shadow-purple-200' : 'border-purple-300 hover:border-purple-500 hover:shadow-purple-200',
          icon: 'bg-gradient-to-br from-purple-600 to-pink-700',
          text: 'text-purple-800',
          badge: 'bg-purple-600'
        }
      case 'green':
        return {
          bg: isActive ? 'bg-gradient-to-br from-green-100 via-emerald-100 to-green-200' : 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 hover:from-green-100 hover:via-emerald-100 hover:to-green-200',
          border: isActive ? 'border-green-500 shadow-green-200' : 'border-green-300 hover:border-green-500 hover:shadow-green-200',
          icon: 'bg-gradient-to-br from-green-600 to-emerald-700',
          text: 'text-green-800',
          badge: 'bg-green-600'
        }
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-50 to-slate-100',
          border: 'border-border',
          icon: 'bg-gradient-to-br from-slate-600 to-slate-700',
          text: 'text-muted-foreground',
          badge: 'bg-muted'
        }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[95vw] !max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-3 pb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-3 shadow-md">
              <Sparkles className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
            <DialogTitle className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-lg font-bold text-transparent sm:text-lg">
              Pilih Mode Pembuatan AHSP
            </DialogTitle>
          </div>
          <DialogDescription className="mx-auto max-w-2xl px-2 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Pilih metode pembuatan Analisa Harga Satuan Pekerjaan yang sesuai dengan kebutuhan Anda
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            {modes.map((mode) => {
              const isActive = selectedMode === mode.id
              const colors = getColorClasses(mode.color, isActive)
              const Icon = mode.icon

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all duration-200 ${colors.bg} ${colors.border} ${isActive ? 'shadow-md' : 'shadow-sm'}`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className={`${colors.icon} rounded-lg p-2.5 text-white shadow-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`${colors.badge} rounded-full px-2 py-1 text-xs font-bold text-white`}>
                      {mode.badge}
                    </span>
                  </div>
                  <div className={`text-base font-bold sm:text-lg ${colors.text}`}>{mode.title}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{mode.subtitle}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{mode.description}</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            {(() => {
              const colors = getColorClasses(selectedModeData.color, true)
              const Icon = selectedModeData.icon

              return (
                <>
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`${colors.icon} rounded-lg p-3 text-white shadow-md`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold ${colors.text}`}>{selectedModeData.title}</h3>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{selectedModeData.subtitle}</p>
                      </div>
                    </div>
                    <Badge className={`${colors.badge} text-white`}>{selectedModeData.badge}</Badge>
                  </div>

                  <ul className="mb-4 grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
                    {selectedModeData.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <ChevronRight className={`mt-0.5 h-4 w-4 ${colors.text} flex-shrink-0`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {selectedMode === 'sni' && (
                    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary">Sumber dari Total AHSP Item</p>
                        <Badge variant="outline" className="border-primary/40 text-primary">{sniItemsPreview.length} item</Badge>
                      </div>

                      {sniItemsPreview.length > 0 && (
                        <div className="mb-3 grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-border bg-card p-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">Rata-rata Harga</p>
                            <p className="text-xs font-bold text-muted-foreground">{formatIDR(averageSNIPrice)}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-card p-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">Total Komponen</p>
                            <p className="text-xs font-bold text-muted-foreground">
                              {sniItemsPreview.reduce((sum, item) => sum + item.componentCount, 0)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                        {sniItemsPreview.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-primary/30 bg-card p-3">
                            <p className="text-xs text-primary">Belum ada data AHSP SNI aktif.</p>
                            <p className="mt-1 text-xs text-muted-foreground">Gunakan mode Kustom untuk membuat item pertama, lalu tandai sebagai SNI.</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-8 border-primary/40 text-primary"
                              onClick={() => setSelectedMode('custom')}
                            >
                              Pindah ke Kustom
                            </Button>
                          </div>
                        ) : (
                          sniItemsPreview.map((item) => (
                            <div key={item.id} className="rounded-lg border border-border bg-card p-2.5">
                              <p className="text-xs font-bold text-foreground">{item.code} - {item.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded bg-muted/50 px-1.5 py-0.5">{item.category}</span>
                                <span>{item.unit}</span>
                                <span className="flex items-center gap-1"><CircleDollarSign className="h-3 w-3" />{formatIDR(item.finalPrice)}</span>
                                <span className="flex items-center gap-1"><Boxes className="h-3 w-3" />{item.componentCount} komponen</span>
                                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(item.updatedAt).toLocaleDateString('id-ID')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    className={`h-11 w-full ${colors.icon} text-white hover:opacity-95`}
                    onClick={() => handleSelect(selectedMode)}
                  >
                    {selectedModeData.cta}
                  </Button>
                </>
              )
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
