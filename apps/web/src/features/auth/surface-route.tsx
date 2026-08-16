import { Outlet } from '@tanstack/react-router'
import type { ComponentType, ReactNode } from 'react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
import type { MeResponse } from './types'
import { surfaceAccess, type Surface } from './access'
import { getSurfaceNavigation } from '../navigation/navigation'
import { checkSurfaceAccess } from './guards'
import { useMe } from './hooks'

type SurfaceLayout = ComponentType<{ children: ReactNode; navItems: LayoutNavEntry[] }>

/**
 * Route options shared by every surface route: the access guard plus a
 * layout wired to the surface's filtered navigation. File-based routing
 * still requires one createFileRoute call per surface; everything else
 * lives here.
 */
export function surfaceRouteOptions(surface: Surface, Layout: SurfaceLayout) {
  function SurfaceRouteLayout() {
    const meQuery = useMe()
    const navItems = meQuery.data ? getSurfaceNavigation(meQuery.data, surface) : []

    return (
      <Layout navItems={navItems}>
        <Outlet />
      </Layout>
    )
  }

  return {
    beforeLoad: ({ context }: { context: { me: MeResponse } }) => {
      checkSurfaceAccess(context.me, surfaceAccess[surface])
    },
    component: SurfaceRouteLayout,
  }
}
