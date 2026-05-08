import { isNativeApp } from './oauth'

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'

// Guard: only call Purchases.configure once per app session.
// Re-configuring while a StoreKit transaction is in progress can silently cancel it.
let _rcConfigured = false

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
  if (_rcConfigured) {
    console.info('[RevenueCat] SDK already configured, skipping')
    return true
  }

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

  _rcConfigured = true
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
  await initRevenueCat()

  const { PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui')
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

  const { PAYWALL_RESULT } = await import('@revenuecat/purchases-capacitor-ui')
  const RevenueCatUI = await getPurchasesUiSdk()

  console.info('[RevenueCat] Presenting paywall if needed', { entitlementId })
  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: entitlementId,
  })
  console.info('[RevenueCat] Paywall-if-needed result', {
    result,
    PURCHASED: PAYWALL_RESULT.PURCHASED,
    RESTORED: PAYWALL_RESULT.RESTORED,
    isPurchased: result === PAYWALL_RESULT.PURCHASED,
    isRestored: result === PAYWALL_RESULT.RESTORED,
  })

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
  // Ensure SDK is configured even if called outside the normal auth flow
  await initRevenueCat()
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

/**
 * Returns the management URL for the current user's subscription.
 * RC provides this directly in CustomerInfo; falls back to the Apple URL.
 * This is an https:// URL that Apple's universal link handling routes to the
 * App Store Subscriptions page when opened via SFSafariViewController.
 */
export async function getNativeManageSubscriptionsUrl() {
  try {
    const customerInfo = await getCustomerInfo()
    if (customerInfo?.managementURL) return customerInfo.managementURL
  } catch {
    // fall through to default
  }
  return APPLE_SUBSCRIPTIONS_URL
}

/**
 * Opens Apple's native in-app refund request flow for the active entitlement.
 * Shows a system sheet inside the app — no browser required.
 */
export async function requestRefundForActiveEntitlement() {
  if (!usesNativeIap()) throw new Error('Refunds are only available in the mobile app.')
  await initRevenueCat()
  const { Purchases } = await getPurchasesSdk()
  const { status } = await Purchases.beginRefundRequestForActiveEntitlement()
  return status
}


// ── Legacy compatibility ──────────────────────────────────────────────────────
// AuthContext calls this; keep it working with the new implementation.

export async function getNativePremiumStatus() {
  return checkPremiumEntitlement()
}

