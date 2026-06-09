import { queryOptions } from '@tanstack/react-query'
import { getMe } from './api'

export const meQueryKey = ['auth', 'me'] as const

export function meQueryOptions() {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: getMe,
    retry: false,
  })
}
