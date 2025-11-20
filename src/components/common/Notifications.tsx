/**
 * Notifications.tsx
 * Enhanced notification system with action buttons, progress, and undo functionality.
 * Provides global toaster and notification utilities.
 */

import React from 'react'
import { Toaster, toast as sonnerToast } from 'sonner'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

/**
 * AppToaster - Enhanced global notification renderer
 */
export default function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      duration={4000}
      expand={false}
      offset={16}
      toastOptions={{
        className:
          'rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50',
      }}
    />
  )
}

/**
 * Enhanced notification utilities
 */

export interface NotificationOptions {
  title?: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
  important?: boolean
}

export const notify = {
  /**
   * Success notification
   */
  success(message: string, options: NotificationOptions = {}) {
    return sonnerToast.success(options.title || 'Berhasil', {
      description: message,
      duration: options.duration,
      important: options.important,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      onDismiss: options.onDismiss,
      icon: <CheckCircle2 className="h-5 w-5" />,
    })
  },

  /**
   * Error notification
   */
  error(message: string, options: NotificationOptions = {}) {
    return sonnerToast.error(options.title || 'Terjadi Kesalahan', {
      description: message,
      duration: options.duration || 5000,
      important: options.important ?? true,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      onDismiss: options.onDismiss,
      icon: <AlertCircle className="h-5 w-5" />,
    })
  },

  /**
   * Warning notification
   */
  warning(message: string, options: NotificationOptions = {}) {
    return sonnerToast.warning(options.title || 'Peringatan', {
      description: message,
      duration: options.duration,
      important: options.important,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      onDismiss: options.onDismiss,
      icon: <AlertTriangle className="h-5 w-5" />,
    })
  },

  /**
   * Info notification
   */
  info(message: string, options: NotificationOptions = {}) {
    return sonnerToast.info(options.title || 'Informasi', {
      description: message,
      duration: options.duration,
      important: options.important,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      onDismiss: options.onDismiss,
      icon: <Info className="h-5 w-5" />,
    })
  },

  /**
   * Loading notification with progress
   */
  loading(message: string, options: Omit<NotificationOptions, 'action'> = {}) {
    return sonnerToast.loading(options.title || 'Memproses...', {
      description: message,
      duration: Infinity,
      important: options.important,
    })
  },

  /**
   * Promise notification - shows loading, then success/error
   */
  promise<T>(
    promise: Promise<T>,
    options: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: Error) => string)
      duration?: number
    }
  ) {
    return sonnerToast.promise(promise, {
      loading: options.loading,
      success: options.success,
      error: options.error,
      duration: options.duration,
    })
  },

  /**
   * Dismissable notification
   */
  dismissable(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const method = type === 'success' ? this.success : type === 'error' ? this.error : type === 'warning' ? this.warning : this.info

    return method(message, {
      duration: Infinity,
      important: true,
    })
  },

  /**
   * Undo notification
   */
  undo(
    message: string,
    onUndo: () => void,
    options: Omit<NotificationOptions, 'action'> = {}
  ) {
    return sonnerToast.success(options.title || 'Tindakan Berhasil', {
      description: message,
      duration: options.duration || 5000,
      important: options.important ?? true,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
      onDismiss: options.onDismiss,
    })
  },

  /**
   * Custom notification
   */
  custom(content: React.ReactNode, options: { duration?: number; important?: boolean } = {}) {
    return sonnerToast.custom(content, {
      duration: options.duration,
      important: options.important,
    })
  },

  /**
   * Dismiss notification by ID
   */
  dismiss(id?: string | number) {
    sonnerToast.dismiss(id)
  },

  /**
   * Dismiss all notifications
   */
  dismissAll() {
    sonnerToast.dismiss()
  },
}
