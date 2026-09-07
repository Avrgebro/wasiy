import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '../../../components/layout/shared/app-shell'
import { surfaceRouteOptions } from '../../../features/auth/surface-route'
import { getAdminNavigation } from '../../../features/navigation/admin-navigation'
import { checkSubscriptionAccess } from '../../../features/subscription/subscription-guard'

const surface = surfaceRouteOptions('admin', AppShell, getAdminNavigation)

export const Route = createFileRoute('/_authenticated/admin')({
  ...surface,
  // Runs on every navigation under /admin: a lapsed Account only reaches the
  // subscription page (ADR 0039).
  beforeLoad: ({ context, location }) => {
    surface.beforeLoad({ context })
    checkSubscriptionAccess(context.me, location.pathname)
  },
})
