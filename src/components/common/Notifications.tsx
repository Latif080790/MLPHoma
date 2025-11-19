/**
 * Notifications.tsx
 * Menyediakan komponen Toaster (sonner) untuk notifikasi global.
 * Letakkan satu kali di root aplikasi.
 */

import React from 'react'
import { Toaster } from 'sonner'

/**
 * AppToaster
 * Renderer global untuk notifikasi (sonner).
 */
export default function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      duration={3500}
      expand={false}
      offset={16}
      toastOptions={{
        className:
          'rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50',
      }}
    />
  )
}
