import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../app/api-client'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { getSafeRedirectPath } from '../features/auth/guards'
import { LoginPage } from '../features/auth/login-page'
import { meQueryOptions } from '../features/auth/query-options'

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      throw redirect({
        to:
          getSafeRedirectPath(search.redirect) ??
          getDefaultAuthenticatedRoute(me),
      })
    } catch (error) {
      if (isAuthBootstrapError(error)) {
        return
      }

      if (isDeactivatedAccountError(error)) {
        throw redirect({ to: '/no-access' })
      }

      throw error
    }
  },
  component: LoginPage,
})
