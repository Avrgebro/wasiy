import type { LayoutNavEntry } from '../../components/layout/shared/types'
import { CalendarIcon, Home2Icon, HouseIcon, UserCircleIcon, UserPlusRoundedIcon } from '@solar-icons/react/dynamic'
import type { MeResponse } from '../auth/types'
import { filterNavigationEntries, type NavEntrySpec } from '../navigation/spec'

/** The portal's tab bar (five destinations since P4). */
const portalNavigation: NavEntrySpec[] = [
  { icon: Home2Icon, labelKey: 'portal.tabs.home', to: '/portal' },
  { icon: UserPlusRoundedIcon, labelKey: 'portal.tabs.visits', to: '/portal/visitas' },
  { icon: CalendarIcon, labelKey: 'portal.tabs.reservations', to: '/portal/reservas' },
  { icon: HouseIcon, labelKey: 'portal.tabs.myUnit', to: '/portal/mi-unidad' },
  { icon: UserCircleIcon, labelKey: 'portal.tabs.profile', to: '/portal/perfil' },
]

export function getPortalNavigation(me: MeResponse): LayoutNavEntry[] {
  return filterNavigationEntries(portalNavigation, me)
}
