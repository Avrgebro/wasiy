import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../../app/api-client'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from './access'
import { meQueryOptions } from './query-options'
import type { MeResponse } from './types'

type GuardContext = {
  queryClient: QueryClient
}

// Only allow in-app paths as post-login redirect targets; anything absolute
// or protocol-relative could send the user off-site.
export function getSafeRedirectPath(redirectPath: string | undefined) {
  if (redirectPath?.startsWith('/') && !redirectPath.startsWith('//')) {
    return redirectPath
  }

  return null
}

// Resolves /api/me for a route guard. Unauthenticated users are sent to
// /login (carrying the attempted location so login can return them there)
// and deactivated users to /no-access. Other errors — notably network
// failures — propagate to the router's error boundary so a transient outage
// does not read as a logout.
export async function requireMe(
  context: GuardContext,
  location?: ParsedLocation,
) {
  try {
    return await context.queryClient.ensureQueryData(meQueryOptions())
  } catch (error) {
    if (isAuthBootstrapError(error)) {
      throw redirect({
        to: '/login',
        search: location ? { redirect: location.href } : {},
      })
    }

    if (isDeactivatedAccountError(error)) {
      throw redirect({ to: '/no-access' })
    }

    throw error
  }
}

export async function requireSurfaceAccess(
  context: GuardContext,
  location: ParsedLocation,
  canAccess: (me: MeResponse) => boolean,
) {
  const me = await requireMe(context, location)

  if (requiresAccountSelection(me)) {
    throw redirect({ to: '/select-account' })
  }

  if (!canAccess(me)) {
    throw redirect({ to: getDefaultAuthenticatedRoute(me) })
  }

  return me
}
