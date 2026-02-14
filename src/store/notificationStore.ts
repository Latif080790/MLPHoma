/**
 * notificationStore.ts
 * Zustand store for notification state management.
 * Connects to Supabase Realtime for live push notifications.
 */

import { create } from 'zustand'
import { notificationService } from '../services/notificationService'
import type { AppNotification, CreateNotificationInput } from '../types/notification'
import { toast } from 'sonner'

interface NotificationState {
    notifications: AppNotification[]
    unreadCount: number
    loading: boolean
    error: string | null

    // Realtime unsubscribe function
    _unsubscribe: (() => void) | null

    // Actions
    fetchNotifications: (userId: string) => Promise<void>
    fetchUnreadCount: (userId: string) => Promise<void>
    markAsRead: (notificationId: string) => Promise<void>
    markAllAsRead: (userId: string) => Promise<void>
    deleteNotification: (notificationId: string) => Promise<void>
    createNotification: (input: CreateNotificationInput) => Promise<void>

    // Realtime subscription
    subscribe: (userId: string) => void
    unsubscribe: () => void

    // Local helpers
    addNotification: (notification: AppNotification) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    _unsubscribe: null,

    fetchNotifications: async (userId: string) => {
        set({ loading: true, error: null })
        try {
            const data = await notificationService.getNotifications(userId)
            const unreadCount = data.filter(n => !n.isRead).length
            set({ notifications: data, unreadCount, loading: false })
        } catch (err: any) {
            set({ error: err.message, loading: false })
        }
    },

    fetchUnreadCount: async (userId: string) => {
        try {
            const count = await notificationService.getUnreadCount(userId)
            set({ unreadCount: count })
        } catch (err: any) {
            console.warn('Failed to fetch unread count:', err)
        }
    },

    markAsRead: async (notificationId: string) => {
        try {
            await notificationService.markAsRead(notificationId)
            set(state => ({
                notifications: state.notifications.map(n =>
                    n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            }))
        } catch (err: any) {
            console.warn('Failed to mark as read:', err)
        }
    },

    markAllAsRead: async (userId: string) => {
        try {
            await notificationService.markAllAsRead(userId)
            set(state => ({
                notifications: state.notifications.map(n => ({
                    ...n,
                    isRead: true,
                    readAt: n.readAt || new Date().toISOString()
                })),
                unreadCount: 0,
            }))
        } catch (err: any) {
            console.warn('Failed to mark all as read:', err)
        }
    },

    deleteNotification: async (notificationId: string) => {
        try {
            const notification = get().notifications.find(n => n.id === notificationId)
            await notificationService.deleteNotification(notificationId)
            set(state => ({
                notifications: state.notifications.filter(n => n.id !== notificationId),
                unreadCount: notification && !notification.isRead
                    ? Math.max(0, state.unreadCount - 1)
                    : state.unreadCount,
            }))
        } catch (err: any) {
            console.warn('Failed to delete notification:', err)
        }
    },

    createNotification: async (input: CreateNotificationInput) => {
        try {
            await notificationService.createNotification(input)
        } catch (err: any) {
            console.warn('Failed to create notification:', err)
        }
    },

    subscribe: (userId: string) => {
        // Prevent duplicate subscriptions
        const existing = get()._unsubscribe
        if (existing) existing()

        const unsubscribe = notificationService.subscribeToNotifications(
            userId,
            (notification) => {
                // Add to the top of the list
                get().addNotification(notification)

                // Show a toast for the new notification
                const toastType = notification.severity === 'critical'
                    ? 'error'
                    : notification.severity === 'warning'
                        ? 'warning'
                        : 'info'

                if (toastType === 'error') {
                    toast.error(notification.title, { description: notification.message })
                } else if (toastType === 'warning') {
                    toast.warning(notification.title, { description: notification.message })
                } else {
                    toast.info(notification.title, { description: notification.message })
                }
            }
        )

        set({ _unsubscribe: unsubscribe })
    },

    unsubscribe: () => {
        const unsub = get()._unsubscribe
        if (unsub) {
            unsub()
            set({ _unsubscribe: null })
        }
    },

    addNotification: (notification: AppNotification) => {
        set(state => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
        }))
    },
}))
