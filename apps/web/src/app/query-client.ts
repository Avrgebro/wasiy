import { MutationCache, QueryClient } from '@tanstack/react-query'
import { i18next } from '../i18n'
import { getErrorMessage } from '../lib/errors'
import { notifyError } from '../lib/notify'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      // Set on mutations whose callers already surface errors in the UI
      // (forms, inline alerts) so failures are not reported twice.
      suppressErrorNotification?: boolean
    }
  }
}

/** Errors stay longer than the default four seconds: they carry a sentence to read. */
export const ERROR_TOAST_AUTO_CLOSE = 8000

export const queryClient = new QueryClient({
  // The one place a failed mutation becomes a toast. Feature code never adds
  // its own notifyError in onError: the cache handler runs as well, and the
  // failure would show twice. Forms that render the error inline opt out
  // with the meta flag.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorNotification) {
        return
      }

      notifyError(getErrorMessage(error), i18next.t('errors.actionFailed'), { autoClose: ERROR_TOAST_AUTO_CLOSE })
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})
