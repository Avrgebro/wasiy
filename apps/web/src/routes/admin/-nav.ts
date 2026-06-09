import {
  Buildings2,
  Calendar,
  ClipboardList,
  KeySquare,
  Speaker,
  UsersGroupRounded,
  Widget,
} from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'

export const adminNavItems: LayoutNavEntry[] = [
  {
    type: 'group',
    titleKey: 'navGroups.overview',
    items: [{ icon: Widget, labelKey: 'nav.dashboard', to: '/admin' }],
  },
  {
    type: 'group',
    titleKey: 'navGroups.operations',
    items: [
      { icon: Buildings2, labelKey: 'nav.units', to: '/admin/units' },
      {
        type: 'collapsible',
        icon: UsersGroupRounded,
        labelKey: 'nav.people',
        children: [
          { icon: UsersGroupRounded, labelKey: 'nav.residents', to: '/admin/residents' },
          { icon: KeySquare, labelKey: 'nav.visitors', to: '/admin/visitors' },
        ],
      },
      { icon: Calendar, labelKey: 'nav.reservations', to: '/admin/reservations' },
    ],
  },
  {
    type: 'group',
    titleKey: 'navGroups.communication',
    items: [
      { icon: Speaker, labelKey: 'nav.announcements', to: '/admin/announcements' },
      { icon: ClipboardList, labelKey: 'nav.activity', to: '/admin/activity' },
    ],
  },
]
