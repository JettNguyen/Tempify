declare const Deno: { env: { get(key: string): string | undefined } }

/**
 * Update a user's subscription status for one platform and recompute is_subscribed.
 * Reads the other platform's column first so a cancelled iOS sub doesn't clear
 * an active Stripe sub (and vice versa).
 */
export async function setSubscriptionStatus(
  userId: string,
  platform: 'rc' | 'stripe',
  active: boolean,
  stripeCustomerId?: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const headers = {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  }

  // Read current state of both platform columns
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=stripe_subscribed,rc_subscribed`,
    { headers },
  )

  if (!getRes.ok) {
    throw new Error(`Failed to fetch user ${userId}: ${getRes.status}`)
  }

  const rows: Array<{ stripe_subscribed: boolean; rc_subscribed: boolean }> = await getRes.json()
  const row = rows[0]

  if (!row) {
    console.warn(`[subscription] No user found with id ${userId}`)
    return
  }

  const stripeActive = platform === 'stripe' ? active : row.stripe_subscribed
  const rcActive    = platform === 'rc'     ? active : row.rc_subscribed
  const isSubscribed = stripeActive || rcActive

  const patch: Record<string, unknown> = {
    stripe_subscribed: stripeActive,
    rc_subscribed:     rcActive,
    is_subscribed:     isSubscribed,
  }

  if (stripeCustomerId) {
    patch.stripe_customer_id = stripeCustomerId
  }

  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    { method: 'PATCH', headers, body: JSON.stringify(patch) },
  )

  if (!patchRes.ok) {
    throw new Error(`Failed to update user ${userId}: ${patchRes.status}`)
  }
}

/**
 * Find a user by their Stripe customer ID.
 * Returns the user id or null if not found.
 */
export async function findUserByStripeCustomerId(customerId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id&limit=1`,
    {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    },
  )

  if (!res.ok) return null
  const rows: Array<{ id: string }> = await res.json()
  return rows[0]?.id ?? null
}

/**
 * Find a user by email address (used as fallback when no stripe_customer_id is stored yet).
 * Returns the user id or null if not found.
 */
export async function findUserByEmail(email: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    },
  )

  if (!res.ok) return null
  const rows: Array<{ id: string }> = await res.json()
  return rows[0]?.id ?? null
}
