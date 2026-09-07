import { describe, expect, it } from 'vitest'
import type { MeResponse, SubscriptionSummary } from '../auth/types'
import { formatPlanMoney, monthlyTotalMinor, shouldShowBanner } from './format'
import { checkSubscriptionAccess } from './subscription-guard'

const subscription: SubscriptionSummary = {
  status: 'trialing', plan: { code: 'esencial', name: 'Esencial' }, unit_price_minor: 450, billable_units: 12, currency: 'PEN',
  trial_ends_at: '2026-09-21T12:00:00Z', access_until: '2026-09-21T12:00:00Z', days_left: 3, is_lapsed: false, contact_email: 'hola@wasiy.co',
}

function meWith(overrides: Partial<SubscriptionSummary> | null): MeResponse {
  const account = { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: overrides === null ? null : { ...subscription, ...overrides } }
  return {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Salas', name: 'Ana Salas', email: 'ana@wasiy.test' },
    accounts: [account], active_account: account, active_location: null,
    roles: { account: [], location: [] }, accessible_locations: [], resident_memberships: [],
  }
}

describe('checkSubscriptionAccess', () => {
  it('lets a live account through everywhere', () => {
    expect(() => checkSubscriptionAccess(meWith({}), '/admin/units')).not.toThrow()
    expect(() => checkSubscriptionAccess(meWith(null), '/admin/units')).not.toThrow()
  })

  it('sends a lapsed account admin to the subscription page and nowhere else', () => {
    const me = { ...meWith({ is_lapsed: true, days_left: 0 }), roles: { account: [{ account_id: 'acc_1', role: 'account_admin' as const }], location: [] } }
    expect(() => checkSubscriptionAccess(me, '/admin/units')).toThrow()
    expect(() => checkSubscriptionAccess(me, '/access-paused')).toThrow()
    expect(() => checkSubscriptionAccess(me, '/admin/subscription')).not.toThrow()
    expect(() => checkSubscriptionAccess(me, '/admin/subscription/')).not.toThrow()
  })

  it('sends other lapsed staff to the lock screen, never to billing', () => {
    const me = meWith({ is_lapsed: true, days_left: 0 })
    expect(() => checkSubscriptionAccess(me, '/admin/units')).toThrow()
    expect(() => checkSubscriptionAccess(me, '/admin/subscription')).toThrow()
    expect(() => checkSubscriptionAccess(me, '/access-paused')).not.toThrow()
  })
})

describe('format', () => {
  it('shows the banner for the last week of a trial and after a lapse only', () => {
    expect(shouldShowBanner(null)).toBe(false)
    expect(shouldShowBanner({ ...subscription, days_left: 8 })).toBe(false)
    expect(shouldShowBanner({ ...subscription, days_left: 7 })).toBe(true)
    expect(shouldShowBanner({ ...subscription, status: 'active', days_left: 2 })).toBe(false)
    expect(shouldShowBanner({ ...subscription, status: 'expired', is_lapsed: true, days_left: 0 })).toBe(true)
  })

  it('prices in the subscription currency from minor units', () => {
    expect(monthlyTotalMinor(subscription)).toBe(5400)
    expect(formatPlanMoney(5400, 'PEN').replace(/\u00a0/g, ' ')).toBe('S/ 54.00')
  })
})
