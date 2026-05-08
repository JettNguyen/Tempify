import {
  setSubscriptionStatus,
  findUserByStripeCustomerId,
  findUserByEmail,
} from '../_shared/subscription.ts'

declare const Deno: { env: { get(key: string): string | undefined } }

// Subscription statuses that mean the customer currently has access.
const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (!webhookSecret || !stripeSecretKey) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY')
    return json({ error: 'misconfigured' }, 500)
  }

  // Read raw body — required for signature verification
  const rawBody = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret)
  if (!valid) {
    console.warn('[stripe-webhook] Rejected: invalid signature')
    return json({ error: 'invalid_signature' }, 400)
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const obj = event.data.object

  switch (event.type) {
    // ── New subscription created via payment link ─────────────────────────────
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') break

      const email = (obj.customer_details as any)?.email ?? (obj.customer_email as string) ?? null
      const stripeCustomerId = obj.customer as string | null

      if (!email) {
        console.warn('[stripe-webhook] checkout.session.completed: no customer email')
        break
      }

      const userId = await findUserByEmail(email)
      if (!userId) {
        console.warn(`[stripe-webhook] checkout.session.completed: no user found for email ${email}`)
        break
      }

      await setSubscriptionStatus(userId, 'stripe', true, stripeCustomerId ?? undefined)
      console.info(`[stripe-webhook] checkout.session.completed → stripe_subscribed=true  user=${userId}`)
      break
    }

    // ── Subscription status changed (reactivation, past_due recovery, etc.) ──
    case 'customer.subscription.updated': {
      const customerId = obj.customer as string
      const status = obj.status as string

      const userId = await resolveUserFromCustomer(customerId, stripeSecretKey)
      if (!userId) {
        console.warn(`[stripe-webhook] subscription.updated: no user for customer ${customerId}`)
        break
      }

      const active = ACTIVE_STATUSES.has(status)
      await setSubscriptionStatus(userId, 'stripe', active)
      console.info(`[stripe-webhook] subscription.updated status=${status} → stripe_subscribed=${active}  user=${userId}`)
      break
    }

    // ── Subscription ended (period end or immediate cancellation) ─────────────
    case 'customer.subscription.deleted': {
      const customerId = obj.customer as string

      const userId = await resolveUserFromCustomer(customerId, stripeSecretKey)
      if (!userId) {
        console.warn(`[stripe-webhook] subscription.deleted: no user for customer ${customerId}`)
        break
      }

      await setSubscriptionStatus(userId, 'stripe', false)
      console.info(`[stripe-webhook] subscription.deleted → stripe_subscribed=false  user=${userId}`)
      break
    }

    default:
      console.info(`[stripe-webhook] Ignoring event type: ${event.type}`)
  }

  // Always return 200 so Stripe doesn't retry events we intentionally ignore.
  return json({ ok: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find a Supabase user from a Stripe customer ID.
 * First checks the DB (fast). Falls back to fetching the customer from Stripe
 * to get their email on the first time we see this customer ID.
 */
async function resolveUserFromCustomer(
  customerId: string,
  stripeSecretKey: string,
): Promise<string | null> {
  // Try the stored customer ID first
  const userId = await findUserByStripeCustomerId(customerId)
  if (userId) return userId

  // Fallback: fetch the customer from Stripe to get their email
  const email = await getStripeCustomerEmail(customerId, stripeSecretKey)
  if (!email) return null

  const userIdByEmail = await findUserByEmail(email)
  if (userIdByEmail) {
    // Opportunistically store the customer ID for next time
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userIdByEmail)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ stripe_customer_id: customerId }),
      },
    )
  }

  return userIdByEmail
}

async function getStripeCustomerEmail(
  customerId: string,
  stripeSecretKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    })
    if (!res.ok) return null
    const customer = await res.json()
    return customer.email ?? null
  } catch {
    return null
  }
}

/**
 * Verify the Stripe webhook signature using HMAC-SHA256.
 * Implements the algorithm from https://stripe.com/docs/webhooks/signatures
 */
async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts: Record<string, string> = {}
    for (const part of sigHeader.split(',')) {
      const eq = part.indexOf('=')
      if (eq !== -1) parts[part.slice(0, eq)] = part.slice(eq + 1)
    }

    const timestamp = parts['t']
    const v1Sig = parts['v1']
    if (!timestamp || !v1Sig) return false

    const payload = `${timestamp}.${rawBody}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Stripe may send multiple v1= entries (key rotation). Check all of them.
    const v1Sigs = sigHeader.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3))
    return v1Sigs.some(s => s === computed)
  } catch {
    return false
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
