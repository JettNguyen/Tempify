import { setSubscriptionStatus } from '../_shared/subscription.ts'

declare const Deno: { env: { get(key: string): string | undefined } }

// These event types mean the entitlement is now active.
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
])

// These event types mean the entitlement has ended immediately.
const INACTIVE_EVENTS = new Set([
  'EXPIRATION', // billing period ended after cancellation
  'REFUND',     // Apple issued a refund — immediate revocation
])

// CANCELLATION: user cancelled but access continues until period end.
//   RC fires EXPIRATION when access actually ends — we handle that instead.
// BILLING_ISSUE: grace period still active; EXPIRATION fires if unresolved.
//   Both are intentionally ignored here.

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  // RevenueCat sends the shared secret as a bare Authorization header value.
  const rcSecret = Deno.env.get('RC_WEBHOOK_SECRET')
  if (!rcSecret) {
    console.error('[rc-webhook] RC_WEBHOOK_SECRET env var not set')
    return json({ error: 'misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader !== rcSecret) {
    console.warn('[rc-webhook] Rejected: invalid Authorization header')
    return json({ error: 'unauthorized' }, 401)
  }

  let body: { event?: { type?: string; app_user_id?: string } }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const event = body?.event
  if (!event?.type) {
    return json({ error: 'missing_event_type' }, 400)
  }

  const { type, app_user_id: appUserId } = event

  if (!appUserId) {
    // RC anonymous user — no Supabase account to update.
    console.warn(`[rc-webhook] ${type} has no app_user_id, skipping`)
    return json({ ok: true, skipped: 'no_app_user_id' })
  }

  if (ACTIVE_EVENTS.has(type)) {
    await setSubscriptionStatus(appUserId, 'rc', true)
    console.info(`[rc-webhook] ${type} → rc_subscribed=true  user=${appUserId}`)
  } else if (INACTIVE_EVENTS.has(type)) {
    await setSubscriptionStatus(appUserId, 'rc', false)
    console.info(`[rc-webhook] ${type} → rc_subscribed=false user=${appUserId}`)
  } else {
    console.info(`[rc-webhook] Ignoring event type: ${type}`)
  }

  return json({ ok: true })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
