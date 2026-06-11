import { Outlet, createFileRoute } from '@tanstack/react-router'
import { FrontDeskLayout } from '../../components/layout/front-desk/front-desk-layout'
import {
  canAccessFrontDesk,
  getAvailableNavigationItems,
} from '../../features/auth/access'
import { requireSurfaceAccess } from '../../features/auth/guards'
import { useMe } from '../../features/auth/hooks'

export const Route = createFileRoute('/front-desk')({
  beforeLoad: async ({ context, location }) => {
    await requireSurfaceAccess(context, location, canAccessFrontDesk)
  },
  component: FrontDeskRouteLayout,
})

function FrontDeskRouteLayout() {
  const meQuery = useMe()
  const navItems = meQuery.data
    ? getAvailableNavigationItems(meQuery.data, 'front-desk')
    : []

  return (
    <FrontDeskLayout navItems={navItems}>
      <Outlet />
    </FrontDeskLayout>
  )
}
