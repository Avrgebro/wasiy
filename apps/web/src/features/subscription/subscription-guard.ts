import { redirect } from '@tanstack/react-router'
import { isSubscriptionLapsed } from '../auth/access'
import type { MeResponse } from '../auth/types'

export const SUBSCRIPTION_ROUTE = '/admin/subscription'

/**
 * Once the active Account has lapsed, the staff surface collapses to the
 * subscription page: the API answers 402 everywhere else (ADR 0039). Every
 * staff role may open that page — a front desk member locked out needs to
 * see why, even though only admins can act on it.
 */
export function checkSubscriptionAccess(me: MeResponse, pathname: string) {
  if (isSubscriptionLapsed(me) && pathname.replace(/\/$/, '') !== SUBSCRIPTION_ROUTE) {
    throw redirect({ to: SUBSCRIPTION_ROUTE })
  }
}
