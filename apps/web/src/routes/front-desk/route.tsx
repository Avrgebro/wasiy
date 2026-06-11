import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { FrontDeskLayout } from '../../components/layout/front-desk/front-desk-layout'
import { isAuthBootstrapError } from '../../app/api-client'
import {
  canAccessFrontDesk,
  getAvailableNavigationItems,
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../../features/auth/access'
import { useMe } from '../../features/auth/hooks'
import { meQueryOptions } from '../../features/auth/query-options'

export const Route = createFileRoute('/front-desk')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions())

      if (requiresAccountSelection(me)) {
        throw redirect({ to: '/select-account' })
      }

      if (!canAccessFrontDesk(me)) {
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
