import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminLayout } from '../../components/layout/admin/admin-layout'
import {
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from '../../app/api-client'
import {
  canAccessAdmin,
  getAvailableNavigationItems,
  getDefaultAuthenticatedRoute,
  hasAccountRole,
  accountRoles,
  requiresAccountSelection,
} from '../../features/auth/access'
import { useMe } from '../../features/auth/hooks'
import { meQueryOptions } from '../../features/auth/query-options'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      if (requiresAccountSelection(me)) {
        throw redirect({ to: '/select-account' })
      }

      if (!canAccessAdmin(me)) {
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
  component: AdminRouteLayout,
})

function AdminRouteLayout() {
  const meQuery = useMe()
  const navItems = meQuery.data
    ? getAvailableNavigationItems(meQuery.data, 'admin')
    : []
  const roleLabelKey =
    meQuery.data && hasAccountRole(meQuery.data, accountRoles.accountAdmin)
      ? 'roles.accountAdmin'
      : 'roles.locationManager'

  return (
    <AdminLayout navItems={navItems} roleLabelKey={roleLabelKey}>
      <Outlet />
    </AdminLayout>
  )
}
