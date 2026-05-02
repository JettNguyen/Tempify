import { isNativeApp } from './oauth'

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey() {
  return import.meta.env.VITE_RC_APPLE_API_KEY || ''
}

export function getEntitlementId() {
  return import.meta.env.VITE_RC_ENTITLEMENT_ID || 'tempify_pro'
}

function validateRevenueCatConfig() {
  const apiKey = getApiKey()
  const entitlementId = getEntitlementId()

  if (!apiKey) {
    throw new Error('RevenueCat is not configured. Missing VITE_RC_APPLE_API_KEY.')
  }

  if (!apiKey.startsWith('appl_')) {
    throw new Error('RevenueCat iOS SDK key must start with appl_. Check VITE_RC_APPLE_API_KEY.')
  }

  if (!entitlementId) {
    throw new Error('RevenueCat is not configured. Missing VITE_RC_ENTITLEMENT_ID.')
  }

  if (/^(appl_|test_|prod_)/.test(entitlementId)) {
    throw new Error('VITE_RC_ENTITLEMENT_ID must be your entitlement identifier, not an API key.')
  }

  return { apiKey, entitlementId }
}

async function getPurchasesSdk() {
  const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor')
  return { Purchases, LOG_LEVEL }
}

async function getPurchasesUiSdk() {
  const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui')
  return RevenueCatUI
}

// ── Public API ────────────────────────────────────────────────────────────────

export function usesNativeIap() {
  return isNativeApp()
}

/**
 * Configure the RevenueCat SDK. Call once on app startup with the current
 * Supabase user ID so RC can link the customer to your backend.
 */
export async function initRevenueCat(appUserId = null) {
  if (!usesNativeIap()) return false

  const { apiKey } = validateRevenueCatConfig()
  const { Purchases, LOG_LEVEL } = await getPurchasesSdk()

  await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
  console.info('[RevenueCat] Configuring SDK', {
    appUserId: appUserId ?? null,
    entitlementId: getEntitlementId(),
  })

  await Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  })

  console.info('[RevenueCat] SDK configured successfully')
  return true
}

/**
 * Returns the raw RevenueCat CustomerInfo object for the current user.
 */
export async function getCustomerInfo() {
  if (!usesNativeIap()) return null
  const { Purchases } = await getPurchasesSdk()
  const { customerInfo } = await Purchases.getCustomerInfo()
  return customerInfo
}

/**
 * Returns true if the customer has an active "Tempify.me Pro" entitlement.
 */
export async function checkPremiumEntitlement() {
  if (!usesNativeIap()) return false
  try {
    const customerInfo = await getCustomerInfo()
    return Boolean(customerInfo?.entitlements?.active?.[getEntitlementId()])
  } catch {
    return false
  }
}

/**
 * Present the RC native paywall for the current offering.
 * Returns { purchased: boolean, result: PAYWALL_RESULT }.
 *
 * Use this when you always want to show the paywall (e.g. a "View Plans" button).
 */
export async function presentPaywall() {
  if (!usesNativeIap()) throw new Error('Paywall is only available in the mobile app.')
  validateRevenueCatConfig()

  const { PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor')
  const RevenueCatUI = await getPurchasesUiSdk()

  console.info('[RevenueCat] Presenting paywall')
  const { result } = await RevenueCatUI.presentPaywall()
  console.info('[RevenueCat] Paywall result', { result })

  return {
    purchased: result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED,
    result,
  }
}

/**
 * Present the paywall only if the user doesn't already hold the entitlement.
 * Returns { purchased: boolean, result: PAYWALL_RESULT }.
 *
 * Use this to gate premium features — it silently skips the paywall for
 * subscribers while showing it to free users.
 */
export async function presentPaywallIfNeeded() {
  if (!usesNativeIap()) throw new Error('Paywall is only available in the mobile app.')
  const { entitlementId } = validateRevenueCatConfig()

  const { PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor')
  const RevenueCatUI = await getPurchasesUiSdk()

  console.info('[RevenueCat] Presenting paywall if needed', { entitlementId })
  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: entitlementId,
  })
  console.info('[RevenueCat] Paywall-if-needed result', { result })

  return {
    purchased: result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED,
    result,
  }
}

/**
 * Restore prior App Store purchases and return whether the entitlement is
 * now active. Required by Apple — always expose this to users.
 */
export async function restorePurchases() {
  if (!usesNativeIap()) throw new Error('Restore is only available in the mobile app.')
  const { entitlementId } = validateRevenueCatConfig()
  const { Purchases } = await getPurchasesSdk()
  const { customerInfo } = await Purchases.restorePurchases()
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId])
}

/**
 * Fetch all current offerings from RevenueCat.
 * Offerings contain your Lifetime / Yearly / Monthly packages.
 */
export async function getOfferings() {
  if (!usesNativeIap()) return null
  validateRevenueCatConfig()
  const { Purchases } = await getPurchasesSdk()
  const offerings = await Purchases.getOfferings()
  console.info('[RevenueCat] Offerings loaded', {
    hasCurrent: Boolean(offerings?.current),
    packageCount: offerings?.current?.availablePackages?.length ?? 0,
  })
  return offerings
}

/** Deep link to the Apple subscription management screen. */
export function getNativeManageSubscriptionsUrl() {
  return APPLE_SUBSCRIPTIONS_URL
}

// ── Legacy compatibility ──────────────────────────────────────────────────────
// AuthContext calls this; keep it working with the new implementation.

export async function getNativePremiumStatus() {
  return checkPremiumEntitlement()
}

