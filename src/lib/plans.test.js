import { describe, it, expect } from 'vitest'
import { planCards, yearlySavings, anyRenews } from './plans.js'

const pkg = (packageType, price, extra = {}) => ({
  identifier: `$rc_${packageType.toLowerCase()}`,
  packageType,
  product: { priceString: `$${price}`, price, ...extra },
})

const store = [
  pkg('ANNUAL', 79.99, { pricePerMonthString: '$6.66' }),
  pkg('LIFETIME', 99.99),
  pkg('MONTHLY', 9.99),
]

describe('the App Store plans as cards', () => {
  it('lists monthly, yearly, then lifetime, like the web', () => {
    expect(planCards(store).map((card) => card.key)).toEqual(['monthly', 'yearly', 'lifetime'])
  })

  it("shows the store's prices and the yearly plan's monthly cost", () => {
    const [monthly, yearly, lifetime] = planCards(store)
    expect(monthly).toMatchObject({ price: '$9.99', unit: '/ month', cta: 'Subscribe monthly' })
    expect(yearly).toMatchObject({ price: '$79.99', badge: 'Save 33%', note: "That's $6.66 a month. Renews every year." })
    expect(lifetime).toMatchObject({ price: '$99.99', unit: ' once', badge: null })
  })

  it('works out the saving from the monthly price, not a fixed number', () => {
    expect(yearlySavings(9.99, 79.99)).toBe('Save 33%')
    expect(yearlySavings(3, 25)).toBe('Save 31%')
    expect(yearlySavings(10, 118)).toBe(null)
    expect(yearlySavings(null, 79.99)).toBe(null)
    expect(planCards([pkg('ANNUAL', 79.99)])[0].badge).toBe(null)
  })

  it('keeps a plan it has no words for, under its own name', () => {
    const [card] = planCards([pkg('WEEKLY', 2.99, { title: 'Tempify+ Weekly' })])
    expect(card).toMatchObject({ label: 'Tempify+ Weekly', price: '$2.99', cta: 'Buy' })
  })

  it('skips a package the store sent without a price', () => {
    expect(planCards([{ packageType: 'MONTHLY', product: {} }, null])).toEqual([])
    expect(planCards(undefined)).toEqual([])
  })

  it('knows when the renewal line belongs', () => {
    expect(anyRenews(planCards(store))).toBe(true)
    expect(anyRenews(planCards([pkg('LIFETIME', 99.99)]))).toBe(false)
  })
})
