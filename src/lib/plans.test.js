import { describe, it, expect } from 'vitest'
import { planCards, yearlySavings, startingPlan } from './plans.js'

const pkg = (packageType, price, extra = {}) => ({
  identifier: `$rc_${packageType.toLowerCase()}`,
  packageType,
  product: { priceString: `$${price}`, price, ...extra },
})

const store = [
  pkg('LIFETIME', 99.99),
  pkg('MONTHLY', 9.99),
  pkg('ANNUAL', 79.99, { pricePerMonthString: '$6.66' }),
]

describe('the App Store plans as a picker', () => {
  it('leads with yearly, then monthly, then lifetime', () => {
    expect(planCards(store).map((card) => card.key)).toEqual(['yearly', 'monthly', 'lifetime'])
  })

  it('gives each plan its own line and a button that names the price', () => {
    const [yearly, monthly, lifetime] = planCards(store)
    expect(yearly).toMatchObject({
      price: '$79.99',
      badge: 'Save 33%',
      detail: '$6.66 a month, billed once a year',
      cta: 'Subscribe for $79.99 a year',
      renews: 'Renews every year until you cancel.',
    })
    expect(monthly).toMatchObject({ detail: 'Billed every month', cta: 'Subscribe for $9.99 a month', badge: null })
    expect(lifetime).toMatchObject({ unit: 'once', cta: 'Buy lifetime for $99.99', renews: null })
  })

  it('works out the saving from the monthly price, not a fixed number', () => {
    expect(yearlySavings(9.99, 79.99)).toBe('Save 33%')
    expect(yearlySavings(3, 25)).toBe('Save 31%')
    expect(yearlySavings(10, 118)).toBe(null)
    expect(yearlySavings(null, 79.99)).toBe(null)
    expect(planCards([pkg('ANNUAL', 79.99)])[0]).toMatchObject({ badge: null, detail: 'Billed once a year' })
  })

  it('keeps a plan it has no words for, under its own name', () => {
    const [card] = planCards([pkg('WEEKLY', 2.99, { title: 'Tempify+ Weekly' })])
    expect(card).toMatchObject({ label: 'Tempify+ Weekly', price: '$2.99', cta: 'Buy for $2.99' })
  })

  it('skips a package the store sent without a price', () => {
    expect(planCards([{ packageType: 'MONTHLY', product: {} }, null])).toEqual([])
    expect(planCards(undefined)).toEqual([])
  })

  it('starts on yearly, or the first plan when there is no yearly', () => {
    expect(startingPlan(planCards(store))).toBe('yearly')
    expect(startingPlan(planCards([pkg('MONTHLY', 9.99), pkg('LIFETIME', 99.99)]))).toBe('monthly')
    expect(startingPlan([])).toBe(null)
  })
})
