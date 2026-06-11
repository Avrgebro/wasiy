import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../app/api-client'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../features/auth/access'
import { SelectAccountPage } from '../features/auth/select-account-page'
import { meQueryOptions } from '../features/auth/query-options'

export const Route = createFileRoute('/select-account')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      if (!requiresAccountSelection(me)) {
        throw redirect({ to: getDefaultAuthenticatedRoute(me) })
      }
    } catch (error) {
      if (isAuthBootstrapError(error)) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href },
        })
      }

      if (isDeactivatedAccountError(error)) {
        throw redirect({ to: '/no-access' })
      }

      throw error
    }
  },
  component: SelectAccountPage,
})
