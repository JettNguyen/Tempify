// The App Store plans as Subscribe's plan picker, the same picker the web
// shows with Stripe prices. RevenueCat hands over its current offering's
// packages; prices are the App Store's own strings, in the player's currency.

const KINDS = {
  ANNUAL: {
    key: 'yearly',
    label: 'Yearly',
    unit: '/ year',
    detail: (product) => product.pricePerMonthString
      ? `${product.pricePerMonthString} a month, billed once a year`
      : 'Billed once a year',
    cta: (price) => `Subscribe for ${price} a year`,
    renews: 'Renews every year until you cancel.',
  },
  MONTHLY: {
    key: 'monthly',
    label: 'Monthly',
    unit: '/ month',
    detail: () => 'Billed every month',
    cta: (price) => `Subscribe for ${price} a month`,
    renews: 'Renews every month until you cancel.',
  },
  LIFETIME: {
    key: 'lifetime',
    label: 'Lifetime',
    unit: 'once',
    detail: () => 'Pay once and keep it',
    cta: (price) => `Buy lifetime for ${price}`,
    renews: null,
  },
}

// Yearly leads and starts chosen: it's the plan most players should pick.
const ORDER = ['ANNUAL', 'MONTHLY', 'LIFETIME']

/** How much a year saves over twelve months, as "Save 33%", or null. */
export function yearlySavings(monthlyPrice, yearlyPrice) {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null
  const percent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
  return percent >= 5 ? `Save ${percent}%` : null
}

/**
 * Plans for the packages: yearly, monthly, lifetime, then anything else the
 * offering holds under the product's own name.
 */
export function planCards(packages) {
  const list = (packages || []).filter((pkg) => pkg?.product?.priceString)
  const monthly = list.find((pkg) => pkg.packageType === 'MONTHLY')
  const rank = (pkg) => {
    const i = ORDER.indexOf(pkg.packageType)
    return i === -1 ? ORDER.length : i
  }

  return [...list].sort((a, b) => rank(a) - rank(b)).map((pkg) => {
    const { product } = pkg
    const price = product.priceString
    const kind = KINDS[pkg.packageType]
    if (!kind) {
      return {
        key: pkg.identifier,
        label: product.title || 'Tempify+',
        price,
        unit: '',
        detail: product.description || '',
        badge: null,
        cta: `Buy for ${price}`,
        renews: null,
        pkg,
      }
    }
    return {
      key: kind.key,
      label: kind.label,
      price,
      unit: kind.unit,
      detail: kind.detail(product),
      badge: pkg.packageType === 'ANNUAL' ? yearlySavings(monthly?.product?.price, product.price) : null,
      cta: kind.cta(price),
      renews: kind.renews,
      pkg,
    }
  })
}

/** The plan to start on: yearly when there is one, else the first. */
export function startingPlan(cards) {
  return (cards.find((card) => card.key === 'yearly') || cards[0])?.key ?? null
}
