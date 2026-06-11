import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../../components/layout/portal/portal-layout'
import {
  canAccessPortal,
  getAvailableNavigationItems,
} from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { useMe } from '../../../features/auth/hooks'

export const Route = createFileRoute('/_authenticated/portal')({
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, canAccessPortal)
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
