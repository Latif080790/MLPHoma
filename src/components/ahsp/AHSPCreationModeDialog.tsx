/**
 * AHSPCreationModeDialog.tsx
 * Mode selection for creating new AHSP items (SNI/Custom/Historical)
 */

import React from 'react'
import { FileText, Wrench, History, ChevronRight, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'

export type AHSPCreationMode = 'sni' | 'custom' | 'historical'

interface AHSPCreationModeDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (mode: AHSPCreationMode) => void
}

export function AHSPCreationModeDialog({ open, onClose, onSelect }: AHSPCreationModeDialogProps) {
  const modes = [
    {
      id: 'sni' as AHSPCreationMode,
      icon: FileText,
      title: 'AHSP SNI',
      description: 'Pre-configured dengan component & coefficient dari standar SNI',
      features: [
        'Resource sudah tersedia otomatis',
        'Coefficient sudah terstandarisasi',
        'Sesuai standar nasional Indonesia',
        'Tinggal pilih dan gunakan'
      ],
      color: 'blue',
      badge: 'Recommended'
    },
    {
      id: 'custom' as AHSPCreationMode,
      icon: Wrench,
      title: 'Custom',
      description: 'Full manual entry - buat analisa dari awal',
      features: [
        'Kontrol penuh atas semua komponen',
        'Definisi resource manual',
        'Coefficient custom sesuai kebutuhan',
        'Fleksibel untuk kasus khusus'
      ],
      color: 'purple',
      badge: 'Flexible'
    },
    {
      id: 'historical' as AHSPCreationMode,
      icon: History,
      title: 'Historical',
      description: 'Gunakan data dari project sebelumnya',
      features: [
        'Ambil dari project yang sudah ada',
        'Data real dari lapangan',
        'Sudah teruji di project sebelumnya',
        'Hemat waktu analisa'
      ],
      color: 'green',
      badge: 'Proven'
    }
  ]

  const handleSelect = (mode: AHSPCreationMode) => {
    onSelect(mode)
    onClose()
  }

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-blue-200 hover:border-blue-400',
          icon: 'bg-blue-600',
          text: 'text-blue-700',
          badge: 'bg-blue-600'
        }
      case 'purple':
        return {
          bg: 'bg-purple-50 hover:bg-purple-100',
          border: 'border-purple-200 hover:border-purple-400',
          icon: 'bg-purple-600',
          text: 'text-purple-700',
          badge: 'bg-purple-600'
        }
      case 'green':
        return {
          bg: 'bg-green-50 hover:bg-green-100',
          border: 'border-green-200 hover:border-green-400',
          icon: 'bg-green-600',
          text: 'text-green-700',
          badge: 'bg-green-600'
        }
      default:
        return {
          bg: 'bg-slate-50 hover:bg-slate-100',
          border: 'border-slate-200 hover:border-slate-400',
          icon: 'bg-slate-600',
          text: 'text-slate-700',
          badge: 'bg-slate-600'
        }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-blue-600" />
            Pilih Mode Pembuatan AHSP
          </DialogTitle>
          <DialogDescription>
            Pilih metode pembuatan Analisa Harga Satuan Pekerjaan yang sesuai dengan kebutuhan Anda
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {modes.map((mode) => {
            const colors = getColorClasses(mode.color)
            const Icon = mode.icon

            return (
              <Card
                key={mode.id}
                className={`cursor-pointer transition-all duration-200 ${colors.bg} ${colors.border} border-2 hover:shadow-lg group`}
                onClick={() => handleSelect(mode.id)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col h-full">
                    {/* Icon & Badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`${colors.icon} p-3 rounded-xl text-white shadow-lg`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className={`${colors.badge} text-white text-xs font-bold px-2 py-1 rounded-full`}>
                        {mode.badge}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className={`font-bold text-lg mb-2 ${colors.text}`}>
                      {mode.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 flex-grow">
                      {mode.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-4">
                      {mode.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                          <ChevronRight className={`h-4 w-4 ${colors.text} flex-shrink-0 mt-0.5`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Select Button */}
                    <Button
                      className={`w-full ${colors.icon} hover:opacity-90 group-hover:scale-105 transition-transform`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(mode.id)
                      }}
                    >
                      Pilih {mode.title}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            <strong>Tips:</strong> Untuk pekerjaan standar, gunakan <strong>AHSP SNI</strong>. 
            Untuk kebutuhan spesial atau perhitungan khusus, gunakan <strong>Custom</strong>. 
            Untuk replikasi dari project lama, gunakan <strong>Historical</strong>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
