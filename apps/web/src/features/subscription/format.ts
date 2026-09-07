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

const SHORT_DAY = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })
const SHORT_DAY_YEAR = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Lima' })

/** "5 set – 4 oct 2026": a billing period on one line. */
export function formatPeriod(startsOn: string, endsOn: string) {
  const clean = (value: string) => value.replace('.', '')
  return `${clean(SHORT_DAY.format(new Date(`${startsOn}T12:00:00`)))} – ${clean(SHORT_DAY_YEAR.format(new Date(`${endsOn}T12:00:00`)))}`
}

/** "21 de setiembre": the day the state card leads with. */
export function formatLongDay(value: string) {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(new Date(value))
}
