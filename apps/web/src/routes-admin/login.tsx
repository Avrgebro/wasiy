import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import {
  getSafeRedirectPath,
  resolveSession,
} from '../features/auth/guards'
import { LoginPage } from '../features/auth/login-page'

const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await resolveSession(context)

    if (session.status === 'deactivated') {
      throw redirect({ to: '/no-access' })
    }

    if (session.status === 'authenticated') {
      throw redirect({
        to:
          getSafeRedirectPath(search.redirect) ??
          getDefaultAuthenticatedRoute(session.me),
      })
    }
    // Anonymous visitors see the login form.
  },
  component: LoginPage,
})
