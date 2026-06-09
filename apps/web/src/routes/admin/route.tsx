import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminLayout } from '../../components/layout/admin/admin-layout'
import { isAuthBootstrapError } from '../../app/api-client'
import {
  canAccessAdmin,
  getDefaultAuthenticatedRoute,
} from '../../features/auth/access'
import { meQueryOptions } from '../../features/auth/query-options'
import { adminNavItems } from './-nav'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

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

      throw error
    }
  },
  component: AdminRouteLayout,
})

function AdminRouteLayout() {
  return (
    <AdminLayout navItems={adminNavItems}>
      <Outlet />
    </AdminLayout>
  )
}
