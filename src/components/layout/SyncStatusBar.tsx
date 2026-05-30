import React, { useState, useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SyncState = 'synced' | 'pending' | 'error' | 'offline'

interface SyncStatusBarProps {
  state?: SyncState
  pendingCount?: number
  lastSynced?: Date
}

/**
 * SyncStatusBar — WF01
 * 
 * Strip tipis h-7 di bawah header untuk status sinkronisasi data Supabase.
 * Hanya tampil saat ada pending items, error, atau offline. 
 * Bahasa: Indonesia.
 */
export function SyncStatusBar({ 
  state = 'synced', 
  pendingCount = 0, 
  lastSynced 
}: SyncStatusBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state !== 'synced' || pendingCount > 0) {
      setVisible(true)
    } else {
      // Tampilkan sebentar setelah sync berhasil lalu sembunyikan
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state, pendingCount])

  if (!visible && state === 'synced') return null

  return (
    <div 
      className={cn(
        "h-7 w-full flex items-center px-4 gap-2 text-xs font-mono font-semibold transition-colors duration-300",
        state === 'synced' && "bg-emerald-500/10 text-emerald-400",
        state === 'pending' && "bg-[rgba(34,211,238,0.07)] text-cyan-400",
        state === 'error' && "bg-[rgba(245,158,11,0.07)] text-amber-400",
        state === 'offline' && "bg-[rgba(239,68,68,0.07)] text-red-400"
      )}
    >
      {state === 'synced' && (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Tersinkron</span>
          {lastSynced && (
            <span className="opacity-50 border-l border-current pl-2 ml-1">
              {lastSynced.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </>
      )}
      {state === 'pending' && (
        <>
          <RefreshCw size={12} className="animate-spin text-cyan-400" />
          <span>Menyinkronkan{pendingCount > 0 ? ` ${pendingCount} item...` : '...'}</span>
        </>
      )}
      {state === 'error' && (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Sinkronisasi gagal · <button className="underline underline-offset-2 hover:opacity-80">Coba lagi</button></span>
        </>
      )}
      {state === 'offline' && (
        <>
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <Cloud size={12} className="text-red-400" />
          <span>Tidak ada koneksi</span>
        </>
      )}
    </div>
  )
}
