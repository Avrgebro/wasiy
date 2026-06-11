import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../components/layout/portal/portal-layout'
import {
  canAccessPortal,
  getAvailableNavigationItems,
} from '../../features/auth/access'
import { requireSurfaceAccess } from '../../features/auth/guards'
import { useMe } from '../../features/auth/hooks'

export const Route = createFileRoute('/portal')({
  beforeLoad: async ({ context, location }) => {
    await requireSurfaceAccess(context, location, canAccessPortal)
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
