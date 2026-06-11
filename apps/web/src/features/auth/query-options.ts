import { queryOptions } from '@tanstack/react-query'
import { getMe } from './api'

export const meQueryKey = ['auth', 'me'] as const

export function meQueryOptions() {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: getMe,
    retry: false,
    // Route guards call ensureQueryData on every navigation; a short
    // staleTime avoids refetching /api/me on each route change while the
    // backend remains the authorization authority. Context mutations update
    // this cache directly from their responses.
    staleTime: 30_000,
  })
}
