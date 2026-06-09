import { Calendar, KeySquare, Magnifier, UserCheckRounded } from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'

export const frontDeskNavItems: LayoutNavEntry[] = [
  {
    type: 'group',
    titleKey: 'navGroups.frontDesk',
    items: [
      { icon: UserCheckRounded, labelKey: 'nav.checkIn', to: '/front-desk' },
      { icon: KeySquare, labelKey: 'nav.todaysVisitors', to: '/front-desk/visitors' },
      { icon: Magnifier, labelKey: 'nav.unitLookup', to: '/front-desk/units' },
      { icon: Calendar, labelKey: 'nav.reservations', to: '/front-desk/reservations' },
    ],
  },
]
