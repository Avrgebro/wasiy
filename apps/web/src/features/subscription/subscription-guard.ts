import { redirect } from '@tanstack/react-router'
import { isAccountAdmin, isSubscriptionLapsed } from '../auth/access'
import type { MeResponse } from '../auth/types'

export const SUBSCRIPTION_ROUTE = '/admin/subscription'
export const ACCESS_PAUSED_ROUTE = '/access-paused'

/** Where a lapsed Account lands: admins on the billing page, everyone else on the lock screen. */
export function lapsedRoute(me: MeResponse) {
  return isAccountAdmin(me) ? SUBSCRIPTION_ROUTE : ACCESS_PAUSED_ROUTE
}

/**
 * Once the active Account has lapsed, the staff surface collapses to one
 * page: the API answers 402 everywhere else (ADR 0039). Account admins get
 * the subscription page, where they can act; other staff get a lock screen
 * that says who can, since the billing page is admin-only.
 */
export function checkSubscriptionAccess(me: MeResponse, pathname: string) {
  if (!isSubscriptionLapsed(me)) return

  const target = lapsedRoute(me)
  if (pathname.replace(/\/$/, '') !== target) {
    throw redirect({ to: target })
  }
}
