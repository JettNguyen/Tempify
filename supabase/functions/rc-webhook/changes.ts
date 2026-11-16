// What one RevenueCat event changes: which players' App Store Premium turns
// on or off. Kept apart from the handler so it can be tested without Deno.

// These event types mean the entitlement is now active.
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
])

// These event types mean the entitlement has ended immediately.
const INACTIVE_EVENTS = new Set([
  'EXPIRATION', // billing period ended after cancellation
  'REFUND',     // Apple issued a refund, immediate revocation
])

// CANCELLATION: user cancelled but access continues until period end.
//   RC fires EXPIRATION when access actually ends, so we handle that instead.
// BILLING_ISSUE: grace period still active; EXPIRATION fires if unresolved.
//   Both are intentionally ignored here.

export type RcEvent = {
  type?: string
  app_user_id?: string
  transferred_from?: string[]
  transferred_to?: string[]
}

export type Change = { userId: string; active: boolean }

// A purchase made before signing in belongs to an id RevenueCat made up, with
// no Tempify account behind it.
function isAccount(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && !id.startsWith('$RCAnonymousID:')
}

export function changesFor(event: RcEvent): Change[] {
  const type = event.type ?? ''

  // A purchase moving between accounts, as when Restore Purchases runs signed
  // in as someone else. The event names both sides and has no app_user_id, so
  // it used to be skipped: the account it left kept Premium in the database
  // for good (its badge showed while its own app, asking RevenueCat, said no),
  // and the account it went to never had it recorded.
  if (type === 'TRANSFER') {
    const from = (event.transferred_from ?? []).filter(isAccount)
    const to = (event.transferred_to ?? []).filter(isAccount)
    return [
      ...from.filter(id => !to.includes(id)).map(userId => ({ userId, active: false })),
      ...to.map(userId => ({ userId, active: true })),
    ]
  }

  if (!isAccount(event.app_user_id)) return []
  if (ACTIVE_EVENTS.has(type)) return [{ userId: event.app_user_id, active: true }]
  if (INACTIVE_EVENTS.has(type)) return [{ userId: event.app_user_id, active: false }]
  return []
}
