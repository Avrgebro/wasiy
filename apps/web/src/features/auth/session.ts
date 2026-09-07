import type { QueryClient } from '@tanstack/react-query'
import { installAuthInterceptors } from '../../app/api-client'
import { sessionQueryKey, sessionQueryOptions } from './query-options'
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
  installAuthInterceptors(
    () => {
      queryClient.setQueryData<Session>(sessionQueryKey, { status: 'anonymous' })
      void router.invalidate()
    },
    // A 402 means the active Account lapsed since /me was last read: fetch
    // the fresh state (which now says is_lapsed) and re-run the guards, which
    // converge on the subscription page.
    () => {
      void queryClient
        .fetchQuery({ ...sessionQueryOptions(), staleTime: 0 })
        .then(() => router.invalidate(), () => undefined)
    },
  )
}
