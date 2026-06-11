import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { PortalLayout } from '../../components/layout/portal/portal-layout'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../../app/api-client'
import {
  canAccessPortal,
  getAvailableNavigationItems,
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../../features/auth/access'
import { useMe } from '../../features/auth/hooks'
import { meQueryOptions } from '../../features/auth/query-options'

export const Route = createFileRoute('/portal')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      if (requiresAccountSelection(me)) {
        throw redirect({ to: '/select-account' })
      }

      if (!canAccessPortal(me)) {
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
  component: PortalRouteLayout,
})

function PortalRouteLayout() {
  const meQuery = useMe()
  const navItems = meQuery.data
    ? getAvailableNavigationItems(meQuery.data, 'portal')
    : []

  return (
    <PortalLayout navItems={navItems}>
      <Outlet />
    </PortalLayout>
  )
}
