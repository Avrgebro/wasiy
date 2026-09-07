import type { SubscriptionSummary } from '../auth/types'

/** Prices travel in minor units with their currency; render them in the account's own currency. */
export function formatPlanMoney(minor: number, currency: string, locale = 'es-PE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100)
}

export function monthlyTotalMinor(subscription: SubscriptionSummary) {
  return subscription.unit_price_minor * subscription.billable_units
}

/** The banner shows for the last week of a trial and whenever access has lapsed. */
export const BANNER_DAYS = 7

export function shouldShowBanner(subscription: SubscriptionSummary | null) {
  if (!subscription) return false
  if (subscription.is_lapsed) return true

  return subscription.status === 'trialing' && subscription.days_left <= BANNER_DAYS
}
