import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '../../components/layout/admin/admin-layout'

export const Route = createFileRoute('/admin')({
  component: AdminRouteLayout,
})

function AdminRouteLayout() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

