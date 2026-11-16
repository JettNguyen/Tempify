import { setSubscriptionStatus } from '../_shared/subscription.ts'
import { changesFor, type RcEvent } from './changes.ts'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response>): unknown
}

export async function handler(req: Request): Promise<Response> {
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

  let body: { event?: RcEvent }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const event = body?.event
  if (!event?.type) {
    return json({ error: 'missing_event_type' }, 400)
  }

  // ./changes.ts decides whose Premium each event turns on or off.
  const changes = changesFor(event)
  if (changes.length === 0) {
    console.info(`[rc-webhook] Nothing to change for ${event.type}`)
    return json({ ok: true, skipped: event.type })
  }

  for (const { userId, active } of changes) {
    await setSubscriptionStatus(userId, 'rc', active)
    console.info(`[rc-webhook] ${event.type} → rc_subscribed=${active}  user=${userId}`)
  }

  return json({ ok: true })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Supabase only answers requests handed to Deno.serve. A default export alone
// started the function and left every request waiting until it timed out.
Deno.serve(handler)
