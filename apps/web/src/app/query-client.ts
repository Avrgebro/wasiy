import { notifications } from '@mantine/notifications'
import { MutationCache, QueryClient } from '@tanstack/react-query'
import { i18next } from '../i18n'
import { getErrorMessage } from '../lib/errors'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      // Set on mutations whose callers already surface errors in the UI
      // (forms, inline alerts) so failures are not reported twice.
      suppressErrorNotification?: boolean
    }
  }
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorNotification) {
        return
      }

      notifications.show({
        color: 'red',
        message: getErrorMessage(error),
        title: i18next.t('errors.actionFailed'),
      })
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
