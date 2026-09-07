import { createFileRoute, redirect } from '@tanstack/react-router'
import { canAccessPortal, getDefaultAuthenticatedRoute } from '../features/auth/access'
import { redirectWithinSurface, resolveSession } from '../features/auth/guards'
import { NoAccessPage } from '../features/auth/no-access-page'

// Deliberately outside the _authenticated layout: deactivated users (whose
// guard would otherwise bounce them here in a loop) and users without portal
// access — staff on the resident host — land here, which only offers logout.
export const Route = createFileRoute('/no-access')({
  beforeLoad: async ({ context }) => {
    const session = await resolveSession(context)

    if (session.status === 'anonymous') {
      throw redirect({ to: '/login' })
    }

    if (session.status === 'authenticated' && canAccessPortal(session.me)) {
      throw redirectWithinSurface(getDefaultAuthenticatedRoute(session.me))
    }
  },
  component: NoAccessPage,
})
