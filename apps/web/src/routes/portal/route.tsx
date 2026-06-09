import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../components/layout/portal/portal-layout'
import { portalNavItems } from './-nav'

export const Route = createFileRoute('/portal')({
  component: PortalRouteLayout,
})

function PortalRouteLayout() {
  return (
    <PortalLayout navItems={portalNavItems}>
      <Outlet />
    </PortalLayout>
  )
}
