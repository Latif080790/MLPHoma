/**
 * pushService.ts
 * Manages browser Web Push subscription lifecycle.
 * Call initPushSubscription() once after user logs in.
 */

import { assertSupabase } from './supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function initPushSubscription(userId: string): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!VAPID_PUBLIC_KEY) return

    try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()

        const subscription = existing ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        })

        const json = subscription.toJSON()
        const client = assertSupabase()

        await client.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint: json.endpoint!,
            keys_p256dh: (json.keys as Record<string, string>)?.p256dh ?? '',
            keys_auth: (json.keys as Record<string, string>)?.auth ?? '',
            is_active: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,endpoint' })
    } catch {
        // Push subscription is best-effort — never block app startup
    }
}

export async function removePushSubscription(userId: string): Promise<void> {
    if (!('serviceWorker' in navigator)) return

    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
            await subscription.unsubscribe()
            const client = assertSupabase()
            await client
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('endpoint', subscription.endpoint)
        }
    } catch { /* best-effort */ }
}
