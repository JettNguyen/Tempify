// The App Store plans as Subscribe's plan cards, the same cards the web shows
// with Stripe prices. RevenueCat hands over its current offering's packages;
// prices are the App Store's own strings, in the player's currency.

const KINDS = {
  MONTHLY: {
    key: 'monthly',
    label: 'Monthly',
    unit: '/ month',
    cta: 'Subscribe monthly',
    note: () => 'Renews every month. Cancel any time.',
  },
  ANNUAL: {
    key: 'yearly',
    label: 'Yearly',
    unit: '/ year',
    cta: 'Subscribe yearly',
    note: (product) => product.pricePerMonthString
      ? `That's ${product.pricePerMonthString} a month. Renews every year.`
      : 'Renews every year. Cancel any time.',
  },
  LIFETIME: {
    key: 'lifetime',
    label: 'Lifetime',
    unit: ' once',
    cta: 'Buy lifetime',
    note: () => 'One payment. Permanent access.',
  },
}

const ORDER = ['MONTHLY', 'ANNUAL', 'LIFETIME']

/** How much a year saves over twelve months, as "Save 33%", or null. */
export function yearlySavings(monthlyPrice, yearlyPrice) {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null
  const percent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
  return percent >= 5 ? `Save ${percent}%` : null
}

/**
 * Cards for the packages: monthly, yearly, lifetime, then anything else
 * the offering holds under the product's own name.
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
    const kind = KINDS[pkg.packageType]
    if (!kind) {
      return {
        key: pkg.identifier,
        label: product.title || 'Tempify+',
        price: product.priceString,
        unit: '',
        note: product.description || '',
        badge: null,
        cta: 'Buy',
        pkg,
      }
    }
    return {
      key: kind.key,
      label: kind.label,
      price: product.priceString,
      unit: kind.unit,
      note: kind.note(product),
      badge: pkg.packageType === 'ANNUAL' ? yearlySavings(monthly?.product?.price, product.price) : null,
      cta: kind.cta,
      pkg,
    }
  })
}

/** True when a plan in the list renews, so the renewal line belongs. */
export function anyRenews(cards) {
  return cards.some((card) => card.key === 'monthly' || card.key === 'yearly')
}
