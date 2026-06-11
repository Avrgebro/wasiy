import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  canAccessAnySurface,
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../features/auth/access'
import { resolveSession } from '../features/auth/guards'
import { NoAccessPage } from '../features/auth/no-access-page'

// Deliberately outside the _authenticated layout: deactivated users (whose
// guard would otherwise bounce them here in a loop) and users without any
// surface both land on this page, which only offers logout.
export const Route = createFileRoute('/no-access')({
  beforeLoad: async ({ context }) => {
    const session = await resolveSession(context)

    if (session.status === 'anonymous') {
      throw redirect({ to: '/login' })
    }

    if (session.status === 'authenticated') {
      if (requiresAccountSelection(session.me)) {
        throw redirect({ to: '/select-account' })
      }

      if (canAccessAnySurface(session.me)) {
        throw redirect({ to: getDefaultAuthenticatedRoute(session.me) })
      }
    }
  },
  component: NoAccessPage,
})
