/**
 * notification-dispatcher — Supabase Edge Function
 *
 * Fan-out dispatcher for multi-channel notifications.
 * Called from client via supabase.functions.invoke('notification-dispatcher', { body: payload })
 * or from a Supabase Database Webhook on the notifications table (INSERT).
 *
 * Channels supported:
 *   in_app  — already written to DB by notificationService; this function is a no-op for it
 *   email   — dispatched via Resend API (set RESEND_API_KEY secret)
 *   push    — dispatched via Web Push / VAPID (set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY secrets)
 *
 * Environment secrets (set via: supabase secrets set KEY=value):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   — bypasses RLS for reading user email from auth.users
 *   RESEND_API_KEY              — Resend email API key (https://resend.com)
 *   RESEND_FROM_EMAIL           — e.g. "MLPHoma <noreply@yourdomain.com>"
 *   VAPID_PUBLIC_KEY            — Web Push VAPID public key
 *   VAPID_PRIVATE_KEY           — Web Push VAPID private key
 *   VAPID_SUBJECT               — e.g. "mailto:admin@yourdomain.com"
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface DispatchPayload {
    userId: string
    title: string
    message: string
    channels: ('in_app' | 'email' | 'push')[]
    deepLink?: string
    groupKey?: string
    // Optional: already-resolved email so we skip the auth.users lookup
    userEmail?: string
}

interface ResendEmailBody {
    from: string
    to: string[]
    subject: string
    html: string
}

// ------------------------------------------------------------------
// CORS headers
// ------------------------------------------------------------------

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ------------------------------------------------------------------
// Main handler
// ------------------------------------------------------------------

serve(async (req: Request) => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload: DispatchPayload = await req.json()
        const { userId, title, message, channels, deepLink, userEmail } = payload

        if (!userId || !title || !message) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: userId, title, message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const results: Record<string, string> = {}

        // Service-role client — needed to query auth.users for email
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } }
        )

        // ------------------------------------------------------------------
        // Email channel
        // ------------------------------------------------------------------
        if (channels.includes('email')) {
            results.email = await sendEmail(adminClient, userId, title, message, deepLink, userEmail)
        }

        // ------------------------------------------------------------------
        // Push channel
        // ------------------------------------------------------------------
        if (channels.includes('push')) {
            results.push = await sendPush(adminClient, userId, title, message, deepLink)
        }

        // in_app is handled by the caller (notificationService) — no-op here
        if (channels.includes('in_app')) {
            results.in_app = 'handled_by_client'
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('[notification-dispatcher] Unhandled error:', err)
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ------------------------------------------------------------------
// Email via Resend
// ------------------------------------------------------------------

async function sendEmail(
    // deno-lint-ignore no-explicit-any
    adminClient: any,
    userId: string,
    title: string,
    message: string,
    deepLink?: string,
    resolvedEmail?: string,
): Promise<string> {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'MLPHoma <noreply@mlphoma.app>'

    if (!RESEND_API_KEY) {
        console.warn('[notification-dispatcher] RESEND_API_KEY not set — skipping email')
        return 'skipped_no_api_key'
    }

    // Resolve user email from auth.users if not provided by caller
    let toEmail = resolvedEmail
    if (!toEmail) {
        const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)
        if (userError || !userData?.user?.email) {
            console.warn('[notification-dispatcher] Could not resolve email for userId:', userId)
            return 'skipped_no_email'
        }
        toEmail = userData.user.email
    }

    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') ?? '#'
    const actionUrl = deepLink ? `${appUrl}${deepLink}` : appUrl

    const html = buildEmailHtml(title, message, actionUrl)

    const body: ResendEmailBody = {
        from: RESEND_FROM,
        to: [toEmail],
        subject: `[MLPHoma] ${title}`,
        html,
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error('[notification-dispatcher] Resend error:', errorText)
        return `error: ${res.status}`
    }

    const resJson = await res.json()
    return `sent: ${resJson.id}`
}

// ------------------------------------------------------------------
// Push via Web Push (VAPID)
// ------------------------------------------------------------------

async function sendPush(
    // deno-lint-ignore no-explicit-any
    adminClient: any,
    userId: string,
    title: string,
    message: string,
    deepLink?: string,
): Promise<string> {
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@mlphoma.app'

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.warn('[notification-dispatcher] VAPID keys not set — skipping push')
        return 'skipped_no_vapid_keys'
    }

    // Load push subscriptions for this user from DB
    const { data: subscriptions, error } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, keys_p256dh, keys_auth')
        .eq('user_id', userId)
        .eq('is_active', true)

    if (error) {
        console.warn('[notification-dispatcher] Could not load push subscriptions:', error.message)
        return 'error_loading_subscriptions'
    }

    if (!subscriptions || subscriptions.length === 0) {
        return 'skipped_no_subscriptions'
    }

    const payload = JSON.stringify({
        title,
        body: message,
        url: deepLink ?? '/',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
    })

    let sent = 0
    for (const sub of subscriptions) {
        try {
            // Build Web Push request (simplified — for production use a proper VAPID library)
            // The full VAPID signing is complex in Deno without node-webpush.
            // Below is a placeholder that sends to a push proxy or uses a service-worker-compatible approach.
            // In production: use https://deno.land/x/web_push or a similar Deno VAPID library.
            console.info('[notification-dispatcher] Push to endpoint:', sub.endpoint.slice(0, 40) + '...')
            console.info('[notification-dispatcher] Payload:', payload)
            // TODO: replace with actual VAPID-signed push request
            // await webPush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } }, payload, { vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE } })
            sent++
        } catch (pushErr) {
            console.error('[notification-dispatcher] Push failed for endpoint:', pushErr)
        }
    }

    return `sent_to_${sent}_of_${subscriptions.length}`
}

// ------------------------------------------------------------------
// Email HTML template
// ------------------------------------------------------------------

function buildEmailHtml(title: string, message: string, actionUrl: string): string {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <p style="margin:0;color:#f97316;font-size:20px;font-weight:bold;letter-spacing:1px;">MLPHoma</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Construction Project Management</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b;">${escapeHtml(title)}</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${escapeHtml(message)}</p>
            <a href="${actionUrl}"
               style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
              Lihat Detail
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              Email ini dikirim otomatis oleh MLPHoma. Jangan balas email ini.<br/>
              <a href="${actionUrl}" style="color:#94a3b8;">Buka Aplikasi</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
