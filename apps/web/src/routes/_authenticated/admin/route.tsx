import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '../../../components/layout/admin/admin-layout'
import {
  canAccessAdmin,
  getAvailableNavigationItems,
} from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { useMe } from '../../../features/auth/hooks'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, canAccessAdmin)
  },
  component: AdminRouteLayout,
})

function AdminRouteLayout() {
  const meQuery = useMe()
  const navItems = meQuery.data
    ? getAvailableNavigationItems(meQuery.data, 'admin')
    : []

  return (
    <AdminLayout navItems={navItems}>
      <Outlet />
    </AdminLayout>
  )
}
