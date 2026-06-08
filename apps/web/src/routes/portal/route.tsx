import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../components/layout/portal/portal-layout'

export const Route = createFileRoute('/portal')({
  component: PortalRouteLayout,
})

function PortalRouteLayout() {
  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  )
}

