import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { SURFACE } from '../../app/surface'
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
  if (SURFACE === 'admin' && requiresAccountSelection(me)) {
    // href, not to: the route exists only in the staff tree.
    throw redirectWithinSurface('/select-account')
  }

  if (!canAccess(me)) {
    throw redirectToLanding(me)
  }
}

/**
 * The landing page is computed per surface (ADR 0038): each build only ever
 * receives its own routes, so the redirect stays within this surface.
 */
export function redirectToLanding(me: MeResponse) {
  return redirectWithinSurface(getDefaultAuthenticatedRoute(me))
}

export type SurfaceRoute = ReturnType<typeof getDefaultAuthenticatedRoute> | '/select-account'

/**
 * A redirect to a route of this build, expressed as `to`, never `href`.
 *
 * `href` is only for the other host. Within a surface it is also unsafe: the
 * router's hover preload rebuilds a thrown redirect from its `to` and ignores
 * `href`, so an href redirect thrown from beforeLoad while preloading
 * re-resolves to the route being preloaded and recurses forever, freezing the
 * tab (front desk hovering a unit link it may not open).
 *
 * The path's type is the union across both surfaces, so it is cast here once
 * rather than typed per build; `getDefaultAuthenticatedRoute` guarantees the
 * value exists on this surface.
 */
export function redirectWithinSurface(path: SurfaceRoute) {
  return redirect({ to: path as never })
}
