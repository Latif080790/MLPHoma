/**
 * toast.ts
 * Helper ringan untuk notifikasi menggunakan sonner.
 * Dipakai dari mana pun tanpa perlu mengimpor Toaster.
 */

import { toast } from 'sonner'

/** Wrapper utilitas toast dengan preset sederhana. */
export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, { description }),
  error: (message: string, description?: string) =>
    toast.error(message, { description }),
  info: (message: string, description?: string) =>
    toast(message, { description }),
  warning: (message: string, description?: string) =>
    toast.warning(message, { description }),
  promise: <T>(p: Promise<T>, messages: { loading: string; success: string; error: string }) =>
    toast.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    }),
}

export default notify
