import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from './access'
import { sessionQueryOptions } from './query-options'
import type { MeResponse, Session } from './types'

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

// Resolves the cached session for a route guard. Auth states come back as
// data; only exceptional failures (network, 5xx) throw, propagating to the
// router's error boundary so a transient outage does not read as a logout.
//
// revalidateIfStale makes this stale-while-revalidate: with any session in
// the cache, guards resolve synchronously (navigation never blocks on
// /api/me) while a stale session refreshes in the background. Only the cold
// first load awaits the network. A session revoked server-side is still
// caught by the next background refresh or, immediately, by the 401
// interceptor when any API call fails.
export function resolveSession(context: GuardContext): Promise<Session> {
  return context.queryClient.ensureQueryData({
    ...sessionQueryOptions(),
    revalidateIfStale: true,
  })
}

// Guard for routes that require a signed-in, active user. Anonymous visitors
// are sent to /login (carrying the attempted location so login can return
// them there) and deactivated users to /no-access.
export async function requireAuthenticated(
  context: GuardContext,
  location?: ParsedLocation,
): Promise<MeResponse> {
  const session = await resolveSession(context)

  if (session.status === 'anonymous') {
    throw redirect({
      to: '/login',
      search: location ? { redirect: location.href } : {},
    })
  }

  if (session.status === 'deactivated') {
    throw redirect({ to: '/no-access' })
  }

  return session.me
}

// Surface-level check for routes under the _authenticated layout, which has
// already resolved `me` into route context.
export function checkSurfaceAccess(
  me: MeResponse,
  canAccess: (me: MeResponse) => boolean,
) {
  if (requiresAccountSelection(me)) {
    throw redirect({ to: '/select-account' })
  }

  if (!canAccess(me)) {
    throw redirect({ to: getDefaultAuthenticatedRoute(me) })
  }
}
