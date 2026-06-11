import { queryOptions } from '@tanstack/react-query'
import { getSession } from './api'

export const sessionQueryKey = ['auth', 'session'] as const

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    // Auth states (anonymous/deactivated) resolve as data, so retry only
    // ever applies to real failures; a single transparent retry would mask
    // outages from the router's error boundary.
    retry: false,
    // Route guards call ensureQueryData on every navigation; a short
    // staleTime avoids refetching /api/me on each route change while the
    // backend remains the authorization authority. Context mutations update
    // this cache directly from their responses.
    staleTime: 30_000,
  })
}
