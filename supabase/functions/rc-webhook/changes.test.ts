import { describe, it, expect } from 'vitest'
import { changesFor } from './changes'

const SAM = '7c1f0b3e-1111-4a2b-9c3d-000000000001'
const DANA = '7c1f0b3e-2222-4a2b-9c3d-000000000002'

describe('changesFor', () => {
  it('turns Premium on for a purchase or renewal', () => {
    for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']) {
      expect(changesFor({ type, app_user_id: SAM })).toEqual([{ userId: SAM, active: true }])
    }
  })

  it('turns it off when it runs out or is refunded', () => {
    expect(changesFor({ type: 'EXPIRATION', app_user_id: SAM })).toEqual([{ userId: SAM, active: false }])
    expect(changesFor({ type: 'REFUND', app_user_id: SAM })).toEqual([{ userId: SAM, active: false }])
  })

  it('leaves a cancellation alone until it runs out', () => {
    expect(changesFor({ type: 'CANCELLATION', app_user_id: SAM })).toEqual([])
    expect(changesFor({ type: 'BILLING_ISSUE', app_user_id: SAM })).toEqual([])
  })

  it('moves Premium with a transfer, which has no app_user_id', () => {
    expect(changesFor({ type: 'TRANSFER', transferred_from: [SAM], transferred_to: [DANA] })).toEqual([
      { userId: SAM, active: false },
      { userId: DANA, active: true },
    ])
  })

  it('skips the made-up ids of a purchase before signing in', () => {
    expect(changesFor({ type: 'TRANSFER', transferred_from: ['$RCAnonymousID:abc'], transferred_to: [SAM] }))
      .toEqual([{ userId: SAM, active: true }])
    expect(changesFor({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' })).toEqual([])
  })

  it('never turns off the account a transfer lands on', () => {
    expect(changesFor({ type: 'TRANSFER', transferred_from: [SAM], transferred_to: [SAM] }))
      .toEqual([{ userId: SAM, active: true }])
  })

  it('does nothing for an event with no one to change', () => {
    expect(changesFor({ type: 'INITIAL_PURCHASE' })).toEqual([])
    expect(changesFor({})).toEqual([])
  })
})
