import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthBootstrapError } from '../app/api-client'
import {
  canAccessAnySurface,
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../features/auth/access'
import { NoAccessPage } from '../features/auth/no-access-page'
import { meQueryOptions } from '../features/auth/query-options'

export const Route = createFileRoute('/no-access')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      if (requiresAccountSelection(me)) {
        throw redirect({ to: '/select-account' })
      }

      if (canAccessAnySurface(me)) {
        throw redirect({ to: getDefaultAuthenticatedRoute(me) })
      }
    } catch (error) {
      if (isAuthBootstrapError(error)) {
        throw redirect({ to: '/login' })
      }

      throw error
    }
  },
  component: NoAccessPage,
})
