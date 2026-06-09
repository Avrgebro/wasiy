import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthBootstrapError } from '../app/api-client'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { LoginPage } from '../features/auth/login-page'
import { meQueryOptions } from '../features/auth/query-options'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      throw redirect({ to: getDefaultAuthenticatedRoute(me) })
    } catch (error) {
      if (isAuthBootstrapError(error)) {
        return
      }

      throw error
    }
  },
  component: LoginPage,
})
