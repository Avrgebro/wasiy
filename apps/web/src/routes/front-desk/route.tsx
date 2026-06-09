import { Outlet, createFileRoute } from '@tanstack/react-router'
import { FrontDeskLayout } from '../../components/layout/front-desk/front-desk-layout'
import { frontDeskNavItems } from './-nav'

export const Route = createFileRoute('/front-desk')({
  component: FrontDeskRouteLayout,
})

function FrontDeskRouteLayout() {
  return (
    <FrontDeskLayout navItems={frontDeskNavItems}>
      <Outlet />
    </FrontDeskLayout>
  )
}
