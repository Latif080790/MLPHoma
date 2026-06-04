import React, { useState } from 'react'
import { AlertTriangle, RefreshCw, X, WifiOff } from 'lucide-react'
import { syncQueue } from '../../lib/supabaseSyncService'
import { useSyncStatus } from '../../hooks/useSyncStatus'

/**
 * SyncStatusBanner
 *
 * Muncul di bagian atas app jika ada task sync yang gagal ke Supabase.
 * User bisa retry semua atau dismiss banner.
 * MERIDIAN: Coral (danger) — data belum tersimpan ke server.
 */
export function SyncStatusBanner() {
  const { failedCount } = useSyncStatus()
  const [dismissed, setDismissed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Reset dismiss state jika muncul kegagalan baru
  React.useEffect(() => {
    if (failedCount > 0) setDismissed(false)
  }, [failedCount])

  if (failedCount === 0 || dismissed) return null

  async function handleRetry() {
    setRetrying(true)
    try {
      await syncQueue.retryFailedTasks()
    } finally {
      setRetrying(false)
    }
  }

  async function handleDiscard() {
    await syncQueue.clearFailedQueue()
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: 9999 }}
      className="fixed top-0 inset-x-0 flex items-center gap-3 px-4 py-2.5
                 bg-rose-950 border-b border-rose-800/60 shadow-lg
                 text-rose-200 text-sm"
    >
      {/* Icon */}
      <span className="flex-shrink-0 flex items-center justify-center
                       w-6 h-6 rounded-full bg-rose-800/60">
        <WifiOff size={13} className="text-rose-300" />
      </span>

      {/* Message */}
      <span className="flex-1 font-medium leading-tight">
        <span className="text-rose-100">
          {failedCount} perubahan belum tersimpan ke server.
        </span>{' '}
        <span className="text-rose-300 font-normal">
          Data tersimpan lokal — klik Retry untuk sinkronisasi ulang.
        </span>
      </span>

      {/* Warning badge */}
      <span className="flex-shrink-0 inline-flex items-center gap-1
                       px-2 py-0.5 rounded-full bg-rose-800/50 border border-rose-700/50
                       text-rose-300 text-xs font-mono font-semibold">
        <AlertTriangle size={10} />
        {failedCount} gagal
      </span>

      {/* Retry button */}
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex-shrink-0 inline-flex items-center gap-1.5
                   px-3 py-1 rounded text-xs font-semibold
                   bg-rose-700 hover:bg-rose-600 active:bg-rose-800
                   text-white border border-rose-600/60
                   transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Retry semua sync yang gagal"
      >
        <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Retrying…' : 'Retry'}
      </button>

      {/* Discard — drop permanently-failing tasks (e.g. invalid/duplicate data) */}
      <button
        onClick={handleDiscard}
        disabled={retrying}
        className="flex-shrink-0 inline-flex items-center gap-1
                   px-3 py-1 rounded text-xs font-semibold
                   bg-rose-900/40 hover:bg-rose-900/70
                   text-rose-200 border border-rose-700/40
                   transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Buang perubahan yang gagal sync"
        title="Buang perubahan yang gagal (tidak bisa disimpan ke server)"
      >
        Buang
      </button>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded hover:bg-rose-800/60
                   text-rose-400 hover:text-rose-200 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X size={14} />
      </button>
    </div>
  )
}
