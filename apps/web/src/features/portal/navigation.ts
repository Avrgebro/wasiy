import { Home2, UserCircle, UserPlusRounded } from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
import type { MeResponse } from '../auth/types'
import { filterNavigationEntries, type NavEntrySpec } from '../navigation/spec'

/** The portal's tab bar (P1). Reservas and Mi unidad join when P2 and P4 land. */
const portalNavigation: NavEntrySpec[] = [
  { icon: Home2, labelKey: 'portal.tabs.home', to: '/portal' },
  { icon: UserPlusRounded, labelKey: 'portal.tabs.visits', to: '/portal/visitas' },
  { icon: UserCircle, labelKey: 'portal.tabs.profile', to: '/portal/perfil' },
]

export function getPortalNavigation(me: MeResponse): LayoutNavEntry[] {
  return filterNavigationEntries(portalNavigation, me)
}
