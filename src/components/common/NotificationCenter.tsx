/**
 * NotificationCenter.tsx
 * Dropdown notification panel attached to the Bell icon in AppHeader.
 * Shows real-time notifications with severity badges, mark-as-read, and actions.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
    Bell, Check, CheckCheck, Trash2, X,
    AlertTriangle, AlertOctagon, Clock, FileCheck, CheckCircle,
    Package, ArrowRightLeft, ShieldAlert, FileEdit, Info
} from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { NotificationType, NotificationSeverity } from '../../types/notification'

const ICON_MAP: Record<NotificationType, React.ReactNode> = {
    BUDGET_WARNING: <AlertTriangle size={16} className="text-yellow-500" />,
    BUDGET_CRITICAL: <AlertOctagon size={16} className="text-red-600" />,
    SCHEDULE_ALERT: <Clock size={16} className="text-orange-500" />,
    SCHEDULE_REMINDER: <Bell size={16} className="text-blue-500" />,
    APPROVAL_REQUEST: <FileCheck size={16} className="text-purple-500" />,
    APPROVAL_RESULT: <CheckCircle size={16} className="text-green-500" />,
    MATERIAL_ALERT: <Package size={16} className="text-amber-500" />,
    TRANSFER_REQUEST: <ArrowRightLeft size={16} className="text-indigo-500" />,
    QUALITY_ALERT: <ShieldAlert size={16} className="text-red-500" />,
    CHANGE_ORDER: <FileEdit size={16} className="text-teal-500" />,
    SYSTEM_INFO: <Info size={16} className="text-slate-500" />,
    BILLING_MILESTONE: <CheckCircle size={16} className="text-green-600" />,
    SYSTEM: <Info size={16} className="text-slate-400" />,
}

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-500',
    critical: 'border-l-red-500',
}

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)

    const { user } = useAuthStore()
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        subscribe,
        unsubscribe,
    } = useNotificationStore()

    // Subscribe to realtime on mount (subscribe first, then fetch to avoid race window)
    useEffect(() => {
        if (user?.id) {
            subscribe(user.id)
            fetchNotifications(user.id)
        }
        return () => {
            unsubscribe()
        }
    }, [user?.id])

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const handleToggle = () => {
        setIsOpen(prev => !prev)
        if (!isOpen && user?.id) {
            fetchNotifications(user.id)
        }
    }

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 max-h-[520px] rounded-xl border bg-[hsl(var(--background))] shadow-2xl z-50 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && user?.id && (
                                <button
                                    onClick={() => markAllAsRead(user.id)}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck size={14} />
                                    Read all
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-md p-1 hover:bg-[hsl(var(--accent))] transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading && notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                Loading notifications...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Bell size={32} className="mb-2 opacity-30" />
                                <span className="text-sm">No notifications yet</span>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`
                                        group relative flex items-start gap-3 border-b border-l-4 px-4 py-3 transition-colors
                                        ${SEVERITY_STYLES[n.severity]}
                                        ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-[hsl(var(--accent))]'}
                                    `}
                                >
                                    {/* Icon */}
                                    <div className="mt-0.5 shrink-0">
                                        {ICON_MAP[n.type] || <Info size={16} className="text-slate-400" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm leading-tight ${!n.isRead ? 'font-semibold' : 'font-medium'}`}>
                                                {n.title}
                                            </p>
                                            {!n.isRead && (
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                        <p className="mt-1 text-xs text-muted-foreground/70">
                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: idLocale })}
                                        </p>
                                    </div>

                                    {/* Actions (on hover) */}
                                    <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                        {!n.isRead && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id) }}
                                                className="rounded-md p-1 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
                                                title="Mark as read"
                                            >
                                                <Check size={12} className="text-green-600" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id) }}
                                            className="rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} className="text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationCenter
