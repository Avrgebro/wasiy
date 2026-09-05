import { Widget } from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
import type { MeResponse } from '../auth/types'
import { filterNavigationEntries, type NavEntrySpec } from '../navigation/spec'

/** The portal's tabs (P1 grows this to Inicio, Visitas, Reservas, Mi unidad, Perfil). */
const portalNavigation: NavEntrySpec[] = [
  {
    type: 'group',
    titleKey: 'navGroups.portal',
    items: [{ icon: Widget, labelKey: 'nav.home', to: '/portal' }],
  },
]

export function getPortalNavigation(me: MeResponse): LayoutNavEntry[] {
  return filterNavigationEntries(portalNavigation, me)
}
