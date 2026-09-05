import { Calendar, Home2, UserCircle, UserPlusRounded } from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
import type { MeResponse } from '../auth/types'
import { filterNavigationEntries, type NavEntrySpec } from '../navigation/spec'

/** The portal's tab bar. Mi unidad joins when P4 lands. */
const portalNavigation: NavEntrySpec[] = [
  { icon: Home2, labelKey: 'portal.tabs.home', to: '/portal' },
  { icon: UserPlusRounded, labelKey: 'portal.tabs.visits', to: '/portal/visitas' },
  { icon: Calendar, labelKey: 'portal.tabs.reservations', to: '/portal/reservas' },
  { icon: UserCircle, labelKey: 'portal.tabs.profile', to: '/portal/perfil' },
]

export function getPortalNavigation(me: MeResponse): LayoutNavEntry[] {
  return filterNavigationEntries(portalNavigation, me)
}
