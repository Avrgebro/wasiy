import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '../../components/layout/admin/admin-layout'
import {
  canAccessAdmin,
  getAvailableNavigationItems,
  hasAccountRole,
  accountRoles,
} from '../../features/auth/access'
import { requireSurfaceAccess } from '../../features/auth/guards'
import { useMe } from '../../features/auth/hooks'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context, location }) => {
    await requireSurfaceAccess(context, location, canAccessAdmin)
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
