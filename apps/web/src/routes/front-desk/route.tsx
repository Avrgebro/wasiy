import { Outlet, createFileRoute } from '@tanstack/react-router'
import { FrontDeskLayout } from '../../components/layout/front-desk/front-desk-layout'

export const Route = createFileRoute('/front-desk')({
  component: FrontDeskRouteLayout,
})

function FrontDeskRouteLayout() {
  return (
    <FrontDeskLayout>
      <Outlet />
    </FrontDeskLayout>
  )
}

