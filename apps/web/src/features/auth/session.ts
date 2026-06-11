import type { QueryClient } from '@tanstack/react-query'
import { installAuthInterceptors } from '../../app/api-client'
import { sessionQueryKey } from './query-options'
import type { Session } from './types'

// Handles session loss detected outside route guards — e.g. an API call
// 401ing mid-use after the session expired server-side. Both reactions are
// idempotent and non-destructive: writing the anonymous session never
// cancels an in-flight fetch, and router.invalidate() simply re-runs the
// current route's guards, which converge on the /login redirect (carrying
// the current location as the post-login redirect target).
export function installSessionExpiryHandler(
  queryClient: QueryClient,
  router: { invalidate: () => Promise<void> },
) {
  installAuthInterceptors(() => {
    queryClient.setQueryData<Session>(sessionQueryKey, { status: 'anonymous' })
    void router.invalidate()
  })
}
