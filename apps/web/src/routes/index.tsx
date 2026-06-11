import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../app/api-client'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { meQueryOptions } from '../features/auth/query-options'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      throw redirect({ to: getDefaultAuthenticatedRoute(me) })
    } catch (error) {
      if (isAuthBootstrapError(error)) {
        throw redirect({ to: '/login' })
      }

      if (isDeactivatedAccountError(error)) {
        throw redirect({ to: '/no-access' })
      }

      throw error
    }
  },
})
